/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
/* ----------------------------------------
   Schemas
   ---------------------------------------- */
export const check = (schema, value, source) => {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const [head, ...rest] = issue?.path ?? [];
  const record = typeof head === "number" ? ` [${head}]` : "";
  const field = (typeof head === "number" ? rest : [head, ...rest]).filter(part => part !== undefined).join(".");
  throw Object.assign(new Error(`${source}${record} ${field || "(root)"}: ${issue?.message ?? "invalid"}`), {
    name: "SchemaError"
  });
};
export const checkOr = (schema, value, fallback) => {
  const result = schema.safeParse(value);
  return result.success ? result.data : fallback;
};
/* ----------------------------------------
   Days and weeks (UTC)
   ---------------------------------------- */
export const DAY_MS = 86_400_000;
export const dayStart = date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
export const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
export const weekStart = date => {
  const day = dayStart(date);
  return addDays(day, -((day.getUTCDay() + 6) % 7));
};
export const monthStart = date => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
export const addMonths = (date, months) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
export const isoDay = date => date.toISOString().slice(0, 10);
export const dayIndex = (iso, origin) => Math.floor((Date.parse(iso) - origin.getTime()) / DAY_MS);
export const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
/* ----------------------------------------
   Statistics
   ---------------------------------------- */
export const sum = values => values.reduce((total, value) => total + value, 0);
export const quantile = (values, q) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
};
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const groupBy = (items, key) => items.reduce((groups, item) => {
  const k = key(item);
  groups.set(k, [...(groups.get(k) ?? []), item]);
  return groups;
}, new Map());
export const uniqueBy = (items, key) => [...new Map(items.map(item => [key(item), item])).values()];
/* ----------------------------------------
   Formatting
   ---------------------------------------- */
export const formatCount = (value, locale) => new Intl.NumberFormat(locale, {
  notation: value >= 10_000 ? "compact" : "standard"
}).format(value);
export const formatRatio = ratio => `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}×`;
export const formatPercent = (value, locale) => new Intl.NumberFormat(locale, {
  style: "percent",
  maximumFractionDigits: value < 0.1 ? 1 : 0
}).format(value);
export const formatDay = (iso, locale, timeZone, withYear = false) => new Intl.DateTimeFormat(locale, {
  month: "short",
  day: "numeric",
  year: withYear ? "numeric" : undefined,
  timeZone
}).format(new Date(iso));
export const formatClock = (time, locale, timeZone) => new Intl.DateTimeFormat(locale, {
  hour: "2-digit",
  minute: "2-digit",
  timeZone,
  timeZoneName: "short"
}).format(new Date(time));
export const formatMonth = (date, locale, withYear) => {
  const month = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC"
  }).format(date);
  return withYear ? `${month} ’${String(date.getUTCFullYear()).slice(2)}` : month;
};
/* ----------------------------------------
   Design tokens
   ---------------------------------------- */
export const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const tokenMs = name => {
  const raw = token(name);
  return raw.endsWith("ms") ? Number.parseFloat(raw) : Number.parseFloat(raw) * 1000;
};