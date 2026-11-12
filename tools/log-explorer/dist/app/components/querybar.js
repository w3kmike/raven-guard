import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/// <reference path="../shims.d.ts" />
import { useEffect, useMemo, useRef, useState, } from 'react';
import { config } from '../config.js';
import { lex } from '../query/index.js';
import { suggest } from '../query/suggest.js';
import { formatClock, formatSpan, formatStamp, parseStamp, plural, zoneLabel, } from '../utils.js';
import { Highlighted, Icon, LangTag, Popover, copyText, langName, segments, useEnter, } from './shared.js';
export const QueryEditor = ({ lang, value, diagnostics, catalog, inputRef, onChange, onRun }) => {
    const tokens = useMemo(() => lex(lang, value), [lang, value]);
    const [sugg, setSugg] = useState(null);
    const [active, setActive] = useState(0);
    const hasError = diagnostics.some((d) => d.severity === 'error');
    const refresh = (text, cursor) => {
        const s = suggest(lang, text, cursor, catalog);
        setSugg(s.items.length ? s : null);
        setActive(0);
    };
    const accept = (item) => {
        if (!sugg)
            return;
        const next = `${value.slice(0, sugg.from)}${item.insert}${value.slice(sugg.to)}`;
        const pos = sugg.from + item.insert.length;
        onChange(next);
        requestAnimationFrame(() => {
            inputRef.current?.setSelectionRange(pos, pos);
            refresh(next, pos);
        });
    };
    const onKeyDown = (e) => {
        const n = sugg?.items.length ?? 0;
        if (sugg && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
        }
        else if (sugg && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) {
            e.preventDefault();
            accept(sugg.items[active]);
        }
        else if (sugg && e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setSugg(null);
        }
        else if (e.key === ' ' && e.ctrlKey) {
            e.preventDefault();
            refresh(value, e.currentTarget.selectionStart);
        }
        else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            setSugg(null);
            onRun();
        }
    };
    return (_jsxs("div", { className: "editor", "data-lang": lang, children: [_jsxs("div", { className: "editor-stack", children: [_jsxs("pre", { className: "editor-mirror", "aria-hidden": "true", children: [segments(value, tokens, diagnostics).map((s) => _jsx("span", { className: s.cls, children: s.text }, s.start)), '\n'] }), _jsx("textarea", { ref: inputRef, className: "editor-input", value: value, rows: 1, spellCheck: false, autoCapitalize: "off", autoComplete: "off", autoCorrect: "off", placeholder: config.placeholders[lang], role: "combobox", "aria-label": `Query in ${langName[lang]}`, "aria-describedby": "query-notices", "aria-invalid": hasError, "aria-expanded": sugg !== null, "aria-controls": "query-suggestions", "aria-autocomplete": "list", "aria-activedescendant": sugg ? `suggestion-${active}` : undefined, onChange: (e) => { onChange(e.target.value); refresh(e.target.value, e.target.selectionStart); }, onKeyDown: onKeyDown, onClick: () => setSugg(null), onBlur: () => setSugg(null) })] }), _jsx("ul", { id: "query-suggestions", className: "suggestions", role: "listbox", "aria-label": "Suggestions", hidden: !sugg, children: sugg?.items.map((item, i) => (_jsxs("li", { id: `suggestion-${i}`, role: "option", "aria-selected": i === active, className: "suggestion", "data-kind": item.kind, onMouseDown: (e) => { e.preventDefault(); accept(item); }, children: [_jsx("span", { className: "suggestion-label", children: item.label }), _jsx("span", { className: "suggestion-detail", children: item.detail })] }, `${item.kind}-${item.label}`))) })] }));
};
export const LangSwitch = ({ lang, onPick }) => (_jsx("div", { className: "lang-switch", role: "group", "aria-label": "Query language", children: ['lucene', 'logql'].map((l) => (_jsx("button", { type: "button", "data-lang": l, "aria-pressed": lang === l, onClick: () => onPick(l), children: langName[l] }, l))) }));
export const Notices = ({ diagnostics, stale, offer, lang, onFix, onAcceptOffer, onDismissOffer }) => {
    const error = diagnostics.find((d) => d.severity === 'error');
    const warnings = diagnostics.filter((d) => d.severity === 'warning');
    return (_jsxs("div", { id: "query-notices", className: "notices", children: [offer && (_jsxs("p", { className: "notice", "data-tone": "offer", "data-lang": offer, children: [_jsxs("span", { children: ["This is valid ", langName[offer], ", but not ", langName[lang], "."] }), _jsxs("button", { type: "button", className: "text-button", onClick: onAcceptOffer, children: ["Run it as ", langName[offer]] }), _jsxs("button", { type: "button", className: "text-button", onClick: onDismissOffer, children: ["Keep ", langName[lang]] })] })), error && (_jsxs("p", { className: "notice", "data-tone": "error", children: [_jsx(Icon, { name: "alert" }), _jsxs("span", { children: [_jsxs("span", { className: "notice-col", children: ["Col ", error.at + 1] }), " ", error.message, " Results below are from the last query that ran."] })] })), !error && warnings.map((w) => (_jsxs("p", { className: "notice", "data-tone": "warning", children: [_jsx(Icon, { name: "alert" }), _jsxs("span", { children: [_jsxs("span", { className: "notice-col", children: ["Col ", w.at + 1] }), " ", w.message] }), w.fix && _jsx("button", { type: "button", className: "text-button fix", onClick: () => onFix(w.fix?.text ?? ''), children: w.fix.label })] }, `${w.at}-${w.message}`))), !error && stale && _jsx("p", { className: "notice", "data-tone": "stale", children: "Not run yet. Press Enter or Run to update the results." })] }));
};
const noteLabel = { kept: 'Kept', changed: 'Changed', dropped: 'Dropped' };
export const SwitchPreviewPanel = ({ from, to, translation, onConfirm, onCancel }) => {
    const ref = useRef(null);
    const heading = useRef(null);
    useEnter(ref, []);
    useEffect(() => { heading.current?.focus(); }, []);
    const dropped = translation?.notes.filter((n) => n.kind === 'dropped').length ?? 0;
    return (_jsxs("section", { ref: ref, className: "translate", "data-lang": to, "aria-labelledby": "translate-heading", children: [_jsxs("h2", { id: "translate-heading", ref: heading, tabIndex: -1, children: [_jsx(Icon, { name: "exchange" }), " ", langName[from], " to ", langName[to]] }), translation ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "translate-lede", children: dropped
                            ? `${plural(dropped, 'clause')} can't be expressed in ${langName[to]}, so results may widen. Review before it runs.`
                            : `Every clause carries over. Review before it runs.` }), _jsx("pre", { className: "translate-out", children: _jsx(Highlighted, { lang: to, text: translation.text }) }), _jsx("ul", { className: "translate-notes", children: translation.notes.map((n) => (_jsxs("li", { "data-kind": n.kind, children: [_jsx("span", { className: "note-kind", children: noteLabel[n.kind] }), _jsx("code", { className: "note-source", children: n.source }), n.detail && _jsx("span", { className: "note-detail", children: n.detail })] }, `${n.kind}-${n.source}`))) })] })) : (_jsxs("p", { className: "translate-lede", children: ["The ", langName[from], " query has an error, so it can't be translated. You can switch and start a new ", langName[to], " query."] })), _jsxs("div", { className: "translate-actions", children: [_jsx("button", { type: "button", className: "primary-button", "data-lang": to, onClick: onConfirm, children: translation ? `Switch and run` : `Switch to ${langName[to]}` }), _jsxs("button", { type: "button", className: "text-button", onClick: onCancel, children: ["Keep ", langName[from]] })] })] }));
};
const RangeForm = ({ extent, range, zone, onApply, onZone, close }) => {
    const [from, setFrom] = useState(formatStamp(range.from, zone));
    const [to, setTo] = useState(formatStamp(range.to, zone));
    const [error, setError] = useState('');
    useEffect(() => { setFrom(formatStamp(range.from, zone)); setTo(formatStamp(range.to, zone)); }, [zone, range]);
    const apply = () => {
        const a = parseStamp(from, zone);
        const b = parseStamp(to, zone);
        if (a === null || b === null) {
            setError(`Use the format ${formatStamp(extent.start, zone)}.`);
            return;
        }
        if (a >= b) {
            setError('From must be earlier than To.');
            return;
        }
        const next = { from: Math.max(a, extent.start), to: Math.min(b, extent.end) };
        if (next.from >= next.to) {
            setError(`Nothing was captured then. The capture runs ${formatStamp(extent.start, zone)} to ${formatClock(extent.end, zone, 'm')} ${zoneLabel(zone)}.`);
            return;
        }
        onApply(next);
        close();
    };
    return (_jsxs("div", { className: "range-form", children: [_jsx("ul", { className: "range-presets", children: config.presets.map((p) => {
                    const from = p.ms === null ? extent.start : Math.max(extent.start, extent.end - p.ms);
                    const active = range.to === extent.end && range.from === from;
                    return (_jsx("li", { children: _jsx("button", { type: "button", "aria-pressed": active, onClick: () => { onApply({ from, to: extent.end }); close(); }, children: p.label }) }, p.label));
                }) }), _jsxs("form", { className: "range-custom", onSubmit: (e) => { e.preventDefault(); apply(); }, noValidate: true, children: [_jsxs("label", { children: [_jsx("span", { children: "From" }), _jsx("input", { value: from, onChange: (e) => { setFrom(e.target.value); setError(''); }, inputMode: "numeric", "aria-invalid": Boolean(error), "aria-describedby": "range-error" })] }), _jsxs("label", { children: [_jsx("span", { children: "To" }), _jsx("input", { value: to, onChange: (e) => { setTo(e.target.value); setError(''); }, inputMode: "numeric", "aria-invalid": Boolean(error), "aria-describedby": "range-error" })] }), _jsx("p", { id: "range-error", className: "field-error", role: "alert", children: error }), _jsx("button", { type: "submit", className: "primary-button", children: "Apply range" })] }), _jsxs("fieldset", { className: "zone-pick", children: [_jsx("legend", { children: "Show times in" }), ['utc', 'local'].map((z) => (_jsxs("label", { children: [_jsx("input", { type: "radio", name: "zone", checked: zone === z, onChange: () => onZone(z) }), _jsx("span", { children: z === 'utc' ? 'UTC' : 'Local time' })] }, z)))] }), _jsxs("p", { className: "range-note", children: ["Capture: ", extent.label, ", ", formatClock(extent.start, zone, 'm'), "\u2013", formatClock(extent.end, zone, 'm'), " ", zoneLabel(zone)] })] }));
};
export const TimeRangeControl = (props) => (_jsx(Popover, { label: "Time range", triggerClass: "range-trigger", trigger: (_jsxs(_Fragment, { children: [_jsx(Icon, { name: "clock" }), _jsxs("span", { className: "range-text range-full", children: [formatClock(props.range.from, props.zone, 's'), "\u2013", formatClock(props.range.to, props.zone, 's')] }), _jsxs("span", { className: "range-text range-short", children: [formatClock(props.range.from, props.zone, 'm'), "\u2013", formatClock(props.range.to, props.zone, 'm')] }), _jsx("span", { className: "range-zone", children: zoneLabel(props.zone) }), _jsx("span", { className: "range-span", children: formatSpan(props.range.to - props.range.from) })] })), children: (close) => _jsx(RangeForm, { ...props, close: close }) }));
export const HistoryMenu = ({ history, zone, onPick }) => (_jsx(Popover, { label: "Query history", triggerClass: "tool-button", trigger: _jsxs(_Fragment, { children: [_jsx(Icon, { name: "history" }), _jsx("span", { className: "tool-label", children: "History" })] }), children: (close) => (history.length ? (_jsx("ol", { className: "history-list", children: history.map((h) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => { onPick(h); close(); }, children: [_jsxs("span", { className: "history-meta", children: [_jsx(LangTag, { lang: h.lang }), _jsxs("span", { children: [formatClock(h.range.from, zone, 'm'), "\u2013", formatClock(h.range.to, zone, 'm')] }), _jsx("span", { children: h.kind === 'logs' ? plural(h.count, 'line') : plural(h.count, 'series', 'series') })] }), _jsx("code", { className: "history-query", children: h.text || '(every line)' })] }) }, `${h.lang}-${h.text}-${h.range.from}-${h.range.to}`))) })) : (_jsx("p", { className: "popover-empty", children: "No queries run yet. Each run is kept here with its language and time range." }))) }));
const CopyForm = ({ lang, text, translate, onCopied }) => {
    const [fallback, setFallback] = useState(null);
    const options = ['lucene', 'logql'].map((l) => {
        const t = l === lang ? { text, notes: [] } : translate(l);
        return { l, t };
    });
    const copy = async (l, out, droppedCount) => {
        const ok = await copyText(out);
        if (!ok) {
            setFallback(out);
            return;
        }
        onCopied(`Copied as ${langName[l]}.${droppedCount ? ` ${plural(droppedCount, 'clause')} couldn't be translated and ${droppedCount === 1 ? 'was' : 'were'} left out.` : ''}`);
    };
    return (_jsxs("div", { className: "copy-form", children: [options.map(({ l, t }) => {
                const dropped = t?.notes.filter((n) => n.kind === 'dropped').length ?? 0;
                return (_jsxs("div", { className: "copy-option", children: [_jsxs("button", { type: "button", disabled: !t || !text.trim(), onClick: () => t && copy(l, t.text, dropped), children: [_jsx(Icon, { name: "copy" }), " Copy as ", langName[l]] }), t && text.trim() ? (_jsxs(_Fragment, { children: [_jsx("code", { className: "copy-preview", children: _jsx(Highlighted, { lang: l, text: t.text }) }), dropped > 0 && _jsxs("span", { className: "copy-loss", children: [plural(dropped, 'clause'), " dropped in translation"] })] })) : _jsx("span", { className: "copy-loss", children: text.trim() ? 'The query has an error.' : 'The query is empty.' })] }, l));
            }), fallback !== null && (_jsxs("label", { className: "copy-fallback", children: [_jsx("span", { children: "The browser blocked the clipboard. Select this text and copy it." }), _jsx("textarea", { readOnly: true, value: fallback, onFocus: (e) => e.target.select() })] }))] }));
};
export const CopyAs = (props) => (_jsx(Popover, { label: "Copy query", triggerClass: "tool-button", trigger: _jsxs(_Fragment, { children: [_jsx(Icon, { name: "copy" }), _jsx("span", { className: "tool-label", children: "Copy as" })] }), children: () => _jsx(CopyForm, { ...props }) }));
export const SourcePicker = ({ source, onSource }) => (_jsxs("label", { className: "source-pick", title: "Where queries run", children: [_jsx(Icon, { name: "source" }), _jsx("span", { className: "sr-only", children: "Data source" }), _jsx("select", { value: source, onChange: (e) => onSource(e.target.value), children: config.sources.map((s) => (_jsx("option", { value: s.id, disabled: !s.available, children: s.available ? s.label : `${s.label} · no adapter yet` }, s.id))) })] }));
export const LiveToggle = ({ live, ended, blocked, onLive }) => (_jsxs("button", { type: "button", className: "tool-button live-button", "aria-pressed": live, disabled: blocked !== null || ended, title: blocked ?? (ended ? 'The demo recording has no more lines.' : live ? 'Stop following new lines' : 'Follow new lines as they arrive'), onClick: () => onLive(!live), children: [_jsx(Icon, { name: "live" }), _jsx("span", { className: "tool-label", children: ended ? 'Recording ended' : live ? 'Following' : 'Live' })] }));
// Shareable link
export const CopyLink = ({ href, onCopied }) => (_jsx(Popover, { label: "Link to this view", triggerClass: "tool-button", trigger: _jsxs(_Fragment, { children: [_jsx(Icon, { name: "link" }), _jsx("span", { className: "tool-label", children: "Link" })] }), children: (close) => (_jsxs("div", { className: "link-form", children: [_jsxs("label", { children: [_jsx("span", { children: "Opens this query, range, line, and case" }), _jsx("input", { readOnly: true, value: href, onFocus: (e) => e.target.select() })] }), _jsxs("button", { type: "button", className: "primary-button", onClick: async () => {
                    const ok = await copyText(href);
                    onCopied(ok ? 'Copied a link to this view.' : 'The browser blocked the clipboard. Select the link and copy it.');
                    if (ok)
                        close();
                }, children: [_jsx(Icon, { name: "copy" }), " Copy link"] })] })) }));
// Alerts entry point
export const AlertBell = ({ snapshot, onOpen }) => {
    const firing = snapshot?.states.filter((s) => s.state === 'firing').length ?? 0;
    const resolved = snapshot?.alerts.filter((a) => a.endsAt !== null).length ?? 0;
    return (_jsxs("button", { type: "button", className: "tool-button bell", "data-firing": firing > 0, onClick: onOpen, "aria-label": `Alerts: ${firing} firing, ${resolved} resolved`, children: [_jsx(Icon, { name: "bell" }), _jsx("span", { className: "bell-count", children: snapshot ? (firing ? `${firing} firing` : `${resolved} resolved`) : '…' })] }));
};
