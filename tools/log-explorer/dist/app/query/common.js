import { labelNames, } from '../schemas.js';
export const fail = (message, at, length = 1) => {
    throw Object.assign(new Error(message), { at, length: Math.max(1, length) });
};
export const isLocated = (e) => (e instanceof Error && typeof e.at === 'number');
// Fields and values
export const isLabel = (name) => labelNames.includes(name);
export const valueOf = (line, name) => (isLabel(name) ? line.labels[name] : line.fields[name]);
export const isNumeric = (s) => /^-?\d+(?:\.\d+)?$/.test(s);
export const lit = (v) => JSON.stringify(v);
export const regexLit = (v) => (v.includes('`') ? JSON.stringify(v) : `\`${v}\``);
export const keyOf = (labels) => JSON.stringify(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));
export const sourceOf = (text, span) => text.slice(span.start, span.end);
export const luceneValue = (v) => (/^[A-Za-z0-9_@.][\w.@-]*$/.test(v) && !/^(?:AND|OR|NOT|TO)$/.test(v) ? v : `"${v.replace(/["\\]/g, '\\$&')}"`);
// Catalog lookups
export const emptyCatalog = { label: '', start: 0, end: 0, total: 0, streams: [], fields: [] };
export const allFieldNames = (catalog) => [...labelNames, ...parsedFieldNames(catalog)];
export const parsedFieldNames = (catalog) => catalog.fields.filter((f) => !f.isLabel).map((f) => f.name);
export const fieldInfo = (catalog, name) => catalog.fields.find((f) => f.name === name) ?? null;
// Text analysis (the default field)
export const analyzeText = (s) => s.toLowerCase()
    .split(/[^\p{L}\p{N}._@-]+/u)
    .map((t) => t.replace(/^[._-]+|[._-]+$/g, ''))
    .filter(Boolean);
const tokenCache = new WeakMap();
export const tokensOf = (line) => {
    const hit = tokenCache.get(line);
    if (hit)
        return hit;
    const set = new Set(analyzeText(line.raw));
    tokenCache.set(line, set);
    return set;
};
export const rest = (c) => c.s.slice(c.i);
export const eat = (c, re) => {
    const m = re.exec(rest(c));
    if (!m)
        return null;
    c.i += m[0].length;
    return m[0];
};
export const skipWs = (c) => { eat(c, /^\s+/); };
