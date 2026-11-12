import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
// Intended use: the Trends view: monthly advisories and exploitations as small multiples for every station, and how many days each station's exploited vulnerabilities took to go from disclosure to KEV listing.
import { useNavigate } from "@tanstack/react-router";
import { reading as readingConfig, stations } from "../config.js";
import { en as strings } from "../locales/en.js";
import { useSearchState } from "../navigation.js";
import { delays, months } from "../model.js";
import { useReadings } from "./shell.js";
import { Stack } from "../components/layout.js";
import { DataTable } from "../components/data.js";
import { DelayPlot, MirroredBars } from "../components/charts.js";
import { formatMonth, groupBy, quantile } from "../lib/utils.js";
const {
  locale
} = readingConfig;
const monthName = month => formatMonth(new Date(month), locale, true);
export const TrendsView = () => {
  const {
    readings,
    now,
    days
  } = useReadings();
  const [search] = useSearchState();
  const navigate = useNavigate();
  const record = readings.map(reading => ({
    reading,
    months: months(reading, now, days)
  }));
  const belowMax = Math.max(1, ...record.flatMap(entry => entry.months.map(month => month.exploited)));
  const byStation = groupBy(delays(readings), delay => delay.stationId);
  const rows = stations.flatMap(station => {
    const values = byStation.get(station.id) ?? [];
    const median = Math.round(quantile(values.map(value => value.days), 0.5));
    return values.length ? [{
      id: station.id,
      label: `${station.name} · ${values.length}`,
      values: values.map(value => ({
        id: value.cve,
        days: value.days,
        label: `${value.cve} — ${value.name}`
      })),
      median,
      medianLabel: strings.trends.median(median)
    }] : [];
  }).sort((a, b) => a.median - b.median);
  const open = (station, event) => navigate({
    to: "/",
    search: previous => ({
      ...previous,
      station,
      event
    })
  });
  return _jsxs(Stack, {
    gap: "section",
    className: "trends",
    children: [_jsxs(Stack, {
      gap: "tight",
      children: [_jsx("h1", {
        className: "headline",
        children: strings.trends.heading(strings.masthead.spans[search.span].long)
      }), _jsx("p", {
        className: "lede",
        children: strings.trends.lede
      })]
    }), _jsxs("figure", {
      className: "chart",
      children: [_jsxs("figcaption", {
        children: [_jsx("span", {
          className: "label",
          children: strings.trends.multiplesTitle
        }), _jsx("span", {
          className: "meta",
          children: strings.trends.multiplesCaption
        })]
      }), _jsx("ul", {
        className: "multiples",
        children: record.map(({
          reading,
          months: list
        }) => {
          const peak = list.reduce((best, month) => !best || month.advisories > best.advisories ? month : best, null);
          const aboveMax = Math.max(1, ...list.map(month => month.advisories));
          return _jsx("li", {
            children: _jsxs("button", {
              type: "button",
              className: "multiple",
              onClick: () => open(reading.station.id),
              children: [_jsx("span", {
                className: "multiple-name",
                children: reading.station.name
              }), _jsx(MirroredBars, {
                above: list.map(month => month.advisories),
                below: list.map(month => month.exploited),
                faint: list.map(month => month.partial),
                gaps: list.map(month => !month.covered && month.advisories === 0),
                aboveMax: aboveMax,
                belowMax: belowMax
              }), _jsxs("span", {
                className: "multiple-axis",
                "aria-hidden": "true",
                children: [_jsx("span", {
                  children: list[0] ? monthName(list[0].month) : ""
                }), _jsx("span", {
                  children: list.length ? monthName(list[list.length - 1].month) : ""
                })]
              }), _jsx("span", {
                className: "meta",
                children: peak && peak.advisories ? strings.trends.peak(peak.advisories, monthName(peak.month)) : strings.trends.unrecorded
              })]
            })
          }, reading.station.id);
        })
      }), _jsx(DataTable, {
        caption: strings.trends.tableCaption,
        showLabel: strings.table.show,
        hideLabel: strings.table.hide,
        rows: record.flatMap(({
          reading,
          months: list
        }) => list.map(month => ({
          station: reading.station.name,
          ...month
        }))),
        rowKey: row => `${row.station}-${row.month}`,
        columns: [{
          key: "station",
          label: strings.register.columns.station,
          cell: row => row.station
        }, {
          key: "month",
          label: "Month",
          cell: row => monthName(row.month)
        }, {
          key: "adv",
          label: strings.trends.advisories,
          numeric: true,
          cell: row => row.covered || row.advisories ? row.advisories : strings.trends.unrecorded
        }, {
          key: "exp",
          label: strings.trends.exploited,
          numeric: true,
          cell: row => row.exploited
        }]
      })]
    }), _jsxs("figure", {
      className: "chart",
      children: [_jsxs("figcaption", {
        children: [_jsx("span", {
          className: "label",
          children: strings.trends.delayTitle
        }), _jsx("span", {
          className: "meta",
          children: strings.trends.delayCaption
        })]
      }), rows.length ? _jsx(DelayPlot, {
        rows: rows,
        sameDayLabel: strings.trends.sameDay,
        axisLabel: strings.trends.delayAxis,
        onSelect: cve => {
          const row = rows.find(entry => entry.values.some(value => value.id === cve));
          if (row) open(row.id, cve);
        }
      }) : _jsx("p", {
        className: "empty",
        children: strings.trends.delayEmpty
      }), _jsx(DataTable, {
        caption: strings.trends.delayTitle,
        showLabel: strings.table.show,
        hideLabel: strings.table.hide,
        rows: rows,
        rowKey: row => row.id,
        columns: [{
          key: "station",
          label: strings.register.columns.station,
          cell: row => row.label
        }, {
          key: "count",
          label: strings.trends.exploited,
          numeric: true,
          cell: row => row.values.length
        }, {
          key: "median",
          label: strings.trends.delayAxis,
          numeric: true,
          cell: row => row.median
        }]
      })]
    })]
  });
};