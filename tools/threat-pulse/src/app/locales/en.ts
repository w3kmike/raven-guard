/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: English text for Threat Pulse, typed by Strings: every label, sentence and formatted phrase, written in the vocabulary of vulnerability intelligence and seismic bulletins.
import type { Strings } from "./types.js";

const plural = (count: number, one: string, many: string): string =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;

export const en: Strings = {
  documentTitle: "Threat Pulse — vulnerability observatory",
  masthead: {
    wordmark: "Threat Pulse",
    tagline: "Vulnerability observatory",
    views: { now: "Stations", trends: "Trends", wire: "Wire" },
    viewsLabel: "Views",
    spanLabel: "Span",
    spans: {
      "16w": { short: "16 wk", long: "16 weeks" },
      "1y": { short: "1 yr", long: "one year" },
      "2y": { short: "2 yr", long: "two years" }
    },
    recorded: (clock) => `Recorded ${clock}`,
    refresh: "Refresh feeds",
    refreshing: "Recording…",
    feedsButton: (recorded, total, paused) =>
      paused
        ? `Feeds · ${plural(paused, "chunk", "chunks")} paused`
        : recorded < total
          ? `Feeds · recording ${recorded}/${total}`
          : "Feeds · current"
  },
  register: {
    heading: "Where the ground is moving",
    lede: "Each station's last 14 days, read against its own normal week.",
    kindLabel: "Stations",
    kinds: { all: "All", ecosystem: "Ecosystems", platform: "Platforms" },
    sortLabel: "Order",
    sorts: { departure: "Departure", pressure: "Pressure", name: "A–Z" },
    columns: {
      station: "Station",
      strip: "7-day pressure, against normal",
      ledger: "Last 14 days vs normal",
      counts: "Exploited · Malicious",
      exploited: "Exploited",
      malicious: "Malicious"
    },
    catchAll: "catch-all",
    kind: { ecosystem: "package ecosystem", platform: "vendor platform" },
    recording: "recording",
    quiet: "quiet station",
    exploited: (count) => `${count} exploited`,
    malicious: (count) => `${count.toLocaleString("en-US")} malicious`,
    rowLabel: (name, ratio, exploited, malicious) =>
      `${name}: ${ratio} of normal; ${plural(exploited, "exploitation", "exploitations")} in 14 days; ${plural(
        malicious,
        "malicious package",
        "malicious packages"
      )} in 7 days`,
    legend: {
      normal: "normal range",
      unusual: "unusual",
      exploited: "exploited (CISA KEV)",
      malicious: "malicious packages",
      unrecorded: "not yet recorded"
    },
    empty: "No station matches this filter.",
    summary: (top, ratio, unusual) =>
      `${top} is moving most, at ${ratio} its normal. ${plural(unusual, "station is", "stations are")} outside their normal range.`,
    tableCaption: "Stations by departure from normal",
    lastWeek: (ratio) => `last wk ${ratio}`,
    progress: (weeks, weeksTotal, months, monthsTotal) =>
      `Recording: ${weeks} of ${weeksTotal} weeks of GitHub advisories, ${months} of ${monthsTotal} months of NVD critical CVEs.`,
    kevBytes: (megabytes) => `KEV catalog: ${megabytes} MB received`,
    pausedPrompt: (clock) =>
      `GitHub's hourly limit paused the ecosystem record until ${clock}. A token raises it to 5,000 requests an hour.`,
    stripReading: (date, ratio, events) =>
      `${date} · ${ratio} of normal · ${plural(events, "event", "events")} in the trace`,
    watch: {
      heading: "Your watchlist",
      pin: (name) => `Pin ${name} to your watchlist`,
      unpin: (name) => `Unpin ${name}`,
      fieldLabel: "Watch a vendor, product or package",
      add: "Watch",
      remove: (term) => `Stop watching ${term}`,
      invalid: "Use 2–60 characters, up to 30 terms.",
      summary: (events) =>
        `${plural(events, "event", "events")} in the last 14 days touch what you watch.`,
      none: "Nothing you watch appears in the last 14 days.",
      empty: "Pin stations or watch a product to keep them here.",
      watched: (count) => `${count} watched`
    }
  },
  focus: {
    close: "Back to stations",
    headline: {
      unusual: (name, ratio) =>
        `${name} is running at ${ratio} its normal pressure.`,
      steady: (name) => `${name} is within its normal range.`,
      below: (name, ratio) =>
        `${name} is quieter than usual, at ${ratio} its normal.`,
      recording: (name) => `${name} is still recording its baseline.`,
      quiet: (name) =>
        `${name} is a quiet station; single events move it a long way.`
    },
    driver: (exploitedCount, exploited, critical, advisories, top, kind) => {
      const parts = [
        exploited.length
          ? `${plural(exploitedCount, "KEV listing", "KEV listings")} (${exploited.slice(0, 2).join(", ")}${exploited.length > 2 ? ", …" : ""})`
          : "",
        critical
          ? `${plural(critical, kind === "platform" ? "critical CVE" : "critical advisory", kind === "platform" ? "critical CVEs" : "critical advisories")}`
          : advisories
            ? plural(advisories, "advisory", "advisories")
            : ""
      ].filter(Boolean);
      if (!parts.length) return "";
      const lead = top ? `, mostly ${top.name}` : "";
      return `Driven by ${parts.join(" and ")}${lead}.`;
    },
    watchedHeading: "Touching your watchlist",
    figuresCaption: "Last 14 days",
    catchAllKind: "catch-all · no station claims these",
    unassigned: {
      lede: "Critical CVEs, KEV listings and stories that no station claims. Read the vendors below more than the strip: they show which station to add next.",
      heading: "Vendors no station claims",
      caption:
        "Across the span, ranked by exploitations, then events. A vendor that keeps appearing belongs in a station in config.ts, or in a station of its own.",
      columns: {
        vendor: "Vendor",
        events: "Events",
        exploited: "Exploited",
        critical: "Critical",
        latest: "Latest"
      },
      empty: "Every event in the span was claimed by a station.",
      reporters: {
        wordfence: "WordPress plugins (via Wordfence)",
        patchstack: "WordPress plugins (via Patchstack)",
        github: "Open source (via GitHub)",
        mitre: "Assigned by MITRE",
        vuldb: "Reported via VulDB",
        incibe: "Reported via INCIBE",
        twcert: "Reported via TWCERT",
        jpcert: "Reported via JPCERT",
        hackerone: "Reported via HackerOne",
        huntr: "Reported via huntr"
      }
    },
    dayHeading: (range) => `Events behind the trace, ${range}`,
    dayEmpty: "Nothing recorded at this station in those days.",
    clearDay: "Show all days",
    swarmKeys:
      "Events by date and weight. Arrow keys step through them; Enter opens one.",
    advisoriesFor: {
      ecosystem: "advisories",
      platform: "critical CVEs"
    },
    stats: {
      ratio: "vs normal",
      advisories: "advisories, 14 d",
      critical: "critical",
      exploited: "exploited",
      malicious: "malicious, 7 d"
    },
    maliciousChange: (now, before) =>
      before === 0
        ? now
          ? "none the week before"
          : ""
        : `${now >= before ? "+" : "−"}${Math.abs(now - before)} on the week before`,
    swarmTitle: "Events in the span",
    swarmCaption: (count, shown, above) =>
      count > shown
        ? `${plural(shown, "event", "events")} weighing over ${above}, of ${count.toLocaleString("en-US")} in the span, placed by date and weight.`
        : `${plural(count, "event", "events")}, placed by date and weight.`,
    swarmAxis: "weight",
    eventsHeading: "Heaviest in the last 14 days",
    eventsEmpty: "Nothing recorded at this station in the last 14 days.",
    newsHeading: "In the news",
    newsEmpty: (name) => `No stories tied to ${name} in this window.`,
    tableCaption: "Events at this station"
  },
  event: {
    back: "All events",
    exploited: "Exploited in the wild",
    cvss: "CVSS",
    epss: "EPSS, 30-day exploitation odds",
    epssLow: "under 10%",
    listed: "Listed in KEV",
    published: "Published",
    affected: "Affected",
    source: { ghsa: "GitHub reviewed advisory", nvd: "NVD record" },
    open: "Open the record",
    weight: "Weight",
    delay: (days) =>
      days < 0
        ? `listed ${plural(-days, "day", "days")} before NVD published it`
        : days === 0
          ? "listed the day it was disclosed"
          : `listed ${plural(days, "day", "days")} after disclosure`,
    mentions: "Stories naming it",
    fixes: "Versions",
    patched: (version) => `patched in ${version}`,
    unpatched: "no patched version yet",
    action: "CISA required action",
    due: "Federal deadline"
  },
  trends: {
    heading: (span) => `The record over ${span}`,
    lede: "Monthly volume and exploitation at every station, and how fast disclosure turns into attack.",
    multiplesTitle: "Monthly record by station",
    multiplesCaption:
      "Bars above the line count advisories; vermilion bars below count exploitations. Grey bars are months the span only partly covers; hatched months are not yet recorded.",
    advisories: "advisories",
    exploited: "exploited",
    unrecorded: "not yet recorded",
    peak: (count, month) => `peak ${count.toLocaleString("en-US")}, ${month}`,
    delayTitle: "From disclosure to exploitation",
    delayCaption:
      "Each mark is one vulnerability CISA listed as exploited in this span, placed by the days between its CVE publication and its listing.",
    delayAxis: "days from disclosure to KEV listing",
    sameDay: "same day",
    median: (days) => `median ${plural(days, "day", "days")}`,
    delayEmpty: "No exploitations listed in this span yet.",
    tableCaption: "Monthly record"
  },
  wire: {
    heading: "Security wire",
    lede: "Stories from Hacker News, tied to the stations and CVEs they name.",
    stationFilter: "Station",
    allStations: "All stations",
    points: (count) => plural(count, "point", "points"),
    comments: (count) => plural(count, "comment", "comments"),
    discussion: "discussion",
    empty: "No stories on the wire for this filter.",
    volumeLabel: "stories per day",
    discussed: "Most discussed this week",
    inTheNews: "Stations in the news this week"
  },
  feeds: {
    title: "Feeds",
    close: "Close feeds",
    names: {
      "ghsa-reviewed": "GitHub reviewed advisories",
      "ghsa-malware": "GitHub malicious packages",
      "nvd-critical": "NVD critical CVEs",
      kev: "CISA KEV, via NVD",
      epss: "FIRST EPSS scores",
      news: "Hacker News"
    },
    recorded: (recorded, total) =>
      total === 1
        ? recorded
          ? "recorded"
          : "recording"
        : `${recorded} of ${total} chunks recorded`,
    paused: (clock) => `paused by GitHub's hourly limit until ${clock}`,
    failed: (message) => `not reachable (${message})`,
    stale: "showing the copy saved on this device",
    partial: "busiest weeks capped; counts are lower bounds",
    budget: (remaining, limit, clock) =>
      `GitHub budget ${remaining} of ${limit}, refills ${clock}`,
    tokenHeading: "GitHub token",
    tokenHelp:
      "Without a token GitHub allows 60 requests an hour, enough for about 16 weeks. A token with no scopes lifts that to 5,000. It stays in this browser and is sent only to api.github.com.",
    tokenLabel: "Personal access token",
    tokenSave: "Save token",
    tokenForget: "Forget token",
    tokenSaved: "Token saved. GitHub feeds now use it.",
    tokenInvalid: "That is not a GitHub token (ghp_… or github_pat_…).",
    storageBlocked:
      "Storage is blocked here, so every visit records from scratch."
  },
  table: { show: "Show as table", hide: "Hide table" },
  errors: {
    stopped: (message) => `This instrument stopped: ${message}`,
    reload: "Restart the observatory",
    feedsDown: "No feed is reachable. Readings resume when the network returns."
  }
};
