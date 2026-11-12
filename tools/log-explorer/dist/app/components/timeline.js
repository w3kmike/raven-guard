import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/// <reference path="../shims.d.ts" />
import { useEffect, useEffectEvent, useRef, useState, } from 'react';
import { brushX, max, pointer, scaleLinear, scaleTime, scaleUtc, select, } from 'd3';
import { config } from '../config.js';
import { NONE_KEY, OTHER_KEY, } from '../schemas.js';
import { useVolume } from '../api.js';
import { cssPx, formatClock, formatCount, formatSpan, plural, zoneLabel, } from '../utils.js';
import { Icon, QueryStatus, edgeOf, useEnter, useObservedSize, } from './shared.js';
const keyColor = (key, keys, split) => {
    if (!split)
        return `var(--level-${key})`;
    if (key === OTHER_KEY)
        return 'var(--series-8)';
    if (key === NONE_KEY)
        return 'var(--level-unknown)';
    return `var(--series-${keys.indexOf(key) + 1})`;
};
const BrushChoice = ({ focus, zone, left, onZoom, onCompare, onCancel }) => {
    const ref = useRef(null);
    useEnter(ref, []);
    useEffect(() => { ref.current?.querySelector('button')?.focus(); }, []);
    return (_jsxs("div", { ref: ref, className: "brush-choice", role: "dialog", "aria-label": "Use the selected time", style: { left }, onKeyDown: (e) => { if (e.key === 'Escape')
            onCancel(); }, children: [_jsxs("strong", { children: [formatClock(focus.from, zone, 's'), "\u2013", formatClock(focus.to, zone, 's')] }), _jsxs("button", { type: "button", className: "tool-button", onClick: onZoom, children: [_jsx(Icon, { name: "zoomOut" }), " Zoom to this"] }), _jsxs("button", { type: "button", className: "tool-button", onClick: onCompare, children: [_jsx(Icon, { name: "compare" }), " Compare with the time around it"] }), _jsx("button", { type: "button", className: "icon-button", "aria-label": "Cancel", onClick: onCancel, children: _jsx(Icon, { name: "close" }) })] }));
};
const Plot = ({ hist, range, zone, split, compare, w, h, axis, onPick }) => {
    const brushRef = useRef(null);
    const [hover, setHover] = useState(null);
    const x = (zone === 'utc' ? scaleUtc() : scaleTime()).domain([range.from, range.to]).range([0, w]);
    const y = scaleLinear().domain([0, Math.max(1, max(hist.buckets, (b) => b.total) ?? 0)]).range([h, 0]);
    const gap = cssPx('--chart-bar-gap');
    const pick = useEffectEvent(([a, b]) => {
        const from = Math.max(range.from, Math.floor(+x.invert(a) / hist.step) * hist.step);
        const to = Math.min(range.to, Math.ceil(+x.invert(b) / hist.step) * hist.step);
        if (to - from >= hist.step)
            onPick({ from, to });
    });
    useEffect(() => {
        const g = brushRef.current;
        if (!g || w === 0)
            return undefined;
        const sel = select(g);
        const brush = brushX()
            .extent([[0, 0], [w, h]])
            .on('end', (ev) => {
            if (!ev.selection || !ev.sourceEvent)
                return;
            sel.call(brush.move, null);
            pick(ev.selection);
        });
        sel.call(brush);
        return () => { sel.on('.brush', null); sel.selectAll('*').remove(); };
    }, [w, h]);
    const hovered = hover === null ? null : hist.buckets[hover] ?? null;
    return (_jsxs(_Fragment, { children: [_jsxs("svg", { width: w, height: h + axis, "aria-hidden": "true", onPointerMove: (e) => {
                    const [mx] = pointer(e);
                    const i = Math.floor((+x.invert(mx) - (hist.buckets[0]?.start ?? 0)) / hist.step);
                    setHover(i >= 0 && i < hist.buckets.length ? i : null);
                }, onPointerLeave: () => setHover(null), children: [compare && _jsx("rect", { className: "focus-band", x: x(compare.from), y: 0, width: Math.max(0, x(compare.to) - x(compare.from)), height: h }), hist.gaps.map((g) => (_jsxs("g", { className: "gap", children: [_jsx("rect", { x: x(g.from), y: 0, width: Math.max(0, x(g.to) - x(g.from)), height: h }), x(g.to) - x(g.from) > cssPx('--gap-label-min') && (_jsxs("text", { x: (x(g.from) + x(g.to)) / 2, y: cssPx('--gap-row'), children: ["no lines \u00B7 ", formatSpan(g.to - g.from)] }))] }, g.from))), hist.buckets.map((b, i) => {
                        const bx = x(b.start);
                        const bw = Math.max(gap, x(b.start + hist.step) - bx - gap);
                        const stacked = hist.keys.reduce((acc, k) => {
                            const v = b.counts[k] ?? 0;
                            if (!v)
                                return acc;
                            const top = acc.top + v;
                            return { top, rects: [...acc.rects, _jsx("rect", { x: bx, width: bw, y: y(top), height: Math.max(0, y(acc.top) - y(top)), style: { fill: keyColor(k, hist.keys, split) } }, k)] };
                        }, { top: 0, rects: [] });
                        return _jsx("g", { className: hover === i ? 'bucket is-hover' : 'bucket', children: stacked.rects }, b.start);
                    }), _jsx("line", { className: "baseline", x1: 0, x2: w, y1: h, y2: h }), hist.total === 0 && _jsx("text", { className: "plot-empty", x: w / 2, y: h / 2, children: "No matching lines in this range" }), x.ticks(w < config.phoneWidth ? 4 : 8).map((t) => (_jsxs("g", { className: "tick", "data-edge": edgeOf(x(t), w), transform: `translate(${x(t)},${h})`, children: [_jsx("line", { y2: cssPx('--chart-tick-length') }), _jsx("text", { y: axis, children: formatClock(+t, zone, 'm') })] }, +t))), _jsx("g", { ref: brushRef, className: "brush" })] }), hovered && (_jsxs("div", { className: "timeline-tip", style: { left: Math.min(x(hovered.start), w - cssPx('--popover-width') / 2) }, children: [_jsxs("strong", { children: [formatClock(hovered.start, zone, 's'), "\u2013", formatClock(hovered.start + hist.step, zone, 's')] }), _jsx("span", { children: plural(hovered.total, 'line') }), hist.keys.filter((k) => hovered.counts[k]).map((k) => (_jsxs("span", { className: "tip-row", children: [_jsx("span", { className: "swatch", style: { background: keyColor(k, hist.keys, split) } }), k, " ", formatCount(hovered.counts[k])] }, k)))] }))] }));
};
export const Timeline = ({ query, extent, zone, split, splitOptions, compare, onSplit, onZoom, onCompare, onZoomOut, }) => {
    const [size, setSize] = useState({ w: 0, h: 0, axis: 0 });
    const [choice, setChoice] = useState(null);
    const box = useObservedSize((el) => setSize({ w: el.clientWidth, h: cssPx('--hist-height', el), axis: cssPx('--chart-margin-bottom', el) }));
    const target = size.w < config.phoneWidth ? config.histogramTargetBucketsPhone : config.histogramTargetBuckets;
    const volume = useVolume(query, { target, split });
    const hist = volume.data;
    const range = query.range;
    const peak = hist?.buckets.reduce((best, b) => (!best || b.total > best.total ? b : best), null) ?? null;
    const peakKey = peak && hist ? hist.keys.reduce((a, k) => ((peak.counts[k] ?? 0) > (peak.counts[a] ?? 0) ? k : a), hist.keys[0]) : '';
    const isWhole = range.from <= extent.from && range.to >= extent.to;
    const choiceLeft = choice && size.w ? Math.min(size.w - cssPx('--popover-width'), Math.max(0, ((choice.from - range.from) / (range.to - range.from)) * size.w)) : 0;
    return (_jsxs("section", { className: "timeline", "aria-labelledby": "timeline-heading", "data-loading": volume.isFetching, children: [_jsxs("div", { className: "timeline-head", children: [_jsx("h2", { id: "timeline-heading", className: "caps", children: "Lines over time" }), hist && _jsxs("span", { className: "timeline-step", children: [formatSpan(hist.step), " buckets \u00B7 tallest ", formatCount(peak?.total ?? 0)] }), _jsx("ul", { className: "legend", "aria-label": split ? `Stacked by ${split}` : 'Stacked by level', children: hist?.keys.map((k) => (_jsxs("li", { children: [_jsx("span", { className: "swatch", style: { background: keyColor(k, hist.keys, split) } }), split || k !== 'unknown' ? k : 'none'] }, k))) }), _jsxs("label", { className: "split-pick", children: [_jsx("span", { className: "tool-label", children: "Stack by" }), _jsxs("select", { value: split ?? '', onChange: (e) => onSplit(e.target.value || null), children: [_jsx("option", { value: "", children: "level" }), splitOptions.map((f) => _jsx("option", { value: f.name, children: f.name }, f.name))] })] }), _jsxs("button", { type: "button", className: "tool-button", onClick: onZoomOut, disabled: isWhole, children: [_jsx(Icon, { name: "zoomOut" }), _jsx("span", { className: "tool-label", children: "Zoom out" })] })] }), _jsxs("div", { className: "timeline-plot", ref: box, children: [size.w > 0 && (_jsx(QueryStatus, { query: volume, loading: "Counting lines over time\u2026", children: (h) => _jsx(Plot, { hist: h, range: range, zone: zone, split: split, compare: compare, w: size.w, h: size.h, axis: size.axis, onPick: setChoice }) })), choice && (_jsx(BrushChoice, { focus: choice, zone: zone, left: choiceLeft, onZoom: () => { onZoom(choice); setChoice(null); }, onCompare: () => { onCompare(choice); setChoice(null); }, onCancel: () => setChoice(null) }))] }), hist && (_jsxs("p", { className: "sr-only", children: [`${plural(hist.total, 'line')} from ${formatClock(range.from, zone, 'm')} to ${formatClock(range.to, zone, 'm')} ${zoneLabel(zone)}.`, peak && peak.total > 0 ? ` Busiest ${formatSpan(hist.step)} starts at ${formatClock(peak.start, zone, 's')} with ${plural(peak.total, 'line')}, mostly ${peakKey}.` : '', hist.gaps.map((g) => ` No lines from ${formatClock(g.from, zone, 's')} to ${formatClock(g.to, zone, 's')}.`).join(''), ' Drag across the chart, or use the time range control, to zoom or compare a window.'] }))] }));
};
