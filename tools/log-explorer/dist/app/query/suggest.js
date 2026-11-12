import { config } from '../config.js';
import { labelNames } from '../schemas.js';
import { allFieldNames, fieldInfo, isLabel, lit, luceneValue, parsedFieldNames, } from './common.js';
import { RANGE_FNS, logqlFunctions } from './logql.js';
const startsWith = (s, prefix) => s.toLowerCase().startsWith(prefix.toLowerCase());
const lineCount = (n) => `${n.toLocaleString('en-US')} ${n === 1 ? 'line' : 'lines'}`;
const fieldDetail = (catalog, name) => {
    if (isLabel(name))
        return 'stream label';
    const stat = fieldInfo(catalog, name);
    return stat ? `field · in ${lineCount(stat.count)}` : 'field · not in range';
};
const valueSuggestions = (catalog, field, prefix, render) => ((fieldInfo(catalog, field)?.top ?? [])
    .filter((r) => startsWith(r.value, prefix) && r.value !== prefix)
    .slice(0, config.suggestionLimit)
    .map((r) => ({ label: r.value, detail: lineCount(r.count), insert: render(r.value), kind: 'value' })));
export const suggest = (lang, text, cursor, catalog) => {
    const allFields = allFieldNames(catalog);
    const parsedFields = parsedFieldNames(catalog);
    const before = text.slice(0, cursor);
    const none = { items: [], from: cursor, to: cursor };
    const limit = (items, from) => ({ items: items.slice(0, config.suggestionLimit), from, to: cursor });
    if (lang === 'lucene') {
        const val = /([A-Za-z_@][\w.@-]*):("?)([^\s()":]*)$/.exec(before);
        if (val) {
            const [, field, quote, prefix] = val;
            if (field === '_exists_') {
                return limit(allFields.filter((f) => startsWith(f, prefix) && f !== prefix).map((f) => ({ label: f, detail: fieldDetail(catalog, f), insert: f, kind: 'field' })), cursor - prefix.length);
            }
            return limit(valueSuggestions(catalog, field, prefix, luceneValue), cursor - prefix.length - quote.length);
        }
        const word = /(?:^|[\s(!+-])([A-Za-z_@][\w.@-]*)$/.exec(before);
        if (!word)
            return none;
        const prefix = word[1];
        const keywords = ['AND', 'OR', 'NOT'].filter((k) => k.startsWith(prefix) && prefix === prefix.toUpperCase() && k !== prefix)
            .map((k) => ({ label: k, detail: 'operator', insert: `${k} `, kind: 'keyword' }));
        const fields = [...allFields, '_exists_'].filter((f) => startsWith(f, prefix) && f !== prefix)
            .map((f) => ({ label: f, detail: f === '_exists_' ? 'lines that have a field' : fieldDetail(catalog, f), insert: `${f}:`, kind: isLabel(f) ? 'label' : 'field' }));
        return limit([...keywords, ...fields], cursor - prefix.length);
    }
    const inSelector = before.lastIndexOf('{') > before.lastIndexOf('}');
    if (inSelector) {
        const val = /([A-Za-z_]\w*)\s*(?:=~|!~|!=|=)\s*"([^"]*)$/.exec(before);
        if (val)
            return limit(valueSuggestions(catalog, val[1], val[2], (v) => `${lit(v).slice(1, -1)}"`), cursor - val[2].length);
        const name = /[{,]\s*([A-Za-z_]\w*)?$/.exec(before);
        if (!name)
            return none;
        const prefix = name[1] ?? '';
        return limit(labelNames.filter((l) => startsWith(l, prefix) && l !== prefix)
            .map((l) => ({ label: l, detail: 'stream label', insert: `${l}="`, kind: 'label' })), cursor - prefix.length);
    }
    const val = /\|\s*([A-Za-z_]\w*)\s*(?:=~|!~|!=|==|=)\s*"([^"]*)$/.exec(before);
    if (val)
        return limit(valueSuggestions(catalog, val[1], val[2], (v) => `${lit(v).slice(1, -1)}"`), cursor - val[2].length);
    const stage = /\|\s*([A-Za-z_]\w*)?$/.exec(before);
    if (stage && !/\|[=~]\s*$/.test(before)) {
        const prefix = stage[1] ?? '';
        const parsedYet = /\|\s*(?:json|logfmt)\b/.test(before);
        const stages = ['json', 'logfmt', 'unwrap'].filter((s) => startsWith(s, prefix) && s !== prefix)
            .map((s) => ({ label: s, detail: s === 'unwrap' ? 'number for aggregation' : 'parser', insert: s === 'unwrap' ? 'unwrap ' : s, kind: 'stage' }));
        const fields = (parsedYet ? [...parsedFields, ...labelNames] : [...labelNames]).filter((f) => startsWith(f, prefix) && f !== prefix)
            .map((f) => ({ label: f, detail: fieldDetail(catalog, f), insert: f, kind: isLabel(f) ? 'label' : 'field' }));
        return limit([...stages, ...fields], cursor - prefix.length);
    }
    const fn = /(?:^|[(\s])([a-z_]+)$/.exec(before);
    if (fn && !/[{|]/.test(before.slice(-fn[1].length - 1, -fn[1].length))) {
        return limit(logqlFunctions.filter((f) => f.startsWith(fn[1]) && f !== fn[1])
            .map((f) => ({ label: f, detail: RANGE_FNS.includes(f) ? 'range function' : 'aggregation', insert: `${f}(`, kind: 'function' })), cursor - fn[1].length);
    }
    return none;
};
