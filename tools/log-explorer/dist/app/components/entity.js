import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/// <reference path="../shims.d.ts" />
import { useState } from 'react';
import { scaleUtc } from 'd3';
import { entityKey, useEnrichment, useEntity } from '../api.js';
import { cssPx, formatClock, formatDate, formatIso, plural, zoneLabel, } from '../utils.js';
import { Icon, LevelTag, QueryStatus, edgeOf, useObservedSize, } from './shared.js';
// Enrichment
const kindName = {
    ip: 'IP address', user: 'User', host: 'Host', beneficiary: 'Payout beneficiary', request: 'Request',
};
const badgeOf = (info) => {
    if (!info)
        return null;
    if (info.kind === 'ip')
        return info.info.reputation === 'benign' || info.info.reputation === 'internal' ? null : { text: info.info.reputation, tone: info.info.reputation };
    if (info.kind === 'user') {
        if (info.info.status === 'nonexistent')
            return { text: 'no such user', tone: 'suspicious' };
        return info.info.mfa === 'enrolled' ? null : { text: info.info.mfa === 'legacy-exempt' ? 'MFA exempt' : 'no MFA', tone: 'suspicious' };
    }
    if (info.kind === 'beneficiary')
        return { text: `new · ${info.info.country}`, tone: 'suspicious' };
    return null;
};
export const EnrichmentBadge = ({ info }) => {
    const badge = badgeOf(info);
    return badge ? _jsx("span", { className: "enrich-badge", "data-tone": badge.tone, children: badge.text }) : null;
};
export const useEnrichmentFor = (refs) => {
    const result = useEnrichment(refs);
    return (ref) => result.data?.[entityKey(ref)];
};
const Facts = ({ info }) => {
    if (!info || info.kind === 'none')
        return _jsx("p", { className: "entity-none", children: "No enrichment on record." });
    const rows = info.kind === 'ip'
        ? [['Reputation', info.info.reputation], ['Network', info.info.asn ? `AS${info.info.asn} · ${info.info.asOrg}` : info.info.asOrg], ['Country', info.info.country], ['Tags', info.info.tags.join(', ') || '—']]
        : info.kind === 'user'
            ? [['Name', info.info.displayName], ['Department', info.info.department], ['MFA', info.info.mfa.replace('-', ' ')], ['Account', info.info.status === 'nonexistent' ? 'does not exist' : `${info.info.status}, created ${formatDate(info.info.created, 'utc')}`]]
            : info.kind === 'host'
                ? [['Role', info.info.role], ['Team', info.info.team], ['OS', info.info.os]]
                : [['Country', info.info.country], ['Added', `${formatDate(info.info.created, 'utc')} ${formatClock(info.info.created, 'utc', 's')} UTC`], ['Added by', info.info.addedBy]];
    return (_jsx("dl", { className: "facts", children: rows.map(([k, v]) => _jsxs("div", { children: [_jsx("dt", { children: k }), _jsx("dd", { children: v })] }, k)) }));
};
// Activity strip: one row per service on a shared time axis
const Strip = ({ services, extent, zone }) => {
    const [w, setW] = useState(0);
    const box = useObservedSize((el) => setW(el.clientWidth));
    const row = cssPx('--strip-row');
    const label = cssPx('--strip-label');
    const x = scaleUtc().domain([extent.from, extent.to]).range([label, Math.max(label, w)]);
    return (_jsx("div", { className: "strip", ref: box, children: w > 0 && (_jsxs("svg", { width: w, height: services.length * row + cssPx('--chart-margin-bottom'), "aria-hidden": "true", children: [services.map((s, i) => (_jsxs("g", { transform: `translate(0,${i * row})`, children: [_jsx("text", { className: "strip-name", y: row / 2, children: s.service }), _jsx("line", { className: "strip-rule", x1: label, x2: w, y1: row / 2, y2: row / 2 }), s.times.map((t) => _jsx("line", { className: "strip-tick", x1: x(t), x2: x(t), y1: row * 0.2, y2: row * 0.8 }, t))] }, s.service))), x.ticks(4).map((t) => (_jsx("text", { className: "strip-axis", "data-edge": edgeOf(x(t) - label, w - label), x: x(t), y: services.length * row + cssPx('--chart-margin-bottom') - cssPx('--gap-hair'), children: formatClock(+t, zone, 'm') }, +t)))] })) }));
};
export const EntityView = ({ entity, zone, extent, onSearch, onAddToCase, onSelect, onClose }) => {
    const activity = useEntity(entity);
    const info = useEnrichmentFor(entity ? [entity] : []);
    if (!entity) {
        return _jsx("p", { className: "empty-note", children: "Choose the arrow next to an IP, user, host, or beneficiary to see everything it did across every service." });
    }
    return (_jsxs("div", { className: "entity", role: "region", "aria-labelledby": "entity-heading", onKeyDown: (e) => { if (e.key === 'Escape')
            onClose(); }, children: [_jsxs("header", { className: "detail-head", children: [_jsxs("h2", { id: "entity-heading", tabIndex: -1, children: [_jsx("span", { className: "entity-kind", children: kindName[entity.kind] }), _jsx("span", { className: "entity-value", children: entity.value })] }), _jsx("div", { className: "detail-actions", children: _jsx("button", { type: "button", className: "icon-button detail-close", "aria-label": "Close entity", onClick: onClose, children: _jsx(Icon, { name: "close" }) }) })] }), _jsx("section", { className: "entity-section", "aria-label": "Enrichment", children: _jsx(Facts, { info: info(entity) }) }), _jsxs("div", { className: "entity-actions", children: [_jsxs("button", { type: "button", className: "tool-button", onClick: () => onSearch(entity), children: [_jsx(Icon, { name: "lines" }), " Search for it"] }), _jsxs("button", { type: "button", className: "tool-button", onClick: () => onAddToCase(entity), children: [_jsx(Icon, { name: "case" }), " Add to case"] })] }), _jsx(QueryStatus, { query: activity, loading: `Gathering activity for ${entity.value}…`, children: (a) => (a.total === 0 ? _jsx("p", { className: "empty-note", children: `${entity.value} doesn't appear in anything captured.` }) : (_jsxs(_Fragment, { children: [_jsxs("section", { className: "entity-section", "aria-labelledby": "entity-activity", children: [_jsx("h3", { id: "entity-activity", className: "caps", children: "Activity across services" }), _jsx("p", { className: "entity-summary", children: `${plural(a.total, 'line')} in ${plural(a.services.length, 'service')}, ${formatClock(a.first ?? 0, zone, 's')} to ${formatClock(a.last ?? 0, zone, 's')} ${zoneLabel(zone)}.` }), _jsx(Strip, { services: a.services, extent: extent, zone: zone }), _jsx("ul", { className: "sr-only", children: a.services.map((s) => _jsx("li", { children: `${s.service}: ${plural(s.count, 'line')}, ${formatClock(s.times[0], zone, 's')} to ${formatClock(s.times[s.times.length - 1], zone, 's')}` }, s.service)) })] }), _jsxs("section", { className: "entity-section", "aria-labelledby": "entity-lines", children: [_jsx("h3", { id: "entity-lines", className: "caps", children: a.lines.length < a.total ? `Latest ${a.lines.length} lines` : 'Lines' }), _jsx("ol", { className: "entity-lines", children: a.lines.slice(0, 60).map((l) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => onSelect(l), children: [_jsx("time", { dateTime: formatIso(l.ts), children: formatClock(l.ts, zone) }), _jsx(LevelTag, { level: l.labels.level }), _jsx("span", { className: "entity-service", children: l.labels.service }), _jsx("span", { className: "context-raw", children: l.raw })] }) }, l.id))) })] })] }))) })] }));
};
