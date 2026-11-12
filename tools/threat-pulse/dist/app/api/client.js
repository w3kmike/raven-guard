import { jsx as _jsx } from "react/jsx-runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
export const isHttpFailure = error => error instanceof Error && error.name === "HttpFailure";
export const request = async (url, init) => {
  const response = await fetch(url, init);
  if (response.ok) return response;
  throw Object.assign(new Error(`${response.status} from ${new URL(url).host}`), {
    name: "HttpFailure",
    status: response.status,
    headers: response.headers,
    url
  });
};
export const readJson = async (response, onBytes) => {
  const reader = response.body?.getReader();
  if (!reader) return response.json();
  const decoder = new TextDecoder();
  const pump = async (text, bytes) => {
    const {
      done,
      value
    } = await reader.read();
    if (done) return text + decoder.decode();
    onBytes(bytes + value.byteLength);
    return pump(text + decoder.decode(value, {
      stream: true
    }), bytes + value.byteLength);
  };
  return JSON.parse(await pump("", 0));
};
export const createLimiter = ({
  concurrency,
  spacingMs = 0
}) => {
  const waiting = [];
  let active = 0;
  let lastStart = 0;
  const next = () => {
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
  return task => new Promise((resolve, reject) => {
    waiting.push(() => {
      task().then(resolve, reject).finally(() => {
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
export const QueryProvider = ({
  children
}) => _jsx(QueryClientProvider, {
  client: queryClient,
  children: children
});