/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: data-agnostic helpers: checking values against schemas with readable failures, UTC day and week arithmetic, number and date formatting, statistics, and reading design tokens from CSS.
import type { z } from "zod";

/* ----------------------------------------
   Schemas
   ---------------------------------------- */
export const check = <S extends z.ZodType>(
  schema: S,
  value: unknown,
  source: string
): z.infer<S> => {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const [head, ...rest] = issue?.path ?? [];
  const record = typeof head === "number" ? ` [${head}]` : "";
  const field = (typeof head === "number" ? rest : [head, ...rest])
    .filter((part) => part !== undefined)
    .join(".");
  throw Object.assign(
    new Error(
      `${source}${record} ${field || "(root)"}: ${issue?.message ?? "invalid"}`
    ),
    { name: "SchemaError" }
  );
};

export const checkOr = <S extends z.ZodType>(
  schema: S,
  value: unknown,
  fallback: z.infer<S>
): z.infer<S> => {
  const result = schema.safeParse(value);
  return result.success ? result.data : fallback;
};

/* ----------------------------------------
   Days and weeks (UTC)
   ---------------------------------------- */
export const DAY_MS = 86_400_000;

export const dayStart = (date: Date): Date =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_MS);

export const weekStart = (date: Date): Date => {
  const day = dayStart(date);
  return addDays(day, -((day.getUTCDay() + 6) % 7));
};

export const monthStart = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

export const addMonths = (date: Date, months: number): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

export const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

export const dayIndex = (iso: string, origin: Date): number =>
  Math.floor((Date.parse(iso) - origin.getTime()) / DAY_MS);

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

/* ----------------------------------------
   Statistics
   ---------------------------------------- */
export const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

export const quantile = (values: readonly number[], q: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const groupBy = <T, K extends string>(
  items: readonly T[],
  key: (item: T) => K
): Map<K, T[]> =>
  items.reduce((groups, item) => {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
    return groups;
  }, new Map<K, T[]>());

export const uniqueBy = <T>(
  items: readonly T[],
  key: (item: T) => string
): T[] => [...new Map(items.map((item) => [key(item), item])).values()];

/* ----------------------------------------
   Formatting
   ---------------------------------------- */
export const formatCount = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, {
    notation: value >= 10_000 ? "compact" : "standard"
  }).format(value);

export const formatRatio = (ratio: number): string =>
  `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}×`;

export const formatPercent = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: value < 0.1 ? 1 : 0
  }).format(value);

export const formatDay = (
  iso: string,
  locale: string,
  timeZone: string,
  withYear = false
): string =>
  new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
    timeZone
  }).format(new Date(iso));

export const formatClock = (
  time: number,
  locale: string,
  timeZone: string
): string =>
  new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short"
  }).format(new Date(time));

export const formatMonth = (
  date: Date,
  locale: string,
  withYear: boolean
): string => {
  const month = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC"
  }).format(date);
  return withYear
    ? `${month} ’${String(date.getUTCFullYear()).slice(2)}`
    : month;
};

/* ----------------------------------------
   Design tokens
   ---------------------------------------- */
export const token = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const tokenMs = (name: string): number => {
  const raw = token(name);
  return raw.endsWith("ms")
    ? Number.parseFloat(raw)
    : Number.parseFloat(raw) * 1000;
};
