/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: the hook every view reads. Requests each feed chunk for the chosen span, reports what each feed has recorded, re-runs rate-limited chunks after GitHub's reset, and derives the station readings.
import { useEffect, useMemo, useState } from "react";
import {
  useIsFetching,
  useQueries,
  useQueryClient,
  type UseQueryResult
} from "@tanstack/react-query";
import { requestRefresh } from "./state.js";
import { feeds, spans, type SpanId } from "./config.js";
import {
  criticalMonthQuery,
  epssQuery,
  isRateLimited,
  kevQuery,
  malwareWeekQuery,
  monthChunks,
  newsFeedQuery,
  reviewedWeekQuery,
  weekChunks,
  type Chunk,
  type FeedId
} from "./api/queries.js";
import type {
  Advisory,
  Compromise,
  EpssMap,
  Exploitation,
  Story
} from "./api/schemas.js";
import { read, spanOrigin, type Observations, type Reading } from "./model.js";
import { addDays, addMonths, dayIndex, DAY_MS } from "./lib/utils.js";

/* ----------------------------------------
   Feed status
   ---------------------------------------- */
export type FeedStatus = {
  feed: FeedId;
  chunks: number;
  recorded: number;
  failed: number;
  paused: number;
  partial: number;
  stale: number;
  resumesAt: number | null;
  lastError: string | null;
  fetchedAt: number | null;
};

type AnyChunk = UseQueryResult<Chunk<unknown>>;

const statusOf = (feed: FeedId, results: AnyChunk[]): FeedStatus => {
  const paused = results.filter((result) => isRateLimited(result.error));
  const failed = results.filter(
    (result) => result.isError && !isRateLimited(result.error)
  );
  const resumes = paused.map((result) =>
    isRateLimited(result.error) ? result.error.resetAt : 0
  );
  const times = results
    .map((result) => result.data?.fetchedAt ?? 0)
    .filter(Boolean);
  return {
    feed,
    chunks: results.length,
    recorded: results.filter((result) => result.data).length,
    failed: failed.length,
    paused: paused.length,
    partial: results.filter((result) => result.data?.partial).length,
    stale: results.filter((result) => result.data?.stale).length,
    resumesAt: resumes.length ? Math.min(...resumes) : null,
    lastError: failed[0]?.error?.message ?? null,
    fetchedAt: times.length ? Math.max(...times) : null
  };
};

/* ----------------------------------------
   The observatory
   ---------------------------------------- */
export type Observatory = {
  now: Date;
  days: number;
  readings: Reading[];
  stories: Story[];
  feeds: FeedStatus[];
  recording: boolean;
  empty: boolean;
  fetching: boolean;
  recordedAt: number | null;
  refresh: () => void;
};

const daysOfWeek = (week: string, origin: Date): number[] =>
  Array.from({ length: 7 }, (_, offset) =>
    dayIndex(addDays(new Date(week), offset).toISOString(), origin)
  );

const daysOfMonth = (month: string, origin: Date): number[] => {
  const start = new Date(month);
  const length = Math.round(
    (addMonths(start, 1).getTime() - start.getTime()) / DAY_MS
  );
  return Array.from({ length }, (_, offset) =>
    dayIndex(addDays(start, offset).toISOString(), origin)
  );
};

export const useObservatory = (spanId: SpanId): Observatory => {
  const [now, setNow] = useState(() => new Date());
  const client = useQueryClient();
  const fetching = useIsFetching() > 0;
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), feeds.freshForMs);
    return () => clearInterval(timer);
  }, []);
  const refresh = () => {
    requestRefresh();
    setNow(new Date());
    client.invalidateQueries();
  };
  const weeks =
    spans.find((span) => span.id === spanId)?.weeks ?? spans[0].weeks;
  const days = weeks * 7;
  const origin = spanOrigin(now, days);
  const weekKeys = weekChunks(weeks + 1, now);
  const monthKeys = monthChunks(weeks + 1, now);
  const malwareKeys = weekChunks(feeds.github.malwareWeeks + 1, now);

  const snapshots = useQueries({
    queries: [kevQuery(), epssQuery(), newsFeedQuery(Math.min(days, 120))]
  });
  const reviewed = useQueries({
    queries: weekKeys.map((week, index) => reviewedWeekQuery(week, index === 0))
  });
  const malware = useQueries({
    queries: malwareKeys.map((week, index) =>
      malwareWeekQuery(week, index === 0)
    )
  });
  const critical = useQueries({
    queries: monthKeys.map((month) => criticalMonthQuery(month))
  });
  const [kev, epss, news] = snapshots;

  const githubResults = [...reviewed, ...malware];
  const resetAt = Math.min(
    ...githubResults.map((result) =>
      isRateLimited(result.error) ? result.error.resetAt : Infinity
    )
  );
  useEffect(() => {
    if (!Number.isFinite(resetAt)) return undefined;
    const timer = setTimeout(
      () =>
        client.refetchQueries({
          predicate: (query) => isRateLimited(query.state.error)
        }),
      Math.max(1000, resetAt - Date.now() + 1500)
    );
    return () => clearTimeout(timer);
  }, [client, resetAt]);

  const stamp = [...snapshots, ...reviewed, ...malware, ...critical]
    .map((result) => result.dataUpdatedAt)
    .join(",");

  const derived = useMemo(() => {
    const advisories: Advisory[] = [
      ...reviewed.flatMap((result) => result.data?.records ?? []),
      ...critical.flatMap((result) => result.data?.records ?? [])
    ];
    const compromises: Compromise[] = malware.flatMap(
      (result) => result.data?.records ?? []
    );
    const exploitations: Exploitation[] = kev.data?.records ?? [];
    const scores: EpssMap = epss.data?.records ?? {};
    const stories: Story[] = news.data?.records ?? [];
    const kevReady = Boolean(kev.data);

    const coveredDays = (
      results: AnyChunk[],
      keys: string[],
      expand: (key: string) => number[]
    ) =>
      new Set(
        kevReady
          ? keys.flatMap((key, index) =>
              results[index]?.data ? expand(key) : []
            )
          : []
      );

    const observations: Observations = {
      now,
      days,
      advisories,
      compromises,
      exploitations,
      epss: scores,
      stories,
      coverage: {
        ecosystem: coveredDays(reviewed, weekKeys, (week) =>
          daysOfWeek(week, origin)
        ),
        platform: coveredDays(critical, monthKeys, (month) =>
          daysOfMonth(month, origin)
        )
      },
      compromiseCoverage: coveredDays(malware, malwareKeys, (week) =>
        daysOfWeek(week, origin)
      )
    };
    const readings = read(observations);
    return {
      readings,
      stories,
      recording: readings.some((reading) => !reading.settled),
      empty: !advisories.length && !exploitations.length
    };
  }, [stamp, days, now]);

  const feedStatus = [
    statusOf("ghsa-reviewed", reviewed),
    statusOf("ghsa-malware", malware),
    statusOf("nvd-critical", critical),
    statusOf("kev", [kev]),
    statusOf("epss", [epss]),
    statusOf("news", [news])
  ];
  const times = feedStatus.flatMap((status) => status.fetchedAt ?? []);
  return {
    now,
    days,
    ...derived,
    fetching,
    refresh,
    recordedAt: times.length ? Math.max(...times) : null,
    feeds: feedStatus
  };
};
