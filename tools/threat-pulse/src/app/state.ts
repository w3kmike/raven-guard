/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: the store for state outside the URL: the reader's optional GitHub token, the GitHub rate budget the feeds report, and the IndexedDB cache that keeps closed feed chunks between visits.
import { useSyncExternalStore } from "react";
import { get, set } from "idb-keyval";
import type { z } from "zod";
import {
  cacheEntrySchema,
  githubTokenSchema,
  watchlistSchema,
  type CacheEntry,
  type Watchlist
} from "./schemas.js";
import { checkOr } from "./lib/utils.js";

/* ----------------------------------------
   Store
   ---------------------------------------- */
export type GithubBudget = {
  limit: number;
  remaining: number;
  resetAt: number;
};

type State = {
  githubToken: string | null;
  githubBudget: GithubBudget | null;
  storage: "available" | "unavailable";
  refreshedAt: number;
  progress: Record<string, number>;
  watchlist: Watchlist;
};

const TOKEN_KEY = "threat-pulse:github-token";
const WATCHLIST_KEY = "threat-pulse:watchlist";
const emptyWatchlist: Watchlist = { pins: [], terms: [] };

const readWatchlist = (): Watchlist => {
  try {
    const saved = localStorage.getItem(WATCHLIST_KEY);
    return checkOr(
      watchlistSchema,
      saved ? JSON.parse(saved) : emptyWatchlist,
      emptyWatchlist
    );
  } catch {
    return emptyWatchlist;
  }
};

const readToken = (): string | null => {
  try {
    return checkOr(
      githubTokenSchema.nullable(),
      localStorage.getItem(TOKEN_KEY),
      null
    );
  } catch {
    return null;
  }
};

let state: State = {
  githubToken: readToken(),
  githubBudget: null,
  storage: "available",
  refreshedAt: 0,
  progress: {},
  watchlist: readWatchlist()
};
const listeners = new Set<() => void>();

const update = (patch: Partial<State>): void => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

export const getState = (): State => state;

export const useStore = <T>(select: (current: State) => T): T =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => select(state)
  );

/* ----------------------------------------
   Actions
   ---------------------------------------- */
export const saveGithubToken = (value: string): boolean => {
  const result = githubTokenSchema.safeParse(value.trim());
  if (!result.success) return false;
  try {
    localStorage.setItem(TOKEN_KEY, result.data);
  } catch {}
  update({ githubToken: result.data, githubBudget: null });
  return true;
};

export const forgetGithubToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  update({ githubToken: null, githubBudget: null });
};

export const requestRefresh = (): void => update({ refreshedAt: Date.now() });

export const recordProgress = (feed: string, bytes: number | null): void => {
  const { [feed]: _done, ...rest } = state.progress;
  update({ progress: bytes === null ? rest : { ...rest, [feed]: bytes } });
};

const saveWatchlist = (watchlist: Watchlist): void => {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  } catch {}
  update({ watchlist });
};

export const togglePin = (stationId: string): void => {
  const { pins, terms } = state.watchlist;
  saveWatchlist({
    terms,
    pins: pins.includes(stationId)
      ? pins.filter((pin) => pin !== stationId)
      : [...pins, stationId]
  });
};

export const addWatchTerm = (value: string): boolean => {
  const term = value.trim().toLowerCase();
  const { pins, terms } = state.watchlist;
  const next = { pins, terms: [...new Set([...terms, term])] };
  if (!term || !watchlistSchema.safeParse(next).success) return false;
  saveWatchlist(next);
  return true;
};

export const removeWatchTerm = (term: string): void =>
  saveWatchlist({
    pins: state.watchlist.pins,
    terms: state.watchlist.terms.filter((entry) => entry !== term)
  });

export const recordGithubBudget = (budget: GithubBudget): void => {
  const current = state.githubBudget;
  const changed =
    !current ||
    current.remaining !== budget.remaining ||
    current.resetAt !== budget.resetAt ||
    current.limit !== budget.limit;
  if (changed) update({ githubBudget: budget });
};

/* ----------------------------------------
   Chunk cache (IndexedDB)
   ---------------------------------------- */
export const readChunk = async <R extends z.ZodType>(
  key: string,
  records: R
): Promise<CacheEntry<z.infer<R>> | null> => {
  if (state.storage === "unavailable") return null;
  try {
    const saved: unknown = await get(key);
    if (saved === undefined) return null;
    const parsed = cacheEntrySchema(records).safeParse(saved);
    return parsed.success ? (parsed.data as CacheEntry<z.infer<R>>) : null;
  } catch {
    update({ storage: "unavailable" });
    return null;
  }
};

export const writeChunk = async <T>(
  key: string,
  entry: CacheEntry<T>
): Promise<void> => {
  if (state.storage === "unavailable") return;
  try {
    await set(key, entry);
  } catch {
    update({ storage: "unavailable" });
  }
};
