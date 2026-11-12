import { config } from '../config.js';
import type { Catalog, LogLine } from '../schemas.js';
import { closest, escapeRegex, toRegExp } from '../utils.js';
import {
  allFieldNames, analyzeText, eat, fail, isNumeric, rest, skipWs, sourceOf, tokensOf, valueOf,
  type Cursor, type Diagnostic, type Span, type SynKind, type SynToken,
} from './common.js';

// Lucene: syntax
type Occur = 'must' | 'should' | 'mustNot';
type Conj = 'and' | 'or' | null;
type Mod = 'req' | 'not' | null;
export type LuceneValue =
  | { readonly kind: 'text'; readonly text: string; readonly quoted: boolean; readonly pattern: string | null }
  | { readonly kind: 'regex'; readonly source: string }
  | { readonly kind: 'range'; readonly lo: string | null; readonly hi: string | null; readonly loInc: boolean; readonly hiInc: boolean };
export type LuceneNode =
  | { readonly kind: 'bool'; readonly clauses: readonly LuceneClause[]; readonly span: Span }
  | { readonly kind: 'term'; readonly field: string | null; readonly fieldSpan: Span | null; readonly value: LuceneValue; readonly span: Span };
export interface LuceneClause {
  readonly occur: Occur;
  readonly conj: Conj;
  readonly mod: Mod;
  readonly node: LuceneNode;
  readonly span: Span;
}
type DraftClause = Omit<LuceneClause, 'occur'>;

const TERM_RE = /^(?:\\[\s\S]|[^\s()[\]{}:"^~/\\])+/;
const unescape = (s: string) => s.replace(/\\([\s\S])/g, '$1');
const wordAhead = (c: Cursor, from: number) => (/^[^\s()]*/.exec(c.s.slice(from)) ?? [''])[0];

const termPattern = (token: string): string | null => {
  const pieces = [...token.matchAll(/\\([\s\S])|([*?])|([\s\S])/g)];
  if (!pieces.some((p) => p[2])) return null;
  return pieces.map((p) => (p[1] !== undefined ? escapeRegex(p[1]) : p[2] === '*' ? '.*' : p[2] === '?' ? '.' : escapeRegex(p[3]))).join('');
};

const checkSuffix = (c: Cursor) => {
  if (c.s[c.i] === '^') fail('Boosts (^) only change ranking. Log results are always ordered by time, so remove it.', c.i);
  if (c.s[c.i] === '~') fail('Fuzzy and proximity matching (~) isn\'t supported. Use a wildcard instead, such as okaf*.', c.i);
};

const parseLuceneValue = (c: Cursor, field: string | null): LuceneValue => {
  const start = c.i;
  const ch = c.s[c.i];
  const label = field ?? 'field';
  if (ch === '"') {
    const m = /^"((?:\\[\s\S]|[^"\\])*)"/.exec(rest(c));
    if (!m) return fail(`Unclosed quote opened at col ${start + 1}. Close it with ".`, start, c.s.length - start);
    c.i += m[0].length;
    checkSuffix(c);
    return { kind: 'text', text: unescape(m[1]), quoted: true, pattern: null };
  }
  if (ch === '/') {
    const m = /^\/((?:\\[\s\S]|[^/\\])*)\//.exec(rest(c));
    if (!m) {
      return fail(`Lucene reads a value starting with / as a regular expression, and this one never closes. If it's a path, quote it: ${label}:"${wordAhead(c, start)}"`, start, c.s.length - start);
    }
    c.i += m[0].length;
    const trailing = wordAhead(c, c.i);
    if (trailing) {
      fail(`Lucene reads /${m[1]}/ as a regular expression and "${trailing}" as a separate term. Quote paths: ${label}:"${m[0]}${trailing}"`, start, m[0].length + trailing.length);
    }
    try { toRegExp(m[1], true); } catch { fail(`/${m[1]}/ isn't a valid regular expression.`, start, m[0].length); }
    checkSuffix(c);
    return { kind: 'regex', source: m[1] };
  }
  const token = eat(c, TERM_RE);
  if (!token) {
    if (c.i >= c.s.length) return fail(field ? `${field}: needs a value after the colon.` : 'Expected a search term.', Math.max(0, c.i - 1));
    return fail(`Unexpected ${ch} at col ${c.i + 1}.`, c.i);
  }
  if (c.s[c.i] === ':') {
    fail(`Unescaped : at col ${c.i + 1}. Values with colons, such as IPv6 addresses, need quotes: ${label}:"${wordAhead(c, start)}"`, c.i);
  }
  if (c.s[c.i] === '/') {
    fail(`Unescaped / at col ${c.i + 1}. Lucene starts a regular expression at /. Quote the value: ${label}:"${wordAhead(c, start)}"`, c.i);
  }
  checkSuffix(c);
  return { kind: 'text', text: unescape(token), quoted: false, pattern: termPattern(token) };
};

const parseRange = (c: Cursor, field: string): LuceneValue => {
  const start = c.i;
  const open = c.s[c.i];
  c.i += 1;
  skipWs(c);
  const lo = eat(c, /^(?:\\[\s\S]|[^\s\]}])+/);
  skipWs(c);
  if (!lo || !eat(c, /^TO(?=\s)/)) fail(`A range needs TO between its bounds, such as ${field}:[400 TO 499].`, c.i);
  skipWs(c);
  const hi = eat(c, /^(?:\\[\s\S]|[^\s\]}])+/);
  skipWs(c);
  const close = eat(c, /^[\]}]/);
  if (!hi || !close) return fail(`Unclosed range opened at col ${start + 1}. Close it with ] or }.`, start, c.i - start);
  const bound = (b: string | null) => (b === null || b === '*' ? null : unescape(b));
  return { kind: 'range', lo: bound(lo), hi: bound(hi), loInc: open === '[', hiInc: close === ']' };
};

const parseFieldValue = (c: Cursor, field: string): LuceneValue | LuceneClause[] => {
  const ch = c.s[c.i];
  if (ch === undefined) return fail(`${field}: needs a value after the colon.`, c.i - 1);
  if (ch === '(') {
    const open = c.i;
    c.i += 1;
    const clauses = parseLuceneList(c, field, true);
    if (c.s[c.i] !== ')') fail(`Unclosed ( opened at col ${open + 1}.`, open);
    c.i += 1;
    return clauses;
  }
  if (ch === '[' || ch === '{') return parseRange(c, field);
  const cmp = eat(c, /^(?:>=|<=|>|<)/);
  if (cmp) {
    const v = eat(c, TERM_RE) ?? fail(`${field}:${cmp} needs a number, such as ${field}:${cmp}500.`, c.i);
    const b = unescape(v);
    return cmp.startsWith('>')
      ? { kind: 'range', lo: b, hi: null, loInc: cmp === '>=', hiInc: false }
      : { kind: 'range', lo: null, hi: b, loInc: false, hiInc: cmp === '<=' };
  }
  return parseLuceneValue(c, field);
};

const parsePrimary = (c: Cursor, field: string | null): LuceneNode => {
  const start = c.i;
  if (c.s[c.i] === '(') {
    c.i += 1;
    const clauses = parseLuceneList(c, field, true);
    if (c.s[c.i] !== ')') fail(`Unclosed ( opened at col ${start + 1}.`, start);
    c.i += 1;
    if (!clauses.length) fail('These parentheses are empty.', start, c.i - start);
    return { kind: 'bool', clauses, span: { start, end: c.i } };
  }
  const name = field === null ? eat(c, /^[A-Za-z_@][\w.@-]*(?=:)/) : null;
  if (name) {
    const fieldSpan = { start, end: c.i };
    c.i += 1;
    skipWs(c);
    const value = parseFieldValue(c, name);
    return Array.isArray(value)
      ? { kind: 'bool', clauses: value, span: { start, end: c.i } }
      : { kind: 'term', field: name, fieldSpan, value, span: { start, end: c.i } };
  }
  return { kind: 'term', field, fieldSpan: null, value: parseLuceneValue(c, field), span: { start, end: c.i } };
};

const assignOccur = (drafts: readonly DraftClause[]): LuceneClause[] => drafts.reduce<LuceneClause[]>((acc, d) => {
  const prev = acc[acc.length - 1];
  const fixed = d.conj === 'and' && prev && prev.occur !== 'mustNot'
    ? [...acc.slice(0, -1), { ...prev, occur: 'must' as Occur }]
    : acc;
  const prohibited = d.mod === 'not';
  const required = d.mod === 'req' || (d.conj === 'and' && !prohibited);
  return [...fixed, { ...d, occur: prohibited ? 'mustNot' : required ? 'must' : 'should' }];
}, []);

const parseLuceneList = (c: Cursor, field: string | null, closer: boolean): LuceneClause[] => {
  const step = (acc: readonly DraftClause[], pending: Conj): readonly DraftClause[] => {
    skipWs(c);
    const atEnd = c.i >= c.s.length || (closer && c.s[c.i] === ')');
    if (atEnd) {
      if (pending) fail(`${pending.toUpperCase()} needs a clause after it.`, Math.max(0, c.i - 1));
      return acc;
    }
    if (c.s[c.i] === ')') fail(`Unmatched ) at col ${c.i + 1}.`, c.i);
    const conjStart = c.i;
    const conj = eat(c, /^(?:AND|OR)(?=[\s()]|$)|^(?:&&|\|\|)/);
    if (conj) {
      if (!acc.length) fail(`A query can't start with ${conj}.`, conjStart, conj.length);
      if (pending) fail(`Two operators in a row at col ${conjStart + 1}.`, conjStart, conj.length);
      return step(acc, conj === 'AND' || conj === '&&' ? 'and' : 'or');
    }
    const start = c.i;
    const modToken = eat(c, /^NOT(?=[\s(]|$)|^!|^[+-](?=\S)/);
    const mod: Mod = modToken === '+' ? 'req' : modToken ? 'not' : null;
    skipWs(c);
    if (modToken && (c.i >= c.s.length || c.s[c.i] === ')')) fail(`${modToken} needs a clause after it.`, start, modToken.length);
    const node = parsePrimary(c, field);
    return step([...acc, { conj: pending, mod, node, span: { start, end: c.i } }], null);
  };
  return assignOccur(step([], null));
};

export const parseLucene = (text: string): LuceneNode => {
  const c: Cursor = { s: text, i: 0 };
  return { kind: 'bool', clauses: parseLuceneList(c, null, false), span: { start: 0, end: text.length } };
};

// Lucene: evaluation
export type Pred = (line: LogLine) => boolean;

const compileText = (value: LuceneValue): Pred => {
  if (value.kind === 'range') return () => false;
  if (value.kind === 'regex') {
    const re = toRegExp(value.source, true);
    return (l) => [...tokensOf(l)].some((t) => re.test(t));
  }
  const lower = value.text.toLowerCase();
  if (value.quoted) return (l) => l.raw.toLowerCase().includes(lower);
  if (value.pattern !== null) {
    const re = new RegExp(`^(?:${value.pattern})$`, 'i');
    return (l) => [...tokensOf(l)].some((t) => re.test(t));
  }
  return (l) => tokensOf(l).has(lower);
};

const compileRange = (field: string, r: Extract<LuceneValue, { kind: 'range' }>): Pred => {
  const numeric = [r.lo, r.hi].every((b) => b === null || isNumeric(b));
  const inRange = <T extends number | string>(v: T, lo: T | null, hi: T | null) => (
    (lo === null || (r.loInc ? v >= lo : v > lo)) && (hi === null || (r.hiInc ? v <= hi : v < hi))
  );
  return (l) => {
    const v = valueOf(l, field);
    if (v === undefined) return false;
    if (numeric) {
      const n = typeof v === 'number' ? v : isNumeric(String(v)) ? Number(v) : NaN;
      return !Number.isNaN(n) && inRange(n, r.lo === null ? null : Number(r.lo), r.hi === null ? null : Number(r.hi));
    }
    return inRange(String(v), r.lo, r.hi);
  };
};

const compileTerm = (field: string | null, value: LuceneValue): Pred => {
  const f = field ?? config.luceneDefaultField;
  if (f === config.luceneDefaultField) return compileText(value);
  if (f === '_exists_' && value.kind === 'text') return (l) => valueOf(l, value.text) !== undefined;
  if (value.kind === 'range') return compileRange(f, value);
  if (value.kind === 'regex') {
    const re = toRegExp(value.source, true);
    return (l) => { const v = valueOf(l, f); return v !== undefined && re.test(String(v)); };
  }
  if (value.pattern === '.*') return (l) => valueOf(l, f) !== undefined;
  if (value.pattern !== null) {
    const re = new RegExp(`^(?:${value.pattern})$`);
    return (l) => { const v = valueOf(l, f); return v !== undefined && re.test(String(v)); };
  }
  const want = value.text;
  const lower = want.toLowerCase();
  const num = isNumeric(want) ? Number(want) : null;
  return (l) => {
    const v = valueOf(l, f);
    if (v === undefined) return false;
    if (typeof v === 'number') return v === num;
    if (typeof v === 'boolean') return String(v) === lower;
    if (v === want) return true;
    if (!/[\s,]/.test(v)) return false;
    return value.quoted ? v.toLowerCase().includes(lower) : analyzeText(v).includes(lower);
  };
};

export const compileLucene = (node: LuceneNode): Pred => {
  if (node.kind === 'term') return compileTerm(node.field, node.value);
  if (!node.clauses.length) return () => true;
  const by = (o: Occur) => node.clauses.filter((c) => c.occur === o).map((c) => compileLucene(c.node));
  const [musts, shoulds, nots] = [by('must'), by('should'), by('mustNot')];
  return (l) => !nots.some((p) => p(l)) && (
    musts.length ? musts.every((p) => p(l)) : shoulds.length ? shoulds.some((p) => p(l)) : true
  );
};

// Lucene: diagnostics
const listOf = (xs: readonly string[]) => xs.join(', ');

const mixedWarning = (node: Extract<LuceneNode, { kind: 'bool' }>, text: string): Diagnostic[] => {
  const conjs = node.clauses.slice(1).map((c) => c.conj ?? 'or');
  if (!(conjs.includes('and') && conjs.includes('or'))) return [];
  const src = (c: LuceneClause) => sourceOf(text, c.span);
  const musts = node.clauses.filter((c) => c.occur === 'must').map(src);
  const shoulds = node.clauses.filter((c) => c.occur === 'should').map(src);
  const groups = node.clauses.reduce<LuceneClause[][]>((acc, c, i) => (
    i > 0 && c.conj === 'and' ? [...acc.slice(0, -1), [...acc[acc.length - 1], c]] : [...acc, [c]]
  ), []);
  const grouped = groups.map((g) => (g.length > 1
    ? `(${text.slice(g[0].span.start, g[g.length - 1].span.end)})`
    : src(g[0]))).join(' OR ');
  const first = node.clauses[0].span.start;
  const last = node.clauses[node.clauses.length - 1].span.end;
  const optional = shoulds.length
    ? ` ${listOf(shoulds)} ${shoulds.length > 1 ? 'are' : 'is'} optional, so ${shoulds.length > 1 ? 'they filter' : 'it filters'} nothing.`
    : '';
  return [{
    severity: 'warning',
    message: `AND and OR are mixed without parentheses. Lucene requires ${listOf(musts)}.${optional}`,
    at: first,
    length: last - first,
    fix: { label: `Group as ${grouped}`, text: `${text.slice(0, first)}${grouped}${text.slice(last)}` },
  }];
};

const unknownField = (name: string, span: Span, text: string, catalog: Catalog): Diagnostic[] => {
  const known = allFieldNames(catalog);
  if (!catalog.fields.length || known.includes(name) || name === config.luceneDefaultField || name === '_exists_') return [];
  const guess = closest(name, known, config.didYouMeanDistance);
  return [{
    severity: 'warning',
    message: `No captured line has a field named ${name}.${guess ? ` Did you mean ${guess}?` : ''}`,
    at: span.start,
    length: span.end - span.start,
    ...(guess ? { fix: { label: `Use ${guess}`, text: `${text.slice(0, span.start)}${guess}${text.slice(span.end)}` } } : {}),
  }];
};

export const luceneWarnings = (node: LuceneNode, text: string, catalog: Catalog): Diagnostic[] => {
  if (node.kind === 'bool') {
    return [...mixedWarning(node, text), ...node.clauses.flatMap((c) => luceneWarnings(c.node, text, catalog))];
  }
  return node.fieldSpan && node.field ? unknownField(node.field, node.fieldSpan, text, catalog) : [];
};

// Lucene: highlighting
const LUCENE_LEX: ReadonlyArray<readonly [SynKind | 'term' | 'ws', RegExp]> = [
  ['ws', /^\s+/],
  ['string', /^"(?:\\[\s\S]|[^"\\])*"?/],
  ['regex', /^\/(?:\\[\s\S]|[^/\\])*\/?/],
  ['keyword', /^(?:AND|OR|NOT)(?=[\s()]|$)|^(?:&&|\|\||!)|^[+-](?=\S)/],
  ['operator', /^TO(?=\s)|^(?:>=|<=|>|<)/],
  ['punct', /^[()[\]{}:]/],
  ['field', /^[A-Za-z_@][\w.@-]*(?=:)/],
  ['term', /^(?:\\[\s\S]|[^\s()[\]{}:"^~/\\])+/],
  ['plain', /^[\s\S]/],
];

export const lexLucene = (text: string): SynToken[] => {
  const step = (i: number, prev: SynKind | null, acc: SynToken[]): SynToken[] => {
    if (i >= text.length) return acc;
    const tail = text.slice(i);
    const [kind, m] = LUCENE_LEX.map(([k, re]) => [k, re.exec(tail)] as const).find(([, mm]) => mm) ?? ['plain', null];
    const len = m ? m[0].length : 1;
    if (kind === 'ws') return step(i + len, prev, acc);
    const valueSide = prev === 'punct' && text[i - 1] === ':' ? true : prev === 'operator';
    const resolved: SynKind = kind === 'term'
      ? (valueSide ? (isNumeric(m?.[0] ?? '') ? 'number' : 'value') : 'bare')
      : kind;
    return step(i + len, resolved, [...acc, { kind: resolved, start: i, end: i + len }]);
  };
  return step(0, null, []);
};