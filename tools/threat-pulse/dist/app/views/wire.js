import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
// Intended use: the Wire view: security stories by day, each tied to the stations and CVEs it names, with a daily volume strip whose signal bars mark stories about exploited vulnerabilities.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { reading as readingConfig, stations } from "../config.js";
import { en as strings } from "../locales/en.js";
import { cvesIn, spanOrigin } from "../model.js";
import { useReadings } from "./shell.js";
import { Stack } from "../components/layout.js";
import { MirroredBars } from "../components/charts.js";
import { DAY_MS, dayIndex, formatDay, groupBy } from "../lib/utils.js";
const {
  locale,
  timeZone
} = readingConfig;
export const WireView = () => {
  const {
    readings,
    stories,
    now
  } = useReadings();
  const [station, setStation] = useState("all");
  const days = Math.min(120, readings[0]?.rolling.length ?? 120);
  const origin = spanOrigin(now, days);
  const exploited = new Set(readings.flatMap(reading => reading.events.flatMap(event => event.exploitation?.cve ?? [])));
  const owners = new Map(readings.flatMap(reading => reading.stories.map(story => [story.id, reading.station.id])));
  const tagged = stories.map(story => ({
    story,
    cves: cvesIn(story.title),
    stationIds: readings.filter(reading => reading.stories.includes(story)).map(reading => reading.station.id)
  }));
  const filtered = tagged.filter(entry => station === "all" || entry.stationIds.includes(station)).slice(0, readingConfig.wireLimit);
  const perDay = Array.from({
    length: days
  }, () => 0);
  const signalPerDay = Array.from({
    length: days
  }, () => 0);
  tagged.filter(entry => station === "all" || entry.stationIds.includes(station)).forEach(entry => {
    const index = dayIndex(entry.story.published, origin);
    if (index < 0 || index >= days) return;
    perDay[index] += 1;
    if (entry.cves.some(cve => exploited.has(cve))) signalPerDay[index] += 1;
  });
  const weekAgo = Date.now() - 7 * DAY_MS;
  const thisWeek = tagged.filter(entry => Date.parse(entry.story.published) >= weekAgo);
  const discussed = [...thisWeek].sort((a, b) => b.story.comments - a.story.comments).slice(0, readingConfig.focusNewsLimit);
  const inTheNews = stations.map(entry => ({
    station: entry,
    count: thisWeek.filter(item => item.stationIds.includes(entry.id)).length
  })).filter(entry => entry.count > 0).sort((a, b) => b.count - a.count);
  const byDay = groupBy(filtered, entry => entry.story.published.slice(0, 10));
  return _jsxs(Stack, {
    gap: "section",
    className: "wire",
    children: [_jsxs(Stack, {
      gap: "tight",
      children: [_jsx("h1", {
        className: "headline",
        children: strings.wire.heading
      }), _jsx("p", {
        className: "lede",
        children: strings.wire.lede
      })]
    }), _jsxs(Stack, {
      direction: "row",
      gap: "loose",
      align: "flex-end",
      wrap: true,
      children: [_jsxs("label", {
        className: "select-field",
        children: [_jsx("span", {
          className: "segmented-legend",
          children: strings.wire.stationFilter
        }), _jsxs("select", {
          className: "field",
          value: station,
          onChange: event => setStation(event.target.value),
          children: [_jsx("option", {
            value: "all",
            children: strings.wire.allStations
          }), stations.map(entry => _jsx("option", {
            value: entry.id,
            children: entry.name
          }, entry.id))]
        })]
      }), _jsxs("figure", {
        className: "wire-volume",
        "aria-label": strings.wire.volumeLabel,
        children: [_jsx(MirroredBars, {
          above: perDay,
          below: signalPerDay,
          gaps: perDay.map(() => false),
          aboveMax: Math.max(1, ...perDay),
          belowMax: Math.max(1, ...signalPerDay)
        }), _jsx("figcaption", {
          className: "meta",
          children: strings.wire.volumeLabel
        })]
      })]
    }), _jsxs("div", {
      className: "wire-body",
      children: [filtered.length ? _jsx("div", {
        className: "wire-days",
        children: [...byDay.entries()].map(([date, entries]) => _jsxs("section", {
          className: "wire-day",
          "aria-label": formatDay(date, locale, timeZone, true),
          children: [_jsx("h2", {
            className: "wire-date",
            children: formatDay(date, locale, timeZone)
          }), _jsx("ol", {
            className: "wire-stories",
            children: entries.map(({
              story,
              cves,
              stationIds
            }) => _jsxs("li", {
              className: "wire-story",
              "data-signal": cves.some(cve => exploited.has(cve)) || undefined,
              children: [_jsx("a", {
                href: story.url,
                target: "_blank",
                rel: "noreferrer",
                className: "story-title",
                children: story.title
              }), _jsxs("span", {
                className: "meta",
                children: [(() => {
                  try {
                    return new URL(story.url).hostname.replace(/^www\./, "");
                  } catch {
                    return "";
                  }
                })(), " ", "\u00B7 ", strings.wire.points(story.points), " \u00B7", " ", _jsx("a", {
                  href: story.discussion,
                  target: "_blank",
                  rel: "noreferrer",
                  children: strings.wire.comments(story.comments)
                })]
              }), (stationIds.length > 0 || cves.length > 0) && _jsxs("span", {
                className: "chips",
                children: [stationIds.map(id => _jsx(Link, {
                  to: "/",
                  search: previous => ({
                    ...previous,
                    station: id,
                    event: undefined
                  }),
                  className: "chip chip-link",
                  children: stations.find(entry => entry.id === id)?.name
                }, id)), cves.map(cve => _jsx(Link, {
                  to: "/",
                  search: previous => ({
                    ...previous,
                    station: owners.get(story.id) ?? stationIds[0],
                    event: cve
                  }),
                  className: exploited.has(cve) ? "chip chip-link chip-signal" : "chip chip-link chip-id",
                  children: cve
                }, cve))]
              })]
            }, story.id))
          })]
        }, date))
      }) : _jsx("p", {
        className: "empty",
        children: strings.wire.empty
      }), _jsxs("aside", {
        className: "wire-aside",
        children: [inTheNews.length > 0 && _jsxs("section", {
          "aria-labelledby": "in-the-news",
          children: [_jsx("h2", {
            id: "in-the-news",
            className: "label",
            children: strings.wire.inTheNews
          }), _jsx("ul", {
            className: "chips",
            children: inTheNews.map(entry => _jsx("li", {
              children: _jsxs("button", {
                type: "button",
                className: "chip chip-filter",
                "aria-pressed": station === entry.station.id,
                onClick: () => setStation(station === entry.station.id ? "all" : entry.station.id),
                children: [entry.station.name, " \u00B7 ", entry.count]
              })
            }, entry.station.id))
          })]
        }), discussed.length > 0 && _jsxs("section", {
          "aria-labelledby": "most-discussed",
          children: [_jsx("h2", {
            id: "most-discussed",
            className: "label",
            children: strings.wire.discussed
          }), _jsx("ol", {
            className: "story-list",
            children: discussed.map(({
              story
            }) => _jsxs("li", {
              className: "story",
              children: [_jsx("a", {
                href: story.url,
                target: "_blank",
                rel: "noreferrer",
                className: "story-title",
                children: story.title
              }), _jsx("a", {
                className: "meta",
                href: story.discussion,
                target: "_blank",
                rel: "noreferrer",
                children: strings.wire.comments(story.comments)
              })]
            }, story.id))
          })]
        })]
      })]
    })]
  });
};