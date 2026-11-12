/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: schemas for data that enters outside the network: URL search parameters, the saved GitHub token, and feed chunks cached in IndexedDB, with the types inferred from them.
import { z } from "zod";

/* ----------------------------------------
   URL search parameters
   ---------------------------------------- */
export const searchSchema = z.object({
  span: z.enum(["16w", "1y", "2y"]).catch("16w"),
  kind: z.enum(["all", "ecosystem", "platform"]).catch("all"),
  sort: z.enum(["departure", "pressure", "name"]).catch("departure"),
  station: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .optional()
    .catch(undefined),
  day: z.coerce.number().int().min(0).max(800).optional().catch(undefined),
  event: z
    .string()
    .regex(/^(CVE-\d{4}-\d{4,}|GHSA(-[23456789cfghjmpqrvwx]{4}){3})$/i)
    .optional()
    .catch(undefined)
});
export type Search = z.infer<typeof searchSchema>;

/* ----------------------------------------
   Saved settings
   ---------------------------------------- */
export const githubTokenSchema = z
  .string()
  .regex(/^(gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255})$/);

export const watchlistSchema = z.object({
  pins: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(40),
  terms: z.array(z.string().min(2).max(60)).max(30)
});
export type Watchlist = z.infer<typeof watchlistSchema>;

/* ----------------------------------------
   Cached feed chunks
   ---------------------------------------- */
export const cacheEntrySchema = <R extends z.ZodType>(record: R) =>
  z.object({
    version: z.number(),
    fetchedAt: z.number(),
    closed: z.boolean(),
    partial: z.boolean(),
    records: record
  });

export type CacheEntry<T> = {
  version: number;
  fetchedAt: number;
  closed: boolean;
  partial: boolean;
  records: T;
};
