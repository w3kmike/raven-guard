import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/// <reference path="../shims.d.ts" />
import { useEffect, useEffectEvent, useRef, useState, } from 'react';
import { brushX, scaleLinear, select } from 'd3';
import { config } from '../config.js';
import { useBreakdown, useCompare, useDistribution, useFieldStats } from '../api.js';
import { cssPx, formatClock, formatCount, formatNumber, formatShare, formatSpan, formatStamp, parseStamp, plural, zoneLabel, } from '../utils.js';
import { Icon, Popover, QueryStatus, useEnter, useObservedSize, } from './shared.js';
import { EnrichmentBadge, useEnrichmentFor } from './entity.js';
const entityKindOf = (field) => (Object.entries(config.entityFields).find(([, fs]) => fs.includes(field))?.[0] ?? null);
const FilterButtons = ({ field, value, raw, onFilter }) => (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "filter-button", "aria-label": `Filter for ${field} ${value}`, title: `Filter for ${field} ${value}`, onClick: () => onFilter(field, raw, false), children: "=" }), _jsx("button", { type: "button", className: "filter-button", "aria-label": `Filter out ${field} ${value}`, title: `Filter out ${field} ${value}`, onClick: () => onFilter(field, raw, true), children: "\u2260" })] }));
const PivotButton = ({ kind, value, onPivot }) => (_jsx("button", { type: "button", className: "filter-button", "aria-label": `Show all activity for ${kind} ${value}`, title: "Show all activity for this", onClick: () => onPivot({ kind, value }), children: _jsx(Icon, { name: "pivot" }) }));
// Top values
const BreakdownTable = ({ query, field, split, onFilter, onPivot, onSplit }) => {
    const result = useBreakdown(query, field);
    const kind = entityKindOf(field);
    const enrich = useEnrichmentFor(kind && result.data ? result.data.rows.map((r) => ({ kind, value: r.value })) : []);
    return (_jsx(QueryStatus, { query: result, loading: `Counting ${field} values…`, children: (b) => (_jsxs(_Fragment, { children: [_jsxs("table", { children: [_jsx("caption", { className: "sr-only", children: `Top values of ${field} in ${plural(b.total, 'matching line')}` }), _jsx("thead", { className: "sr-only", children: _jsxs("tr", { children: [_jsx("th", { children: "Value, lines, share" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: b.rows.map((r) => (_jsxs("tr", { children: [_jsxs("th", { scope: "row", className: "bd-value", title: r.value, children: [_jsxs("span", { className: "bd-text", children: [r.value === '' ? '(empty)' : r.value, kind && _jsx(EnrichmentBadge, { info: enrich({ kind, value: r.value }) })] }), _jsxs("span", { className: "bd-meta", children: [_jsx("span", { className: "bd-bar", "aria-hidden": "true", children: _jsx("span", { style: { width: `${(r.count / Math.max(1, b.total)) * 100}%` } }) }), _jsx("span", { className: "bd-count", children: formatCount(r.count) }), _jsx("span", { className: "bd-share", children: formatShare(r.count, b.total) })] })] }), _jsxs("td", { className: "bd-actions", children: [kind && _jsx(PivotButton, { kind: kind, value: r.value, onPivot: onPivot }), _jsx(FilterButtons, { field: field, value: r.value, raw: r.raw, onFilter: onFilter })] })] }, r.value))) })] }), _jsxs("p", { className: "bd-foot", children: [b.distinct > b.rows.length ? `Top ${b.rows.length} of ${formatCount(b.distinct)} values.` : `${plural(b.distinct, 'value')}.`, b.missing > 0 && ` Missing in ${plural(b.missing, 'line')}.`] }), _jsx("button", { type: "button", className: "text-button", "aria-pressed": split === field, onClick: () => onSplit(split === field ? null : field), children: split === field ? 'Stack timeline by level' : `Stack timeline by ${field}` })] })) }));
};
// Numeric distribution
const DistributionView = ({ query, field, onRange }) => {
    const result = useDistribution(query, field);
    const [w, setW] = useState(0);
    const box = useObservedSize((el) => setW(el.clientWidth));
    const brushRef = useRef(null);
    const d = result.data;
    const h = cssPx('--dist-height');
    const n = d?.bins.length ?? 1;
    const bw = w / Math.max(1, n);
    const y = scaleLinear().domain([0, Math.max(1, ...(d?.bins.map((b) => b.count) ?? [1]))]).range([h, 0]);
    const xOf = (v) => {
        if (!d)
            return 0;
        const i = d.bins.findIndex((b) => v <= b.hi);
        if (i < 0)
            return w;
        const b = d.bins[i];
        const frac = b.hi > b.lo ? (d.scale === 'log' ? Math.log(Math.max(v, b.lo) / b.lo) / Math.log(b.hi / b.lo) : (v - b.lo) / (b.hi - b.lo)) : 0.5;
        return (i + Math.max(0, Math.min(1, frac))) * bw;
    };
    const pick = useEffectEvent(([a, b]) => {
        if (!d)
            return;
        const lo = d.bins[Math.max(0, Math.floor(a / bw))]?.lo ?? d.min;
        const hi = d.bins[Math.min(n - 1, Math.ceil(b / bw) - 1)]?.hi ?? d.max;
        onRange(field, Math.floor(lo), Math.ceil(hi));
    });
    useEffect(() => {
        const g = brushRef.current;
        if (!g || !w)
            return undefined;
        const sel = select(g);
        const brush = brushX().extent([[0, 0], [w, h]]).on('end', (ev) => {
            if (!ev.selection || !ev.sourceEvent)
                return;
            sel.call(brush.move, null);
            pick(ev.selection);
        });
        sel.call(brush);
        return () => { sel.on('.brush', null); sel.selectAll('*').remove(); };
    }, [w, h, d]);
    return (_jsx("div", { className: "distribution", ref: box, children: _jsx(QueryStatus, { query: result, loading: `Measuring ${field}…`, children: (dist) => (dist.count === 0 ? _jsx("p", { className: "bd-foot", children: "No numeric values in the matching lines." }) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "dist-scale", children: dist.scale === 'log' ? 'Log scale: each bar covers a wider range than the one before.' : 'Linear scale.' }), w > 0 && (_jsxs("svg", { width: w, height: h + cssPx('--chart-margin-bottom'), "aria-hidden": "true", children: [dist.bins.map((b, i) => _jsx("rect", { className: "dist-bar", x: i * bw, y: y(b.count), width: Math.max(cssPx('--rule'), bw - cssPx('--chart-bar-gap')), height: h - y(b.count) }, b.lo)), [['p50', dist.p50], ['p95', dist.p95], ['p99', dist.p99]]
                                .map(([label, v]) => ({ label, x: xOf(v) }))
                                .reduce((acc, m) => {
                                const lastShown = [...acc].reverse().find((a) => a.shown);
                                return [...acc, { ...m, shown: !lastShown || m.x - lastShown.x >= cssPx('--axis-edge-room') }];
                            }, [])
                                .map((m) => (_jsxs("g", { className: "dist-marker", transform: `translate(${m.x},0)`, children: [_jsx("line", { y2: h }), m.shown && _jsx("text", { y: h + cssPx('--chart-margin-bottom') - cssPx('--gap-hair'), children: m.label })] }, m.label))), _jsx("line", { className: "baseline", x1: 0, x2: w, y1: h, y2: h }), _jsx("g", { ref: brushRef, className: "brush" })] })), _jsxs("dl", { className: "dist-stats", children: [_jsxs("div", { children: [_jsx("dt", { children: "p50" }), _jsx("dd", { children: formatNumber(dist.p50) })] }), _jsxs("div", { children: [_jsx("dt", { children: "p95" }), _jsx("dd", { children: formatNumber(dist.p95) })] }), _jsxs("div", { children: [_jsx("dt", { children: "p99" }), _jsx("dd", { children: formatNumber(dist.p99) })] }), _jsxs("div", { children: [_jsx("dt", { children: "max" }), _jsx("dd", { children: formatNumber(dist.max) })] })] }), _jsxs("div", { className: "dist-actions", children: [_jsx("button", { type: "button", className: "text-button", onClick: () => onRange(field, Math.floor(dist.p95), Math.ceil(dist.max)), children: "Filter to p95 and above" }), _jsx("button", { type: "button", className: "text-button", onClick: () => onRange(field, Math.floor(dist.p99), Math.ceil(dist.max)), children: "p99 and above" })] }), _jsx("p", { className: "bd-foot", children: `${plural(dist.count, 'value')}${dist.missing ? `, missing in ${plural(dist.missing, 'line')}` : ''}. Drag across the bars to filter a range.` })] }))) }) }));
};
// Compare mode
const CompareRows = ({ field, result, onFilter }) => (_jsxs("table", { className: "lift", children: [_jsx("caption", { className: "sr-only", children: `How often each ${field.name} value appears in the window compared with the time around it` }), _jsx("thead", { className: "sr-only", children: _jsxs("tr", { children: [_jsx("th", { children: "Value" }), _jsx("th", { children: "Window vs around it" }), _jsx("th", { children: "Actions" })] }) }), _jsx("tbody", { children: field.values.map((v) => {
                const diff = v.focusShare - v.baseShare;
                return (_jsxs("tr", { "data-direction": diff >= 0 ? 'up' : 'down', children: [_jsx("th", { scope: "row", className: "bd-text", title: v.value, children: v.value === '' ? '(empty)' : v.value }), _jsxs("td", { className: "lift-cell", children: [_jsx("span", { className: "lift-track", "aria-hidden": "true", children: _jsx("span", { className: "lift-bar", style: { width: `${Math.abs(diff) * 50}%`, [diff >= 0 ? 'left' : 'right']: '50%' } }) }), _jsxs("span", { className: "lift-label", children: [formatShare(v.focusCount, result.focusTotal), " vs ", formatShare(v.baseCount, result.baseTotal)] })] }), _jsx("td", { className: "bd-actions", children: _jsx(FilterButtons, { field: field.name, value: v.value, raw: v.raw, onFilter: onFilter }) })] }, v.value));
            }) })] }));
const CompareForm = ({ zone, extent, onCompare, close }) => {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [error, setError] = useState('');
    return (_jsxs("form", { className: "range-custom", noValidate: true, onSubmit: (e) => {
            e.preventDefault();
            const a = parseStamp(from, zone);
            const b = parseStamp(to, zone);
            if (a === null || b === null) {
                setError(`Use the format ${formatStamp(extent.from, zone)}.`);
                return;
            }
            if (a >= b) {
                setError('The window must start before it ends.');
                return;
            }
            if (a < extent.from || b > extent.to) {
                setError('Pick a window inside the captured time.');
                return;
            }
            onCompare({ from: a, to: b });
            close();
        }, children: [_jsx("p", { className: "range-note", children: "Compare a window with the same length of time before and after it." }), _jsxs("label", { children: [_jsx("span", { children: "Window starts" }), _jsx("input", { value: from, placeholder: formatStamp(extent.from, zone), onChange: (e) => { setFrom(e.target.value); setError(''); } })] }), _jsxs("label", { children: [_jsx("span", { children: "Window ends" }), _jsx("input", { value: to, placeholder: formatStamp(extent.to, zone), onChange: (e) => { setTo(e.target.value); setError(''); } })] }), _jsx("p", { className: "field-error", role: "alert", children: error }), _jsx("button", { type: "submit", className: "primary-button", children: "Compare" })] }));
};
const CompareList = ({ query, focus, zone, onFilter, onCompare }) => {
    const result = useCompare(query, focus);
    const ref = useRef(null);
    useEnter(ref, []);
    return (_jsxs("div", { ref: ref, className: "compare", children: [_jsxs("div", { className: "compare-head", children: [_jsxs("p", { children: [_jsxs("strong", { children: [formatClock(focus.from, zone, 's'), "\u2013", formatClock(focus.to, zone, 's'), " ", zoneLabel(zone)] }), ` against the ${formatSpan(focus.to - focus.from)} before and after. Fields are ranked by how much they changed.`] }), _jsx("button", { type: "button", className: "text-button", onClick: () => onCompare(null), children: "Stop comparing" })] }), _jsx(QueryStatus, { query: result, loading: "Comparing the window with the time around it\u2026", children: (c) => (c.fields.length === 0 ? _jsx("p", { className: "empty-note", children: "Nothing differs enough to rank. Try a wider window." }) : (_jsxs("ol", { className: "compare-list", children: [_jsx("li", { className: "compare-totals", children: `${plural(c.focusTotal, 'line')} in the window, ${plural(c.baseTotal, 'line')} around it.` }), c.fields.map((f) => (_jsxs("li", { children: [_jsxs("h3", { className: "compare-field", children: [_jsx("span", { className: "field-name", children: f.name }), _jsxs("span", { className: "field-cover", children: ["\u00B1", Math.round(f.score * 100), " pts"] })] }), _jsx(CompareRows, { field: f, result: c, onFilter: onFilter })] }, f.name)))] }))) })] }));
};
// The panel
const FieldRow = ({ s, total, open, lang, onOpen }) => (_jsxs("button", { type: "button", className: "field-row", "aria-expanded": open, onClick: () => onOpen(open ? null : s.name), children: [_jsx(Icon, { name: "chevron" }), _jsx("span", { className: "field-name", children: s.name }), s.isLabel && _jsx("span", { className: "stream-badge", title: lang === 'logql' ? 'Usable in the {…} stream selector' : 'A LogQL stream label', children: "stream" }), s.type === 'number' && !s.isLabel && _jsx("span", { className: "type-badge", title: "Numeric: shows a distribution", children: "123" }), _jsx("span", { className: "field-cover", children: formatShare(s.count, total) })] }));
export const FieldPanel = (p) => {
    const stats = useFieldStats(p.query);
    return (_jsxs("div", { className: "fields", "data-loading": stats.isFetching, children: [_jsxs("div", { className: "pane-head", children: [_jsx("h2", { className: "caps", children: "Fields" }), _jsx("span", { className: "pane-sub", children: stats.data ? `from ${plural(stats.data.total, 'matching line')}` : '' }), !p.compare && (_jsx(Popover, { label: "Compare a window", triggerClass: "tool-button", trigger: _jsxs(_Fragment, { children: [_jsx(Icon, { name: "compare" }), _jsx("span", { children: "Compare" })] }), children: (close) => _jsx(CompareForm, { zone: p.zone, extent: p.extent, onCompare: p.onCompare, close: close }) }))] }), p.compare ? (_jsx(CompareList, { query: p.query, focus: p.compare, zone: p.zone, onFilter: p.onFilter, onCompare: p.onCompare })) : (_jsx(QueryStatus, { query: stats, loading: "Listing fields\u2026", children: (data) => (data.total === 0 ? (_jsx("p", { className: "empty-note", children: "No lines match, so there are no fields to break down. Widen the time range or loosen the query." })) : (_jsx("ul", { className: "field-list", children: data.fields.map((s) => (_jsxs("li", { className: "field-item", "data-open": p.openField === s.name, children: [_jsx(FieldRow, { s: s, total: data.total, open: p.openField === s.name, lang: p.lang, onOpen: p.onOpen }), p.openField === s.name && (_jsx("div", { className: "breakdown", children: s.type === 'number' && !s.isLabel
                                    ? _jsx(DistributionView, { query: p.query, field: s.name, onRange: p.onRange })
                                    : _jsx(BreakdownTable, { query: p.query, field: s.name, split: p.split, onFilter: p.onFilter, onPivot: p.onPivot, onSplit: p.onSplit }) }))] }, s.name))) }))) }))] }));
};
