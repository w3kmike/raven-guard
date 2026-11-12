import type { Zone } from './config.js';

// Search helpers
export const lowerBound = (xs: readonly number[], target: number, lo = 0, hi = xs.length): number => {
  if (lo >= hi) return lo;
  const mid = (lo + hi) >>> 1;
  return xs[mid] < target ? lowerBound(xs, target, mid + 1, hi) : lowerBound(xs, target, lo, mid);
};

export const levenshtein = (a: string, b: string): number => {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  const last = [...a].reduce((prev, ca, i) => [...b].reduce(
    (cur, cb, j) => [...cur, Math.min(cur[j] + 1, prev[j + 1] + 1, prev[j] + (ca === cb ? 0 : 1))],
    [i + 1],
  ), row);
  return last[b.length];
};

export const closest = (word: string, options: readonly string[], maxDistance: number): string | null => {
  const ranked = options
    .map((o) => ({ o, d: levenshtein(word.toLowerCase(), o.toLowerCase()) }))
    .filter((x) => x.d > 0 && x.d <= maxDistance)
    .sort((x, y) => x.d - y.d);
  return ranked[0]?.o ?? null;
};

export const niceStep = (spanMs: number, target: number, steps: readonly number[]): number => (
  steps.find((s) => spanMs / s <= target) ?? steps[steps.length - 1]
);

// Regex helpers
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const toRegExp = (source: string, anchored: boolean) => {
  const insensitive = source.startsWith('(?i)');
  const body = insensitive ? source.slice(4) : source;
  return new RegExp(anchored ? `^(?:${body})$` : body, insensitive ? 'i' : '');
};

// Formatting
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

const parts = (ts: number, zone: Zone) => {
  const d = new Date(ts);
  return zone === 'utc'
    ? { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, da: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), ms: d.getUTCMilliseconds() }
    : { y: d.getFullYear(), mo: d.getMonth() + 1, da: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds(), ms: d.getMilliseconds() };
};

export const zoneLabel = (zone: Zone) => (zone === 'utc' ? 'UTC' : 'local');

export const formatClock = (ts: number, zone: Zone, precision: 'ms' | 's' | 'm' = 'ms') => {
  const p = parts(ts, zone);
  const base = `${pad(p.h)}:${pad(p.mi)}`;
  if (precision === 'm') return base;
  return precision === 's' ? `${base}:${pad(p.s)}` : `${base}:${pad(p.s)}.${pad(p.ms, 3)}`;
};

export const formatDate = (ts: number, zone: Zone) => {
  const p = parts(ts, zone);
  return `${p.y}-${pad(p.mo)}-${pad(p.da)}`;
};

export const formatStamp = (ts: number, zone: Zone) => `${formatDate(ts, zone)} ${formatClock(ts, zone, 's')}`;

export const formatIso = (ts: number) => new Date(ts).toISOString();

export const parseStamp = (text: string, zone: Zone): number | null => {
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?\s*$/.exec(text);
  if (!m) return null;
  const [y, mo, da, h, mi, s] = m.slice(1).map((x) => Number(x ?? 0));
  const ts = zone === 'utc' ? Date.UTC(y, mo - 1, da, h, mi, s) : new Date(y, mo - 1, da, h, mi, s).getTime();
  return Number.isNaN(ts) ? null : ts;
};

export const formatSpan = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
};

const counter = new Intl.NumberFormat('en-US');
const compactFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const formatCount = (n: number) => counter.format(n);
export const formatNumber = (n: number) => compactFmt.format(n);
export const formatShare = (part: number, whole: number) => {
  if (whole === 0) return '0%';
  const pct = (part / whole) * 100;
  return pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`;
};

export const plural = (n: number, one: string, many = `${one}s`) => `${formatCount(n)} ${n === 1 ? one : many}`;

export const cssMs = (name: string) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000;
};

export const cssPx = (name: string, el: Element = document.documentElement) => (
  parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0
);
