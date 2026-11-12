import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/// <reference path="../shims.d.ts" />
import { useEffect, useRef, useState } from 'react';
import { config } from '../config.js';
import { useCase, useCaseMutations, useCases } from '../api.js';
import { formatClock, formatDate, formatIso, plural, zoneLabel, } from '../utils.js';
import { Icon, LangTag, LevelTag, Popover, QueryStatus, SeverityTag, copyText, langName, useEnter, } from './shared.js';
import { EnrichmentBadge, useEnrichmentFor } from './entity.js';
// Case vocabulary
const severities = ['low', 'medium', 'high', 'critical'];
const statuses = ['open', 'investigating', 'contained', 'closed'];
const eventIcon = {
    created: 'case', query: 'lines', pinned: 'pin', unpinned: 'close', comment: 'exchange', status: 'retry', severity: 'alert', entity: 'pivot', alert: 'bell', note: 'copy',
};
export const caseText = (c) => [
    `# ${c.title}`,
    `Severity: ${c.severity} · Status: ${c.status} · Owner: ${c.owner}`,
    '',
    '## Evidence',
    ...c.evidence.map((e) => [
        `- ${formatIso(e.line.ts)} ${e.line.labels.service} · ${e.line.labels.host} ${e.line.labels.level}`,
        `  ${e.line.raw}`,
        `  Found with ${langName[e.lang]}: ${e.query || '(every line)'} [${formatIso(e.range.from)} – ${formatIso(e.range.to)}]`,
        ...(e.note ? [`  Note: ${e.note}`] : []),
    ].join('\n')),
    '',
    '## Entities',
    ...c.entities.map((r) => `- ${r.kind}: ${r.value}`),
    '',
    '## Activity',
    ...c.events.map((ev) => `- ${formatIso(ev.at)} ${ev.actor}: ${ev.text}${ev.query ? ` (${langName[ev.query.lang]}: ${ev.query.text || '(every line)'})` : ''}`),
].join('\n');
// New case
const NewCaseForm = ({ onCreate, close, busy }) => {
    const [title, setTitle] = useState('');
    const [severity, setSeverity] = useState('medium');
    return (_jsxs("form", { className: "range-custom", onSubmit: (e) => {
            e.preventDefault();
            if (!title.trim())
                return;
            onCreate(title.trim(), severity);
            close();
        }, children: [_jsxs("label", { children: [_jsx("span", { children: "What are you investigating?" }), _jsx("input", { value: title, onChange: (e) => setTitle(e.target.value), placeholder: "Payout to an unfamiliar beneficiary", required: true })] }), _jsxs("label", { children: [_jsx("span", { children: "Severity" }), _jsx("select", { value: severity, onChange: (e) => setSeverity(e.target.value), children: severities.map((s) => _jsx("option", { value: s, children: s }, s)) })] }), _jsx("button", { type: "submit", className: "primary-button", disabled: busy || !title.trim(), children: "Open case" })] }));
};
// Evidence
const Exhibit = ({ e, zone, fresh, onOpen, onRemove, onNote }) => {
    const ref = useRef(null);
    const [note, setNote] = useState(e.note);
    useEnter(ref, [], 'slide', fresh);
    useEffect(() => { setNote(e.note); }, [e.note]);
    const when = `${formatClock(e.line.ts, zone)} ${zoneLabel(zone)}`;
    return (_jsxs("article", { ref: ref, className: "exhibit", "aria-label": `Evidence line at ${when}`, children: [_jsxs("div", { className: "exhibit-meta", children: [_jsx("time", { dateTime: formatIso(e.line.ts), children: when }), _jsx(LevelTag, { level: e.line.labels.level }), _jsx("span", { children: e.line.labels.service }), _jsxs("span", { className: "exhibit-by", children: ["pinned by ", e.pinnedBy] })] }), _jsx("p", { className: "exhibit-raw", children: e.line.raw }), _jsxs("p", { className: "exhibit-source", children: [_jsx(LangTag, { lang: e.lang }), _jsx("code", { children: e.query || '(every line)' }), _jsxs("span", { children: [formatClock(e.range.from, zone, 'm'), "\u2013", formatClock(e.range.to, zone, 'm')] })] }), _jsxs("label", { className: "exhibit-note", children: [_jsxs("span", { className: "sr-only", children: ["Note for the line at ", when] }), _jsx("textarea", { rows: 2, value: note, placeholder: "Why this line matters", onChange: (ev) => setNote(ev.target.value), onBlur: () => { if (note !== e.note)
                            onNote(e.line.id, note); } })] }), _jsxs("div", { className: "exhibit-actions", children: [_jsx("button", { type: "button", className: "text-button", onClick: () => onOpen({ lang: e.lang, text: e.query, range: e.range }, e.line), children: "Open the query that found it" }), _jsx("button", { type: "button", className: "text-button", onClick: () => onRemove(e.line.id), children: "Remove" })] })] }));
};
const Entities = ({ refs, onPivot }) => {
    const enrich = useEnrichmentFor(refs);
    return refs.length ? (_jsx("ul", { className: "entity-chips", children: refs.map((r) => (_jsx("li", { children: _jsxs("button", { type: "button", className: "chip", onClick: () => onPivot(r), "aria-label": `Show all activity for ${r.kind} ${r.value}`, children: [_jsx("span", { className: "chip-kind", children: r.kind }), _jsx("span", { className: "chip-text", children: r.value }), _jsx(EnrichmentBadge, { info: enrich(r) })] }) }, `${r.kind}:${r.value}`))) })) : _jsx("p", { className: "case-hint", children: "Add IPs, users, or beneficiaries from their activity view." });
};
const CaseBody = ({ c, zone, onOpenQuery, onPivot, onAnnounce }) => {
    const m = useCaseMutations(c.id);
    const [title, setTitle] = useState(c.title);
    const [comment, setComment] = useState('');
    const [fallback, setFallback] = useState(null);
    const seen = useRef(new Set(c.evidence.map((e) => e.line.id)));
    useEffect(() => { c.evidence.forEach((e) => seen.current.add(e.line.id)); }, [c.evidence]);
    useEffect(() => { setTitle(c.title); }, [c.title]);
    const failed = (e) => onAnnounce(`Couldn't save the case: ${e.message}`);
    const exportCase = async () => {
        const text = caseText(c);
        if (await copyText(text)) {
            setFallback(null);
            onAnnounce('Copied the case as Markdown.');
        }
        else
            setFallback(text);
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "case-head", children: [_jsxs("label", { className: "case-title", children: [_jsx("span", { className: "sr-only", children: "Case title" }), _jsx("input", { value: title, onChange: (e) => setTitle(e.target.value), onBlur: () => { if (title.trim() && title !== c.title)
                                    m.update.mutate({ title: title.trim() }, { onError: failed }); } })] }), _jsxs("div", { className: "case-fields", children: [_jsxs("label", { children: [_jsx("span", { children: "Severity" }), _jsx("select", { value: c.severity, onChange: (e) => m.update.mutate({ severity: e.target.value }, { onError: failed }), children: severities.map((s) => _jsx("option", { value: s, children: s }, s)) })] }), _jsxs("label", { children: [_jsx("span", { children: "Status" }), _jsx("select", { value: c.status, onChange: (e) => m.update.mutate({ status: e.target.value }, { onError: failed }), children: statuses.map((s) => _jsx("option", { value: s, children: s }, s)) })] }), _jsxs("span", { className: "case-owner", children: ["Owner ", _jsx("strong", { children: c.owner })] }), _jsx(SeverityTag, { severity: c.severity })] })] }), _jsxs("section", { className: "case-section", "aria-labelledby": "case-evidence", children: [_jsxs("div", { className: "case-section-head", children: [_jsx("h3", { id: "case-evidence", className: "caps", children: `Evidence · ${c.evidence.length}` }), _jsxs("button", { type: "button", className: "tool-button", onClick: exportCase, children: [_jsx(Icon, { name: "copy" }), _jsx("span", { children: "Copy case" })] })] }), fallback !== null && (_jsxs("label", { className: "copy-fallback", children: [_jsx("span", { children: "The browser blocked the clipboard. Select this text and copy it." }), _jsx("textarea", { readOnly: true, value: fallback, onFocus: (e) => e.target.select() })] })), c.evidence.length === 0 ? (_jsx("p", { className: "case-hint", children: "Pin a line with P or its Pin button. Each pin keeps the query, language, and range that found it." })) : (_jsx("div", { className: "exhibits", children: c.evidence.map((e) => (_jsx(Exhibit, { e: e, zone: zone, fresh: !seen.current.has(e.line.id), onOpen: onOpenQuery, onRemove: (id) => m.unpin.mutate(id, { onError: failed }), onNote: (id, note) => m.note.mutate({ lineId: id, note }, { onError: failed }) }, e.line.id))) }))] }), _jsxs("section", { className: "case-section", "aria-labelledby": "case-entities", children: [_jsx("h3", { id: "case-entities", className: "caps", children: "Entities" }), _jsx(Entities, { refs: c.entities, onPivot: onPivot })] }), _jsxs("section", { className: "case-section", "aria-labelledby": "case-activity", children: [_jsx("h3", { id: "case-activity", className: "caps", children: "Activity" }), _jsx("ol", { className: "case-events", children: [...c.events].reverse().map((ev) => (_jsxs("li", { "data-kind": ev.kind, children: [_jsx(Icon, { name: eventIcon[ev.kind] }), _jsxs("div", { children: [_jsxs("p", { children: [_jsx("strong", { children: ev.actor }), " ", ev.text] }), ev.query && (_jsxs("button", { type: "button", className: "event-query", onClick: () => onOpenQuery(ev.query, null), title: "Run this query again", children: [_jsx(LangTag, { lang: ev.query.lang }), _jsx("code", { children: ev.query.text || '(every line)' })] })), _jsxs("time", { dateTime: formatIso(ev.at), children: [formatDate(ev.at, zone), " ", formatClock(ev.at, zone, 's')] })] })] }, ev.id))) }), _jsxs("form", { className: "comment-form", onSubmit: (e) => {
                            e.preventDefault();
                            if (!comment.trim())
                                return;
                            m.addEvent.mutate({ kind: 'comment', text: comment.trim(), query: null }, { onSuccess: () => setComment(''), onError: failed });
                        }, children: [_jsxs("label", { children: [_jsx("span", { className: "sr-only", children: "Comment" }), _jsx("textarea", { rows: 2, value: comment, placeholder: "Leave a note for whoever picks this up", onChange: (e) => setComment(e.target.value) })] }), _jsx("button", { type: "submit", className: "primary-button", disabled: !comment.trim() || m.addEvent.isPending, children: "Comment" })] })] })] }));
};
export const CasePanel = ({ caseId, zone, onCase, onOpenQuery, onPivot, onAnnounce }) => {
    const list = useCases();
    const current = useCase(caseId);
    const create = useCaseMutations(null).create;
    return (_jsxs("div", { className: "case", children: [_jsxs("div", { className: "pane-head", children: [_jsx("h2", { className: "caps", children: "Case" }), _jsxs("label", { className: "case-pick", children: [_jsx("span", { className: "sr-only", children: "Open case" }), _jsxs("select", { value: caseId ?? '', onChange: (e) => onCase(e.target.value || null), disabled: !list.data?.length, children: [!caseId && _jsx("option", { value: "", children: "No case open" }), list.data?.map((c) => _jsx("option", { value: c.id, children: `${c.title} · ${c.status}` }, c.id))] })] }), _jsx(Popover, { label: "Open a new case", triggerClass: "tool-button", trigger: _jsxs(_Fragment, { children: [_jsx(Icon, { name: "plus" }), _jsx("span", { children: "New" })] }), children: (close) => (_jsx(NewCaseForm, { busy: create.isPending, close: close, onCreate: (title, severity) => create.mutate({ title, severity, owner: config.mock.analyst }, {
                                onSuccess: (c) => { onCase(c.id); onAnnounce(`Opened case "${c.title}".`); },
                                onError: (e) => onAnnounce(`Couldn't open the case: ${e.message}`),
                            }) })) })] }), caseId === null ? (_jsx("p", { className: "empty-note", children: "No case is open. Open one to collect evidence, entities, and the queries that found them, so a teammate can pick it up." })) : (_jsx(QueryStatus, { query: current, loading: "Opening the case\u2026", children: (c) => _jsx(CaseBody, { c: c, zone: zone, onOpenQuery: onOpenQuery, onPivot: onPivot, onAnnounce: onAnnounce }) })), list.data && _jsxs("p", { className: "sr-only", children: [plural(list.data.length, 'case'), " available."] })] }));
};
