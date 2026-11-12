/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: one query per live resource: GitHub reviewed advisories and malicious packages by week, NVD critical CVEs by month, the CISA KEV catalog, EPSS scores and security news, each checked, compacted and cached.
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { catchAll, feeds, stations, type Severity } from "../config.js";
import {
  getState,
  readChunk,
  recordGithubBudget,
  recordProgress,
  writeChunk
} from "../state.js";
import {
  addDays,
  addMonths,
  check,
  DAY_MS,
  isoDay,
  monthStart,
  uniqueBy,
  weekStart
} from "../lib/utils.js";
import { createLimiter, isHttpFailure, readJson, request } from "./client.js";
import {
  advisorySchema,
  compromiseSchema,
  epssMapSchema,
  epssPageSchema,
  exploitationSchema,
  ghsaPageSchema,
  hnPageSchema,
  nvdPageSchema,
  storySchema,
  type Advisory,
  type Compromise,
  type EpssMap,
  type Exploitation,
  type GhsaAdvisory,
  type NvdVulnerability,
  type Story
} from "./schemas.js";

/* ----------------------------------------
   Chunks and the cache in front of them
   ---------------------------------------- */
export type Chunk<T> = {
  records: T;
  partial: boolean;
  fetchedAt: number;
  stale: boolean;
};

export type FeedId =
  "ghsa-reviewed" | "ghsa-malware" | "nvd-critical" | "kev" | "epss" | "news";

const cached = async <R extends z.ZodType>(
  key: string,
  records: R,
  closed: boolean,
  freshForMs: number,
  load: (
    previous: z.infer<R> | null,
    fetchedAt: number
  ) => Promise<{
    records: z.infer<R>;
    partial: boolean;
  }>
): Promise<Chunk<z.infer<R>>> => {
  const saved = await readChunk(key, records);
  const usable = saved && saved.version === feeds.cacheVersion ? saved : null;
  const fresh =
    usable &&
    (usable.closed ||
      (Date.now() - usable.fetchedAt < freshForMs &&
        usable.fetchedAt >= getState().refreshedAt));
  if (usable && fresh) {
    return {
      records: usable.records,
      partial: usable.partial,
      fetchedAt: usable.fetchedAt,
      stale: false
    };
  }
  try {
    const fetched = await load(usable?.records ?? null, usable?.fetchedAt ?? 0);
    const fetchedAt = Date.now();
    await writeChunk(key, {
      version: feeds.cacheVersion,
      fetchedAt,
      closed: closed && !fetched.partial,
      partial: fetched.partial,
      records: fetched.records
    });
    return { ...fetched, fetchedAt, stale: false };
  } catch (error) {
    if (usable) {
      return {
        records: usable.records,
        partial: usable.partial,
        fetchedAt: usable.fetchedAt,
        stale: true
      };
    }
    throw error;
  }
};

export const weekChunks = (weeks: number, now: Date): string[] =>
  Array.from({ length: weeks }, (_, index) =>
    isoDay(addDays(weekStart(now), -7 * index))
  );

export const monthChunks = (weeks: number, now: Date): string[] => {
  const first = monthStart(addDays(now, -7 * weeks));
  const count =
    (now.getUTCFullYear() - first.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    first.getUTCMonth() +
    1;
  return Array.from({ length: count }, (_, index) =>
    isoDay(addMonths(monthStart(now), -index))
  );
};

const closedAfter = (end: Date, days: number): boolean =>
  Date.now() > end.getTime() + days * DAY_MS;

/* ----------------------------------------
   Station lookups
   ---------------------------------------- */
const stationByEcosystem = new Map(
  stations.flatMap((station) =>
    (station.ghsa ?? []).map((name) => [name, station.id] as const)
  )
);
const stationByVendor = new Map(
  stations.flatMap((station) =>
    (station.vendors ?? []).map((name) => [name, station.id] as const)
  )
);

const toSeverity = (value: string | null | undefined): Severity => {
  const normal = value === "medium" ? "moderate" : value;
  return normal === "critical" ||
    normal === "high" ||
    normal === "moderate" ||
    normal === "low"
    ? normal
    : "unknown";
};

const severityFromScore = (score: number | null): Severity => {
  if (score === null) return "unknown";
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "moderate";
  return score > 0 ? "low" : "unknown";
};

/* ----------------------------------------
   GitHub Advisory Database
   ---------------------------------------- */
export type RateLimited = Error & { resetAt: number };

export const isRateLimited = (error: unknown): error is RateLimited =>
  error instanceof Error && error.name === "RateLimited";

const rateLimited = (resetAt: number): RateLimited =>
  Object.assign(new Error("GitHub rate budget spent"), {
    name: "RateLimited",
    resetAt
  });

const githubLimiter = createLimiter({ concurrency: feeds.github.concurrency });

const readBudget = (headers: Headers): void => {
  const limit = Number(headers.get("x-ratelimit-limit"));
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (headers.has("x-ratelimit-remaining")) {
    recordGithubBudget({ limit, remaining, resetAt: reset * 1000 });
  }
};

const github = (url: string, priority: boolean): Promise<Response> =>
  githubLimiter(async () => {
    const { githubBudget, githubToken } = getState();
    const reserve = priority ? 0 : feeds.github.reserve;
    if (
      githubBudget &&
      githubBudget.remaining <= reserve &&
      githubBudget.resetAt > Date.now()
    ) {
      throw rateLimited(githubBudget.resetAt);
    }
    try {
      const response = await request(url, {
        headers: {
          Accept: "application/vnd.github+json",
          ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {})
        }
      });
      readBudget(response.headers);
      return response;
    } catch (error) {
      if (
        isHttpFailure(error) &&
        (error.status === 403 || error.status === 429)
      ) {
        readBudget(error.headers);
        const reset = Number(error.headers.get("x-ratelimit-reset")) * 1000;
        throw rateLimited(reset || Date.now() + 60 * 60 * 1000);
      }
      throw error;
    }
  });

const nextLink = (headers: Headers): string | null =>
  headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;

const ghsaPages = async (
  url: string,
  cap: number,
  priority: boolean,
  source: string,
  gathered: GhsaAdvisory[] = []
): Promise<{ items: GhsaAdvisory[]; partial: boolean }> => {
  const response = await github(url, priority);
  const items = [
    ...gathered,
    ...check(ghsaPageSchema, await response.json(), source)
  ];
  const next = nextLink(response.headers);
  if (!next) return { items, partial: false };
  if (cap <= 1) return { items, partial: true };
  return ghsaPages(next, cap - 1, priority, source, items);
};

const ghsaUrl = (type: "reviewed" | "malware", week: string): string => {
  const end = isoDay(addDays(new Date(week), 6));
  return `${feeds.github.base}?type=${type}&per_page=${feeds.github.perPage}&published=${week}..${end}`;
};

const toAdvisory = (item: GhsaAdvisory): Advisory | null => {
  if (item.withdrawn_at) return null;
  const packages = (item.vulnerabilities ?? []).flatMap((entry) =>
    entry.package ? [entry.package] : []
  );
  const matched = [
    ...new Set(
      packages.flatMap((pkg) => stationByEcosystem.get(pkg.ecosystem) ?? [])
    )
  ];
  const stationIds = matched.length ? matched : [catchAll.id];
  return {
    id: item.ghsa_id,
    cve: item.cve_id,
    title: item.summary,
    severity: toSeverity(item.severity),
    cvss: item.cvss?.score ?? null,
    published: item.published_at,
    source: "ghsa",
    stationIds,
    vendor: matched.length ? null : (packages[0]?.ecosystem ?? null),
    products: [
      ...new Set(packages.flatMap((pkg) => (pkg.name ? [pkg.name] : [])))
    ].slice(0, 4),
    fixes: (item.vulnerabilities ?? [])
      .flatMap((entry) =>
        entry.package?.name
          ? [
              {
                pkg: entry.package.name,
                affected: entry.vulnerable_version_range ?? null,
                patched: entry.first_patched_version ?? null
              }
            ]
          : []
      )
      .slice(0, 4),
    url: item.html_url
  };
};

const toCompromise = (item: GhsaAdvisory): Compromise | null => {
  const pkg = item.vulnerabilities?.find((entry) => entry.package)?.package;
  const stationId = pkg ? stationByEcosystem.get(pkg.ecosystem) : undefined;
  if (!pkg || !stationId || item.withdrawn_at) return null;
  return {
    id: item.ghsa_id,
    stationId,
    pkg: pkg.name ?? item.summary,
    published: item.published_at,
    url: item.html_url
  };
};

export const reviewedWeekQuery = (week: string, newest: boolean) => {
  const closed = closedAfter(
    addDays(new Date(week), 7),
    feeds.github.closeAfterDays
  );
  return queryOptions({
    queryKey: ["ghsa-reviewed", week] as const,
    staleTime: closed ? Infinity : feeds.freshForMs,
    refetchInterval: closed ? false : feeds.freshForMs,
    queryFn: () =>
      cached(
        `ghsa-reviewed:${week}`,
        z.array(advisorySchema),
        closed,
        feeds.freshForMs,
        async () => {
          const { items, partial } = await ghsaPages(
            ghsaUrl("reviewed", week),
            feeds.github.reviewedPageCap,
            newest,
            `GitHub advisories, week of ${week}`
          );
          return {
            records: items.flatMap((item) => toAdvisory(item) ?? []),
            partial
          };
        }
      )
  });
};

export const malwareWeekQuery = (week: string, newest: boolean) => {
  const closed = closedAfter(
    addDays(new Date(week), 7),
    feeds.github.closeAfterDays
  );
  return queryOptions({
    queryKey: ["ghsa-malware", week] as const,
    staleTime: closed ? Infinity : feeds.freshForMs,
    refetchInterval: closed ? false : feeds.freshForMs,
    queryFn: () =>
      cached(
        `ghsa-malware:${week}`,
        z.array(compromiseSchema),
        closed,
        feeds.freshForMs,
        async () => {
          const { items, partial } = await ghsaPages(
            ghsaUrl("malware", week),
            feeds.github.malwarePageCap,
            newest,
            `GitHub malware advisories, week of ${week}`
          );
          return {
            records: items.flatMap((item) => toCompromise(item) ?? []),
            partial
          };
        }
      )
  });
};

/* ----------------------------------------
   NVD: critical CVEs and the KEV catalog
   ---------------------------------------- */
const nvdLimiter = createLimiter({
  concurrency: 1,
  spacingMs: feeds.nvd.spacingMs
});

const nvdPages = async (
  params: string,
  source: string,
  progressKey: string | null = null,
  startIndex = 0,
  gathered: NvdVulnerability[] = []
): Promise<NvdVulnerability[]> => {
  const url = `${feeds.nvd.base}?${params}&resultsPerPage=${feeds.nvd.resultsPerPage}&startIndex=${startIndex}`;
  const response = await nvdLimiter(() => request(url));
  const body = progressKey
    ? await readJson(response, (bytes) => recordProgress(progressKey, bytes))
    : await response.json();
  if (progressKey) recordProgress(progressKey, null);
  const page = check(nvdPageSchema, body, source);
  const items = [...gathered, ...page.vulnerabilities];
  const next = page.startIndex + page.resultsPerPage;
  return next < page.totalResults && page.vulnerabilities.length
    ? nvdPages(params, source, progressKey, next, items)
    : items;
};

const cpeParts = (
  item: NvdVulnerability
): { vendor: string; product: string }[] =>
  (item.cve.configurations ?? [])
    .flatMap((config) => config.nodes)
    .flatMap((node) => node.cpeMatch ?? [])
    .map((match) => match.criteria.split(":"))
    .map((parts) => ({ vendor: parts[3] ?? "", product: parts[4] ?? "" }))
    .filter((part) => part.vendor);

const vendorsOf = (item: NvdVulnerability): string[] => {
  const domain =
    item.cve.sourceIdentifier?.split("@")[1]?.split(".").slice(0, -1) ?? [];
  const named = item.cve.cisaVulnerabilityName?.split(" ")[0]?.toLowerCase();
  return [
    ...new Set([
      ...cpeParts(item).map((part) => part.vendor),
      ...domain,
      ...(named ? [named] : [])
    ])
  ];
};

const stationsOf = (item: NvdVulnerability): string[] => {
  const matched = [
    ...new Set(
      vendorsOf(item).flatMap((vendor) => stationByVendor.get(vendor) ?? [])
    )
  ];
  return matched.length ? matched : [catchAll.id];
};

const vendorOf = (item: NvdVulnerability): string | null => {
  const cpe = cpeParts(item)[0]?.vendor;
  if (cpe) return cpe;
  const domain = item.cve.sourceIdentifier?.split("@")[1]?.split(".");
  const label = domain?.[domain.length - 2];
  if (label) return label;
  return item.cve.cisaVulnerabilityName?.split(" ")[0]?.toLowerCase() ?? null;
};

const productsOf = (item: NvdVulnerability): string[] =>
  uniqueBy(cpeParts(item), (part) => `${part.vendor}:${part.product}`)
    .map((part) => `${part.vendor} ${part.product}`.replaceAll("_", " "))
    .slice(0, 4);

const scoreOf = (item: NvdVulnerability): number | null => {
  const metrics = item.cve.metrics;
  const metric =
    metrics?.cvssMetricV31?.[0] ??
    metrics?.cvssMetricV30?.[0] ??
    metrics?.cvssMetricV40?.[0];
  return metric?.cvssData.baseScore ?? null;
};

const descriptionOf = (item: NvdVulnerability): string => {
  const text =
    item.cve.descriptions.find((entry) => entry.lang === "en")?.value ??
    item.cve.id;
  return text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text;
};

const nvdUrl = (id: string): string => `https://nvd.nist.gov/vuln/detail/${id}`;

const live = (item: NvdVulnerability): boolean =>
  item.cve.vulnStatus !== "Rejected";

export const criticalMonthQuery = (month: string) => {
  const start = new Date(month);
  const end = new Date(Math.min(addMonths(start, 1).getTime() - 1, Date.now()));
  const closed = closedAfter(end, feeds.nvd.closeAfterDays);
  return queryOptions({
    queryKey: ["nvd-critical", month] as const,
    staleTime: closed ? Infinity : feeds.freshForMs,
    refetchInterval: closed ? false : feeds.freshForMs,
    queryFn: () =>
      cached(
        `nvd-critical:${feeds.nvd.cacheTag}:${month}`,
        z.array(advisorySchema),
        closed,
        feeds.freshForMs,
        async () => {
          const items = await nvdPages(
            `cvssV3Severity=CRITICAL&pubStartDate=${start.toISOString()}&pubEndDate=${end.toISOString()}`,
            `NVD critical CVEs, ${month.slice(0, 7)}`
          );
          const records = items.filter(live).map((item): Advisory => {
            const cvss = scoreOf(item);
            return {
              id: item.cve.id,
              cve: item.cve.id,
              title: descriptionOf(item),
              severity: severityFromScore(cvss),
              cvss,
              published: item.cve.published,
              source: "nvd",
              stationIds: stationsOf(item),
              vendor: vendorOf(item),
              products: productsOf(item),
              fixes: [],
              url: nvdUrl(item.cve.id)
            };
          });
          return { records, partial: false };
        }
      )
  });
};

const toExploitation = (item: NvdVulnerability): Exploitation[] =>
  item.cve.cisaExploitAdd
    ? [
        {
          cve: item.cve.id,
          added: item.cve.cisaExploitAdd,
          published: item.cve.published,
          name: item.cve.cisaVulnerabilityName ?? descriptionOf(item),
          stationIds: stationsOf(item),
          vendor: vendorOf(item),
          products: productsOf(item),
          cvss: scoreOf(item),
          action: item.cve.cisaRequiredAction ?? null,
          due: item.cve.cisaActionDue ?? null,
          url: nvdUrl(item.cve.id)
        }
      ]
    : [];

export const kevQuery = () =>
  queryOptions({
    queryKey: ["kev"] as const,
    staleTime: feeds.snapshotForMs,
    refetchInterval: feeds.snapshotForMs,
    queryFn: () =>
      cached(
        `kev:${feeds.nvd.cacheTag}`,
        z.array(exploitationSchema),
        false,
        feeds.snapshotForMs,
        async (previous, fetchedAt) => {
          const from = addDays(new Date(fetchedAt), -2);
          const incremental =
            previous &&
            Date.now() - from.getTime() < (feeds.nvd.maxRangeDays - 1) * DAY_MS;
          const params = incremental
            ? `hasKev&kevStartDate=${from.toISOString()}&kevEndDate=${new Date().toISOString()}`
            : "hasKev";
          const items = await nvdPages(params, "NVD KEV catalog", "kev");
          const fresh = items.filter(live).flatMap(toExploitation);
          return {
            records: uniqueBy(
              [...(incremental ? previous : []), ...fresh],
              (entry) => entry.cve
            ),
            partial: false
          };
        }
      )
  });

/* ----------------------------------------
   EPSS: exploitation likelihood
   ---------------------------------------- */
const epssPages = async (
  offset = 0,
  gathered: EpssMap = {}
): Promise<EpssMap> => {
  const url = `${feeds.epss.base}?epss-gt=${feeds.epss.cutoff}&limit=${feeds.epss.pageSize}&offset=${offset}`;
  const page = check(
    epssPageSchema,
    await (await request(url)).json(),
    "EPSS scores"
  );
  const scores = {
    ...gathered,
    ...Object.fromEntries(page.data.map((row) => [row.cve, Number(row.epss)]))
  };
  const next = offset + feeds.epss.pageSize;
  return next < page.total && page.data.length
    ? epssPages(next, scores)
    : scores;
};

export const epssQuery = () =>
  queryOptions({
    queryKey: ["epss"] as const,
    staleTime: feeds.snapshotForMs,
    refetchInterval: feeds.snapshotForMs,
    queryFn: () =>
      cached("epss", epssMapSchema, false, feeds.snapshotForMs, async () => ({
        records: await epssPages(),
        partial: false
      }))
  });

/* ----------------------------------------
   News: security stories from Hacker News
   ---------------------------------------- */
const newsSince = (days: number): number =>
  Math.floor((Date.now() - days * DAY_MS) / 1000);

const newsQuery = async (term: string, since: number): Promise<Story[]> => {
  const params = new URLSearchParams({
    query: term,
    tags: "story",
    numericFilters: `created_at_i>${since},points>=${feeds.news.minPoints}`,
    hitsPerPage: String(feeds.news.hitsPerPage),
    restrictSearchableAttributes: "title",
    typoTolerance: "false",
    advancedSyntax: "true"
  });
  const named = new RegExp(`\\b${term.replace(/[-\s]+/g, "[-\\s]?")}`, "i");
  const page = check(
    hnPageSchema,
    await (await request(`${feeds.news.base}?${params}`)).json(),
    `News, "${term}"`
  );
  return page.hits.flatMap((hit) => {
    const discussion = `https://news.ycombinator.com/item?id=${hit.objectID}`;
    return hit.title && named.test(hit.title)
      ? [
          {
            id: hit.objectID,
            title: hit.title,
            url: hit.url ?? discussion,
            discussion,
            points: hit.points ?? 0,
            comments: hit.num_comments ?? 0,
            published: hit.created_at
          }
        ]
      : [];
  });
};

export const newsFeedQuery = (days: number) =>
  queryOptions({
    queryKey: ["news", days, feeds.cacheVersion] as const,
    staleTime: feeds.freshForMs,
    refetchInterval: feeds.freshForMs,
    queryFn: () =>
      cached(
        `news:${days}:v2`,
        z.array(storySchema),
        false,
        feeds.freshForMs,
        async () => {
          const since = newsSince(days);
          const batches = await Promise.all(
            feeds.news.queries.map((term) => newsQuery(term, since))
          );
          return {
            records: uniqueBy(batches.flat(), (story) => story.id).sort(
              (a, b) => b.published.localeCompare(a.published)
            ),
            partial: false
          };
        }
      )
  });
