import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
// Intended use: generic chart instruments drawn as SVG by React with D3 doing the math: a horizon strip, a range ledger, a swarm of weighted events, mirrored monthly bars, and a delay strip plot.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
/* ----------------------------------------
   Measuring
   ---------------------------------------- */
export const useWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
};
const runs = flags => flags.reduce((found, flag, index) => {
  if (!flag) return found;
  const last = found[found.length - 1];
  if (last && last[1] === index) return [...found.slice(0, -1), [last[0], index + 1]];
  return [...found, [index, index + 1]];
}, []);
const Hatch = ({
  id,
  className
}) => _jsx("pattern", {
  id: id,
  width: "6",
  height: "6",
  patternUnits: "userSpaceOnUse",
  patternTransform: "rotate(45)",
  children: _jsx("line", {
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "6",
    className: className
  })
});
export const HorizonStrip = ({
  ratios,
  gaps,
  marks,
  rug,
  bands = 3,
  cursor = null
}) => {
  const hatch = useId();
  const height = 100;
  const length = ratios.length;
  const levels = ratios.map(ratio => ratio > 0 ? Math.log2(ratio) : -bands);
  const area = band => d3.area().x((_, index) => index + 0.5).y0(height).y1(level => height - Math.max(0, Math.min(1, level - band)) * height).curve(d3.curveMonotoneX)(levels) ?? "";
  const below = d3.area().x((_, index) => index + 0.5).y0(height).y1(level => height - Math.max(0, Math.min(1, -level)) * height).curve(d3.curveMonotoneX)(levels) ?? "";
  const rugMax = Math.max(1, ...(rug ?? []));
  return _jsxs("svg", {
    className: "horizon",
    viewBox: `0 0 ${length} ${height}`,
    preserveAspectRatio: "none",
    "aria-hidden": "true",
    focusable: "false",
    children: [_jsx("defs", {
      children: _jsx(Hatch, {
        id: hatch,
        className: "horizon-hatch-line"
      })
    }), _jsx("path", {
      d: below,
      className: "horizon-below"
    }), Array.from({
      length: bands
    }, (_, band) => _jsx("path", {
      d: area(band),
      className: `horizon-band horizon-band-${band + 1}`
    }, band)), runs(gaps).map(([start, end]) => _jsx("rect", {
      x: start,
      width: end - start,
      y: "0",
      height: height,
      fill: `url(#${hatch})`,
      className: "horizon-gap"
    }, start)), rug?.map((count, day) => count ? _jsx("line", {
      x1: day + 0.5,
      x2: day + 0.5,
      y1: height,
      y2: height - 8 - Math.sqrt(count) / Math.sqrt(rugMax) * 34,
      className: "horizon-rug",
      vectorEffect: "non-scaling-stroke"
    }, `r${day}`) : null), marks.map((day, index) => _jsx("line", {
      x1: day + 0.5,
      x2: day + 0.5,
      y1: "0",
      y2: "46",
      className: "horizon-mark",
      vectorEffect: "non-scaling-stroke"
    }, `m${day}-${index}`)), cursor !== null && _jsx("line", {
      x1: cursor + 0.5,
      x2: cursor + 0.5,
      y1: "0",
      y2: height,
      className: "horizon-cursor",
      vectorEffect: "non-scaling-stroke"
    })]
  });
};
/* ----------------------------------------
   Range ledger: one reading against its normal band, on a log scale
   ---------------------------------------- */
export const ledgerDomain = [0.25, 8];
export const ledgerTicks = [0.5, 1, 2, 4];
export const ledgerPosition = ratio => d3.scaleLog().domain(ledgerDomain).range([0, 100]).clamp(true)(Math.max(ratio, 0.01));
export const RangeLedger = ({
  ratio,
  bandLow,
  bandHigh,
  unusualAt,
  pending,
  previous
}) => {
  const low = ledgerPosition(Math.max(bandLow, ledgerDomain[0]));
  const high = ledgerPosition(Math.max(bandHigh, bandLow));
  const at = ledgerPosition(ratio);
  const unusual = ratio >= unusualAt;
  const beyond = ratio > ledgerDomain[1];
  return _jsxs("span", {
    className: "ledger",
    "aria-hidden": "true",
    children: [_jsxs("svg", {
      viewBox: "0 0 100 20",
      preserveAspectRatio: "none",
      focusable: "false",
      children: [_jsx("line", {
        x1: "0",
        x2: "100",
        y1: "10",
        y2: "10",
        className: "ledger-axis",
        vectorEffect: "non-scaling-stroke"
      }), _jsx("rect", {
        x: low,
        width: Math.max(0.8, high - low),
        y: "5",
        height: "10",
        className: "ledger-band"
      }), _jsx("line", {
        x1: ledgerPosition(1),
        x2: ledgerPosition(1),
        y1: "3",
        y2: "17",
        className: "ledger-normal",
        vectorEffect: "non-scaling-stroke"
      }), !pending && previous !== undefined && _jsx("line", {
        x1: ledgerPosition(previous),
        x2: ledgerPosition(previous),
        y1: "4",
        y2: "16",
        className: "ledger-previous",
        vectorEffect: "non-scaling-stroke"
      }), !pending && _jsx("line", {
        x1: ledgerPosition(1),
        x2: at,
        y1: "10",
        y2: "10",
        className: unusual ? "ledger-reach ledger-reach-unusual" : "ledger-reach",
        vectorEffect: "non-scaling-stroke"
      })]
    }), !pending && _jsx("span", {
      className: unusual ? "ledger-dot ledger-dot-unusual" : "ledger-dot",
      "data-beyond": beyond || undefined,
      style: {
        left: `${beyond ? 100 : at}%`
      }
    })]
  });
};
export const Swarm = ({
  points,
  days,
  selected,
  onSelect,
  dayLabel,
  axisLabel,
  keysLabel,
  focusRange = null
}) => {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);
  const height = 220;
  const margin = {
    top: 22,
    right: 12,
    bottom: 22,
    left: 34
  };
  const weights = points.map(point => point.weight);
  const y = d3.scaleLog().domain([Math.max(0.3, (d3.min(weights) ?? 0.5) * 0.8), Math.max(4, (d3.max(weights) ?? 4) * 1.25)]).range([height - margin.bottom, margin.top]);
  const x = d3.scaleLinear().domain([0, days]).range([margin.left, Math.max(margin.left + 1, width - margin.right)]);
  const placed = useMemo(() => {
    if (!width) return [];
    const nodes = points.map(point => {
      const tx = x(point.day + 0.5);
      const ty = y(point.weight);
      return {
        ...point,
        tx,
        ty,
        x: tx,
        y: ty
      };
    });
    const simulation = d3.forceSimulation(nodes).force("x", d3.forceX(node => node.tx).strength(0.2)).force("y", d3.forceY(node => node.ty).strength(1)).force("collide", d3.forceCollide(3.1)).stop();
    simulation.tick(140);
    return nodes.map(node => ({
      ...node,
      x: Math.min(width - margin.right - 3, Math.max(margin.left + 3, node.x)),
      y: Math.min(height - margin.bottom - 3, Math.max(margin.top + 3, node.y))
    }));
  }, [points, width, days]);
  const [low, high] = y.domain();
  const ticks = [0.5, 1, 2, 4, 8, 16, 32, 64].filter(tick => tick >= low && tick <= high);
  const dayTicks = d3.ticks(0, days, Math.max(2, Math.floor(width / 110)));
  const focus = placed.find(node => node.id === selected);
  const order = [...placed].sort((a, b) => a.day - b.day || b.weight - a.weight);
  const current = placed.find(node => node.id === active);
  const step = event => {
    const index = order.findIndex(node => node.id === active);
    const moves = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1
    };
    if (event.key in moves) {
      event.preventDefault();
      const next = index < 0 ? 0 : Math.min(order.length - 1, Math.max(0, index + moves[event.key]));
      setActive(order[next]?.id ?? null);
    } else if (event.key === "Enter" && current) {
      onSelect(current.id);
    } else if (event.key === "Escape") {
      setActive(null);
    }
  };
  return _jsxs("div", {
    ref: ref,
    className: "swarm",
    tabIndex: 0,
    role: "group",
    "aria-label": keysLabel,
    onKeyDown: step,
    onBlur: () => setActive(null),
    children: [current && _jsxs("div", {
      className: "swarm-card",
      style: {
        left: `${Math.min(Math.max(current.x, 124), width - 124)}px`,
        top: `${current.y}px`
      },
      "aria-live": "polite",
      children: [_jsx("span", {
        className: "swarm-card-id",
        children: current.label
      }), _jsx("span", {
        className: "swarm-card-title",
        children: current.title
      }), _jsx("span", {
        className: "swarm-card-meta",
        children: current.meta
      })]
    }), width > 0 && _jsxs("svg", {
      width: width,
      height: height,
      "aria-hidden": "true",
      focusable: "false",
      children: [ticks.map(tick => _jsxs("g", {
        children: [_jsx("line", {
          x1: margin.left,
          x2: width - margin.right,
          y1: y(tick),
          y2: y(tick),
          className: "swarm-rule"
        }), _jsx("text", {
          x: margin.left - 6,
          y: y(tick),
          className: "swarm-tick",
          textAnchor: "end",
          dominantBaseline: "middle",
          children: tick
        })]
      }, tick)), _jsx("text", {
        x: 2,
        y: 4,
        className: "swarm-tick swarm-axis-label",
        dominantBaseline: "hanging",
        children: axisLabel
      }), dayTicks.map(day => _jsx("text", {
        x: x(day),
        y: height - 6,
        className: "swarm-tick",
        textAnchor: "middle",
        children: dayLabel(day)
      }, day)), focus && _jsxs("g", {
        className: "swarm-crosshair",
        children: [_jsx("line", {
          x1: focus.x,
          x2: focus.x,
          y1: margin.top,
          y2: height - margin.bottom
        }), _jsx("line", {
          x1: margin.left,
          x2: width - margin.right,
          y1: focus.y,
          y2: focus.y
        })]
      }), focusRange !== null && _jsx("rect", {
        x: x(focusRange[0]),
        width: Math.max(2, x(focusRange[1] + 1) - x(focusRange[0])),
        y: margin.top,
        height: height - margin.top - margin.bottom,
        className: "swarm-day"
      }), placed.map(node => _jsx("circle", {
        cx: node.x,
        cy: node.y,
        r: node.id === selected || node.id === active ? 5 : 3,
        className: ["swarm-point", `swarm-point-${node.tone}`, node.id === selected ? "is-selected" : "", node.id === active ? "is-active" : "", node.watched ? "is-watched" : "", focusRange !== null && (node.day < focusRange[0] || node.day > focusRange[1]) ? "is-muted" : ""].filter(Boolean).join(" "),
        onClick: () => onSelect(node.id),
        onPointerEnter: () => setActive(node.id),
        onPointerLeave: () => setActive(null)
      }, node.id))]
    })]
  });
};
export const MirroredBars = ({
  above,
  below,
  gaps,
  faint,
  aboveMax,
  belowMax
}) => {
  const hatch = useId();
  const length = above.length;
  const top = 64;
  const bottom = 24;
  return _jsxs("svg", {
    className: "mirrored",
    viewBox: `0 0 ${length * 10} ${top + bottom + 1}`,
    preserveAspectRatio: "none",
    "aria-hidden": "true",
    focusable: "false",
    children: [_jsx("defs", {
      children: _jsx(Hatch, {
        id: hatch,
        className: "mirrored-hatch-line"
      })
    }), above.map((count, index) => gaps[index] ? _jsx("rect", {
      x: index * 10 + 1,
      width: "8",
      y: "0",
      height: top,
      fill: `url(#${hatch})`
    }, `g${index}`) : _jsx("rect", {
      x: index * 10 + 1,
      width: "8",
      y: top - count / Math.max(1, aboveMax) * top,
      height: count / Math.max(1, aboveMax) * top,
      className: faint?.[index] ? "mirrored-above is-faint" : "mirrored-above"
    }, `a${index}`)), _jsx("line", {
      x1: "0",
      x2: length * 10,
      y1: top + 0.5,
      y2: top + 0.5,
      className: "mirrored-axis",
      vectorEffect: "non-scaling-stroke"
    }), below.map((count, index) => count ? _jsx("rect", {
      x: index * 10 + 1,
      width: "8",
      y: top + 1,
      height: Math.max(2, count / Math.max(1, belowMax) * bottom),
      className: "mirrored-below"
    }, `b${index}`) : null)]
  });
};
export const DelayPlot = ({
  rows,
  sameDayLabel,
  axisLabel,
  onSelect
}) => {
  const [ref, width] = useWidth();
  const rowHeight = 30;
  const labelWidth = width < 560 ? 0 : 200;
  const margin = {
    top: 8,
    right: 16,
    bottom: 30,
    left: labelWidth + 8
  };
  const height = margin.top + margin.bottom + rows.length * (rowHeight + (labelWidth ? 0 : 16));
  const maxDays = Math.max(30, d3.max(rows.flatMap(row => row.values.map(value => value.days))) ?? 30);
  const x = d3.scaleSymlog().constant(3).domain([0, maxDays]).range([margin.left, Math.max(margin.left + 1, width - margin.right)]);
  const ticks = [0, 1, 7, 30, 90, 365, 1000, 3650].filter(tick => tick <= maxDays);
  const rowTop = index => margin.top + index * (rowHeight + (labelWidth ? 0 : 16)) + (labelWidth ? 0 : 16);
  return _jsx("div", {
    ref: ref,
    className: "delay-plot",
    children: width > 0 && _jsxs("svg", {
      width: width,
      height: height,
      "aria-hidden": "true",
      focusable: "false",
      children: [ticks.map(tick => _jsxs("g", {
        children: [_jsx("line", {
          x1: x(tick),
          x2: x(tick),
          y1: margin.top,
          y2: height - margin.bottom,
          className: "delay-rule"
        }), _jsx("text", {
          x: x(tick),
          y: height - margin.bottom + 14,
          className: "delay-tick",
          textAnchor: "middle",
          children: tick === 0 ? sameDayLabel : tick >= 365 ? `${Math.round(tick / 365)}y` : `${tick}d`
        })]
      }, tick)), _jsx("text", {
        x: width - margin.right,
        y: height - 2,
        className: "delay-tick delay-axis-label",
        textAnchor: "end",
        children: axisLabel
      }), rows.map((row, index) => {
        const top = rowTop(index);
        return _jsxs("g", {
          children: [_jsx("text", {
            x: labelWidth ? labelWidth : margin.left,
            y: labelWidth ? top + rowHeight / 2 : top - 5,
            className: "delay-label",
            textAnchor: labelWidth ? "end" : "start",
            dominantBaseline: labelWidth ? "middle" : "auto",
            children: row.label
          }), _jsx("line", {
            x1: margin.left,
            x2: width - margin.right,
            y1: top + rowHeight / 2,
            y2: top + rowHeight / 2,
            className: "delay-row"
          }), row.values.map((value, valueIndex) => _jsx("circle", {
            cx: x(value.days),
            cy: top + rowHeight / 2 + (valueIndex * 7 % 5 - 2) * 2.4,
            r: "3.4",
            className: "delay-point",
            onClick: () => onSelect(value.id),
            children: _jsx("title", {
              children: value.label
            })
          }, `${value.id}-${valueIndex}`)), _jsx("line", {
            x1: x(row.median),
            x2: x(row.median),
            y1: top + 3,
            y2: top + rowHeight - 3,
            className: "delay-median"
          }), _jsx("text", {
            x: x(row.median) + 5,
            y: top + 4,
            className: "delay-median-label",
            dominantBaseline: "hanging",
            children: row.medianLabel
          })]
        }, row.id);
      })]
    })
  });
};