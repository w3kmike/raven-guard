import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/// <reference path="../shims.d.ts" />
import { useEffect, useRef } from 'react';
import { config } from '../config.js';
import { useContextLines } from '../api.js';
import { formatClock, formatDate, formatIso, zoneLabel, } from '../utils.js';
import { Icon, LevelTag, QueryStatus } from './shared.js';
import { EnrichmentBadge, useEnrichmentFor } from './entity.js';
const entityKindOf = (field) => (Object.entries(config.entityFields).find(([, fs]) => fs.includes(field))?.[0] ?? null);
const FieldTable = ({ caption, entries, line, onFilter, onPivot }) => {
    const refs = entries.flatMap(([k, v]) => {
        const kind = entityKindOf(k);
        return kind ? [{ kind, value: String(v) }] : [];
    });
    const enrich = useEnrichmentFor(refs);
    return (_jsxs("table", { className: "kv", children: [_jsx("caption", { className: "caps", children: caption }), _jsx("tbody", { children: entries.map(([k, v]) => {
                    const kind = entityKindOf(k);
                    return (_jsxs("tr", { children: [_jsx("th", { scope: "row", children: k }), _jsxs("td", { children: [_jsx("span", { className: "kv-value", children: String(v) }), kind && _jsx(EnrichmentBadge, { info: enrich({ kind, value: String(v) }) })] }), _jsxs("td", { className: "kv-actions", children: [kind && (_jsx("button", { type: "button", className: "filter-button", "aria-label": `Show all activity for ${k} ${String(v)}`, title: "Show all activity for this", onClick: () => onPivot({ kind, value: String(v) }), children: _jsx(Icon, { name: "pivot" }) })), _jsx("button", { type: "button", className: "filter-button", "aria-label": `Filter for ${k} ${String(v)}`, title: `Filter for ${k}`, onClick: () => onFilter(k, v, false, line), children: "=" }), _jsx("button", { type: "button", className: "filter-button", "aria-label": `Filter out ${k} ${String(v)}`, title: `Filter out ${k}`, onClick: () => onFilter(k, v, true, line), children: "\u2260" })] })] }, k));
                }) })] }));
};
export const LineDetail = ({ selection, open, zone, pinned, caseTitle, onPin, onFilter, onPivot, onSelect, onClose, }) => {
    const root = useRef(null);
    const heading = useRef(null);
    const context = useContextLines(selection?.id ?? null);
    const line = selection?.line ?? context.data?.find((l) => l.id === selection?.id) ?? null;
    useEffect(() => {
        const sheet = root.current?.parentElement;
        if (open && line && sheet && getComputedStyle(sheet).position === 'fixed')
            heading.current?.focus();
    }, [open, line]);
    if (!selection) {
        return (_jsx("div", { className: "detail", ref: root, children: _jsx("p", { className: "empty-note", children: "Select a line to see its labels, parsed fields, raw text, and the lines around it from the same stream." }) }));
    }
    if (!line) {
        return (_jsx("div", { className: "detail", ref: root, children: _jsx(QueryStatus, { query: context, loading: "Loading the line\u2026", children: () => _jsx("p", { className: "empty-note", children: "That line isn't in this capture anymore." }) }) }));
    }
    const fields = Object.entries(line.fields).filter(([k]) => k !== 'level');
    const host = line.labels.host;
    return (_jsxs("div", { className: "detail", ref: root, role: "region", "aria-labelledby": "detail-heading", onKeyDown: (e) => { if (e.key === 'Escape')
            onClose(); }, children: [_jsxs("header", { className: "detail-head", children: [_jsxs("h2", { id: "detail-heading", ref: heading, tabIndex: -1, children: [_jsxs("time", { dateTime: formatIso(line.ts), children: [formatDate(line.ts, zone), " ", formatClock(line.ts, zone)] }), _jsx("span", { className: "detail-zone", children: zoneLabel(zone) })] }), _jsxs("div", { className: "detail-meta", children: [_jsx(LevelTag, { level: line.labels.level }), _jsx("span", { children: line.labels.service }), _jsx("span", { className: "detail-host", children: host })] }), _jsxs("div", { className: "detail-actions", children: [_jsxs("button", { type: "button", className: "tool-button", "aria-pressed": pinned, onClick: () => onPin(line), title: caseTitle ? `Pin to ${caseTitle}` : 'Pin to a new case', children: [_jsx(Icon, { name: "pin" }), _jsx("span", { children: pinned ? 'Pinned' : 'Pin to case' })] }), _jsx("button", { type: "button", className: "icon-button detail-close", "aria-label": "Close line", onClick: onClose, children: _jsx(Icon, { name: "close" }) })] })] }), _jsx(FieldTable, { caption: "Stream labels", entries: Object.entries(line.labels), line: line, onFilter: onFilter, onPivot: onPivot }), fields.length ? (_jsx(FieldTable, { caption: `Parsed fields · ${line.format}`, entries: fields, line: line, onFilter: onFilter, onPivot: onPivot })) : (_jsx("p", { className: "empty-note", children: "This line is unstructured text, so no fields were parsed. Search its words with a bare term in Lucene or a |= line filter in LogQL." })), _jsxs("section", { className: "detail-raw", "aria-label": "Raw line", children: [_jsx("h3", { className: "caps", children: "Raw" }), _jsx("pre", { children: line.raw })] }), _jsxs("section", { className: "detail-context", "aria-labelledby": "context-heading", children: [_jsxs("h3", { id: "context-heading", className: "caps", children: ["Same stream \u00B7 ", host] }), _jsx(QueryStatus, { query: context, loading: "Loading nearby lines\u2026", children: (lines) => (_jsx("ol", { children: lines.map((c) => (_jsx("li", { "aria-current": c.id === line.id ? 'true' : undefined, children: _jsxs("button", { type: "button", onClick: () => onSelect(c), disabled: c.id === line.id, children: [_jsx("time", { dateTime: formatIso(c.ts), children: formatClock(c.ts, zone) }), _jsx("span", { className: "context-raw", children: c.raw })] }) }, c.id))) })) })] })] }));
};
