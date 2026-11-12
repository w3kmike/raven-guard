import { config } from '../config.js';
import { escapeRegex, toRegExp } from '../utils.js';
import { isLabel, isNumeric, lit, luceneValue, regexLit, sourceOf, } from './common.js';
import { innerLog } from './logql.js';
import { parseQuery } from './index.js';
const kept = (source, conds, detail = '') => ({ conds, notes: [{ kind: 'kept', source, detail }], breakdownField: null });
const changed = (source, conds, detail) => ({ conds, notes: [{ kind: 'changed', source, detail }], breakdownField: null });
const dropped = (source, detail) => ({ conds: [], notes: [{ kind: 'dropped', source, detail }], breakdownField: null });
const merge = (parts) => ({
    conds: parts.flatMap((p) => p.conds),
    notes: parts.flatMap((p) => p.notes),
    breakdownField: parts.map((p) => p.breakdownField).find((f) => f !== null) ?? null,
});
const alternation = (clauses) => {
    const terms = clauses.map((c) => c.node);
    if (!clauses.every((c) => c.occur === 'should'))
        return null;
    const plain = terms.every((t) => t.kind === 'term' && t.value.kind === 'text' && t.value.pattern === null);
    const fields = new Set(terms.map((t) => (t.kind === 'term' ? t.field : '\u0000')));
    if (!plain || fields.size !== 1)
        return null;
    const [field] = [...fields];
    if (field === null || field === config.luceneDefaultField)
        return null;
    return { field, values: terms.map((t) => (t.kind === 'term' && t.value.kind === 'text' ? t.value.text : '')) };
};
const luceneNodeToIR = (node, negate, text) => {
    const source = sourceOf(text, node.span);
    if (node.kind === 'bool') {
        const alt = alternation(node.clauses);
        if (alt) {
            const value = alt.values.map(escapeRegex).join('|');
            return changed(source, [{ kind: 'match', field: alt.field, op: negate ? 'nre' : 're', value }], 'OR on one field became a regex alternation.');
        }
        if (!negate && node.clauses.every((c) => c.occur !== 'should')) {
            return merge(node.clauses.map((c) => luceneNodeToIR(c.node, c.occur === 'mustNot', text)));
        }
        return dropped(source, 'OR across different fields has no single LogQL filter. Run each branch as its own query.');
    }
    const { field, value } = node;
    const f = field ?? config.luceneDefaultField;
    if (f === config.luceneDefaultField) {
        if (value.kind === 'range')
            return dropped(source, 'Ranges need a field.');
        if (value.kind === 'regex')
            return changed(source, [{ kind: 'text', op: negate ? 'nre' : 're', value: value.source }], 'Lucene matched the regex against whole words; LogQL matches it anywhere in the line.');
        if (value.pattern !== null)
            return changed(source, [{ kind: 'text', op: negate ? 'nre' : 're', value: `(?i)${value.pattern}` }], 'The wildcard became a case-insensitive regex line filter.');
        return changed(source, [{ kind: 'text', op: negate ? 'hasNot' : 'has', value: value.text }], 'Became a case-insensitive line filter, because Lucene ignores case in message text.');
    }
    if (f === '_exists_' && value.kind === 'text')
        return kept(source, [{ kind: 'exists', field: value.text, negate }]);
    if (value.kind === 'range') {
        const numeric = [value.lo, value.hi].every((b) => b === null || isNumeric(b));
        if (!numeric || negate)
            return dropped(source, negate ? 'An excluded range has no LogQL label filter here.' : 'Text ranges have no LogQL equivalent.');
        const lo = value.lo === null ? [] : [{ kind: 'cmp', field: f, op: value.loInc ? '>=' : '>', value: Number(value.lo) }];
        const hi = value.hi === null ? [] : [{ kind: 'cmp', field: f, op: value.hiInc ? '<=' : '<', value: Number(value.hi) }];
        return kept(source, [...lo, ...hi]);
    }
    if (value.kind === 'regex')
        return kept(source, [{ kind: 'match', field: f, op: negate ? 'nre' : 're', value: value.source }]);
    if (value.pattern === '.*')
        return kept(source, [{ kind: 'exists', field: f, negate }]);
    if (value.pattern !== null)
        return changed(source, [{ kind: 'match', field: f, op: negate ? 'nre' : 're', value: value.pattern }], 'The wildcard became a regex matcher.');
    return kept(source, [{ kind: 'match', field: f, op: negate ? 'neq' : 'eq', value: value.text }]);
};
const luceneToIR = (root, text) => {
    if (root.kind !== 'bool')
        return luceneNodeToIR(root, false, text);
    const { clauses } = root;
    const musts = clauses.filter((c) => c.occur === 'must');
    const nots = clauses.filter((c) => c.occur === 'mustNot');
    const shoulds = clauses.filter((c) => c.occur === 'should');
    const alt = musts.length === 0 && shoulds.length > 1 ? alternation(shoulds) : null;
    const shouldIR = (() => {
        if (!shoulds.length)
            return [];
        if (musts.length)
            return shoulds.map((c) => dropped(sourceOf(text, c.span), 'Optional in Lucene next to required clauses, so it never filtered.'));
        if (shoulds.length === 1)
            return [luceneNodeToIR(shoulds[0].node, false, text)];
        if (alt) {
            return [changed(shoulds.map((c) => sourceOf(text, c.span)).join(' OR '), [{ kind: 'match', field: alt.field, op: 're', value: alt.values.map(escapeRegex).join('|') }], 'OR on one field became a regex alternation.')];
        }
        return shoulds.map((c) => dropped(sourceOf(text, c.span), 'OR across different fields has no single LogQL filter. Run each branch as its own query.'));
    })();
    return merge([
        ...musts.map((c) => luceneNodeToIR(c.node, false, text)),
        ...nots.map((c) => luceneNodeToIR(c.node, true, text)),
        ...shouldIR,
    ]);
};
const firstBy = (q) => {
    if (q.kind === 'log')
        return null;
    if (q.kind === 'range')
        return q.by?.[0] ?? null;
    return q.by?.[0] ?? firstBy(q.inner);
};
const exprToIR = (e, text) => {
    const source = sourceOf(text, e.span);
    if (e.kind !== 'cmp') {
        return e.kind === 'and'
            ? merge([exprToIR(e.left, text), exprToIR(e.right, text)])
            : dropped(source, 'Lucene can express this OR, but not alongside the other filters here. Add it back by hand.');
    }
    if (e.name === '__error__')
        return dropped(source, 'Lucene has no parse-error label.');
    if (typeof e.value === 'number' && ['>', '>=', '<', '<='].includes(e.op)) {
        return kept(source, [{ kind: 'cmp', field: e.name, op: e.op, value: e.value }]);
    }
    const ops = { '=': 'eq', '==': 'eq', '!=': 'neq', '=~': 're', '!~': 'nre' };
    return kept(source, [{ kind: 'match', field: e.name, op: ops[e.op], value: String(e.value) }]);
};
const logqlToIR = (ast, text) => {
    const log = innerLog(ast);
    const wrapper = ast.kind === 'log' ? [] : [{
            ...dropped(`${text.slice(ast.span.start, log.span.start).trim()} … ${text.slice(log.span.end, ast.span.end).trim()}`, firstBy(ast) ? `Aggregation has no Lucene form. The field breakdown for ${firstBy(ast)} shows the same split.` : 'Aggregation has no Lucene form. The histogram shows the line volume over time.'),
            breakdownField: firstBy(ast),
        }];
    const matchers = log.matchers.map((m) => kept(sourceOf(text, m.span), [{
            kind: 'match', field: m.name, op: { '=': 'eq', '!=': 'neq', '=~': 're', '!~': 'nre' }[m.op], value: m.value,
        }]));
    const stages = log.stages.map((st) => {
        const source = sourceOf(text, st.span);
        if (st.kind === 'parser')
            return changed(source, [], 'Not needed: Lucene indexes fields when lines arrive.');
        if (st.kind === 'unwrap')
            return dropped(source, 'Only used by aggregations.');
        if (st.kind === 'filter')
            return exprToIR(st.expr, text);
        const ops = { '|=': 'has', '!=': 'hasNot', '|~': 're', '!~': 'nre' };
        const detail = st.op === '|=' || st.op === '!='
            ? 'Lucene phrase matching ignores case.'
            : 'Lucene matches the regex against whole words.';
        return changed(source, [{ kind: 'text', op: ops[st.op], value: st.value.replace(/^\(\?i\)/, '') }], detail);
    });
    return merge([...wrapper, ...matchers, ...stages]);
};
const luceneRegex = (v) => `/${v.replace(/^\(\?i\)/, '').replace(/\//g, '\\/')}/`;
const condToLucene = (c) => {
    if (c.kind === 'exists')
        return `${c.negate ? 'NOT ' : ''}_exists_:${c.field}`;
    if (c.kind === 'cmp')
        return `${c.field}:${c.op}${c.value}`;
    if (c.kind === 'text') {
        const body = c.op === 'has' || c.op === 'hasNot' ? `"${c.value.replace(/["\\]/g, '\\$&')}"` : `${config.luceneDefaultField}:${luceneRegex(`.*${c.value}.*`)}`;
        return `${c.op === 'hasNot' || c.op === 'nre' ? 'NOT ' : ''}${body}`;
    }
    const body = c.op === 'eq' || c.op === 'neq' ? luceneValue(c.value) : luceneRegex(c.value);
    return `${c.op === 'neq' || c.op === 'nre' ? 'NOT ' : ''}${c.field}:${body}`;
};
const condHolds = (c, labels) => {
    if (c.kind !== 'match' && c.kind !== 'exists')
        return true;
    const v = labels[c.field] ?? '';
    if (c.kind === 'exists')
        return (v !== '') !== c.negate;
    const re = c.op === 're' || c.op === 'nre' ? toRegExp(c.value, true) : null;
    const hit = re ? re.test(v) : v === c.value;
    return c.op === 'eq' || c.op === 're' ? hit : !hit;
};
const condToStage = (c) => {
    if (c.kind === 'cmp')
        return `| ${c.field} ${c.op} ${c.value}`;
    if (c.kind === 'exists')
        return `| ${c.field}${c.negate ? '=' : '!='}""`;
    if (c.kind === 'text') {
        const ops = { has: '|~', hasNot: '!~', re: '|~', nre: '!~' };
        return `${ops[c.op]} ${regexLit(c.op === 'has' || c.op === 'hasNot' ? `(?i)${escapeRegex(c.value)}` : c.value)}`;
    }
    const ops = { eq: '=', neq: '!=', re: '=~', nre: '!~' };
    return `| ${c.field}${ops[c.op]}${c.op === 're' || c.op === 'nre' ? regexLit(c.value) : lit(c.value)}`;
};
const condToMatcher = (c) => {
    if (c.kind === 'exists')
        return `${c.field}${c.negate ? '=""' : '=~".+"'}`;
    if (c.kind !== 'match')
        return '';
    const ops = { eq: '=', neq: '!=', re: '=~', nre: '!~' };
    return `${c.field}${ops[c.op]}${c.op === 're' || c.op === 'nre' ? regexLit(c.value) : lit(c.value)}`;
};
const irToLogql = (ir, catalog) => {
    const isStream = (c) => (c.kind === 'match' || c.kind === 'exists') && isLabel(c.field);
    const streamConds = ir.conds.filter(isStream);
    const textConds = ir.conds.filter((c) => c.kind === 'text');
    const fieldConds = ir.conds.filter((c) => !isStream(c) && c.kind !== 'text');
    const matchers = streamConds.map(condToMatcher);
    const positive = streamConds.some((c) => (c.kind === 'match' && ((c.op === 'eq' && c.value !== '') || (c.op === 're' && !toRegExp(c.value, true).test(''))))
        || (c.kind === 'exists' && !c.negate));
    const fallback = positive ? [] : [{ kind: 'changed', source: '(no stream filter)', detail: `LogQL needs a stream matcher, so ${config.logqlNoSelectorFallback} was added to select every stream.` }];
    const selected = catalog.streams.filter((st) => streamConds.every((c) => condHolds(c, st.labels)) && st.format !== 'text');
    const formats = new Set(selected.map((st) => st.format));
    const parser = formats.size === 1 && formats.has('logfmt') ? 'logfmt' : 'json';
    const others = [...new Set(selected.filter((st) => st.format !== parser).map((st) => st.labels.service))];
    const formatNote = fieldConds.length && others.length
        ? [{ kind: 'changed', source: `| ${parser}`, detail: `${others.join(' and ')} ${others.length > 1 ? 'write' : 'writes'} ${parser === 'json' ? 'logfmt' : 'json'}, so their lines won't match the field filters. Add service to narrow the streams.` }]
        : [];
    const text = [
        `{${[...matchers, ...(positive ? [] : [config.logqlNoSelectorFallback])].join(', ')}}`,
        ...textConds.map(condToStage),
        ...(fieldConds.length ? [`| ${parser}`] : []),
        ...fieldConds.map(condToStage),
    ].join(' ');
    return { text, notes: [...ir.notes, ...fallback, ...formatNote], breakdownField: ir.breakdownField };
};
const irToLucene = (ir) => ({
    text: ir.conds.map(condToLucene).join(' AND '),
    notes: ir.notes,
    breakdownField: ir.breakdownField,
});
export const translate = (from, text, catalog) => {
    const parsed = parseQuery(from, text, catalog);
    if (!parsed.ok)
        return null;
    return parsed.lang === 'lucene'
        ? irToLogql(luceneToIR(parsed.ast, text), catalog)
        : irToLucene(logqlToIR(parsed.ast, text));
};
