/// <reference path="../shims.d.ts" />
import {
  useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode, type RefObject,
} from 'react';
import { gsap } from 'gsap';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Lang, Severity } from '../schemas.js';
import { lex, type Diagnostic, type SynToken } from '../query/index.js';
import { eases } from '../tokens.js';
import { cssMs, cssPx, escapeRegex } from '../utils.js';
import type { NarrowView } from '../state.js';

// Language vocabulary
export const langName: Readonly<Record<Lang, string>> = { lucene: 'Lucene', logql: 'LogQL' };
export const otherLang = (l: Lang): Lang => (l === 'lucene' ? 'logql' : 'lucene');

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
} as const;
export type IconName = keyof typeof ICONS;

export const Icon = ({ name }: { name: IconName }) => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {ICONS[name].map((d) => <path key={d} d={d} />)}
  </svg>
);

// Motion
const motionQueries = { full: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)' };

export const useEnter = (ref: RefObject<HTMLElement | null>, deps: readonly unknown[], variant: 'drop' | 'slide' = 'drop', enabled = true) => {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;
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

export const useBump = (ref: RefObject<HTMLElement | null>, value: number) => {
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    const el = ref.current;
    if (!el) return undefined;
    const mm = gsap.matchMedia();
    mm.add(motionQueries, (ctx) => {
      if (!ctx.conditions?.full) return;
      gsap.fromTo(el, { scale: cssPx('--motion-bump') }, { scale: 1, duration: cssMs('--dur-shape') / 1000, ease: eases.settle });
    });
    return () => mm.revert();
  }, [ref, value]);
};

export const useObservedSize = <T extends HTMLElement>(read: (el: T) => void) => useCallback((el: T | null) => {
  if (!el) return undefined;
  const measure = () => read(el);
  const ro = new ResizeObserver(measure);
  ro.observe(el);
  measure();
  return () => ro.disconnect();
}, []);

// Small parts
export const LevelTag = ({ level }: { level: string }) => (
  <span className="level-tag" data-level={level}>{level === 'unknown' ? 'none' : level}</span>
);

export const LangTag = ({ lang }: { lang: Lang }) => (
  <span className="lang-tag" data-lang={lang}>{langName[lang]}</span>
);

export const Highlighted = ({ lang, text }: { lang: Lang; text: string }) => {
  const tokens = useMemo(() => lex(lang, text), [lang, text]);
  return <>{segments(text, tokens, []).map((s) => <span key={s.start} className={s.cls}>{s.text}</span>)}</>;
};

export const segments = (text: string, tokens: readonly SynToken[], diagnostics: readonly Diagnostic[]) => {
  const flag = (start: number, end: number) => {
    const hit = diagnostics.find((d) => start < d.at + d.length && end > d.at);
    return hit ? ` is-${hit.severity}` : '';
  };
  const built = tokens.reduce<{ pos: number; out: Array<{ start: number; text: string; cls: string }> }>((acc, t) => ({
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

export const Marked = ({ text, terms }: { text: string; terms: readonly string[] }) => {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map(escapeRegex).join('|')})`, 'gi');
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}</>;
};

export const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// Popover
interface PopoverProps {
  readonly label: string;
  readonly trigger: ReactNode;
  readonly triggerClass: string;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly children: (close: () => void) => ReactNode;
}

export const Popover = ({ label, trigger, triggerClass, disabled, title, children }: PopoverProps) => {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setOpen(false); button.current?.focus(); }, []);
  const onDown = useEffectEvent((e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); });
  const onKey = useEffectEvent((e: KeyboardEvent) => { if (e.key === 'Escape') close(); });
  useEffect(() => {
    if (!open) return undefined;
    const down = (e: PointerEvent) => onDown(e);
    const key = (e: KeyboardEvent) => onKey(e);
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    panel.current?.querySelector<HTMLElement>('button:not(:disabled), input, textarea')?.focus();
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  useEnter(panel, [open]);
  return (
    <div className="popover" ref={wrap}>
      <button
        ref={button}
        type="button"
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        title={title}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <div ref={panel} className="popover-panel" role="dialog" aria-label={label}>
          {children(close)}
        </div>
      )}
    </div>
  );
};

// Chart helpers
export const edgeOf = (px: number, width: number) => {
  const room = cssPx('--axis-edge-room');
  if (px < room) return 'start';
  return px > width - room ? 'end' : 'middle';
};

// Async states
interface StatusProps<T> {
  readonly query: UseQueryResult<T>;
  readonly loading: string;
  readonly children: (data: T) => ReactNode;
}

export const QueryStatus = <T,>({ query, loading, children }: StatusProps<T>) => {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError) {
    return (
      <div className="status" data-tone="error" role="alert">
        <Icon name="alert" />
        <span>{query.error?.message ?? 'The request failed.'}</span>
        <button type="button" className="text-button" onClick={() => { query.refetch(); }}><Icon name="retry" /> Try again</button>
      </div>
    );
  }
  return <p className="status" role="status"><span className="status-pulse" aria-hidden="true" />{loading}</p>;
};

// Small charts and tags
export const Sparkline = ({ values, max, label }: { values: readonly number[]; max: number; label: string }) => {
  const w = cssPx('--spark-width');
  const h = cssPx('--spark-height');
  const bw = w / Math.max(1, values.length);
  return (
    <svg className="sparkline" width={w} height={h} role="img" aria-label={label}>
      {values.map((v, i) => {
        const bh = max ? Math.max(v ? cssPx('--rule') : 0, (v / max) * h) : 0;
        return <rect key={i} x={i * bw} y={h - bh} width={Math.max(cssPx('--rule'), bw - cssPx('--chart-bar-gap'))} height={bh} />;
      })}
    </svg>
  );
};

export const SeverityTag = ({ severity }: { severity: Severity }) => (
  <span className="severity-tag" data-severity={severity}>{severity}</span>
);

// Narrow-screen view switcher
interface SwitcherProps {
  readonly view: NarrowView;
  readonly resultCount: string;
  readonly evidenceCount: number;
  readonly firing: number;
  readonly onView: (v: NarrowView) => void;
  readonly onAlerts: () => void;
}

export const Switcher = ({ view, resultCount, evidenceCount, firing, onView, onAlerts }: SwitcherProps) => {
  const badge = useRef<HTMLSpanElement>(null);
  useBump(badge, evidenceCount);
  const items = [
    { v: 'results' as const, label: 'Results', count: resultCount },
    { v: 'fields' as const, label: 'Fields', count: '' },
    { v: 'case' as const, label: 'Case', count: String(evidenceCount) },
  ];
  return (
    <nav className="switcher" aria-label="Workspace views">
      {items.map((it) => (
        <button key={it.v} type="button" aria-current={view === it.v ? 'page' : undefined} onClick={() => onView(it.v)}>
          <span>{it.label}</span>
          {it.count && <span className="switcher-count" ref={it.v === 'case' ? badge : undefined}>{it.count}</span>}
        </button>
      ))}
      <button type="button" onClick={onAlerts} data-firing={firing > 0}>
        <span>Alerts</span>
        <span className="switcher-count">{firing ? `${firing} firing` : '0'}</span>
      </button>
    </nav>
  );
};
