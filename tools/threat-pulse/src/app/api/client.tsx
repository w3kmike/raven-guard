/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: the TanStack Query client and its provider, a request helper whose failures carry status and headers, and a limiter that paces requests to one host.
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* ----------------------------------------
   Requests
   ---------------------------------------- */
export type HttpFailure = Error & {
  status: number;
  headers: Headers;
  url: string;
};

export const isHttpFailure = (error: unknown): error is HttpFailure =>
  error instanceof Error && error.name === "HttpFailure";

export const request = async (
  url: string,
  init?: RequestInit
): Promise<Response> => {
  const response = await fetch(url, init);
  if (response.ok) return response;
  throw Object.assign(
    new Error(`${response.status} from ${new URL(url).host}`),
    {
      name: "HttpFailure",
      status: response.status,
      headers: response.headers,
      url
    }
  );
};

export const readJson = async (
  response: Response,
  onBytes: (bytes: number) => void
): Promise<unknown> => {
  const reader = response.body?.getReader();
  if (!reader) return response.json();
  const decoder = new TextDecoder();
  const pump = async (text: string, bytes: number): Promise<string> => {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    onBytes(bytes + value.byteLength);
    return pump(
      text + decoder.decode(value, { stream: true }),
      bytes + value.byteLength
    );
  };
  return JSON.parse(await pump("", 0)) as unknown;
};

/* ----------------------------------------
   Limiter: concurrency plus spacing per host
   ---------------------------------------- */
export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

export const createLimiter = ({
  concurrency,
  spacingMs = 0
}: {
  concurrency: number;
  spacingMs?: number;
}): Limiter => {
  const waiting: (() => void)[] = [];
  let active = 0;
  let lastStart = 0;

  const next = (): void => {
    if (active >= concurrency || !waiting.length) return;
    const wait = Math.max(0, lastStart + spacingMs - Date.now());
    if (wait > 0) {
      setTimeout(next, wait);
      return;
    }
    active += 1;
    lastStart = Date.now();
    waiting.shift()?.();
  };

  return <T,>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      waiting.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            next();
          });
      });
      next();
    });
};

/* ----------------------------------------
   Query client
   ---------------------------------------- */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: Infinity
    }
  }
});

export const QueryProvider = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
