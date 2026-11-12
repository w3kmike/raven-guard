import {
  labelNames, type Catalog, type FieldValue, type LabelName, type LogLine,
} from '../schemas.js';

// Shared types
export interface Span { readonly start: number; readonly end: number }
export interface Fix { readonly label: string; readonly text: string }
export interface Diagnostic {
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly at: number;
  readonly length: number;
  readonly fix?: Fix;
}
export type SynKind =
  | 'field' | 'value' | 'string' | 'regex' | 'keyword' | 'function'
  | 'number' | 'duration' | 'operator' | 'punct' | 'bare' | 'plain';
export interface SynToken { readonly kind: SynKind; readonly start: number; readonly end: number }

interface Located { at: number; length: number }
export const fail = (message: string, at: number, length = 1): never => {
  throw Object.assign(new Error(message), { at, length: Math.max(1, length) });
};
export const isLocated = (e: unknown): e is Error & Located => (
  e instanceof Error && typeof (e as Partial<Located>).at === 'number'
);

// Fields and values
export const isLabel = (name: string): name is LabelName => (labelNames as readonly string[]).includes(name);
export const valueOf = (line: LogLine, name: string): FieldValue | undefined => (
  isLabel(name) ? line.labels[name] : line.fields[name]
);
export const isNumeric = (s: string) => /^-?\d+(?:\.\d+)?$/.test(s);
export const lit = (v: string) => JSON.stringify(v);
export const regexLit = (v: string) => (v.includes('`') ? JSON.stringify(v) : `\`${v}\``);
export const keyOf = (labels: Readonly<Record<string, string>>) => JSON.stringify(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)));
export const sourceOf = (text: string, span: Span) => text.slice(span.start, span.end);

export const luceneValue = (v: string) => (
  /^[A-Za-z0-9_@.][\w.@-]*$/.test(v) && !/^(?:AND|OR|NOT|TO)$/.test(v) ? v : `"${v.replace(/["\\]/g, '\\$&')}"`
);

// Catalog lookups
export const emptyCatalog: Catalog = { label: '', start: 0, end: 0, total: 0, streams: [], fields: [] };
export const allFieldNames = (catalog: Catalog): readonly string[] => [...labelNames, ...parsedFieldNames(catalog)];
export const parsedFieldNames = (catalog: Catalog): readonly string[] => catalog.fields.filter((f) => !f.isLabel).map((f) => f.name);
export const fieldInfo = (catalog: Catalog, name: string) => catalog.fields.find((f) => f.name === name) ?? null;

// Text analysis (the default field)
export const analyzeText = (s: string) => s.toLowerCase()
  .split(/[^\p{L}\p{N}._@-]+/u)
  .map((t) => t.replace(/^[._-]+|[._-]+$/g, ''))
  .filter(Boolean);
const tokenCache = new WeakMap<LogLine, ReadonlySet<string>>();
export const tokensOf = (line: LogLine): ReadonlySet<string> => {
  const hit = tokenCache.get(line);
  if (hit) return hit;
  const set = new Set(analyzeText(line.raw));
  tokenCache.set(line, set);
  return set;
};

// Character cursor for the Lucene parser
export interface Cursor { readonly s: string; i: number }
export const rest = (c: Cursor) => c.s.slice(c.i);
export const eat = (c: Cursor, re: RegExp): string | null => {
  const m = re.exec(rest(c));
  if (!m) return null;
  c.i += m[0].length;
  return m[0];
};
export const skipWs = (c: Cursor) => { eat(c, /^\s+/); };
