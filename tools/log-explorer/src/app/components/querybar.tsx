/// <reference path="../shims.d.ts" />
import {
  useEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type RefObject,
} from 'react';
import { config, type SourceId, type Zone } from '../config.js';
import type { AlertSnapshot, Catalog, Lang, TimeRange } from '../schemas.js';
import { lex, type Diagnostic } from '../query/index.js';
import { suggest, type Suggestion, type Suggestions } from '../query/suggest.js';
import type { Note, Translation } from '../query/translate.js';
import type { HistoryEntry } from '../state.js';
import {
  formatClock, formatSpan, formatStamp, parseStamp, plural, zoneLabel,
} from '../utils.js';
import {
  Highlighted, Icon, LangTag, Popover, copyText, langName, segments, useEnter,
} from './shared.js';

// Query editor
interface EditorProps {
  readonly lang: Lang;
  readonly value: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly catalog: Catalog;
  readonly inputRef: RefObject<HTMLTextAreaElement | null>;
  readonly onChange: (text: string) => void;
  readonly onRun: () => void;
}

export const QueryEditor = ({ lang, value, diagnostics, catalog, inputRef, onChange, onRun }: EditorProps) => {
  const tokens = useMemo(() => lex(lang, value), [lang, value]);
  const [sugg, setSugg] = useState<Suggestions | null>(null);
  const [active, setActive] = useState(0);
  const hasError = diagnostics.some((d) => d.severity === 'error');

  const refresh = (text: string, cursor: number) => {
    const s = suggest(lang, text, cursor, catalog);
    setSugg(s.items.length ? s : null);
    setActive(0);
  };

  const accept = (item: Suggestion) => {
    if (!sugg) return;
    const next = `${value.slice(0, sugg.from)}${item.insert}${value.slice(sugg.to)}`;
    const pos = sugg.from + item.insert.length;
    onChange(next);
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(pos, pos);
      refresh(next, pos);
    });
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const n = sugg?.items.length ?? 0;
    if (sugg && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
    } else if (sugg && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) {
      e.preventDefault();
      accept(sugg.items[active]);
    } else if (sugg && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setSugg(null);
    } else if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      refresh(value, e.currentTarget.selectionStart);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setSugg(null);
      onRun();
    }
  };

  return (
    <div className="editor" data-lang={lang}>
      <div className="editor-stack">
        <pre className="editor-mirror" aria-hidden="true">
          {segments(value, tokens, diagnostics).map((s) => <span key={s.start} className={s.cls}>{s.text}</span>)}
          {'\n'}
        </pre>
        <textarea
          ref={inputRef}
          className="editor-input"
          value={value}
          rows={1}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder={config.placeholders[lang]}
          role="combobox"
          aria-label={`Query in ${langName[lang]}`}
          aria-describedby="query-notices"
          aria-invalid={hasError}
          aria-expanded={sugg !== null}
          aria-controls="query-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={sugg ? `suggestion-${active}` : undefined}
          onChange={(e) => { onChange(e.target.value); refresh(e.target.value, e.target.selectionStart); }}
          onKeyDown={onKeyDown}
          onClick={() => setSugg(null)}
          onBlur={() => setSugg(null)}
        />
      </div>
      <ul id="query-suggestions" className="suggestions" role="listbox" aria-label="Suggestions" hidden={!sugg}>
        {sugg?.items.map((item, i) => (
          <li
            key={`${item.kind}-${item.label}`}
            id={`suggestion-${i}`}
            role="option"
            aria-selected={i === active}
            className="suggestion"
            data-kind={item.kind}
            onMouseDown={(e) => { e.preventDefault(); accept(item); }}
          >
            <span className="suggestion-label">{item.label}</span>
            <span className="suggestion-detail">{item.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Language switch
interface LangSwitchProps { readonly lang: Lang; readonly onPick: (lang: Lang) => void }

export const LangSwitch = ({ lang, onPick }: LangSwitchProps) => (
  <div className="lang-switch" role="group" aria-label="Query language">
    {(['lucene', 'logql'] as const).map((l) => (
      <button key={l} type="button" data-lang={l} aria-pressed={lang === l} onClick={() => onPick(l)}>
        {langName[l]}
      </button>
    ))}
  </div>
);

// Notices under the query
interface NoticesProps {
  readonly diagnostics: readonly Diagnostic[];
  readonly stale: boolean;
  readonly offer: Lang | null;
  readonly lang: Lang;
  readonly onFix: (text: string) => void;
  readonly onAcceptOffer: () => void;
  readonly onDismissOffer: () => void;
}

export const Notices = ({ diagnostics, stale, offer, lang, onFix, onAcceptOffer, onDismissOffer }: NoticesProps) => {
  const error = diagnostics.find((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  return (
    <div id="query-notices" className="notices">
      {offer && (
        <p className="notice" data-tone="offer" data-lang={offer}>
          <span>This is valid {langName[offer]}, but not {langName[lang]}.</span>
          <button type="button" className="text-button" onClick={onAcceptOffer}>Run it as {langName[offer]}</button>
          <button type="button" className="text-button" onClick={onDismissOffer}>Keep {langName[lang]}</button>
        </p>
      )}
      {error && (
        <p className="notice" data-tone="error">
          <Icon name="alert" />
          <span><span className="notice-col">Col {error.at + 1}</span> {error.message} Results below are from the last query that ran.</span>
        </p>
      )}
      {!error && warnings.map((w) => (
        <p key={`${w.at}-${w.message}`} className="notice" data-tone="warning">
          <Icon name="alert" />
          <span><span className="notice-col">Col {w.at + 1}</span> {w.message}</span>
          {w.fix && <button type="button" className="text-button fix" onClick={() => onFix(w.fix?.text ?? '')}>{w.fix.label}</button>}
        </p>
      ))}
      {!error && stale && <p className="notice" data-tone="stale">Not run yet. Press Enter or Run to update the results.</p>}
    </div>
  );
};

// Translation preview
interface PreviewProps {
  readonly from: Lang;
  readonly to: Lang;
  readonly translation: Translation | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

const noteLabel: Readonly<Record<Note['kind'], string>> = { kept: 'Kept', changed: 'Changed', dropped: 'Dropped' };

export const SwitchPreviewPanel = ({ from, to, translation, onConfirm, onCancel }: PreviewProps) => {
  const ref = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEnter(ref, []);
  useEffect(() => { heading.current?.focus(); }, []);
  const dropped = translation?.notes.filter((n) => n.kind === 'dropped').length ?? 0;
  return (
    <section ref={ref} className="translate" data-lang={to} aria-labelledby="translate-heading">
      <h2 id="translate-heading" ref={heading} tabIndex={-1}>
        <Icon name="exchange" /> {langName[from]} to {langName[to]}
      </h2>
      {translation ? (
        <>
          <p className="translate-lede">
            {dropped
              ? `${plural(dropped, 'clause')} can't be expressed in ${langName[to]}, so results may widen. Review before it runs.`
              : `Every clause carries over. Review before it runs.`}
          </p>
          <pre className="translate-out"><Highlighted lang={to} text={translation.text} /></pre>
          <ul className="translate-notes">
            {translation.notes.map((n) => (
              <li key={`${n.kind}-${n.source}`} data-kind={n.kind}>
                <span className="note-kind">{noteLabel[n.kind]}</span>
                <code className="note-source">{n.source}</code>
                {n.detail && <span className="note-detail">{n.detail}</span>}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="translate-lede">The {langName[from]} query has an error, so it can&apos;t be translated. You can switch and start a new {langName[to]} query.</p>
      )}
      <div className="translate-actions">
        <button type="button" className="primary-button" data-lang={to} onClick={onConfirm}>
          {translation ? `Switch and run` : `Switch to ${langName[to]}`}
        </button>
        <button type="button" className="text-button" onClick={onCancel}>Keep {langName[from]}</button>
      </div>
    </section>
  );
};

// Time range
interface RangeProps {
  readonly extent: Catalog;
  readonly range: TimeRange;
  readonly zone: Zone;
  readonly onApply: (range: TimeRange) => void;
  readonly onZone: (zone: Zone) => void;
}

const RangeForm = ({ extent, range, zone, onApply, onZone, close }: RangeProps & { close: () => void }) => {
  const [from, setFrom] = useState(formatStamp(range.from, zone));
  const [to, setTo] = useState(formatStamp(range.to, zone));
  const [error, setError] = useState('');
  useEffect(() => { setFrom(formatStamp(range.from, zone)); setTo(formatStamp(range.to, zone)); }, [zone, range]);
  const apply = () => {
    const a = parseStamp(from, zone);
    const b = parseStamp(to, zone);
    if (a === null || b === null) { setError(`Use the format ${formatStamp(extent.start, zone)}.`); return; }
    if (a >= b) { setError('From must be earlier than To.'); return; }
    const next = { from: Math.max(a, extent.start), to: Math.min(b, extent.end) };
    if (next.from >= next.to) {
      setError(`Nothing was captured then. The capture runs ${formatStamp(extent.start, zone)} to ${formatClock(extent.end, zone, 'm')} ${zoneLabel(zone)}.`);
      return;
    }
    onApply(next);
    close();
  };
  return (
    <div className="range-form">
      <ul className="range-presets">
        {config.presets.map((p) => {
          const from = p.ms === null ? extent.start : Math.max(extent.start, extent.end - p.ms);
          const active = range.to === extent.end && range.from === from;
          return (
            <li key={p.label}>
              <button type="button" aria-pressed={active} onClick={() => { onApply({ from, to: extent.end }); close(); }}>
                {p.label}
              </button>
            </li>
          );
        })}
      </ul>
      <form className="range-custom" onSubmit={(e) => { e.preventDefault(); apply(); }} noValidate>
        <label>
          <span>From</span>
          <input value={from} onChange={(e) => { setFrom(e.target.value); setError(''); }} inputMode="numeric" aria-invalid={Boolean(error)} aria-describedby="range-error" />
        </label>
        <label>
          <span>To</span>
          <input value={to} onChange={(e) => { setTo(e.target.value); setError(''); }} inputMode="numeric" aria-invalid={Boolean(error)} aria-describedby="range-error" />
        </label>
        <p id="range-error" className="field-error" role="alert">{error}</p>
        <button type="submit" className="primary-button">Apply range</button>
      </form>
      <fieldset className="zone-pick">
        <legend>Show times in</legend>
        {(['utc', 'local'] as const).map((z) => (
          <label key={z}>
            <input type="radio" name="zone" checked={zone === z} onChange={() => onZone(z)} />
            <span>{z === 'utc' ? 'UTC' : 'Local time'}</span>
          </label>
        ))}
      </fieldset>
      <p className="range-note">Capture: {extent.label}, {formatClock(extent.start, zone, 'm')}–{formatClock(extent.end, zone, 'm')} {zoneLabel(zone)}</p>
    </div>
  );
};

export const TimeRangeControl = (props: RangeProps) => (
  <Popover
    label="Time range"
    triggerClass="range-trigger"
    trigger={(
      <>
        <Icon name="clock" />
        <span className="range-text range-full">{formatClock(props.range.from, props.zone, 's')}–{formatClock(props.range.to, props.zone, 's')}</span>
        <span className="range-text range-short">{formatClock(props.range.from, props.zone, 'm')}–{formatClock(props.range.to, props.zone, 'm')}</span>
        <span className="range-zone">{zoneLabel(props.zone)}</span>
        <span className="range-span">{formatSpan(props.range.to - props.range.from)}</span>
      </>
    )}
  >
    {(close) => <RangeForm {...props} close={close} />}
  </Popover>
);

// History
interface HistoryProps {
  readonly history: readonly HistoryEntry[];
  readonly zone: Zone;
  readonly onPick: (entry: HistoryEntry) => void;
}

export const HistoryMenu = ({ history, zone, onPick }: HistoryProps) => (
  <Popover label="Query history" triggerClass="tool-button" trigger={<><Icon name="history" /><span className="tool-label">History</span></>}>
    {(close) => (history.length ? (
      <ol className="history-list">
        {history.map((h) => (
          <li key={`${h.lang}-${h.text}-${h.range.from}-${h.range.to}`}>
            <button type="button" onClick={() => { onPick(h); close(); }}>
              <span className="history-meta">
                <LangTag lang={h.lang} />
                <span>{formatClock(h.range.from, zone, 'm')}–{formatClock(h.range.to, zone, 'm')}</span>
                <span>{h.kind === 'logs' ? plural(h.count, 'line') : plural(h.count, 'series', 'series')}</span>
              </span>
              <code className="history-query">{h.text || '(every line)'}</code>
            </button>
          </li>
        ))}
      </ol>
    ) : (
      <p className="popover-empty">No queries run yet. Each run is kept here with its language and time range.</p>
    ))}
  </Popover>
);

// Copy as
interface CopyAsProps {
  readonly lang: Lang;
  readonly text: string;
  readonly translate: (to: Lang) => Translation | null;
  readonly onCopied: (message: string) => void;
}

const CopyForm = ({ lang, text, translate, onCopied }: CopyAsProps) => {
  const [fallback, setFallback] = useState<string | null>(null);
  const options = (['lucene', 'logql'] as const).map((l) => {
    const t = l === lang ? { text, notes: [] as readonly Note[] } : translate(l);
    return { l, t };
  });
  const copy = async (l: Lang, out: string, droppedCount: number) => {
    const ok = await copyText(out);
    if (!ok) { setFallback(out); return; }
    onCopied(`Copied as ${langName[l]}.${droppedCount ? ` ${plural(droppedCount, 'clause')} couldn't be translated and ${droppedCount === 1 ? 'was' : 'were'} left out.` : ''}`);
  };
  return (
    <div className="copy-form">
      {options.map(({ l, t }) => {
        const dropped = t?.notes.filter((n) => n.kind === 'dropped').length ?? 0;
        return (
          <div key={l} className="copy-option">
            <button type="button" disabled={!t || !text.trim()} onClick={() => t && copy(l, t.text, dropped)}>
              <Icon name="copy" /> Copy as {langName[l]}
            </button>
            {t && text.trim() ? (
              <>
                <code className="copy-preview"><Highlighted lang={l} text={t.text} /></code>
                {dropped > 0 && <span className="copy-loss">{plural(dropped, 'clause')} dropped in translation</span>}
              </>
            ) : <span className="copy-loss">{text.trim() ? 'The query has an error.' : 'The query is empty.'}</span>}
          </div>
        );
      })}
      {fallback !== null && (
        <label className="copy-fallback">
          <span>The browser blocked the clipboard. Select this text and copy it.</span>
          <textarea readOnly value={fallback} onFocus={(e) => e.target.select()} />
        </label>
      )}
    </div>
  );
};

export const CopyAs = (props: CopyAsProps) => (
  <Popover label="Copy query" triggerClass="tool-button" trigger={<><Icon name="copy" /><span className="tool-label">Copy as</span></>}>
    {() => <CopyForm {...props} />}
  </Popover>
);


// Data source
interface SourceProps { readonly source: SourceId; readonly onSource: (id: SourceId) => void }

export const SourcePicker = ({ source, onSource }: SourceProps) => (
  <label className="source-pick" title="Where queries run">
    <Icon name="source" />
    <span className="sr-only">Data source</span>
    <select value={source} onChange={(e) => onSource(e.target.value as SourceId)}>
      {config.sources.map((s) => (
        <option key={s.id} value={s.id} disabled={!s.available}>{s.available ? s.label : `${s.label} · no adapter yet`}</option>
      ))}
    </select>
  </label>
);

// Live tail
interface LiveProps {
  readonly live: boolean;
  readonly ended: boolean;
  readonly blocked: string | null;
  readonly onLive: (on: boolean) => void;
}

export const LiveToggle = ({ live, ended, blocked, onLive }: LiveProps) => (
  <button
    type="button"
    className="tool-button live-button"
    aria-pressed={live}
    disabled={blocked !== null || ended}
    title={blocked ?? (ended ? 'The demo recording has no more lines.' : live ? 'Stop following new lines' : 'Follow new lines as they arrive')}
    onClick={() => onLive(!live)}
  >
    <Icon name="live" />
    <span className="tool-label">{ended ? 'Recording ended' : live ? 'Following' : 'Live'}</span>
  </button>
);

// Shareable link
export const CopyLink = ({ href, onCopied }: { href: string; onCopied: (message: string) => void }) => (
  <Popover label="Link to this view" triggerClass="tool-button" trigger={<><Icon name="link" /><span className="tool-label">Link</span></>}>
    {(close) => (
      <div className="link-form">
        <label>
          <span>Opens this query, range, line, and case</span>
          <input readOnly value={href} onFocus={(e) => e.target.select()} />
        </label>
        <button
          type="button"
          className="primary-button"
          onClick={async () => {
            const ok = await copyText(href);
            onCopied(ok ? 'Copied a link to this view.' : 'The browser blocked the clipboard. Select the link and copy it.');
            if (ok) close();
          }}
        >
          <Icon name="copy" /> Copy link
        </button>
      </div>
    )}
  </Popover>
);

// Alerts entry point
export const AlertBell = ({ snapshot, onOpen }: { snapshot: AlertSnapshot | undefined; onOpen: () => void }) => {
  const firing = snapshot?.states.filter((s) => s.state === 'firing').length ?? 0;
  const resolved = snapshot?.alerts.filter((a) => a.endsAt !== null).length ?? 0;
  return (
    <button type="button" className="tool-button bell" data-firing={firing > 0} onClick={onOpen} aria-label={`Alerts: ${firing} firing, ${resolved} resolved`}>
      <Icon name="bell" />
      <span className="bell-count">{snapshot ? (firing ? `${firing} firing` : `${resolved} resolved`) : '…'}</span>
    </button>
  );
};
