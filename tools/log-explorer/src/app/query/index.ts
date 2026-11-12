import { config } from '../config.js';
import type {
  Catalog, Committed, EntityRef, FieldValue, Lang, LogLine, Series,
} from '../schemas.js';
import {
  emptyCatalog, isLabel, isLocated, lit, luceneValue, type Diagnostic, type SynToken,
} from './common.js';
import {
  lexLucene, luceneWarnings, parseLucene, type LuceneNode,
} from './lucene.js';
import {
  exprCmps, innerLog, lexLogql, logqlWarnings, parseLogql, type LogqlAst,
} from './logql.js';

export type { Diagnostic, Fix, SynToken } from './common.js';

// Parsing entry point
export type Parsed =
  | { readonly ok: true; readonly lang: 'lucene'; readonly ast: LuceneNode; readonly metric: false; readonly diagnostics: readonly Diagnostic[] }
  | { readonly ok: true; readonly lang: 'logql'; readonly ast: LogqlAst; readonly metric: boolean; readonly diagnostics: readonly Diagnostic[] }
  | { readonly ok: false; readonly lang: Lang; readonly diagnostics: readonly Diagnostic[] };

export const parseQuery = (lang: Lang, text: string, catalog: Catalog = emptyCatalog): Parsed => {
  try {
    if (lang === 'lucene') {
      const ast = parseLucene(text);
      return { ok: true, lang, ast, metric: false, diagnostics: luceneWarnings(ast, text, catalog) };
    }
    const ast = parseLogql(text);
    return { ok: true, lang, ast, metric: ast.kind !== 'log', diagnostics: logqlWarnings(ast, text, catalog) };
  } catch (e) {
    if (!isLocated(e)) throw e;
    return { ok: false, lang, diagnostics: [{ severity: 'error', message: e.message, at: e.at, length: e.length }] };
  }
};

export const lex = (lang: Lang, text: string): SynToken[] => (lang === 'lucene' ? lexLucene(text) : lexLogql(text));

export const seriesName = (s: Series) => {
  const entries = Object.entries(s.labels).filter(([k]) => k !== '__error__');
  return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join(', ') : 'all lines';
};

// Click-to-filter
export interface FilterTarget {
  readonly field: string;
  readonly value: FieldValue;
  readonly negate: boolean;
  readonly format: LogLine['format'];
  readonly service: string;
}

export const addFilter = (lang: Lang, text: string, t: FilterTarget): string => {
  const value = String(t.value);
  const trimmed = text.trim();
  if (lang === 'lucene') {
    const clause = `${t.negate ? 'NOT ' : ''}${t.field}:${luceneValue(value)}`;
    if (!trimmed) return clause;
    const parsed = parseQuery('lucene', trimmed);
    const loose = parsed.ok && parsed.ast.kind === 'bool' && parsed.ast.clauses.length > 1
      && parsed.ast.clauses.some((c) => c.occur === 'should');
    return `${loose ? `(${trimmed})` : trimmed} AND ${clause}`;
  }
  const op = t.negate ? '!=' : '=';
  const parsed = parseQuery('logql', trimmed);
  const fmt = t.format === 'logfmt' ? 'logfmt' : 'json';
  if (!parsed.ok || parsed.lang !== 'logql') {
    const base = t.field === 'service' ? '' : `service=${lit(t.service)}`;
    return isLabel(t.field)
      ? `{${[base, `${t.field}${op}${lit(value)}`].filter(Boolean).join(', ')}}`
      : `{${base}} | ${fmt} | ${t.field}${op}${lit(value)}`;
  }
  const log = innerLog(parsed.ast);
  if (isLabel(t.field)) {
    const pos = log.selectorSpan.end - 1;
    return `${trimmed.slice(0, pos).trimEnd()}, ${t.field}${op}${lit(value)}${trimmed.slice(pos)}`;
  }
  const needsParser = !log.stages.some((s) => s.kind === 'parser');
  const insert = `${needsParser ? ` | ${fmt}` : ''} | ${t.field}${op}${lit(value)}`;
  return `${trimmed.slice(0, log.span.end)}${insert}${trimmed.slice(log.span.end)}`;
};

const appendClause = (lang: Lang, text: string, lucene: string, logqlStage: string, format: 'json' | 'logfmt', fallbackService: string): string => {
  const trimmed = text.trim();
  if (lang === 'lucene') {
    if (!trimmed) return lucene;
    const parsed = parseQuery('lucene', trimmed);
    const loose = parsed.ok && parsed.ast.kind === 'bool' && parsed.ast.clauses.length > 1
      && parsed.ast.clauses.some((c) => c.occur === 'should');
    return `${loose ? `(${trimmed})` : trimmed} AND ${lucene}`;
  }
  const parsed = parseQuery('logql', trimmed);
  if (!parsed.ok || parsed.lang !== 'logql') return `{service=${lit(fallbackService)}} | ${format} ${logqlStage}`;
  const log = innerLog(parsed.ast);
  const needsParser = !log.stages.some((st) => st.kind === 'parser');
  const insert = `${needsParser ? ` | ${format}` : ''} ${logqlStage}`;
  return `${trimmed.slice(0, log.span.end)}${insert}${trimmed.slice(log.span.end)}`;
};

export const addRange = (lang: Lang, text: string, field: string, lo: number, hi: number, format: 'json' | 'logfmt', service: string) => (
  appendClause(lang, text, `${field}:[${lo} TO ${hi}]`, `| ${field} >= ${lo} | ${field} <= ${hi}`, format, service)
);

export const entityQuery = (lang: Lang, ref: EntityRef): string => {
  const fields = config.entityFields[ref.kind];
  if (lang === 'lucene') {
    const clauses = fields.map((f) => `${f}:${luceneValue(ref.value)}`);
    return [...clauses, ...(ref.kind === 'ip' ? [`"${ref.value}"`] : [])].join(' OR ');
  }
  return `{${config.logqlNoSelectorFallback}} |= ${lit(ref.value)}`;
};

// Highlight terms for the stream
export const highlightTerms = (q: Committed): string[] => {
  const parsed = parseQuery(q.lang, q.text);
  if (!parsed.ok) return [];
  if (parsed.lang === 'lucene') {
    const walk = (n: LuceneNode, negated: boolean): string[] => {
      if (n.kind === 'bool') return n.clauses.flatMap((c) => walk(c.node, negated || c.occur === 'mustNot'));
      if (negated || n.value.kind !== 'text' || n.value.pattern !== null || n.field === '_exists_') return [];
      if (n.field !== null && isLabel(n.field)) return [];
      return [n.value.text];
    };
    return [...new Set(walk(parsed.ast, false))].filter((s) => s.length > 1);
  }
  const log = innerLog(parsed.ast);
  const fromStages = log.stages.flatMap((s) => {
    if (s.kind === 'line' && s.op === '|=') return [s.value];
    if (s.kind === 'filter') return exprCmps(s.expr).filter((c) => (c.op === '=' || c.op === '==') && c.name !== '__error__').map((c) => String(c.value));
    return [];
  });
  return [...new Set(fromStages)].filter((s) => s.length > 1);
};
