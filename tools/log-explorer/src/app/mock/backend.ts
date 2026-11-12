/// <reference path="../shims.d.ts" />
import type { QueryClient } from '@tanstack/react-query';
import { config } from '../config.js';
import {
  arrayOf, captureCheck, caseRecordCheck, enrichmentCheck, linesCheck, ruleCheck,
  type CaseRecord, type Check, type EnrichmentFile, type CaptureFile, type LinesFile, type LogLine, type Rule,
} from '../schemas.js';
import { appendLines, createStore, type Store } from './engine.js';

// Shared state of the mock backend
export interface Backend {
  readonly store: Store;
  readonly enrichment: EnrichmentFile;
  readonly seedRules: readonly Rule[];
  readonly seedCases: readonly CaseRecord[];
  readonly tail: LinesFile;
  readonly tailListeners: Set<(added: readonly LogLine[], now: number, exhausted: boolean) => void>;
  readonly changeListeners: Set<() => void>;
  clock: { readonly origin: number; now: number; cursor: number; timer: number | null };
}

const loadJson = <T>(client: QueryClient, name: string, check: Check<T>) => client.fetchQuery({
  queryKey: ['static', name],
  staleTime: Infinity,
  queryFn: async ({ signal }) => {
    const response = await fetch(`${config.dataPath}${name}`, { signal });
    if (!response.ok) throw new Error(`Couldn't load ${name} (HTTP ${response.status}).`);
    return check(await response.json(), name);
  },
});

// The capture is split across files to stay under CodePen's 1 MB text-file limit
const loadCapture = async (client: QueryClient): Promise<CaptureFile> => {
  const head = await loadJson(client, 'capture-1.json', captureCheck);
  const rest = await Promise.all(head.parts.map((name) => loadJson(client, name, linesCheck)));
  return { ...head, lines: [...head.lines, ...rest.flatMap((part) => part.lines)] };
};

const instances = new WeakMap<QueryClient, Promise<Backend>>();

export const backendFor = (client: QueryClient): Promise<Backend> => {
  const existing = instances.get(client);
  if (existing) return existing;
  const created = Promise.all([
    loadCapture(client),
    loadJson(client, 'enrichment.json', enrichmentCheck),
    loadJson(client, 'rules.json', arrayOf(ruleCheck)),
    loadJson(client, 'cases.json', arrayOf(caseRecordCheck)),
    loadJson(client, 'tail.json', linesCheck),
  ]).then(([capture, enrichment, seedRules, seedCases, tail]): Backend => {
    const store = createStore(capture);
    return {
      store, enrichment, seedRules, seedCases, tail, tailListeners: new Set(), changeListeners: new Set(), clock: { origin: store.end, now: store.end, cursor: 0, timer: null },
    };
  });
  created.catch(() => instances.delete(client));
  instances.set(client, created);
  return created;
};

// Simulated network
export const respond = <T>(signal: AbortSignal | undefined, work: () => T): Promise<T> => {
  const [lo, hi] = config.mock.latencyMs;
  const wait = lo + Math.random() * (hi - lo);
  return new Promise<T>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('The request was cancelled.', 'AbortError')); };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      if (Math.random() < config.mock.failureRate) {
        reject(new Error('The demo backend dropped this request (simulated failure).'));
        return;
      }
      try {
        resolve(work());
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    }, wait);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
};

// Simulated clock: plays tail.json onward while anyone is tailing
const tick = (b: Backend) => {
  const now = b.clock.now + config.mock.tailTickMs * config.mock.tailSpeed;
  const due = b.tail.lines.slice(b.clock.cursor).filter(([dt]) => b.clock.origin + dt <= now);
  Object.assign(b.clock, { now, cursor: b.clock.cursor + due.length });
  const added = appendLines(b.store, due.map(([dt, si, raw]) => [b.clock.origin + dt, si, raw] as const), now);
  const exhausted = b.clock.cursor >= b.tail.lines.length;
  b.tailListeners.forEach((fn) => fn(added, now, exhausted));
  b.changeListeners.forEach((fn) => fn());
  if (exhausted && b.clock.timer !== null) {
    window.clearInterval(b.clock.timer);
    b.clock.timer = null;
  }
};

export const startClock = (b: Backend) => {
  if (b.clock.timer !== null || b.clock.cursor >= b.tail.lines.length) return;
  b.clock.timer = window.setInterval(() => tick(b), config.mock.tailTickMs);
};

export const stopClockIfIdle = (b: Backend) => {
  if (b.tailListeners.size || b.clock.timer === null) return;
  window.clearInterval(b.clock.timer);
  b.clock.timer = null;
};

// Local persistence (best effort: storage can be unavailable)
export const readStored = <T>(key: string, check: Check<T>): T | null => {
  try {
    const raw = window.localStorage.getItem(`${config.mock.storageKey}:${key}`);
    return raw === null ? null : check(JSON.parse(raw), key);
  } catch {
    return null;
  }
};

export const writeStored = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(`${config.mock.storageKey}:${key}`, JSON.stringify(value));
  } catch {
    return undefined;
  }
  return undefined;
};
