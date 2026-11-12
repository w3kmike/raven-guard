/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
// Intended use: the analysis layer. Turns live records into station readings: weighted events, each station's normal, its departure from normal, daily strip series, monthly trends and exploitation delays.
import { catchAll, scoring, stations } from "./config.js";
import { addDays, addMonths, dayIndex, daysBetween, dayStart, isoDay, monthStart, quantile, sum } from "./lib/utils.js";
/* ----------------------------------------
   Weighing events
   ---------------------------------------- */
export const epssOf = (cve, epss) => cve ? epss[cve] ?? null : null;
const advisoryWeight = (advisory, epss) => scoring.severityWeight[advisory.severity] * (1 + scoring.epssBoost * (epssOf(advisory.cve, epss) ?? scoring.epssFloor));
const CVE_PATTERN = /CVE-\d{4}-\d{4,}/gi;
const connectors = new Set(["and", "or", "of", "the", "for", "in", "to"]);
const shortName = event => {
  const source = event.exploitation?.name ?? event.advisory?.products[0] ?? event.id;
  const words = source.split(" ").slice(0, 3).filter((word, index, all) => word.toLowerCase() !== all[index - 1]?.toLowerCase());
  const end = words.reduce((last, word, index) => connectors.has(word.toLowerCase()) ? last : index + 1, 0);
  return words.slice(0, end).join(" ");
};
const whoOf = (event, kind) => {
  const product = event.advisory?.products[0];
  if (!product) return null;
  return kind === "platform" ? product.split(" ")[0] : product;
};
const driversOf = (recent, kind) => {
  const advisories = recent.filter(event => event.kind === "advisory");
  const counts = advisories.reduce((tally, event) => {
    const who = whoOf(event, kind);
    if (who) tally.set(who, (tally.get(who) ?? 0) + 1);
    return tally;
  }, new Map());
  const [name, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const leads = count >= scoring.driverMinimum && count / Math.max(1, advisories.length) >= scoring.driverShare;
  return {
    exploitedCount: recent.filter(event => event.kind === "exploited").length,
    exploited: [...new Set(recent.filter(event => event.kind === "exploited").map(shortName))],
    critical: advisories.filter(event => event.advisory?.severity === "critical").length,
    advisories: advisories.length,
    top: leads ? {
      name: kind === "platform" ? name.charAt(0).toUpperCase() + name.slice(1) : name,
      count
    } : null
  };
};
export const matchesWatch = (event, terms) => {
  if (!terms.length) return false;
  const text = [event.id, event.advisory?.cve ?? "", event.advisory?.title ?? "", event.exploitation?.name ?? "", ...(event.advisory?.products ?? []), ...(event.exploitation?.products ?? [])].join(" ").toLowerCase();
  return terms.some(term => text.includes(term));
};
export const traceDays = Math.ceil(scoring.halfLifeDays * 2);
export const inTrace = (event, day) => event.day <= day && event.day > day - traceDays;
export const cvesIn = text => [...new Set((text.match(CVE_PATTERN) ?? []).map(id => id.toUpperCase()))];
const storyStations = story => {
  const title = ` ${story.title.toLowerCase()} `;
  return stations.filter(station => station.newsTerms.some(term => title.includes(term))).map(s => s.id);
};
const claimed = ids => {
  const real = ids.filter(id => id !== catchAll.id);
  return real.length ? real : [catchAll.id];
};
/* ----------------------------------------
   Readings
   ---------------------------------------- */
export const read = observations => {
  const {
    now,
    days,
    advisories,
    compromises,
    exploitations,
    epss,
    stories,
    coverage
  } = observations;
  const origin = addDays(dayStart(now), -(days - 1));
  const inSpan = day => day >= 0 && day < days;
  const ecosystemsByCve = advisories.filter(advisory => advisory.source === "ghsa" && advisory.cve).reduce((map, advisory) => {
    map.set(advisory.cve ?? "", [...(map.get(advisory.cve ?? "") ?? []), ...advisory.stationIds]);
    return map;
  }, new Map());
  const events = [...advisories.map(advisory => ({
    id: advisory.id,
    kind: "advisory",
    day: dayIndex(advisory.published, origin),
    date: advisory.published,
    weight: advisoryWeight(advisory, epss),
    epss: epssOf(advisory.cve, epss),
    advisory,
    stationIds: advisory.stationIds
  })), ...exploitations.map(exploitation => ({
    id: exploitation.cve,
    kind: "exploited",
    day: dayIndex(exploitation.added, origin),
    date: exploitation.added,
    weight: scoring.exploitedWeight,
    epss: epssOf(exploitation.cve, epss),
    exploitation,
    stationIds: claimed([...new Set([...exploitation.stationIds, ...(ecosystemsByCve.get(exploitation.cve) ?? [])])])
  }))].filter(event => inSpan(event.day));
  const recentStart = days - scoring.recentDays;
  const baselineStart = recentStart - scoring.baselineWeeks * 7;
  const storyOwners = new Map(stories.map(story => {
    const named = cvesIn(story.title);
    const linked = events.filter(event => named.includes(event.id) || named.includes(event.advisory?.cve ?? "")).flatMap(event => event.stationIds);
    return [story.id, claimed([...new Set([...storyStations(story), ...linked])])];
  }));
  return stations.map(station => {
    const own = events.filter(event => event.stationIds.includes(station.id));
    const daily = Array.from({
      length: days
    }, () => 0);
    own.forEach(event => {
      daily[event.day] += event.weight;
    });
    const covered = coverage[station.kind];
    const gaps = daily.map((_, day) => !covered.has(day));
    const decay = 2 ** (-1 / scoring.halfLifeDays);
    const rolling = daily.reduce((trace, value, day) => {
      trace.push((trace[day - 1] ?? 0) * decay + value);
      return trace;
    }, []).map(value => value * 7 * (1 - decay));
    const weekCovered = start => Array.from({
      length: 7
    }, (_, offset) => start + offset).every(day => covered.has(day));
    const weeks = Array.from({
      length: scoring.baselineWeeks
    }, (_, week) => baselineStart + week * 7).filter(start => start >= 0 && weekCovered(start)).map(start => sum(daily.slice(start, start + 7)));
    const median = quantile(weeks, 0.5);
    const normal = Math.max(median, scoring.baselineFloor);
    const recentPressure = sum(daily.slice(recentStart)) * 7 / scoring.recentDays;
    const settled = weeks.length >= scoring.minBaselineWeeks && Array.from({
      length: days - recentStart
    }, (_, offset) => recentStart + offset).every(day => covered.has(day));
    const recentEvents = own.filter(event => event.day >= recentStart);
    const recentAdvisories = recentEvents.filter(event => event.kind === "advisory");
    const ownCompromises = compromises.filter(item => item.stationId === station.id);
    const compromisesByDay = Array.from({
      length: days
    }, () => 0);
    ownCompromises.forEach(item => {
      const day = dayIndex(item.published, origin);
      if (inSpan(day)) compromisesByDay[day] += 1;
    });
    const lastWeek = sum(compromisesByDay.slice(days - scoring.compromiseDays));
    const weekBefore = sum(compromisesByDay.slice(days - scoring.compromiseDays * 2, days - scoring.compromiseDays));
    return {
      station,
      rolling,
      gaps,
      exploitedDays: own.filter(event => event.kind === "exploited").map(event => event.day),
      compromisesByDay,
      normal,
      bandLow: quantile(weeks, 0.1) / normal,
      bandHigh: Math.max(quantile(weeks, 0.9), scoring.baselineFloor) / normal,
      ratio: recentPressure / normal,
      previousRatio: sum(daily.slice(Math.max(0, recentStart - 7), days - 7)) * 7 / scoring.recentDays / normal,
      drivers: driversOf(recentEvents.map(({
        stationIds: _ids,
        ...event
      }) => event), station.kind),
      settled,
      quiet: median < scoring.baselineFloor,
      recent: {
        pressure: recentPressure,
        advisories: recentAdvisories.length,
        critical: recentAdvisories.filter(event => event.advisory?.severity === "critical").length,
        exploited: recentEvents.filter(event => event.kind === "exploited").length,
        compromises: lastWeek,
        compromisesBefore: weekBefore
      },
      events: own.map(({
        stationIds: _ids,
        ...event
      }) => event).sort((a, b) => b.weight - a.weight || b.date.localeCompare(a.date)),
      stories: stories.filter(story => (storyOwners.get(story.id) ?? []).includes(station.id))
    };
  });
};
export const vendorOfEvent = event => event.advisory?.vendor ?? event.exploitation?.vendor ?? event.advisory?.products[0]?.split(" ")[0] ?? event.exploitation?.name.split(" ")[0]?.toLowerCase() ?? "unknown";
export const vendorTally = (events, fromDay) => [...events.filter(event => event.day >= fromDay).reduce((tally, event) => {
  const vendor = vendorOfEvent(event);
  const entry = tally.get(vendor) ?? {
    vendor,
    events: 0,
    exploited: 0,
    critical: 0,
    latest: event.date
  };
  tally.set(vendor, {
    vendor,
    events: entry.events + 1,
    exploited: entry.exploited + (event.kind === "exploited" ? 1 : 0),
    critical: entry.critical + (event.advisory?.severity === "critical" ? 1 : 0),
    latest: event.date > entry.latest ? event.date : entry.latest
  });
  return tally;
}, new Map()).values()].sort((a, b) => b.exploited - a.exploited || b.events - a.events || a.vendor.localeCompare(b.vendor));
export const months = (reading, now, days) => {
  const origin = addDays(dayStart(now), -(days - 1));
  const first = monthStart(origin);
  const count = (now.getUTCFullYear() - first.getUTCFullYear()) * 12 + now.getUTCMonth() - first.getUTCMonth() + 1;
  return Array.from({
    length: count
  }, (_, index) => {
    const start = addMonths(first, index);
    const end = addMonths(first, index + 1);
    const from = Math.max(0, dayIndex(start.toISOString(), origin));
    const to = Math.min(days, dayIndex(end.toISOString(), origin));
    const inMonth = reading.events.filter(event => event.day >= from && event.day < to);
    return {
      month: isoDay(start),
      partial: start < origin || end > addDays(dayStart(now), 1),
      advisories: inMonth.filter(event => event.kind === "advisory").length,
      exploited: inMonth.filter(event => event.kind === "exploited").length,
      covered: reading.gaps.slice(from, to).every(gap => !gap)
    };
  });
};
export const delays = readings => readings.flatMap(reading => reading.events.flatMap(event => event.exploitation ? [{
  cve: event.exploitation.cve,
  name: event.exploitation.name,
  days: Math.max(0, daysBetween(event.exploitation.published, event.exploitation.added)),
  stationId: reading.station.id
}] : []));
/* ----------------------------------------
   Ordering
   ---------------------------------------- */
export const orderReadings = (readings, sort) => [...readings].sort((a, b) => {
  if (sort === "name") return a.station.name.localeCompare(b.station.name);
  if (sort === "pressure") return b.recent.pressure - a.recent.pressure;
  if (a.settled !== b.settled) return a.settled ? -1 : 1;
  return b.ratio - a.ratio;
});
export const spanOrigin = (now, days) => addDays(dayStart(now), -(days - 1));