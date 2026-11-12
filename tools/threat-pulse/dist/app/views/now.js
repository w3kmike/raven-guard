import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
// Intended use: the Stations view: every station's strip and departure from normal in one ordered register, the focused station's events, swarm and news, and the record of a selected event.
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { reading as readingConfig, scoring } from "../config.js";
import { en as strings } from "../locales/en.js";
import { useSearchState } from "../navigation.js";
import { motion } from "../tokens.js";
import { cvesIn, inTrace, matchesWatch, traceDays, vendorTally, orderReadings, spanOrigin } from "../model.js";
import { TokenForm, useReadings } from "./shell.js";
import { addWatchTerm, removeWatchTerm, togglePin, useStore } from "../state.js";
import { Box, Stack } from "../components/layout.js";
import { Segmented } from "../components/controls.js";
import { DataTable } from "../components/data.js";
import { BackIcon, CloseIcon, OutboundIcon, PinIcon, PinnedIcon } from "../components/icons.js";
import { HorizonStrip, ledgerPosition, ledgerTicks, RangeLedger, Swarm } from "../components/charts.js";
import { addDays, addMonths, dayIndex, daysBetween, formatClock, formatCount, formatDay, formatMonth, formatPercent, formatRatio, monthStart, tokenMs } from "../lib/utils.js";
const {
  locale,
  timeZone
} = readingConfig;
const day = (iso, withYear = false) => formatDay(iso, locale, timeZone, withYear);
const kindLabel = (reading, long = false) => reading.station.catchAll ? long ? strings.focus.catchAllKind : strings.register.catchAll : strings.register.kind[reading.station.kind];
const vendorName = vendor => {
  const known = strings.focus.unassigned.reporters[vendor];
  const plain = vendor.replaceAll("_", " ");
  return known ?? plain.charAt(0).toUpperCase() + plain.slice(1);
};
/* ----------------------------------------
   Register: one row per station
   ---------------------------------------- */
const StripAxis = ({
  days,
  now
}) => {
  const origin = spanOrigin(now, days);
  const first = addMonths(monthStart(origin), 1);
  const count = Math.floor(days / 30);
  const step = count > 14 ? 3 : 1;
  const ticks = Array.from({
    length: count
  }, (_, index) => addMonths(first, index * step)).filter(date => date <= now);
  return _jsx("div", {
    className: "strip-axis",
    "aria-hidden": "true",
    children: ticks.map(date => _jsx("span", {
      style: {
        left: `${dayIndex(date.toISOString(), origin) / days * 100}%`
      },
      children: formatMonth(date, locale, date.getUTCMonth() === 0 || step > 1)
    }, date.toISOString()))
  });
};
const LedgerAxis = () => _jsx("div", {
  className: "ledger-axis-labels",
  "aria-hidden": "true",
  children: ledgerTicks.map(tick => _jsx("span", {
    style: {
      left: `${ledgerPosition(tick)}%`
    },
    children: tick < 1 ? `${tick === 0.5 ? "½" : "¼"}×` : `${tick}×`
  }, tick))
});
const StationRow = ({
  reading,
  selected,
  pinned,
  watched,
  cursor,
  onCursor,
  onSelect
}) => {
  const {
    now,
    days
  } = useReadings();
  const ratios = reading.rolling.map(value => value / reading.normal);
  const unusual = reading.settled && reading.ratio >= scoring.unusualRatio;
  const recorded = reading.gaps.some(gap => !gap);
  const change = reading.ratio / Math.max(0.01, reading.previousRatio);
  const trend = change >= 1.15 ? "up" : change <= 0.87 ? "down" : "flat";
  const track = event => {
    const box = event.currentTarget.getBoundingClientRect();
    const at = Math.floor((event.clientX - box.left) / box.width * days);
    onCursor({
      day: Math.min(days - 1, Math.max(0, at)),
      station: reading.station.id
    });
  };
  const here = cursor?.station === reading.station.id ? cursor : null;
  const date = here ? day(addDays(spanOrigin(now, days), here.day).toISOString()) : "";
  const dayEvents = here ? reading.events.filter(event => inTrace(event, here.day)).length : 0;
  const pinLabel = pinned ? strings.register.watch.unpin(reading.station.name) : strings.register.watch.pin(reading.station.name);
  return _jsxs("li", {
    className: "station",
    "data-station": reading.station.id,
    "data-catch-all": reading.station.catchAll || undefined,
    children: [_jsx("button", {
      type: "button",
      className: "station-pin",
      "aria-pressed": pinned,
      "aria-label": pinLabel,
      title: pinLabel,
      onClick: () => togglePin(reading.station.id),
      children: pinned ? _jsx(PinnedIcon, {}) : _jsx(PinIcon, {})
    }), _jsxs("button", {
      type: "button",
      className: "station-row",
      "aria-current": selected || undefined,
      "data-unusual": unusual || undefined,
      "aria-label": strings.register.rowLabel(reading.station.name, formatRatio(reading.ratio), reading.recent.exploited, reading.recent.compromises),
      onClick: event => onSelect(event.target.closest(".station-strip") && here ? here.day : undefined),
      children: [_jsxs("span", {
        className: "station-name",
        children: [_jsx("span", {
          className: "station-title",
          children: reading.station.name
        }), _jsxs("span", {
          className: "station-kind",
          children: [watched > 0 && _jsxs("span", {
            className: "station-watched",
            children: [strings.register.watch.watched(watched), " \u00B7", " "]
          }), kindLabel(reading), !reading.settled && _jsxs("span", {
            className: "station-state",
            children: [" ", "\u00B7 ", strings.register.recording]
          }), reading.settled && reading.quiet && _jsxs("span", {
            className: "station-state",
            children: [" \u00B7 ", strings.register.quiet]
          })]
        })]
      }), _jsxs("span", {
        className: "station-strip",
        onPointerMove: track,
        onPointerDown: track,
        onPointerLeave: () => onCursor(null),
        children: [_jsx(HorizonStrip, {
          ratios: ratios,
          gaps: reading.gaps,
          marks: reading.exploitedDays,
          rug: reading.compromisesByDay,
          cursor: cursor?.day ?? null
        }, recorded ? "recorded" : "waiting"), here && _jsx("span", {
          className: "strip-reading",
          style: {
            left: `${(here.day + 0.5) / days * 100}%`
          },
          children: strings.register.stripReading(date, formatRatio(ratios[here.day] ?? 0), dayEvents)
        })]
      }), _jsxs("span", {
        className: "station-ledger",
        children: [_jsx(RangeLedger, {
          ratio: reading.ratio,
          bandLow: reading.bandLow,
          bandHigh: reading.bandHigh,
          unusualAt: scoring.unusualRatio,
          pending: !reading.settled,
          previous: reading.previousRatio
        }), _jsx("span", {
          className: "station-ratio",
          "data-trend": reading.settled ? trend : undefined,
          title: strings.register.lastWeek(formatRatio(reading.previousRatio)),
          children: reading.settled ? formatRatio(reading.ratio) : "—"
        })]
      }), _jsxs("span", {
        className: "station-counts",
        children: [_jsx("span", {
          className: "count-exploited",
          "data-zero": !reading.recent.exploited || undefined,
          children: reading.recent.exploited
        }), _jsx("span", {
          className: "count-sep",
          "aria-hidden": "true",
          children: "\u00B7"
        }), _jsx("span", {
          className: "count-malicious",
          "data-zero": !reading.recent.compromises || undefined,
          children: formatCount(reading.recent.compromises, locale)
        })]
      })]
    })]
  });
};
const useReorderMotion = (list, order) => {
  const previous = useRef(new Map());
  useLayoutEffect(() => {
    const rows = [...(list.current?.querySelectorAll("[data-station]") ?? [])];
    const duration = tokenMs("--dur-reorder") / 1000;
    rows.forEach(row => {
      const id = row.dataset.station ?? "";
      const top = row.getBoundingClientRect().top;
      const before = previous.current.get(id);
      if (before !== undefined && before !== top && duration > 0) {
        gsap.fromTo(row, {
          y: before - top
        }, {
          y: 0,
          duration,
          ease: motion.ease,
          overwrite: true
        });
      }
    });
    previous.current = new Map(rows.map(row => [row.dataset.station ?? "", row.getBoundingClientRect().top - Number(gsap.getProperty(row, "y"))]));
  }, [list, order]);
};
const recentWatched = (reading, terms, days) => reading.events.filter(event => event.day >= days - scoring.recentDays && matchesWatch(event, terms)).length;
const Watchlist = ({
  readings
}) => {
  const {
    days
  } = useReadings();
  const {
    pins,
    terms
  } = useStore(state => state.watchlist);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const matched = readings.reduce((total, reading) => total + recentWatched(reading, terms, days), 0);
  const submit = event => {
    event.preventDefault();
    const added = addWatchTerm(draft);
    setInvalid(!added);
    if (added) setDraft("");
  };
  const note = !pins.length && !terms.length ? strings.register.watch.empty : !terms.length ? "" : matched ? strings.register.watch.summary(matched) : strings.register.watch.none;
  return _jsxs("section", {
    className: "watchlist",
    "aria-labelledby": "watchlist-heading",
    children: [_jsx("h2", {
      id: "watchlist-heading",
      className: "segmented-legend",
      children: strings.register.watch.heading
    }), _jsxs("form", {
      className: "watch-form",
      onSubmit: submit,
      children: [terms.length > 0 && _jsx("ul", {
        className: "chips",
        children: terms.map(term => _jsx("li", {
          children: _jsxs("button", {
            type: "button",
            className: "chip chip-watch",
            "aria-label": strings.register.watch.remove(term),
            onClick: () => removeWatchTerm(term),
            children: [_jsx("span", {
              children: term
            }), _jsx(CloseIcon, {})]
          })
        }, term))
      }), _jsx("label", {
        className: "visually-hidden",
        htmlFor: "watch-term",
        children: strings.register.watch.fieldLabel
      }), _jsx("input", {
        id: "watch-term",
        className: "field watch-field",
        placeholder: strings.register.watch.fieldLabel,
        value: draft,
        "aria-invalid": invalid || undefined,
        onChange: event => {
          setDraft(event.target.value);
          setInvalid(false);
        }
      }), _jsx("button", {
        type: "submit",
        className: "solid-button",
        children: strings.register.watch.add
      })]
    }), _jsx("p", {
      className: "meta",
      role: invalid ? "alert" : undefined,
      "aria-live": "polite",
      children: invalid ? strings.register.watch.invalid : note
    })]
  });
};
const Progress = () => {
  const {
    feeds
  } = useReadings();
  const kevBytes = useStore(state => state.progress.kev);
  const token = useStore(state => state.githubToken);
  const reviewed = feeds.find(feed => feed.feed === "ghsa-reviewed");
  const critical = feeds.find(feed => feed.feed === "nvd-critical");
  const paused = feeds.find(feed => feed.paused > 0 && feed.resumesAt);
  const recording = Boolean(kevBytes) || reviewed !== undefined && reviewed.recorded < reviewed.chunks || critical !== undefined && critical.recorded < critical.chunks;
  if (!recording && !paused) return null;
  return _jsxs("div", {
    className: "progress",
    role: "status",
    children: [reviewed && critical && recording && _jsxs("p", {
      className: "progress-line",
      children: [strings.register.progress(reviewed.recorded, reviewed.chunks, critical.recorded, critical.chunks), kevBytes ? ` ${strings.register.kevBytes((kevBytes / 1_000_000).toFixed(1))}` : ""]
    }), paused?.resumesAt && !token && _jsxs("div", {
      className: "paused-prompt",
      children: [_jsx("p", {
        children: strings.register.pausedPrompt(formatClock(paused.resumesAt, locale, timeZone))
      }), _jsx(TokenForm, {
        compact: true
      })]
    })]
  });
};
const Register = ({
  readings,
  selectedId,
  onSelect
}) => {
  const {
    now,
    days
  } = useReadings();
  const [search, setSearch] = useSearchState();
  const {
    pins,
    terms
  } = useStore(state => state.watchlist);
  const [cursor, setCursor] = useState(null);
  const list = useRef(null);
  const pinned = readings.filter(reading => pins.includes(reading.station.id));
  const rest = readings.filter(reading => !pins.includes(reading.station.id));
  const row = reading => _jsx(StationRow, {
    reading: reading,
    selected: reading.station.id === selectedId,
    pinned: pins.includes(reading.station.id),
    watched: recentWatched(reading, terms, days),
    cursor: cursor,
    onCursor: setCursor,
    onSelect: day => onSelect(reading.station.id, day)
  }, reading.station.id);
  useReorderMotion(list, [...pinned, ...rest].map(reading => reading.station.id).join(","));
  const settled = readings.filter(reading => reading.settled && !reading.station.catchAll);
  const unusual = settled.filter(reading => reading.ratio >= scoring.unusualRatio).length;
  const top = orderReadings(settled, "departure")[0];
  const move = event => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = [...(list.current?.querySelectorAll(".station-row") ?? [])];
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.min(buttons.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)));
    event.preventDefault();
    buttons[next]?.focus();
  };
  return _jsxs("section", {
    className: "register",
    "aria-labelledby": "register-heading",
    children: [_jsxs(Stack, {
      gap: "tight",
      className: "register-head",
      children: [_jsx("h1", {
        id: "register-heading",
        className: "headline",
        children: strings.register.heading
      }), _jsx("p", {
        className: "lede",
        children: strings.register.lede
      }), _jsx("p", {
        className: "register-summary",
        "aria-live": "polite",
        children: top ? strings.register.summary(top.station.name, formatRatio(top.ratio), unusual) : ""
      }), _jsx(Progress, {})]
    }), _jsxs(Stack, {
      direction: "row",
      gap: "loose",
      wrap: true,
      align: "flex-start",
      className: "register-controls",
      children: [_jsx(Segmented, {
        label: strings.register.kindLabel,
        value: search.kind,
        options: ["all", "ecosystem", "platform"].map(kind => ({
          value: kind,
          label: strings.register.kinds[kind]
        })),
        onChange: kind => setSearch({
          kind
        })
      }), _jsx(Segmented, {
        label: strings.register.sortLabel,
        value: search.sort,
        options: ["departure", "pressure", "name"].map(sort => ({
          value: sort,
          label: strings.register.sorts[sort]
        })),
        onChange: sort => setSearch({
          sort
        })
      }), _jsx(Watchlist, {
        readings: readings
      })]
    }), _jsxs("div", {
      className: "register-columns",
      "aria-hidden": "true",
      children: [_jsx("span", {
        className: "column-label",
        children: strings.register.columns.station
      }), _jsxs("span", {
        className: "column-strip",
        children: [_jsx("span", {
          className: "column-label",
          children: strings.register.columns.strip
        }), _jsx(StripAxis, {
          days: days,
          now: now
        })]
      }), _jsxs("span", {
        className: "column-ledger",
        children: [_jsx("span", {
          className: "column-label",
          children: strings.register.columns.ledger
        }), _jsx(LedgerAxis, {})]
      }), _jsxs("span", {
        className: "column-label column-counts",
        children: [_jsx("span", {
          className: "count-exploited",
          children: strings.register.columns.exploited
        }), _jsx("span", {
          className: "count-malicious",
          children: strings.register.columns.malicious
        })]
      })]
    }), readings.length ? _jsxs("ol", {
      ref: list,
      className: "register-rows",
      onKeyDown: move,
      children: [pinned.map(row), pinned.length > 0 && rest.length > 0 && _jsx("li", {
        className: "register-divider",
        "aria-hidden": "true"
      }), rest.map(row)]
    }) : _jsx("p", {
      className: "empty",
      children: strings.register.empty
    }), _jsxs("ul", {
      className: "legend",
      "aria-hidden": "true",
      children: [_jsx("li", {
        className: "legend-band",
        children: strings.register.legend.normal
      }), _jsx("li", {
        className: "legend-unusual",
        children: strings.register.legend.unusual
      }), _jsx("li", {
        className: "legend-exploited",
        children: strings.register.legend.exploited
      }), _jsx("li", {
        className: "legend-malicious",
        children: strings.register.legend.malicious
      }), _jsx("li", {
        className: "legend-unrecorded",
        children: strings.register.legend.unrecorded
      })]
    }), _jsx(DataTable, {
      caption: strings.register.tableCaption,
      showLabel: strings.table.show,
      hideLabel: strings.table.hide,
      rows: readings,
      rowKey: reading => reading.station.id,
      columns: [{
        key: "name",
        label: strings.register.columns.station,
        cell: reading => reading.station.name
      }, {
        key: "ratio",
        label: strings.focus.stats.ratio,
        numeric: true,
        cell: reading => reading.settled ? formatRatio(reading.ratio) : strings.register.recording
      }, {
        key: "adv",
        label: strings.focus.stats.advisories,
        numeric: true,
        cell: reading => reading.recent.advisories
      }, {
        key: "exp",
        label: strings.focus.stats.exploited,
        numeric: true,
        cell: reading => reading.recent.exploited
      }, {
        key: "mal",
        label: strings.focus.stats.malicious,
        numeric: true,
        cell: reading => reading.recent.compromises
      }]
    })]
  });
};
/* ----------------------------------------
   Focus: the selected station
   ---------------------------------------- */
const eventTitle = event => event.exploitation?.name ?? event.advisory?.title ?? event.id;
const eventLabel = event => event.advisory?.cve && event.advisory.cve !== event.id ? `${event.id} · ${event.advisory.cve}` : event.id;
const Figure = ({
  value,
  label,
  tone
}) => _jsxs("div", {
  className: "figure",
  "data-tone": tone,
  children: [_jsx("span", {
    className: "figure-value",
    children: value
  }), _jsx("span", {
    className: "figure-label",
    children: label
  })]
});
const StoryList = ({
  stories
}) => _jsx("ul", {
  className: "story-list",
  children: stories.map(story => _jsxs("li", {
    className: "story",
    children: [_jsx("a", {
      href: story.url,
      target: "_blank",
      rel: "noreferrer",
      className: "story-title",
      children: story.title
    }), _jsxs("span", {
      className: "meta",
      children: [day(story.published), " \u00B7 ", strings.wire.points(story.points), " \u00B7", " ", _jsx("a", {
        href: story.discussion,
        target: "_blank",
        rel: "noreferrer",
        children: strings.wire.discussion
      })]
    })]
  }, story.id))
});
const headline = reading => {
  const name = reading.station.name;
  if (!reading.settled) return strings.focus.headline.recording(name);
  if (reading.ratio >= scoring.unusualRatio) return strings.focus.headline.unusual(name, formatRatio(reading.ratio));
  if (reading.ratio < reading.bandLow) return strings.focus.headline.below(name, formatRatio(reading.ratio));
  return reading.quiet ? strings.focus.headline.quiet(name) : strings.focus.headline.steady(name);
};
const EventList = ({
  events,
  onEvent
}) => _jsx("ol", {
  className: "event-list",
  children: events.map(event => _jsx("li", {
    children: _jsxs("button", {
      type: "button",
      className: "event-row",
      "data-kind": event.kind,
      onClick: () => onEvent(event.id),
      children: [_jsx("span", {
        className: "event-id",
        children: eventLabel(event)
      }), _jsx("span", {
        className: "event-title",
        children: eventTitle(event)
      }), _jsxs("span", {
        className: "event-facts",
        children: [event.kind === "exploited" ? _jsx("span", {
          className: "chip chip-signal",
          children: strings.event.exploited
        }) : _jsx("span", {
          className: "chip",
          "data-severity": event.advisory?.severity,
          children: event.advisory?.severity
        }), event.epss !== null && _jsxs("span", {
          className: "meta",
          children: ["EPSS ", formatPercent(event.epss, locale)]
        }), _jsx("span", {
          className: "meta",
          children: day(event.date)
        })]
      })]
    })
  }, `${event.kind}-${event.id}`))
});
const VendorRanking = ({
  reading
}) => {
  const tally = vendorTally(reading.events, 0).slice(0, readingConfig.vendorLimit);
  const most = Math.max(1, ...tally.map(entry => entry.events));
  const copy = strings.focus.unassigned;
  return _jsxs("section", {
    className: "vendors",
    "aria-labelledby": "vendors-heading",
    children: [_jsx("p", {
      className: "prose-small",
      children: copy.lede
    }), _jsx("h3", {
      id: "vendors-heading",
      className: "label",
      children: copy.heading
    }), _jsx("p", {
      className: "meta",
      children: copy.caption
    }), tally.length ? _jsxs("table", {
      className: "vendor-table",
      children: [_jsx("thead", {
        children: _jsxs("tr", {
          children: [_jsx("th", {
            scope: "col",
            children: copy.columns.vendor
          }), _jsx("th", {
            scope: "col",
            "data-numeric": true,
            children: copy.columns.events
          }), _jsx("th", {
            scope: "col",
            "data-numeric": true,
            children: copy.columns.exploited
          }), _jsx("th", {
            scope: "col",
            "data-numeric": true,
            children: copy.columns.latest
          })]
        })
      }), _jsx("tbody", {
        children: tally.map(entry => _jsxs("tr", {
          children: [_jsxs("th", {
            scope: "row",
            children: [_jsx("span", {
              className: "vendor-name",
              children: vendorName(entry.vendor)
            }), _jsx("span", {
              className: "vendor-bar",
              style: {
                width: `${entry.events / most * 100}%`
              },
              "aria-hidden": "true"
            })]
          }), _jsx("td", {
            "data-numeric": true,
            children: entry.events
          }), _jsx("td", {
            "data-numeric": true,
            "data-signal": entry.exploited > 0 || undefined,
            children: entry.exploited
          }), _jsx("td", {
            "data-numeric": true,
            children: day(entry.latest)
          })]
        }, entry.vendor))
      })]
    }) : _jsx("p", {
      className: "empty",
      children: copy.empty
    })]
  });
};
const StationFocus = ({
  reading,
  focusDay,
  onEvent,
  onClearDay,
  onClose
}) => {
  const {
    now,
    days
  } = useReadings();
  const terms = useStore(state => state.watchlist.terms);
  const origin = spanOrigin(now, days);
  const recentFrom = days - scoring.recentDays;
  const heaviest = reading.events.filter(event => event.day >= recentFrom).slice(0, readingConfig.focusEventLimit);
  const watched = reading.events.filter(event => event.day >= recentFrom && matchesWatch(event, terms)).slice(0, readingConfig.focusEventLimit);
  const onDay = focusDay === undefined ? [] : reading.events.filter(event => inTrace(event, focusDay));
  const dayName = focusDay === undefined ? "" : `${day(addDays(origin, Math.max(0, focusDay - traceDays + 1)).toISOString())} – ${day(addDays(origin, focusDay).toISOString(), true)}`;
  const {
    drivers
  } = reading;
  const driver = strings.focus.driver(drivers.exploitedCount, drivers.exploited, drivers.critical, drivers.advisories, drivers.top, reading.station.kind);
  const cutoff = reading.events.length > readingConfig.swarmLimit ? reading.events[readingConfig.swarmLimit].weight : 0;
  const shown = reading.events.filter(event => event.weight > cutoff);
  const points = useMemo(() => shown.map(event => ({
    id: event.id,
    day: event.day,
    weight: event.weight,
    tone: event.kind === "exploited" ? "signal" : (event.epss ?? 0) >= 0.1 ? "ring" : "ink",
    label: eventLabel(event),
    title: eventTitle(event),
    meta: [day(event.date, true), event.kind === "exploited" ? strings.event.exploited : event.advisory?.severity ?? "", event.epss !== null ? `EPSS ${formatPercent(event.epss, locale)}` : "", `${strings.event.weight} ${event.weight.toFixed(1)}`].filter(Boolean).join(" · "),
    watched: matchesWatch(event, terms)
  })), [reading.events, terms]);
  const change = strings.focus.maliciousChange(reading.recent.compromises, reading.recent.compromisesBefore);
  return _jsxs(Stack, {
    gap: "section",
    className: "focus",
    children: [_jsxs(Stack, {
      gap: "tight",
      children: [_jsxs(Stack, {
        direction: "row",
        justify: "space-between",
        align: "center",
        children: [_jsx("span", {
          className: "label",
          children: kindLabel(reading, true)
        }), _jsx("button", {
          type: "button",
          className: "icon-button sheet-close",
          "aria-label": strings.focus.close,
          onClick: onClose,
          children: _jsx(CloseIcon, {})
        })]
      }), _jsx("h2", {
        className: "sheet-title",
        children: reading.station.name
      }), _jsxs("p", {
        className: "lede",
        "aria-live": "polite",
        children: [headline(reading), driver && reading.settled ? ` ${driver}` : ""]
      })]
    }), _jsxs("div", {
      className: "figures",
      children: [_jsx("span", {
        className: "label figures-caption",
        children: strings.focus.figuresCaption
      }), _jsx(Figure, {
        value: reading.settled ? formatRatio(reading.ratio) : "—",
        label: strings.focus.stats.ratio
      }), _jsx(Figure, {
        value: String(reading.recent.advisories),
        label: strings.focus.advisoriesFor[reading.station.kind]
      }), reading.station.kind === "ecosystem" && _jsx(Figure, {
        value: String(reading.recent.critical),
        label: strings.focus.stats.critical
      }), _jsx(Figure, {
        value: String(reading.recent.exploited),
        label: strings.focus.stats.exploited,
        tone: "signal"
      }), _jsx(Figure, {
        value: formatCount(reading.recent.compromises, locale),
        label: `${strings.focus.stats.malicious}${change ? ` · ${change}` : ""}`,
        tone: "compromise"
      })]
    }), reading.station.catchAll && _jsx(VendorRanking, {
      reading: reading
    }), _jsxs("figure", {
      className: "chart",
      children: [_jsxs("figcaption", {
        children: [_jsx("span", {
          className: "label",
          children: strings.focus.swarmTitle
        }), _jsx("span", {
          className: "meta",
          children: strings.focus.swarmCaption(reading.events.length, shown.length, cutoff.toFixed(1))
        })]
      }), _jsx(Swarm, {
        points: points,
        days: days,
        onSelect: onEvent,
        dayLabel: offset => day(addDays(origin, offset).toISOString()),
        axisLabel: strings.focus.swarmAxis,
        keysLabel: strings.focus.swarmKeys,
        focusRange: focusDay === undefined ? null : [Math.max(0, focusDay - traceDays + 1), focusDay]
      })]
    }), focusDay !== undefined && _jsxs("section", {
      "aria-labelledby": "day-heading",
      className: "day-filter",
      children: [_jsxs(Stack, {
        direction: "row",
        justify: "space-between",
        align: "baseline",
        children: [_jsx("h3", {
          id: "day-heading",
          className: "label",
          children: strings.focus.dayHeading(dayName)
        }), _jsx("button", {
          type: "button",
          className: "text-button",
          onClick: onClearDay,
          children: strings.focus.clearDay
        })]
      }), onDay.length ? _jsx(EventList, {
        events: onDay,
        onEvent: onEvent
      }) : _jsx("p", {
        className: "empty",
        children: strings.focus.dayEmpty
      })]
    }), watched.length > 0 && _jsxs("section", {
      "aria-labelledby": "watched-heading",
      children: [_jsx("h3", {
        id: "watched-heading",
        className: "label",
        children: strings.focus.watchedHeading
      }), _jsx(EventList, {
        events: watched,
        onEvent: onEvent
      })]
    }), _jsxs("section", {
      "aria-labelledby": "heaviest-heading",
      children: [_jsx("h3", {
        id: "heaviest-heading",
        className: "label",
        children: strings.focus.eventsHeading
      }), heaviest.length ? _jsx(EventList, {
        events: heaviest,
        onEvent: onEvent
      }) : _jsx("p", {
        className: "empty",
        children: strings.focus.eventsEmpty
      })]
    }), _jsxs("section", {
      "aria-labelledby": "news-heading",
      children: [_jsx("h3", {
        id: "news-heading",
        className: "label",
        children: strings.focus.newsHeading
      }), reading.stories.length ? _jsx(StoryList, {
        stories: reading.stories.slice(0, readingConfig.focusNewsLimit)
      }) : _jsx("p", {
        className: "empty",
        children: strings.focus.newsEmpty(reading.station.name)
      })]
    }), _jsx(DataTable, {
      caption: `${strings.focus.tableCaption}: ${reading.station.name}`,
      showLabel: strings.table.show,
      hideLabel: strings.table.hide,
      rows: shown,
      rowKey: event => `${event.kind}-${event.id}`,
      columns: [{
        key: "id",
        label: "ID",
        cell: eventLabel
      }, {
        key: "date",
        label: strings.event.published,
        cell: event => day(event.date, true)
      }, {
        key: "weight",
        label: strings.event.weight,
        numeric: true,
        cell: event => event.weight.toFixed(1)
      }, {
        key: "title",
        label: strings.event.affected,
        cell: eventTitle
      }]
    })]
  });
};
/* ----------------------------------------
   Event record
   ---------------------------------------- */
const EventRecord = ({
  readings,
  eventId,
  stories,
  onBack
}) => {
  const all = readings.flatMap(reading => reading.events);
  const match = all.filter(event => event.id.toUpperCase() === eventId.toUpperCase() || event.advisory?.cve === eventId.toUpperCase());
  const advisory = match.find(event => event.advisory)?.advisory;
  const cve = advisory?.cve ?? (eventId.toUpperCase().startsWith("CVE-") ? eventId.toUpperCase() : null);
  const exploitation = match.find(event => event.exploitation)?.exploitation ?? all.find(event => event.exploitation && event.exploitation.cve === cve)?.exploitation;
  const epss = match.find(event => event.epss !== null)?.epss ?? null;
  const mentions = stories.filter(story => cve && cvesIn(story.title).includes(cve));
  const title = exploitation?.name ?? advisory?.title ?? eventId;
  const products = advisory?.products.length ? advisory.products : exploitation?.products ?? [];
  return _jsxs(Stack, {
    gap: "section",
    className: "focus record",
    children: [_jsxs(Stack, {
      gap: "tight",
      children: [_jsxs("button", {
        type: "button",
        className: "text-button back-button",
        onClick: onBack,
        children: [_jsx(BackIcon, {}), _jsx("span", {
          children: strings.event.back
        })]
      }), _jsx("span", {
        className: "record-id",
        children: advisory && cve && advisory.id !== cve ? `${advisory.id} · ${cve}` : eventId
      }), _jsx("h2", {
        className: "sheet-title record-title",
        children: title
      }), exploitation && _jsxs("p", {
        className: "exploited-banner",
        children: [strings.event.exploited, " \u00B7", " ", strings.event.delay(daysBetween(exploitation.published, exploitation.added))]
      })]
    }), _jsxs("dl", {
      className: "facts",
      children: [(advisory?.cvss ?? exploitation?.cvss) !== null && (advisory?.cvss ?? exploitation?.cvss) !== undefined && _jsxs("div", {
        children: [_jsx("dt", {
          children: strings.event.cvss
        }), _jsx("dd", {
          className: "fact-figure",
          children: (advisory?.cvss ?? exploitation?.cvss)?.toFixed(1)
        })]
      }), _jsxs("div", {
        children: [_jsx("dt", {
          children: strings.event.epss
        }), _jsx("dd", {
          className: "fact-figure",
          children: epss !== null ? formatPercent(epss, locale) : strings.event.epssLow
        })]
      }), exploitation && _jsxs("div", {
        children: [_jsx("dt", {
          children: strings.event.listed
        }), _jsx("dd", {
          children: day(exploitation.added, true)
        })]
      }), _jsxs("div", {
        children: [_jsx("dt", {
          children: strings.event.published
        }), _jsx("dd", {
          children: day(advisory?.published ?? exploitation?.published ?? new Date().toISOString(), true)
        })]
      }), products.length > 0 && !advisory?.fixes.length && _jsxs("div", {
        children: [_jsx("dt", {
          children: strings.event.affected
        }), _jsx("dd", {
          className: "fact-products",
          children: products.join(", ")
        })]
      }), advisory && advisory.fixes.length > 0 && _jsxs("div", {
        children: [_jsx("dt", {
          children: strings.event.fixes
        }), _jsx("dd", {
          children: _jsx("ul", {
            className: "fixes",
            children: advisory.fixes.map(fix => _jsxs("li", {
              children: [_jsx("span", {
                className: "fix-package",
                children: fix.pkg
              }), fix.affected && _jsx("span", {
                className: "fix-range",
                children: fix.affected
              }), _jsx("span", {
                className: "fix-patched",
                "data-missing": !fix.patched || undefined,
                children: fix.patched ? strings.event.patched(fix.patched) : strings.event.unpatched
              })]
            }, `${fix.pkg}-${fix.affected}`))
          })
        })]
      })]
    }), exploitation?.action && _jsxs("div", {
      className: "cisa-action",
      children: [_jsx("span", {
        className: "label",
        children: strings.event.action
      }), _jsx("p", {
        children: exploitation.action
      }), exploitation.due && _jsxs("p", {
        className: "meta",
        children: [strings.event.due, ": ", day(exploitation.due, true)]
      })]
    }), (advisory || exploitation) && _jsxs("a", {
      className: "outbound",
      href: advisory?.url ?? exploitation?.url,
      target: "_blank",
      rel: "noreferrer",
      children: [_jsxs("span", {
        children: [strings.event.open, ":", " ", strings.event.source[advisory?.source ?? "nvd"]]
      }), _jsx(OutboundIcon, {})]
    }), mentions.length > 0 && _jsxs("section", {
      "aria-labelledby": "mentions-heading",
      children: [_jsx("h3", {
        id: "mentions-heading",
        className: "label",
        children: strings.event.mentions
      }), _jsx(StoryList, {
        stories: mentions
      })]
    })]
  });
};
/* ----------------------------------------
   View
   ---------------------------------------- */
export const NowView = () => {
  const {
    readings,
    stories
  } = useReadings();
  const [search, setSearch] = useSearchState();
  const shown = orderReadings(readings.filter(reading => search.kind === "all" || reading.station.kind === search.kind), search.sort);
  const chosen = readings.find(reading => reading.station.id === search.station);
  const focused = chosen ?? shown[0];
  return _jsxs("div", {
    className: "now",
    "data-sheet": chosen ? "open" : "closed",
    children: [_jsx(Register, {
      readings: shown,
      selectedId: focused?.station.id,
      onSelect: (station, focusDay) => setSearch({
        station,
        event: undefined,
        day: focusDay
      })
    }), _jsx(Box, {
      as: "aside",
      className: "sheet",
      label: focused?.station.name,
      children: search.event ? _jsx(EventRecord, {
        readings: readings,
        eventId: search.event,
        stories: stories,
        onBack: () => setSearch({
          event: undefined
        })
      }) : focused && _jsx(StationFocus, {
        reading: focused,
        focusDay: search.day,
        onClearDay: () => setSearch({
          day: undefined
        }),
        onEvent: event => setSearch({
          station: focused.station.id,
          event
        }),
        onClose: () => setSearch({
          station: undefined,
          event: undefined,
          day: undefined
        })
      })
    })]
  });
};