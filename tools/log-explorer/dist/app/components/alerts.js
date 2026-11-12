import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/// <reference path="../shims.d.ts" />
import { useEffect, useRef, useState } from 'react';
import { line as lineShape, scaleLinear } from 'd3';
import { config } from '../config.js';
import { parseQuery } from '../query/index.js';
import { useRuleMutations, useRules } from '../api.js';
import { cssPx, formatClock, formatNumber, formatSpan, plural, zoneLabel, } from '../utils.js';
import { Icon, LangTag, QueryStatus, SeverityTag, useObservedSize, } from './shared.js';
// Rule vocabulary
const opWords = { '>': 'above', '>=': 'at or above', '<': 'below', '<=': 'at or below' };
const isMetric = (lang, query) => {
    const parsed = parseQuery(lang, query);
    return parsed.ok && parsed.metric;
};
export const ruleSentence = (r) => (isMetric(r.lang, r.query)
    ? `Fires when any series is ${opWords[r.op]} ${formatNumber(r.threshold)}.`
    : `Fires when matching lines in ${r.window} are ${opWords[r.op]} ${formatNumber(r.threshold)}.`);
const stateWords = { firing: 'Firing', ok: 'Quiet', error: 'Error', disabled: 'Off' };
// Rule history with its threshold
const RuleSpark = ({ state, rule }) => {
    const [w, setW] = useState(0);
    const box = useObservedSize((el) => setW(el.clientWidth));
    const h = cssPx('--rule-spark-height');
    const values = state.history.map((p) => p.v);
    const top = Math.max(rule.threshold, ...values.map((v) => v ?? 0)) * 1.1 || 1;
    const y = scaleLinear().domain([0, top]).range([h, 0]);
    const step = w / Math.max(1, values.length - 1);
    const path = lineShape().defined((v) => v !== null).x((_, i) => i * step).y((v) => y(v ?? 0))(values) ?? '';
    return (_jsx("div", { className: "rule-spark", ref: box, children: w > 0 && (_jsxs("svg", { width: w, height: h, role: "img", "aria-label": `Last ${formatSpan(state.history.length * config.ruleEvalStepMs)}: latest ${state.value === null ? 'no data' : formatNumber(state.value)} against a threshold of ${formatNumber(rule.threshold)}`, children: [_jsx("line", { className: "rule-threshold", x1: 0, x2: w, y1: y(rule.threshold), y2: y(rule.threshold) }), _jsx("path", { className: "rule-line", d: path })] })) }));
};
const RuleForm = ({ initial, ruleId, onDone, onCancel }) => {
    const [draft, setDraft] = useState(initial);
    const [error, setError] = useState('');
    const { save } = useRuleMutations();
    const ref = useRef(null);
    useEffect(() => { ref.current?.querySelector('input')?.focus(); }, []);
    const metric = isMetric(draft.lang, draft.query);
    const set = (k, v) => { setDraft((d) => ({ ...d, [k]: v })); setError(''); };
    return (_jsxs("form", { ref: ref, className: "rule-form", noValidate: true, onSubmit: (e) => {
            e.preventDefault();
            if (!draft.name.trim()) {
                setError('Give the rule a name your teammates will recognize in an alert.');
                return;
            }
            if (!Number.isFinite(draft.threshold)) {
                setError('The threshold needs to be a number.');
                return;
            }
            save.mutate({ draft: { ...draft, name: draft.name.trim() }, ruleId }, {
                onSuccess: (r) => onDone(`Saved rule "${r.name}".`),
                onError: (err) => setError(err.message),
            });
        }, children: [_jsxs("label", { children: [_jsx("span", { children: "Name" }), _jsx("input", { value: draft.name, onChange: (e) => set('name', e.target.value), placeholder: "Payout to a new beneficiary" })] }), _jsxs("p", { className: "rule-query", children: [_jsx(LangTag, { lang: draft.lang }), _jsx("code", { children: draft.query || '(every line)' })] }), _jsxs("div", { className: "rule-row", children: [_jsxs("label", { children: [_jsx("span", { children: metric ? 'When any series is' : 'When matching lines are' }), _jsx("select", { value: draft.op, onChange: (e) => set('op', e.target.value), children: ['>', '>=', '<', '<='].map((o) => _jsx("option", { value: o, children: opWords[o] }, o)) })] }), _jsxs("label", { children: [_jsx("span", { children: "Threshold" }), _jsx("input", { inputMode: "decimal", value: String(draft.threshold), onChange: (e) => set('threshold', Number(e.target.value)) })] }), !metric && (_jsxs("label", { children: [_jsx("span", { children: "Within" }), _jsx("select", { value: draft.window, onChange: (e) => set('window', e.target.value), children: ['1m', '5m', '15m', '1h'].map((w) => _jsx("option", { value: w, children: w }, w)) })] })), _jsxs("label", { children: [_jsx("span", { children: "Severity" }), _jsx("select", { value: draft.severity, onChange: (e) => set('severity', e.target.value), children: ['low', 'medium', 'high', 'critical'].map((s) => _jsx("option", { value: s, children: s }, s)) })] })] }), _jsx("p", { className: "rule-preview", children: ruleSentence(draft) }), _jsx("p", { className: "field-error", role: "alert", children: error }), _jsxs("div", { className: "translate-actions", children: [_jsx("button", { type: "submit", className: "primary-button", disabled: save.isPending, children: save.isPending ? 'Saving…' : 'Save rule' }), _jsx("button", { type: "button", className: "text-button", onClick: onCancel, children: "Cancel" })] })] }));
};
const RuleCard = ({ rule, state, onEdit, onInvestigate, onAnnounce }) => {
    const { save, remove } = useRuleMutations();
    const [confirm, setConfirm] = useState(false);
    const s = state?.state ?? 'ok';
    return (_jsxs("li", { className: "rule", "data-state": s, children: [_jsxs("div", { className: "rule-head", children: [_jsx("span", { className: "rule-state", children: stateWords[s] }), _jsx("h3", { children: rule.name }), _jsx(SeverityTag, { severity: rule.severity })] }), _jsxs("p", { className: "rule-query", children: [_jsx(LangTag, { lang: rule.lang }), _jsx("code", { children: rule.query })] }), _jsxs("p", { className: "rule-sentence", children: [ruleSentence(rule), state?.value !== null && state?.value !== undefined ? ` Now ${formatNumber(state.value)}.` : ''] }), state?.error && _jsxs("p", { className: "status", "data-tone": "error", children: [_jsx(Icon, { name: "alert" }), state.error] }), state && state.history.length > 1 && _jsx(RuleSpark, { state: state, rule: rule }), _jsxs("div", { className: "rule-actions", children: [_jsx("button", { type: "button", className: "text-button", onClick: onInvestigate, children: "Investigate" }), _jsx("button", { type: "button", className: "text-button", onClick: onEdit, children: "Edit" }), _jsx("button", { type: "button", className: "text-button", onClick: () => save.mutate({ draft: { ...rule, enabled: !rule.enabled }, ruleId: rule.id }, { onSuccess: () => onAnnounce(`${rule.enabled ? 'Turned off' : 'Turned on'} "${rule.name}".`) }), children: rule.enabled ? 'Turn off' : 'Turn on' }), confirm ? (_jsxs("span", { className: "confirm", children: ["Delete this rule?", _jsx("button", { type: "button", className: "text-button danger", onClick: () => remove.mutate(rule.id, { onSuccess: () => onAnnounce(`Deleted "${rule.name}".`) }), children: "Delete" }), _jsx("button", { type: "button", className: "text-button", onClick: () => setConfirm(false), children: "Keep" })] })) : _jsx("button", { type: "button", className: "text-button", onClick: () => setConfirm(true), children: "Delete" })] })] }));
};
export const AlertsPanel = ({ snapshot, zone, current, extent, onInvestigate, onAddToCase, onClose, onAnnounce, }) => {
    const rules = useRules();
    const [editing, setEditing] = useState(null);
    const heading = useRef(null);
    useEffect(() => { heading.current?.focus(); }, []);
    const around = (from, to) => ({
        from: Math.max(extent.from, from - 15 * 60000), to: Math.min(extent.to, to + 15 * 60000),
    });
    const newDraft = {
        name: '', lang: current.lang, query: current.text, op: '>', threshold: 0, window: '5m', severity: 'medium', enabled: true, createdBy: config.mock.analyst,
    };
    const stateOf = (id) => snapshot?.states.find((s) => s.ruleId === id);
    const ruleOf = (id) => rules.data?.find((r) => r.id === id);
    return (_jsxs("div", { className: "alerts", role: "region", "aria-labelledby": "alerts-heading", onKeyDown: (e) => { if (e.key === 'Escape' && !editing)
            onClose(); }, children: [_jsxs("header", { className: "detail-head", children: [_jsx("h2", { id: "alerts-heading", ref: heading, tabIndex: -1, children: "Alerts" }), _jsx("div", { className: "detail-actions", children: _jsx("button", { type: "button", className: "icon-button", "aria-label": "Close alerts", onClick: onClose, children: _jsx(Icon, { name: "close" }) }) })] }), _jsx("p", { className: "alerts-clock", children: snapshot ? `Evaluated every minute up to ${formatClock(snapshot.now, zone, 'm')} ${zoneLabel(zone)}.` : 'Evaluating rules…' }), editing ? (_jsx("section", { className: "case-section", "aria-label": editing.id ? 'Edit rule' : 'New rule', children: _jsx(RuleForm, { initial: editing.draft, ruleId: editing.id, onCancel: () => setEditing(null), onDone: (m) => { setEditing(null); onAnnounce(m); } }) })) : (_jsxs("button", { type: "button", className: "tool-button new-rule", onClick: () => setEditing({ draft: newDraft, id: null }), children: [_jsx(Icon, { name: "plus" }), " Save the current query as a rule"] })), _jsxs("section", { className: "case-section", "aria-labelledby": "rules-heading", children: [_jsx("h3", { id: "rules-heading", className: "caps", children: "Rules" }), _jsx(QueryStatus, { query: rules, loading: "Loading rules\u2026", children: (list) => (list.length === 0 ? _jsx("p", { className: "case-hint", children: "No rules yet. Save a query as a rule to be alerted when it crosses a threshold." }) : (_jsx("ul", { className: "rule-list", children: list.map((r) => (_jsx(RuleCard, { rule: r, state: stateOf(r.id), onAnnounce: onAnnounce, onEdit: () => setEditing({ draft: r, id: r.id }), onInvestigate: () => {
                                    const latest = snapshot?.alerts.find((a) => a.ruleId === r.id);
                                    onInvestigate({ lang: r.lang, text: r.query, range: latest ? around(latest.startsAt, latest.endsAt ?? extent.to) : extent });
                                } }, r.id))) }))) })] }), _jsxs("section", { className: "case-section", "aria-labelledby": "history-heading", children: [_jsx("h3", { id: "history-heading", className: "caps", children: snapshot ? `History · ${plural(snapshot.alerts.length, 'alert')}` : 'History' }), snapshot && snapshot.alerts.length === 0 && _jsx("p", { className: "case-hint", children: "Nothing has fired in the captured time." }), _jsx("ol", { className: "alert-list", children: snapshot?.alerts.map((a) => {
                            const labels = Object.entries(a.labels).map(([k, v]) => `${k}=${v}`).join(', ');
                            const rule = ruleOf(a.ruleId);
                            return (_jsxs("li", { className: "alert-item", "data-firing": a.endsAt === null, children: [_jsxs("div", { className: "alert-head", children: [_jsx(SeverityTag, { severity: a.severity }), _jsx("strong", { children: a.ruleName }), labels && _jsx("code", { children: labels })] }), _jsxs("p", { className: "alert-when", children: [a.endsAt === null
                                                ? `Firing since ${formatClock(a.startsAt, zone, 'm')} ${zoneLabel(zone)}`
                                                : `${formatClock(a.startsAt, zone, 'm')}–${formatClock(a.endsAt, zone, 'm')} ${zoneLabel(zone)} · ${formatSpan(a.endsAt - a.startsAt)}`, ` · peak ${formatNumber(a.peak)}`] }), _jsxs("div", { className: "rule-actions", children: [rule && _jsx("button", { type: "button", className: "text-button", onClick: () => onInvestigate({ lang: rule.lang, text: rule.query, range: around(a.startsAt, a.endsAt ?? extent.to) }), children: "Investigate" }), _jsx("button", { type: "button", className: "text-button", onClick: () => onAddToCase(a), children: "Add to case" })] })] }, a.id));
                        }) })] })] }));
};
