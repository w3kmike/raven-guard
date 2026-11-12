import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/// <reference path="../shims.d.ts" />
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, } from 'react';
import { gsap } from 'gsap';
import { lex } from '../query/index.js';
import { eases } from '../tokens.js';
import { cssMs, cssPx, escapeRegex } from '../utils.js';
// Language vocabulary
export const langName = { lucene: 'Lucene', logql: 'LogQL' };
export const otherLang = (l) => (l === 'lucene' ? 'logql' : 'lucene');
// Icons (Tabler, MIT)
const ICONS = {
    pin: ['M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4', 'M9 15l-4.5 4.5', 'M14.5 4l5.5 5.5'],
    close: ['M18 6l-12 12', 'M6 6l12 12'],
    back: ['M9 14l-4 -4l4 -4', 'M5 10h11a4 4 0 1 1 0 8h-1'],
    history: ['M12 8l0 4l2 2', 'M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5'],
    copy: [
        'M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z',
        'M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1',
    ],
    chevron: ['M9 6l6 6l-6 6'],
    run: ['M7 4v16l13 -8z'],
    alert: ['M12 9v4', 'M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z', 'M12 16h.01'],
    zoomOut: ['M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M7 10l6 0', 'M21 21l-6 -6'],
    clock: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 7v5l3 3'],
    exchange: ['M7 10h14l-4 -4', 'M17 14h-14l4 4'],
    sort: ['M3 9l4 -4l4 4m-4 -4v14', 'M21 15l-4 4l-4 -4m4 4v-14'],
    live: ['M18.364 19.364a9 9 0 1 0 -12.728 0', 'M15.536 16.536a5 5 0 1 0 -7.072 0', 'M12 13m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
    bell: ['M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6', 'M9 17v1a3 3 0 0 0 6 0v-1'],
    case: ['M3 7m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z', 'M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2', 'M12 12l0 .01', 'M3 13a20 20 0 0 0 18 0'],
    link: ['M9 15l6 -6', 'M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464', 'M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463'],
    pivot: ['M17 7l-10 10', 'M8 7l9 0l0 9'],
    compare: ['M11 16h10', 'M11 16l4 4', 'M11 16l4 -4', 'M13 8h-10', 'M13 8l-4 4', 'M13 8l-4 -4'],
    patterns: ['M12 4l-8 4l8 4l8 -4l-8 -4', 'M4 12l8 4l8 -4', 'M4 16l8 4l8 -4'],
    lines: ['M9 6l11 0', 'M9 12l11 0', 'M9 18l11 0', 'M5 6l0 .01', 'M5 12l0 .01', 'M5 18l0 .01'],
    plus: ['M12 5l0 14', 'M5 12l14 0'],
    retry: ['M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'],
    source: ['M12 6m-8 0a8 3 0 1 0 16 0a8 3 0 1 0 -16 0', 'M4 6v6a8 3 0 0 0 16 0v-6', 'M4 12v6a8 3 0 0 0 16 0v-6'],
};
export const Icon = ({ name }) => (_jsx("svg", { className: "icon", viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", children: ICONS[name].map((d) => _jsx("path", { d: d }, d)) }));
// Motion
const motionQueries = { full: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)' };
export const useEnter = (ref, deps, variant = 'drop', enabled = true) => {
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el || !enabled)
            return undefined;
        const mm = gsap.matchMedia();
        mm.add(motionQueries, (ctx) => {
            const offset = cssPx(variant === 'slide' ? '--motion-slide' : '--motion-drop');
            gsap.from(el, ctx.conditions?.full
                ? { [variant === 'slide' ? 'x' : 'y']: offset, autoAlpha: 0, duration: cssMs('--dur-reveal') / 1000, ease: eases.settle }
                : { autoAlpha: 0, duration: cssMs('--dur-feedback') / 1000 });
        });
        return () => mm.revert();
    }, deps);
};
export const useBump = (ref, value) => {
    const first = useRef(true);
    useLayoutEffect(() => {
        if (first.current) {
            first.current = false;
            return undefined;
        }
        const el = ref.current;
        if (!el)
            return undefined;
        const mm = gsap.matchMedia();
        mm.add(motionQueries, (ctx) => {
            if (!ctx.conditions?.full)
                return;
            gsap.fromTo(el, { scale: cssPx('--motion-bump') }, { scale: 1, duration: cssMs('--dur-shape') / 1000, ease: eases.settle });
        });
        return () => mm.revert();
    }, [ref, value]);
};
export const useObservedSize = (read) => useCallback((el) => {
    if (!el)
        return undefined;
    const measure = () => read(el);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
}, []);
// Small parts
export const LevelTag = ({ level }) => (_jsx("span", { className: "level-tag", "data-level": level, children: level === 'unknown' ? 'none' : level }));
export const LangTag = ({ lang }) => (_jsx("span", { className: "lang-tag", "data-lang": lang, children: langName[lang] }));
export const Highlighted = ({ lang, text }) => {
    const tokens = useMemo(() => lex(lang, text), [lang, text]);
    return _jsx(_Fragment, { children: segments(text, tokens, []).map((s) => _jsx("span", { className: s.cls, children: s.text }, s.start)) });
};
export const segments = (text, tokens, diagnostics) => {
    const flag = (start, end) => {
        const hit = diagnostics.find((d) => start < d.at + d.length && end > d.at);
        return hit ? ` is-${hit.severity}` : '';
    };
    const built = tokens.reduce((acc, t) => ({
        pos: t.end,
        out: [
            ...acc.out,
            ...(t.start > acc.pos ? [{ start: acc.pos, text: text.slice(acc.pos, t.start), cls: 'syn-plain' }] : []),
            { start: t.start, text: text.slice(t.start, t.end), cls: `syn-${t.kind}${flag(t.start, t.end)}` },
        ],
    }), { pos: 0, out: [] });
    return built.pos < text.length
        ? [...built.out, { start: built.pos, text: text.slice(built.pos), cls: 'syn-plain' }]
        : built.out;
};
export const Marked = ({ text, terms }) => {
    if (!terms.length)
        return _jsx(_Fragment, { children: text });
    const re = new RegExp(`(${terms.map(escapeRegex).join('|')})`, 'gi');
    return _jsx(_Fragment, { children: text.split(re).map((part, i) => (i % 2 ? _jsx("mark", { children: part }, i) : part)) });
};
export const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    }
    catch {
        return false;
    }
};
export const Popover = ({ label, trigger, triggerClass, disabled, title, children }) => {
    const [open, setOpen] = useState(false);
    const wrap = useRef(null);
    const button = useRef(null);
    const panel = useRef(null);
    const close = useCallback(() => { setOpen(false); button.current?.focus(); }, []);
    const onDown = useEffectEvent((e) => { if (!wrap.current?.contains(e.target))
        setOpen(false); });
    const onKey = useEffectEvent((e) => { if (e.key === 'Escape')
        close(); });
    useEffect(() => {
        if (!open)
            return undefined;
        const down = (e) => onDown(e);
        const key = (e) => onKey(e);
        document.addEventListener('pointerdown', down);
        document.addEventListener('keydown', key);
        panel.current?.querySelector('button:not(:disabled), input, textarea')?.focus();
        return () => {
            document.removeEventListener('pointerdown', down);
            document.removeEventListener('keydown', key);
        };
    }, [open]);
    useEnter(panel, [open]);
    return (_jsxs("div", { className: "popover", ref: wrap, children: [_jsx("button", { ref: button, type: "button", className: triggerClass, "aria-expanded": open, "aria-haspopup": "dialog", disabled: disabled, title: title, onClick: () => setOpen((o) => !o), children: trigger }), open && (_jsx("div", { ref: panel, className: "popover-panel", role: "dialog", "aria-label": label, children: children(close) }))] }));
};
// Chart helpers
export const edgeOf = (px, width) => {
    const room = cssPx('--axis-edge-room');
    if (px < room)
        return 'start';
    return px > width - room ? 'end' : 'middle';
};
export const QueryStatus = ({ query, loading, children }) => {
    if (query.data !== undefined)
        return _jsx(_Fragment, { children: children(query.data) });
    if (query.isError) {
        return (_jsxs("div", { className: "status", "data-tone": "error", role: "alert", children: [_jsx(Icon, { name: "alert" }), _jsx("span", { children: query.error?.message ?? 'The request failed.' }), _jsxs("button", { type: "button", className: "text-button", onClick: () => { query.refetch(); }, children: [_jsx(Icon, { name: "retry" }), " Try again"] })] }));
    }
    return _jsxs("p", { className: "status", role: "status", children: [_jsx("span", { className: "status-pulse", "aria-hidden": "true" }), loading] });
};
// Small charts and tags
export const Sparkline = ({ values, max, label }) => {
    const w = cssPx('--spark-width');
    const h = cssPx('--spark-height');
    const bw = w / Math.max(1, values.length);
    return (_jsx("svg", { className: "sparkline", width: w, height: h, role: "img", "aria-label": label, children: values.map((v, i) => {
            const bh = max ? Math.max(v ? cssPx('--rule') : 0, (v / max) * h) : 0;
            return _jsx("rect", { x: i * bw, y: h - bh, width: Math.max(cssPx('--rule'), bw - cssPx('--chart-bar-gap')), height: bh }, i);
        }) }));
};
export const SeverityTag = ({ severity }) => (_jsx("span", { className: "severity-tag", "data-severity": severity, children: severity }));
export const Switcher = ({ view, resultCount, evidenceCount, firing, onView, onAlerts }) => {
    const badge = useRef(null);
    useBump(badge, evidenceCount);
    const items = [
        { v: 'results', label: 'Results', count: resultCount },
        { v: 'fields', label: 'Fields', count: '' },
        { v: 'case', label: 'Case', count: String(evidenceCount) },
    ];
    return (_jsxs("nav", { className: "switcher", "aria-label": "Workspace views", children: [items.map((it) => (_jsxs("button", { type: "button", "aria-current": view === it.v ? 'page' : undefined, onClick: () => onView(it.v), children: [_jsx("span", { children: it.label }), it.count && _jsx("span", { className: "switcher-count", ref: it.v === 'case' ? badge : undefined, children: it.count })] }, it.v))), _jsxs("button", { type: "button", onClick: onAlerts, "data-firing": firing > 0, children: [_jsx("span", { children: "Alerts" }), _jsx("span", { className: "switcher-count", children: firing ? `${firing} firing` : '0' })] })] }));
};
