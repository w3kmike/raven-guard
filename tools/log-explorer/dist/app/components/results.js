import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/// <reference path="../shims.d.ts" />
import { useEffect, useMemo, useRef, useState, } from 'react';
import { bisectCenter, line as lineShape, max, pointer, scaleLinear, scaleTime, scaleUtc, } from 'd3';
import { config } from '../config.js';
import { seriesName } from '../query/index.js';
import { usePatterns } from '../api.js';
import { cssPx, formatClock, formatCount, formatIso, formatNumber, formatShare, plural, } from '../utils.js';
import { Icon, LevelTag, Marked, QueryStatus, Sparkline, edgeOf, useObservedSize, } from './shared.js';
export const ResultsHeader = (p) => (_jsxs(_Fragment, { children: [_jsxs("div", { className: "pane-head", children: [p.metric ? _jsx("h2", { className: "caps", children: p.metric }) : (_jsxs("div", { className: "view-switch", role: "group", "aria-label": "Show results as", children: [_jsxs("button", { type: "button", "aria-pressed": p.view === 'lines', onClick: () => p.onView('lines'), children: [_jsx(Icon, { name: "lines" }), " Lines"] }), _jsxs("button", { type: "button", "aria-pressed": p.view === 'patterns', onClick: () => p.onView('patterns'), children: [_jsx(Icon, { name: "patterns" }), " Patterns"] })] })), _jsx("span", { className: "pane-sub", children: p.summary }), !p.metric && p.view === 'lines' && (_jsxs("button", { type: "button", className: "tool-button", onClick: () => p.onSort(p.sort === 'newest' ? 'oldest' : 'newest'), children: [_jsx(Icon, { name: "sort" }), _jsx("span", { children: p.sort === 'newest' ? 'Newest first' : 'Oldest first' })] }))] }), p.pattern && p.view === 'lines' && (_jsx("p", { className: "chip-bar", children: _jsxs("span", { className: "chip", children: [_jsx(Icon, { name: "patterns" }), _jsxs("span", { className: "chip-text", children: ["Pattern: ", _jsx("code", { children: p.pattern.template })] }), _jsx("button", { type: "button", className: "chip-clear", "aria-label": "Show all lines again", onClick: p.onClearPattern, children: _jsx(Icon, { name: "close" }) })] }) })), p.pending > 0 && (_jsxs("button", { type: "button", className: "live-bar", onClick: p.onFlush, children: [_jsx(Icon, { name: "live" }), " ", plural(p.pending, 'new line'), " \u00B7 Show"] }))] }));
export const LogStream = (p) => {
    const scroller = useRef(null);
    const [rowH, setRowH] = useState(1);
    const [view, setView] = useState({ top: 0, height: 0 });
    const ordered = p.lines;
    const index = ordered.findIndex((l) => l.id === p.selectedId);
    const measure = useObservedSize((el) => {
        scroller.current = el;
        setRowH(Math.max(1, cssPx('--row-current', el)));
        setView({ top: el.scrollTop, height: el.clientHeight });
    });
    useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [p.lines, p.sort]);
    const reveal = (i) => {
        const el = scroller.current;
        if (!el)
            return;
        if (i * rowH < el.scrollTop)
            el.scrollTop = i * rowH;
        else if ((i + 1) * rowH > el.scrollTop + el.clientHeight)
            el.scrollTop = (i + 1) * rowH - el.clientHeight;
    };
    const move = (to) => {
        const i = Math.max(0, Math.min(ordered.length - 1, to));
        if (!ordered[i])
            return;
        p.onSelect(ordered[i], false);
        reveal(i);
    };
    const page = Math.max(1, Math.floor(view.height / rowH) - 1);
    const onKeyDown = (e) => {
        const keys = {
            ArrowDown: () => move(index + 1),
            ArrowUp: () => move(index < 0 ? 0 : index - 1),
            PageDown: () => move(index + page),
            PageUp: () => move(index - page),
            Home: () => move(0),
            End: () => move(ordered.length - 1),
            Enter: () => { if (index >= 0)
                p.onSelect(ordered[index], true); },
            p: () => { if (index >= 0)
                p.onPin(ordered[index]); },
            Escape: () => p.onClose(),
        };
        const fn = keys[e.key];
        if (fn && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            fn();
        }
    };
    const start = Math.max(0, Math.floor(view.top / rowH) - config.overscanRows);
    const end = Math.min(ordered.length, Math.ceil((view.top + view.height) / rowH) + config.overscanRows);
    return (_jsx("div", { className: "stream-wrap", children: ordered.length === 0 ? (_jsxs("div", { className: "empty-state", children: [_jsx("h3", { children: "No lines match" }), _jsxs("p", { children: [_jsx("code", { children: p.queryText || '(every line)' }), " found nothing in this range. The query is valid; the time range or a filter is too narrow."] }), _jsxs("div", { className: "empty-actions", children: [p.canWiden && _jsx("button", { type: "button", className: "text-button", onClick: p.onWiden, children: "Search the whole capture" }), p.canGoBack && _jsxs("button", { type: "button", className: "text-button", onClick: p.onBack, children: [_jsx(Icon, { name: "back" }), " Back to the previous query"] })] })] })) : (_jsx("div", { ref: measure, className: "stream", role: "listbox", tabIndex: 0, "aria-label": `Log lines, ${p.sort} first. Arrow keys move, Enter opens a line, P pins it.`, "aria-activedescendant": index >= 0 ? `line-${ordered[index].id}` : undefined, onKeyDown: onKeyDown, onScroll: (e) => setView({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight }), children: _jsx("div", { className: "stream-inner", style: { height: ordered.length * rowH }, children: ordered.slice(start, end).map((l, k) => {
                    const i = start + k;
                    return (_jsxs("div", { id: `line-${l.id}`, role: "option", "aria-selected": l.id === p.selectedId, "aria-setsize": ordered.length, "aria-posinset": i + 1, className: "row", "data-level": l.labels.level, style: { transform: `translateY(${i * rowH}px)` }, onClick: () => p.onSelect(l, true), children: [_jsx("time", { className: "row-time", dateTime: formatIso(l.ts), children: formatClock(l.ts, p.zone) }), _jsx(LevelTag, { level: l.labels.level }), _jsx("span", { className: "row-service", children: l.labels.service }), _jsx("span", { className: "row-raw", children: _jsx(Marked, { text: l.raw.slice(0, config.excerptChars), terms: p.terms }) }), p.pinned.has(l.id) && _jsx("span", { className: "row-pin", title: "Pinned to the open case", children: _jsx(Icon, { name: "pin" }) })] }, l.id));
                }) }) })) }));
};
const LineChart = ({ result, zone, focus, onFocus }) => {
    const [w, setW] = useState(0);
    const [hover, setHover] = useState(null);
    const box = useObservedSize((el) => setW(el.clientWidth));
    const h = cssPx('--chart-height');
    const final = result.steps.length - 1;
    const direct = w >= config.directLabelMinWidth && result.series.some((s) => s.values[final] !== null);
    const m = {
        top: cssPx('--chart-margin-top'),
        right: cssPx(direct ? '--chart-margin-right' : '--chart-margin-right-narrow'),
        bottom: cssPx('--chart-margin-bottom'),
        left: cssPx('--chart-margin-left'),
    };
    const iw = Math.max(0, w - m.left - m.right);
    const ih = h - m.top - m.bottom;
    const x = (zone === 'utc' ? scaleUtc() : scaleTime()).domain([result.steps[0], result.steps[result.steps.length - 1]]).range([0, iw]);
    const yMax = max(result.series.flatMap((s) => s.values.filter((v) => v !== null))) ?? 1;
    const y = scaleLinear().domain([0, yMax]).nice().range([ih, 0]);
    const path = lineShape()
        .defined((v) => v !== null)
        .x((_, i) => x(result.steps[i]))
        .y((v) => y(v ?? 0));
    const labelGap = cssPx('--chart-label-gap');
    const stacked = result.series
        .map((s, i) => ({ s, i, last: s.values[final] }))
        .filter((l) => l.last !== null)
        .map((l) => ({ ...l, y: y(l.last) }))
        .sort((a, b) => a.y - b.y)
        .reduce((acc, l) => [...acc, { ...l, y: Math.max(l.y, (acc[acc.length - 1]?.y ?? -Infinity) + labelGap) }], []);
    const overflow = Math.max(0, (stacked[stacked.length - 1]?.y ?? 0) - ih);
    const labels = stacked.map((l) => ({ ...l, y: l.y - overflow }));
    const hovered = hover === null ? null : result.steps[hover];
    return (_jsxs("div", { className: "chart", ref: box, onPointerLeave: () => setHover(null), children: [w > 0 && (_jsx("svg", { width: w, height: h, "aria-hidden": "true", onPointerMove: (e) => {
                    const [mx] = pointer(e);
                    const t = +x.invert(mx - m.left);
                    const i = bisectCenter(result.steps, t);
                    setHover(i >= 0 && i < result.steps.length ? i : null);
                }, children: _jsxs("g", { transform: `translate(${m.left},${m.top})`, children: [y.ticks(4).map((t) => (_jsxs("g", { className: "grid", transform: `translate(0,${y(t)})`, children: [_jsx("line", { x2: iw }), _jsx("text", { x: -cssPx('--gap-cell'), children: formatNumber(t) })] }, t))), x.ticks(w < config.phoneWidth ? 3 : 6).map((t) => (_jsxs("g", { className: "tick", "data-edge": edgeOf(x(t), iw), transform: `translate(${x(t)},${ih})`, children: [_jsx("line", { y2: cssPx('--chart-tick-length') }), _jsx("text", { y: m.bottom, children: formatClock(+t, zone, 'm') })] }, +t))), result.series.map((s, i) => (_jsx("path", { className: "series-line", "data-dim": focus !== null && focus !== s.key, d: path(s.values) ?? '', style: { stroke: `var(--series-${i + 1})` } }, s.key))), direct && labels.map((l) => (_jsx("text", { className: "series-label", "data-dim": focus !== null && focus !== l.s.key, x: iw + cssPx('--gap-cell'), y: l.y, style: { fill: `var(--series-${l.i + 1})` }, onPointerEnter: () => onFocus(l.s.key), onPointerLeave: () => onFocus(null), children: seriesName(l.s) }, l.s.key))), hovered !== null && _jsx("line", { className: "crosshair", x1: x(hovered), x2: x(hovered), y1: 0, y2: ih })] }) })), hover !== null && hovered !== null && (_jsxs("div", { className: "timeline-tip", style: { left: Math.min(m.left + x(hovered), w - cssPx('--popover-width') / 2) }, children: [_jsx("strong", { children: formatClock(hovered, zone, 's') }), result.series
                        .map((s, i) => ({ s, i, v: s.values[hover] }))
                        .filter((r) => r.v !== null)
                        .sort((a, b) => (b.v ?? 0) - (a.v ?? 0))
                        .map((r) => (_jsxs("span", { className: "tip-row", children: [_jsx("span", { className: "swatch", style: { background: `var(--series-${r.i + 1})` } }), seriesName(r.s), " ", formatNumber(r.v ?? 0)] }, r.s.key)))] }))] }));
};
export const MetricView = ({ result, zone }) => {
    const [focus, setFocus] = useState(null);
    const summary = useMemo(() => result.series.map((s, i) => {
        const vals = s.values.filter((v) => v !== null);
        const peakIdx = s.values.reduce((best, v, j) => ((v ?? -Infinity) > (s.values[best] ?? -Infinity) ? j : best), 0);
        const last = [...s.values].reverse().find((v) => v !== null) ?? null;
        return { s, i, last, peak: s.values[peakIdx] ?? 0, peakAt: result.steps[peakIdx], mean: vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length) };
    }), [result]);
    const top = summary[0];
    const capped = result.totalSeries > result.series.length;
    return (_jsxs("div", { className: "metric", children: [capped && (_jsxs("p", { className: "notice", "data-tone": "warning", children: [_jsx(Icon, { name: "alert" }), _jsx("span", { children: `The query produced ${formatCount(result.totalSeries)} series. Showing the ${result.series.length} with the highest peaks; the rest are hidden. Group with sum by (…), or pick with topk(…), to compare fewer.` })] })), result.series.length === 0 ? (_jsxs("div", { className: "empty-state", children: [_jsx("h3", { children: "No samples" }), _jsx("p", { children: "The query is valid, but no lines fell inside its range windows. Widen the time range, the [window], or the selector." })] })) : result.instant ? (_jsx("ul", { className: "stats", children: summary.map((r) => (_jsxs("li", { className: "stat", children: [_jsx("span", { className: "stat-value", children: formatNumber(r.last ?? 0) }), _jsx("code", { className: "stat-label", children: seriesName(r.s) })] }, r.s.key))) })) : (_jsxs(_Fragment, { children: [_jsx(LineChart, { result: result, zone: zone, focus: focus, onFocus: setFocus }), _jsx("p", { className: "sr-only", children: `${plural(result.series.length, 'series', 'series')} of ${result.unit}. ${top ? `Highest peak: ${seriesName(top.s)} at ${formatNumber(top.peak)}, ${formatClock(top.peakAt, zone, 's')}.` : ''}` }), _jsxs("table", { className: "series-table", children: [_jsx("caption", { className: "sr-only", children: "Series summary" }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "Series" }), _jsx("th", { scope: "col", children: "Latest" }), _jsx("th", { scope: "col", children: "Peak" }), _jsx("th", { scope: "col", children: "Mean" })] }) }), _jsx("tbody", { children: summary.map((r) => (_jsxs("tr", { "data-focus": focus === r.s.key, onPointerEnter: () => setFocus(r.s.key), onPointerLeave: () => setFocus(null), children: [_jsx("th", { scope: "row", children: _jsxs("span", { className: "series-name", children: [_jsx("span", { className: "swatch", style: { background: `var(--series-${r.i + 1})` } }), _jsx("code", { children: seriesName(r.s) })] }) }), _jsx("td", { children: r.last === null ? '—' : formatNumber(r.last) }), _jsxs("td", { children: [formatNumber(r.peak), " ", _jsxs("span", { className: "cell-sub", children: ["at ", formatClock(r.peakAt, zone, 'm')] })] }), _jsx("td", { children: formatNumber(r.mean) })] }, r.s.key))) })] })] }))] }));
};
const PatternTemplate = ({ template }) => (_jsx("code", { className: "pattern-template", children: template.split(/(<(?:ip|num|str|bool|hex|hash|user)>)/).map((part, i) => (i % 2 ? _jsx("span", { className: "placeholder", children: part }, i) : part)) }));
export const PatternList = ({ query, onShowLines }) => {
    const result = usePatterns(query, true);
    const [rareFirst, setRareFirst] = useState(false);
    return (_jsx("div", { className: "patterns", "data-loading": result.isFetching, children: _jsx(QueryStatus, { query: result, loading: "Grouping lines into patterns\u2026", children: (r) => {
                const list = rareFirst ? [...r.patterns].reverse() : r.patterns;
                const peak = Math.max(1, ...r.patterns.flatMap((x) => x.sparkline));
                return r.patterns.length === 0 ? _jsx("p", { className: "empty-note", children: "No lines match, so there's nothing to group." }) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "patterns-tools", children: [_jsxs("span", { children: [`${plural(r.patterns.length, 'pattern')} from ${plural(r.total, 'line')}. Placeholders like `, _jsx("span", { className: "placeholder", children: "<ip>" }), ' stand for values that vary.'] }), _jsxs("button", { type: "button", className: "tool-button", "aria-pressed": rareFirst, onClick: () => setRareFirst((v) => !v), children: [_jsx(Icon, { name: "sort" }), _jsx("span", { children: rareFirst ? 'Rarest first' : 'Most common first' })] })] }), _jsx("ol", { className: "pattern-list", children: list.map((x) => (_jsxs("li", { className: "pattern", "data-level": x.level, children: [_jsxs("div", { className: "pattern-meta", children: [_jsx("span", { className: "pattern-count", children: formatCount(x.count) }), _jsx("span", { className: "pattern-share", children: formatShare(x.count, r.total) }), _jsx(LevelTag, { level: x.level }), _jsx("span", { className: "row-service", children: x.service }), _jsx(Sparkline, { values: x.sparkline, max: peak, label: `${x.count} lines between ${formatClock(x.first, 'utc', 's')} and ${formatClock(x.last, 'utc', 's')} UTC` })] }), _jsx(PatternTemplate, { template: x.template }), _jsxs("button", { type: "button", className: "text-button", onClick: () => onShowLines(x), children: ["Show ", x.count === 1 ? 'the line' : `these ${formatCount(x.count)} lines`] })] }, x.id))) })] }));
            } }) }));
};
