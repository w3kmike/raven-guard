/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: Strings, the shape of every user-facing text in Threat Pulse, so each locale supplies the same labels, sentences and formatted phrases.
import type { FeedId } from "../api/queries.js";
import type { SpanId, StationKind } from "../config.js";

export type Strings = {
  documentTitle: string;
  masthead: {
    wordmark: string;
    tagline: string;
    views: { now: string; trends: string; wire: string };
    viewsLabel: string;
    spanLabel: string;
    spans: Record<SpanId, { short: string; long: string }>;
    recorded: (clock: string) => string;
    refresh: string;
    refreshing: string;
    feedsButton: (recorded: number, total: number, paused: number) => string;
  };
  register: {
    heading: string;
    lede: string;
    kindLabel: string;
    kinds: Record<"all" | StationKind, string>;
    sortLabel: string;
    sorts: Record<"departure" | "pressure" | "name", string>;
    columns: {
      station: string;
      strip: string;
      ledger: string;
      counts: string;
      exploited: string;
      malicious: string;
    };
    catchAll: string;
    kind: Record<StationKind, string>;
    recording: string;
    quiet: string;
    exploited: (count: number) => string;
    malicious: (count: number) => string;
    rowLabel: (
      name: string,
      ratio: string,
      exploited: number,
      malicious: number
    ) => string;
    legend: {
      normal: string;
      unusual: string;
      exploited: string;
      malicious: string;
      unrecorded: string;
    };
    empty: string;
    summary: (top: string, ratio: string, unusual: number) => string;
    tableCaption: string;
    lastWeek: (ratio: string) => string;
    progress: (
      weeks: number,
      weeksTotal: number,
      months: number,
      monthsTotal: number
    ) => string;
    kevBytes: (megabytes: string) => string;
    pausedPrompt: (clock: string) => string;
    stripReading: (date: string, ratio: string, events: number) => string;
    watch: {
      heading: string;
      pin: (name: string) => string;
      unpin: (name: string) => string;
      fieldLabel: string;
      add: string;
      remove: (term: string) => string;
      invalid: string;
      summary: (events: number) => string;
      none: string;
      empty: string;
      watched: (count: number) => string;
    };
  };
  focus: {
    close: string;
    headline: {
      unusual: (name: string, ratio: string) => string;
      steady: (name: string) => string;
      below: (name: string, ratio: string) => string;
      recording: (name: string) => string;
      quiet: (name: string) => string;
    };
    driver: (
      exploitedCount: number,
      exploited: string[],
      critical: number,
      advisories: number,
      top: { name: string; count: number } | null,
      kind: StationKind
    ) => string;
    watchedHeading: string;
    figuresCaption: string;
    catchAllKind: string;
    unassigned: {
      lede: string;
      heading: string;
      caption: string;
      columns: {
        vendor: string;
        events: string;
        exploited: string;
        critical: string;
        latest: string;
      };
      empty: string;
      reporters: Record<string, string>;
    };
    dayHeading: (date: string) => string;
    dayEmpty: string;
    clearDay: string;
    swarmKeys: string;
    advisoriesFor: Record<StationKind, string>;
    stats: {
      ratio: string;
      advisories: string;
      critical: string;
      exploited: string;
      malicious: string;
    };
    maliciousChange: (now: number, before: number) => string;
    swarmTitle: string;
    swarmCaption: (count: number, shown: number, above: string) => string;
    swarmAxis: string;
    eventsHeading: string;
    eventsEmpty: string;
    newsHeading: string;
    newsEmpty: (name: string) => string;
    tableCaption: string;
  };
  event: {
    back: string;
    exploited: string;
    cvss: string;
    epss: string;
    epssLow: string;
    listed: string;
    published: string;
    affected: string;
    source: Record<"ghsa" | "nvd", string>;
    open: string;
    weight: string;
    delay: (days: number) => string;
    mentions: string;
    fixes: string;
    patched: (version: string) => string;
    unpatched: string;
    action: string;
    due: string;
  };
  trends: {
    heading: (span: string) => string;
    lede: string;
    multiplesTitle: string;
    multiplesCaption: string;
    advisories: string;
    exploited: string;
    unrecorded: string;
    peak: (count: number, month: string) => string;
    delayTitle: string;
    delayCaption: string;
    delayAxis: string;
    sameDay: string;
    median: (days: number) => string;
    delayEmpty: string;
    tableCaption: string;
  };
  wire: {
    heading: string;
    lede: string;
    stationFilter: string;
    allStations: string;
    points: (count: number) => string;
    comments: (count: number) => string;
    discussion: string;
    empty: string;
    volumeLabel: string;
    discussed: string;
    inTheNews: string;
  };
  feeds: {
    title: string;
    close: string;
    names: Record<FeedId, string>;
    recorded: (recorded: number, total: number) => string;
    paused: (clock: string) => string;
    failed: (message: string) => string;
    stale: string;
    partial: string;
    budget: (remaining: number, limit: number, clock: string) => string;
    tokenHeading: string;
    tokenHelp: string;
    tokenLabel: string;
    tokenSave: string;
    tokenForget: string;
    tokenSaved: string;
    tokenInvalid: string;
    storageBlocked: string;
  };
  table: { show: string; hide: string };
  errors: {
    stopped: (message: string) => string;
    reload: string;
    feedsDown: string;
  };
};
