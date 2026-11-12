import { config } from '../config.js';
import { labelNames } from '../schemas.js';
import { closest, lowerBound, toRegExp } from '../utils.js';
import { fail, fieldInfo, isLabel, keyOf, lit, parsedFieldNames, } from './common.js';
const LOGQL_LEX = [
    ['ws', /^\s+/],
    ['string', /^"(?:\\[\s\S]|[^"\\])*"|^`[^`]*`/],
    ['duration', /^\d+(?:ms|s|m|h|d|w)(?![\w.])/],
    ['number', /^\d+(?:\.\d+)?(?![\w])/],
    ['ident', /^[A-Za-z_]\w*/],
    ['op', /^(?:\|=|\|~|!=|!~|=~|==|>=|<=|[=<>|])/],
    ['lbrace', /^\{/], ['rbrace', /^\}/], ['lparen', /^\(/], ['rparen', /^\)/],
    ['lbrack', /^\[/], ['rbrack', /^\]/], ['comma', /^,/],
];
const lexLogqlTokens = (text) => {
    const step = (i, acc) => {
        if (i >= text.length)
            return [...acc, { t: 'eof', v: '', start: text.length, end: text.length }];
        const tail = text.slice(i);
        const hit = LOGQL_LEX.map(([k, re]) => [k, re.exec(tail)]).find(([, m]) => m);
        if (!hit || !hit[1]) {
            const ch = text[i];
            return ch === '"' || ch === '`'
                ? fail(`Unclosed string opened at col ${i + 1}. Close it with ${ch}.`, i, text.length - i)
                : fail(`Unexpected ${ch} at col ${i + 1}.`, i);
        }
        const [kind, m] = hit;
        const end = i + m[0].length;
        return step(end, kind === 'ws' ? acc : [...acc, { t: kind, v: m[0], start: i, end }]);
    };
    return step(0, []);
};
export const RANGE_FNS = ['count_over_time', 'rate', 'sum_over_time', 'avg_over_time', 'max_over_time', 'min_over_time', 'quantile_over_time'];
const AGG_OPS = ['sum', 'avg', 'max', 'min', 'count'];
const TOPK = ['topk', 'bottomk'];
const UNSUPPORTED_STAGES = ['line_format', 'label_format', 'pattern', 'regexp', 'decolorize', 'drop', 'keep', 'unpack'];
export const logqlFunctions = [...RANGE_FNS, ...AGG_OPS, ...TOPK];
const at = (c) => c.toks[c.i];
const take = (c) => { const t = c.toks[c.i]; c.i += 1; return t; };
const prevEnd = (c) => c.toks[Math.max(0, c.i - 1)].end;
const failAt = (t, message) => fail(message, t.start, t.end - t.start);
const expectTok = (c, t, message) => (at(c).t === t ? take(c) : failAt(at(c), message));
const decode = (t) => {
    if (t.v.startsWith('`'))
        return t.v.slice(1, -1);
    try {
        return JSON.parse(t.v);
    }
    catch {
        return failAt(t, 'Invalid escape in a double-quoted string. Write \\\\ for a backslash, or use backticks for regular expressions.');
    }
};
const compileRe = (t, source, anchored) => {
    try {
        return toRegExp(source, anchored);
    }
    catch {
        return failAt(t, `${t.v} isn't a valid regular expression.`);
    }
};
export const durationMs = (d) => {
    const m = /^(\d+)(ms|s|m|h|d|w)$/.exec(d);
    const unit = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
    return m ? Number(m[1]) * unit[m[2]] : 0;
};
const parseMatchers = (c, acc) => {
    if (at(c).t === 'rbrace' || at(c).t === 'eof')
        return acc;
    if (acc.length)
        expectTok(c, 'comma', 'Separate matchers with a comma.');
    const name = expectTok(c, 'ident', 'Expected a label name, such as service.');
    const op = at(c);
    if (op.t !== 'op' || !['=', '!=', '=~', '!~'].includes(op.v))
        failAt(op, `Use =, !=, =~ or !~ after ${name.v}.`);
    take(c);
    const str = expectTok(c, 'string', `${name.v}${op.v} needs a quoted value, such as ${name.v}${op.v}"auth".`);
    const value = decode(str);
    const re = op.v === '=~' || op.v === '!~' ? compileRe(str, value, true) : null;
    return parseMatchers(c, [...acc, { name: name.v, op: op.v, value, re, span: { start: name.start, end: str.end } }]);
};
const parseLabelAtom = (c) => {
    if (at(c).t === 'lparen') {
        const open = take(c);
        const e = parseLabelOr(c);
        expectTok(c, 'rparen', `Close the ( opened at col ${open.start + 1}.`);
        return e;
    }
    const name = expectTok(c, 'ident', 'Expected a label filter, such as status="401".');
    const op = at(c);
    if (op.t !== 'op' || !['=', '!=', '=~', '!~', '==', '>', '>=', '<', '<='].includes(op.v)) {
        failAt(op, `Compare ${name.v} with a value, such as ${name.v}="value" or ${name.v}>500.`);
    }
    take(c);
    const v = at(c);
    const regex = op.v === '=~' || op.v === '!~';
    const ordered = ['>', '>=', '<', '<='].includes(op.v);
    if (v.t === 'string') {
        if (ordered)
            failAt(v, `${op.v} compares numbers. Drop the quotes: ${name.v} ${op.v} ${decode(v)}`);
        take(c);
        const value = decode(v);
        return { kind: 'cmp', name: name.v, op: op.v, value, re: regex ? compileRe(v, value, true) : null, span: { start: name.start, end: v.end }, nameSpan: { start: name.start, end: name.end } };
    }
    if (v.t === 'number' && !regex) {
        take(c);
        return { kind: 'cmp', name: name.v, op: op.v, value: Number(v.v), re: null, span: { start: name.start, end: v.end }, nameSpan: { start: name.start, end: name.end } };
    }
    return failAt(v, regex ? `${op.v} needs a quoted pattern.` : `Expected a value after ${name.v}${op.v}.`);
};
const parseLabelAnd = (c) => {
    const left = parseLabelAtom(c);
    const k = at(c);
    if ((k.t === 'ident' && k.v === 'and') || k.t === 'comma') {
        take(c);
        const right = parseLabelAnd(c);
        return { kind: 'and', left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
};
const parseLabelOr = (c) => {
    const left = parseLabelAnd(c);
    if (at(c).t === 'ident' && at(c).v === 'or') {
        take(c);
        const right = parseLabelOr(c);
        return { kind: 'or', left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
};
const parseStages = (c, acc) => {
    const k = at(c);
    if (k.t === 'op' && ['|=', '!=', '|~', '!~'].includes(k.v)) {
        take(c);
        const str = expectTok(c, 'string', `${k.v} needs a quoted string, such as ${k.v} "timeout".`);
        const value = decode(str);
        const re = k.v === '|~' || k.v === '!~' ? compileRe(str, value, false) : null;
        return parseStages(c, [...acc, { kind: 'line', op: k.v, value, re, span: { start: k.start, end: str.end } }]);
    }
    if (!(k.t === 'op' && k.v === '|'))
        return acc;
    take(c);
    const n = at(c);
    if (n.t === 'ident' && (n.v === 'json' || n.v === 'logfmt')) {
        take(c);
        return parseStages(c, [...acc, { kind: 'parser', format: n.v, span: { start: k.start, end: n.end } }]);
    }
    if (n.t === 'ident' && n.v === 'unwrap') {
        take(c);
        const f = expectTok(c, 'ident', 'unwrap needs a numeric field, such as | unwrap latency_ms.');
        return parseStages(c, [...acc, { kind: 'unwrap', field: f.v, span: { start: k.start, end: f.end } }]);
    }
    if (n.t === 'ident' && UNSUPPORTED_STAGES.includes(n.v)) {
        failAt(n, `${n.v} isn't supported here. Supported stages: json, logfmt, unwrap, and label filters.`);
    }
    if (n.t !== 'ident')
        failAt(n, 'Expected a stage after |: json, logfmt, unwrap, or a label filter such as status="401".');
    const expr = parseLabelOr(c);
    return parseStages(c, [...acc, { kind: 'filter', expr, span: { start: k.start, end: expr.span.end } }]);
};
const hasNonEmptyMatcher = (ms) => ms.some((m) => ((m.op === '=' && m.value !== '') || (m.op === '=~' && m.re !== null && !m.re.test(''))));
const parseLogQuery = (c) => {
    const open = expectTok(c, 'lbrace', 'A log query starts with a stream selector, such as {service="auth"}.');
    const matchers = parseMatchers(c, []);
    const close = expectTok(c, 'rbrace', 'Close the stream selector with }.');
    if (!matchers.length)
        fail('The stream selector is empty. Add a matcher, such as {service="auth"}.', open.start, close.end - open.start);
    if (!hasNonEmptyMatcher(matchers)) {
        fail('A stream selector needs at least one matcher that can\'t match an empty value, such as service="auth" or env=~".+".', open.start, close.end - open.start);
    }
    const stages = parseStages(c, []);
    return { kind: 'log', matchers, stages, selectorSpan: { start: open.start, end: close.end }, span: { start: open.start, end: prevEnd(c) } };
};
const parseBy = (c) => {
    if (at(c).t === 'ident' && at(c).v === 'without')
        failAt(at(c), 'without isn\'t supported here. List the labels to keep with by (…).');
    if (!(at(c).t === 'ident' && at(c).v === 'by'))
        return null;
    take(c);
    expectTok(c, 'lparen', 'by needs a label list, such as by (src_ip).');
    const names = (acc) => {
        if (at(c).t === 'rparen')
            return acc;
        if (acc.length)
            expectTok(c, 'comma', 'Separate labels with a comma.');
        return names([...acc, expectTok(c, 'ident', 'Expected a label name.').v]);
    };
    const list = names([]);
    expectTok(c, 'rparen', 'Close the by (…) list.');
    return list;
};
const parseMetric = (c) => {
    const name = take(c);
    const fn = name.v;
    if (AGG_OPS.includes(fn)) {
        const byFirst = parseBy(c);
        expectTok(c, 'lparen', `${fn} needs ( after it.`);
        const inner = parseMetricOnly(c);
        expectTok(c, 'rparen', `Close the ${fn}( … ).`);
        const by = byFirst ?? parseBy(c);
        return { kind: 'agg', op: fn, by, inner, span: { start: name.start, end: prevEnd(c) } };
    }
    if (TOPK.includes(fn)) {
        const byFirst = parseBy(c);
        expectTok(c, 'lparen', `${fn} needs ( after it.`);
        const k = expectTok(c, 'number', `${fn} needs a count first, such as ${fn}(5, …).`);
        expectTok(c, 'comma', `Put a comma after the count in ${fn}.`);
        const inner = parseMetricOnly(c);
        expectTok(c, 'rparen', `Close the ${fn}( … ).`);
        const by = byFirst ?? parseBy(c);
        return { kind: 'topk', k: Number(k.v), bottom: fn === 'bottomk', by, inner, span: { start: name.start, end: prevEnd(c) } };
    }
    if (RANGE_FNS.includes(fn)) {
        expectTok(c, 'lparen', `${fn} needs ( after it.`);
        const param = fn === 'quantile_over_time'
            ? Number(expectTok(c, 'number', 'quantile_over_time needs the quantile first, such as quantile_over_time(0.95, …).').v)
            : null;
        if (param !== null)
            expectTok(c, 'comma', 'Put a comma after the quantile.');
        const log = parseLogQuery(c);
        expectTok(c, 'lbrack', `Add the range window after the log query, such as [5m].`);
        const dur = expectTok(c, 'duration', 'The range window needs a duration, such as [5m] or [30s].');
        expectTok(c, 'rbrack', 'Close the range window with ].');
        expectTok(c, 'rparen', `Close the ${fn}( … ).`);
        const unwrap = log.stages.find((s) => s.kind === 'unwrap');
        const counts = fn === 'count_over_time' || fn === 'rate';
        if (!counts && !unwrap)
            fail(`${fn} needs a number to aggregate. Add | unwrap <field> to the log query, such as | unwrap latency_ms.`, name.start, name.end - name.start);
        if (counts && unwrap)
            fail(`${fn} counts lines. Remove | unwrap, or use sum_over_time to add up ${unwrap.field}.`, unwrap.span.start, unwrap.span.end - unwrap.span.start);
        const by = parseBy(c);
        if (by && counts)
            fail(`by (…) after ${fn} isn't supported. Wrap it instead: sum by (${by.join(', ')}) (${fn}(…)).`, name.start, prevEnd(c) - name.start);
        return { kind: 'range', fn: fn, param, log, rangeMs: durationMs(dur.v), rangeText: dur.v, by, span: { start: name.start, end: prevEnd(c) } };
    }
    const guess = closest(fn, logqlFunctions, config.didYouMeanDistance);
    return failAt(name, `${fn} isn't a LogQL function.${guess ? ` Did you mean ${guess}?` : ''}`);
};
const parseLogqlExpr = (c) => {
    const k = at(c);
    if (k.t === 'lbrace')
        return parseLogQuery(c);
    if (k.t === 'ident')
        return parseMetric(c);
    return failAt(k, 'LogQL starts with a stream selector, such as {service="auth"}, or a function, such as rate(…).');
};
const parseMetricOnly = (c) => {
    const e = parseLogqlExpr(c);
    if (e.kind === 'log') {
        fail('This function works on samples. Wrap the log query in a range function, such as count_over_time(… [5m]).', e.span.start, e.span.end - e.span.start);
    }
    return e;
};
export const parseLogql = (text) => {
    if (!text.trim())
        fail('LogQL needs a stream selector. Start with {, for example {service="auth"}.', 0);
    const c = { toks: lexLogqlTokens(text), i: 0 };
    const ast = parseLogqlExpr(c);
    if (at(c).t !== 'eof')
        failAt(at(c), `Unexpected ${at(c).v} at col ${at(c).start + 1}.`);
    return ast;
};
export const innerLog = (q) => {
    if (q.kind === 'log')
        return q;
    return q.kind === 'range' ? q.log : innerLog(q.inner);
};
export const innerRange = (q) => (q.kind === 'range' ? q : innerRange(q.inner));
// LogQL: diagnostics
export const exprCmps = (e) => (e.kind === 'cmp' ? [e] : [...exprCmps(e.left), ...exprCmps(e.right)]);
const parserFor = (catalog, matchers, field) => {
    const allowed = fieldInfo(catalog, field)?.formats ?? [];
    const formats = new Set(catalog.streams
        .filter((st) => matchers.every((m) => matcherHolds(m, st.labels)) && allowed.includes(st.format))
        .map((st) => st.format));
    return formats.size === 1 && formats.has('logfmt') ? 'logfmt' : 'json';
};
export const logqlWarnings = (ast, text, catalog) => {
    const parsed = parsedFieldNames(catalog);
    const log = innerLog(ast);
    const selector = log.matchers.filter((m) => !isLabel(m.name)).map((m) => ({
        severity: 'warning',
        message: `${m.name} isn't a stream label, so this selector matches no streams. Stream labels are ${labelNames.join(', ')}. To filter on ${m.name}, parse it first: … | json | ${m.name}${m.op}${lit(m.value)}`,
        at: m.span.start,
        length: m.span.end - m.span.start,
    }));
    const filters = log.stages.reduce((acc, st) => {
        if (st.kind === 'parser')
            return { ...acc, parsed: true };
        if (st.kind !== 'filter')
            return acc;
        const found = exprCmps(st.expr).flatMap((cmp) => {
            if (isLabel(cmp.name) || cmp.name === '__error__')
                return [];
            if (!parsed.length)
                return [];
            if (!parsed.includes(cmp.name)) {
                const guess = closest(cmp.name, parsed, config.didYouMeanDistance);
                return [{
                        severity: 'warning',
                        message: `No captured line has a field named ${cmp.name}.${guess ? ` Did you mean ${guess}?` : ''}`,
                        at: cmp.nameSpan.start,
                        length: cmp.nameSpan.end - cmp.nameSpan.start,
                        ...(guess ? { fix: { label: `Use ${guess}`, text: `${text.slice(0, cmp.nameSpan.start)}${guess}${text.slice(cmp.nameSpan.end)}` } } : {}),
                    }];
            }
            if (acc.parsed)
                return [];
            const fmt = parserFor(catalog, log.matchers, cmp.name);
            return [{
                    severity: 'warning',
                    message: `${cmp.name} only exists after a parser stage, so this filter matches nothing. Add | ${fmt} before it.`,
                    at: cmp.nameSpan.start,
                    length: cmp.nameSpan.end - cmp.nameSpan.start,
                    fix: { label: `Insert | ${fmt}`, text: `${text.slice(0, st.span.start)}| ${fmt} ${text.slice(st.span.start)}` },
                }];
        });
        return { ...acc, out: [...acc.out, ...found] };
    }, { parsed: false, out: [] }).out;
    return [...selector, ...filters];
};
// LogQL: highlighting
export const lexLogql = (text) => {
    const kinds = [
        ['ws', /^\s+/],
        ['string', /^"(?:\\[\s\S]|[^"\\])*"?|^`[^`]*`?/],
        ['duration', /^\d+(?:ms|s|m|h|d|w)(?![\w.])/],
        ['number', /^\d+(?:\.\d+)?/],
        ['function', new RegExp(`^(?:${logqlFunctions.join('|')})(?![\\w])`)],
        ['keyword', /^(?:by|without|and|or|json|logfmt|unwrap)(?![\w])/],
        ['field', /^[A-Za-z_]\w*/],
        ['operator', /^(?:\|=|\|~|!=|!~|=~|==|>=|<=|[=<>|])/],
        ['punct', /^[{}()[\],]/],
        ['plain', /^[\s\S]/],
    ];
    const step = (i, prevOp, acc) => {
        if (i >= text.length)
            return acc;
        const tail = text.slice(i);
        const [kind, m] = kinds.map(([k, re]) => [k, re.exec(tail)]).find(([, mm]) => mm) ?? ['plain', null];
        const len = m ? m[0].length : 1;
        if (kind === 'ws')
            return step(i + len, prevOp, acc);
        const resolved = kind === 'string' && ['=~', '!~', '|~'].includes(prevOp) ? 'regex' : kind === 'string' ? 'value' : kind;
        return step(i + len, kind === 'operator' ? (m?.[0] ?? '') : '', [...acc, { kind: resolved, start: i, end: i + len }]);
    };
    return step(0, '', []);
};
const cmpHolds = (e, ex) => {
    const v = ex[e.name];
    if (e.re)
        return e.op === '=~' ? e.re.test(String(v ?? '')) : !e.re.test(String(v ?? ''));
    if (typeof e.value === 'number') {
        const n = typeof v === 'number' ? v : v === undefined || v === '' ? NaN : Number(v);
        if (Number.isNaN(n))
            return false;
        const ops = { '=': n === e.value, '==': n === e.value, '!=': n !== e.value, '>': n > e.value, '>=': n >= e.value, '<': n < e.value, '<=': n <= e.value };
        return ops[e.op] ?? false;
    }
    const s = String(v ?? '');
    return e.op === '!=' ? s !== e.value : s === e.value;
};
const exprHolds = (e, ex) => {
    if (e.kind === 'cmp')
        return cmpHolds(e, ex);
    return e.kind === 'and' ? exprHolds(e.left, ex) && exprHolds(e.right, ex) : exprHolds(e.left, ex) || exprHolds(e.right, ex);
};
const parsedOf = (line) => Object.fromEntries(Object.entries(line.fields).map(([k, v]) => [k, typeof v === 'boolean' ? String(v) : v]));
const compileStage = (st) => (line, ex) => {
    if (st.kind === 'line') {
        const hit = st.re ? st.re.test(line.raw) : line.raw.includes(st.value);
        return (st.op === '|=' || st.op === '|~') === hit ? ex : null;
    }
    if (st.kind === 'parser') {
        return line.format === st.format
            ? { ...ex, ...parsedOf(line) }
            : { ...ex, __error__: st.format === 'json' ? 'JSONParserErr' : 'LogfmtParserErr' };
    }
    if (st.kind === 'filter')
        return exprHolds(st.expr, ex) ? ex : null;
    const v = ex[st.field];
    const n = typeof v === 'number' ? v : Number(v);
    return v !== undefined && Number.isFinite(n) ? { ...ex, __value__: n } : { ...ex, __error__: 'SampleExtractionErr' };
};
export const matcherHolds = (m, labels) => {
    const v = labels[m.name] ?? '';
    if (m.re)
        return m.op === '=~' ? m.re.test(v) : !m.re.test(v);
    return m.op === '=' ? v === m.value : v !== m.value;
};
export const compilePipeline = (q) => {
    const stages = q.stages.map(compileStage);
    return (line) => {
        if (!q.matchers.every((m) => matcherHolds(m, line.labels)))
            return null;
        return stages.reduce((ex, st) => (ex === null ? null : st(line, ex)), { ...line.labels });
    };
};
const quantile = (q, xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const rank = q * (s.length - 1);
    const lo = Math.floor(rank);
    const hi = Math.min(s.length - 1, lo + 1);
    return s[lo] + (s[hi] - s[lo]) * (rank - lo);
};
const rangeValue = (q, vals) => {
    if (!vals.length)
        return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    const fns = {
        count_over_time: () => vals.length,
        rate: () => vals.length / (q.rangeMs / 1000),
        sum_over_time: () => sum,
        avg_over_time: () => sum / vals.length,
        max_over_time: () => Math.max(...vals),
        min_over_time: () => Math.min(...vals),
        quantile_over_time: () => quantile(q.param ?? 0.5, vals),
    };
    return fns[q.fn]();
};
const evalRange = (q, lines, steps) => {
    const pipe = compilePipeline(q.log);
    const unwrap = q.log.stages.find((s) => s.kind === 'unwrap');
    const groups = lines.reduce((acc, line) => {
        const ex = pipe(line);
        if (!ex || (unwrap && ex.__error__ === 'SampleExtractionErr'))
            return acc;
        const all = Object.fromEntries(Object.entries(ex)
            .filter(([k]) => k !== '__value__' && k !== unwrap?.field)
            .map(([k, v]) => [k, String(v)]));
        const labels = q.by === null ? all : Object.fromEntries(q.by.map((k) => [k, all[k] ?? '']));
        const key = keyOf(labels);
        const g = acc.get(key) ?? { labels, ts: [], vals: [] };
        g.ts.push(line.ts);
        g.vals.push(unwrap ? Number(ex.__value__) : 1);
        return acc.set(key, g);
    }, new Map());
    return [...groups.entries()].map(([key, g]) => ({
        key,
        labels: g.labels,
        values: steps.map((t) => rangeValue(q, g.vals.slice(lowerBound(g.ts, t - q.rangeMs + 1), lowerBound(g.ts, t + 1)))),
    }));
};
const subset = (labels, by) => (by === null ? {} : Object.fromEntries(by.map((k) => [k, labels[k] ?? ''])));
const aggregate = (op, xs) => {
    if (!xs.length)
        return null;
    const sum = xs.reduce((a, b) => a + b, 0);
    const ops = { sum, avg: sum / xs.length, max: Math.max(...xs), min: Math.min(...xs), count: xs.length };
    return ops[op];
};
const groupSeries = (series, by) => series.reduce((acc, s) => {
    const labels = subset(s.labels, by);
    const key = keyOf(labels);
    return acc.set(key, { labels, members: [...(acc.get(key)?.members ?? []), s] });
}, new Map());
export const evalMetric = (q, lines, steps) => {
    if (q.kind === 'range')
        return evalRange(q, lines, steps);
    const inner = evalMetric(q.inner, lines, steps);
    if (q.kind === 'agg') {
        return [...groupSeries(inner, q.by).entries()].map(([key, g]) => ({
            key,
            labels: g.labels,
            values: steps.map((_, i) => aggregate(q.op, g.members.map((m) => m.values[i]).filter((v) => v !== null))),
        }));
    }
    const groups = [...groupSeries(inner, q.by).values()];
    const keep = steps.map((_, i) => new Set(groups.flatMap((g) => g.members
        .filter((m) => m.values[i] !== null)
        .sort((a, b) => (q.bottom ? 1 : -1) * ((a.values[i] ?? 0) - (b.values[i] ?? 0)))
        .slice(0, q.k)
        .map((m) => m.key))));
    return inner.map((s) => ({ ...s, values: s.values.map((v, i) => (keep[i].has(s.key) ? v : null)) }));
};
export const unitOf = (q) => {
    if (q.kind === 'agg' && q.op === 'count')
        return 'series';
    if (q.kind !== 'range')
        return unitOf(q.inner);
    const field = q.log.stages.find((s) => s.kind === 'unwrap')?.field ?? '';
    const units = {
        count_over_time: `lines per ${q.rangeText}`,
        rate: 'lines per second',
        sum_over_time: `sum of ${field} per ${q.rangeText}`,
        avg_over_time: `mean ${field}`,
        max_over_time: `max ${field}`,
        min_over_time: `min ${field}`,
        quantile_over_time: `p${Math.round((q.param ?? 0) * 100)} ${field}`,
    };
    return units[q.fn];
};
