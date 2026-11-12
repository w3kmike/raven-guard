/// <reference path="../shims.d.ts" />
import {
  useEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  bisectCenter, line as lineShape, max, pointer, scaleLinear, scaleTime, scaleUtc,
} from 'd3';
import { config, type Zone } from '../config.js';
import type {
  Committed, LogLine, MetricResult, Pattern, SortOrder,
} from '../schemas.js';
import { seriesName } from '../query/index.js';
import { usePatterns } from '../api.js';
import type { PatternFilter, ResultsView } from '../state.js';
import {
  cssPx, formatClock, formatCount, formatIso, formatNumber, formatShare, plural,
} from '../utils.js';
import {
  Icon, LevelTag, Marked, QueryStatus, Sparkline, edgeOf, useObservedSize,
} from './shared.js';

// Results header: view switch, counts, sort, pattern filter, live lines
interface HeaderProps {
  readonly view: ResultsView;
  readonly metric: 'Series' | 'Values' | null;
  readonly summary: string;
  readonly sort: SortOrder;
  readonly pattern: PatternFilter | null;
  readonly pending: number;
  readonly onView: (v: ResultsView) => void;
  readonly onSort: (s: SortOrder) => void;
  readonly onClearPattern: () => void;
  readonly onFlush: () => void;
}

export const ResultsHeader = (p: HeaderProps) => (
  <>
    <div className="pane-head">
      {p.metric ? <h2 className="caps">{p.metric}</h2> : (
        <div className="view-switch" role="group" aria-label="Show results as">
          <button type="button" aria-pressed={p.view === 'lines'} onClick={() => p.onView('lines')}><Icon name="lines" /> Lines</button>
          <button type="button" aria-pressed={p.view === 'patterns'} onClick={() => p.onView('patterns')}><Icon name="patterns" /> Patterns</button>
        </div>
      )}
      <span className="pane-sub">{p.summary}</span>
      {!p.metric && p.view === 'lines' && (
        <button type="button" className="tool-button" onClick={() => p.onSort(p.sort === 'newest' ? 'oldest' : 'newest')}>
          <Icon name="sort" /><span>{p.sort === 'newest' ? 'Newest first' : 'Oldest first'}</span>
        </button>
      )}
    </div>
    {p.pattern && p.view === 'lines' && (
      <p className="chip-bar">
        <span className="chip"><Icon name="patterns" /><span className="chip-text">Pattern: <code>{p.pattern.template}</code></span>
          <button type="button" className="chip-clear" aria-label="Show all lines again" onClick={p.onClearPattern}><Icon name="close" /></button>
        </span>
      </p>
    )}
    {p.pending > 0 && (
      <button type="button" className="live-bar" onClick={p.onFlush}>
        <Icon name="live" /> {plural(p.pending, 'new line')} · Show
      </button>
    )}
  </>
);

// Log stream
interface StreamProps {
  readonly lines: readonly LogLine[];
  readonly sort: SortOrder;
  readonly zone: Zone;
  readonly terms: readonly string[];
  readonly selectedId: number | null;
  readonly pinned: ReadonlySet<number>;
  readonly canWiden: boolean;
  readonly canGoBack: boolean;
  readonly queryText: string;
  readonly onSelect: (line: LogLine, open: boolean) => void;
  readonly onPin: (line: LogLine) => void;
  readonly onClose: () => void;
  readonly onWiden: () => void;
  readonly onBack: () => void;
}

export const LogStream = (p: StreamProps) => {
  const scroller = useRef<HTMLDivElement>(null);
  const [rowH, setRowH] = useState(1);
  const [view, setView] = useState({ top: 0, height: 0 });
  const ordered = p.lines;
  const index = ordered.findIndex((l) => l.id === p.selectedId);

  const measure = useObservedSize<HTMLDivElement>((el) => {
    scroller.current = el;
    setRowH(Math.max(1, cssPx('--row-current', el)));
    setView({ top: el.scrollTop, height: el.clientHeight });
  });

  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [p.lines, p.sort]);

  const reveal = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    if (i * rowH < el.scrollTop) el.scrollTop = i * rowH;
    else if ((i + 1) * rowH > el.scrollTop + el.clientHeight) el.scrollTop = (i + 1) * rowH - el.clientHeight;
  };

  const move = (to: number) => {
    const i = Math.max(0, Math.min(ordered.length - 1, to));
    if (!ordered[i]) return;
    p.onSelect(ordered[i], false);
    reveal(i);
  };

  const page = Math.max(1, Math.floor(view.height / rowH) - 1);
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(index + 1),
      ArrowUp: () => move(index < 0 ? 0 : index - 1),
      PageDown: () => move(index + page),
      PageUp: () => move(index - page),
      Home: () => move(0),
      End: () => move(ordered.length - 1),
      Enter: () => { if (index >= 0) p.onSelect(ordered[index], true); },
      p: () => { if (index >= 0) p.onPin(ordered[index]); },
      Escape: () => p.onClose(),
    };
    const fn = keys[e.key];
    if (fn && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); fn(); }
  };

  const start = Math.max(0, Math.floor(view.top / rowH) - config.overscanRows);
  const end = Math.min(ordered.length, Math.ceil((view.top + view.height) / rowH) + config.overscanRows);

  return (
    <div className="stream-wrap">
      {ordered.length === 0 ? (
        <div className="empty-state">
          <h3>No lines match</h3>
          <p><code>{p.queryText || '(every line)'}</code> found nothing in this range. The query is valid; the time range or a filter is too narrow.</p>
          <div className="empty-actions">
            {p.canWiden && <button type="button" className="text-button" onClick={p.onWiden}>Search the whole capture</button>}
            {p.canGoBack && <button type="button" className="text-button" onClick={p.onBack}><Icon name="back" /> Back to the previous query</button>}
          </div>
        </div>
      ) : (
        <div
          ref={measure}
          className="stream"
          role="listbox"
          tabIndex={0}
          aria-label={`Log lines, ${p.sort} first. Arrow keys move, Enter opens a line, P pins it.`}
          aria-activedescendant={index >= 0 ? `line-${ordered[index].id}` : undefined}
          onKeyDown={onKeyDown}
          onScroll={(e) => setView({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight })}
        >
          <div className="stream-inner" style={{ height: ordered.length * rowH }}>
            {ordered.slice(start, end).map((l, k) => {
              const i = start + k;
              return (
                <div
                  key={l.id}
                  id={`line-${l.id}`}
                  role="option"
                  aria-selected={l.id === p.selectedId}
                  aria-setsize={ordered.length}
                  aria-posinset={i + 1}
                  className="row"
                  data-level={l.labels.level}
                  style={{ transform: `translateY(${i * rowH}px)` }}
                  onClick={() => p.onSelect(l, true)}
                >
                  <time className="row-time" dateTime={formatIso(l.ts)}>{formatClock(l.ts, p.zone)}</time>
                  <LevelTag level={l.labels.level} />
                  <span className="row-service">{l.labels.service}</span>
                  <span className="row-raw"><Marked text={l.raw.slice(0, config.excerptChars)} terms={p.terms} /></span>
                  {p.pinned.has(l.id) && <span className="row-pin" title="Pinned to the open case"><Icon name="pin" /></span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Metric view
interface MetricProps { readonly result: MetricResult; readonly zone: Zone }

const LineChart = ({ result, zone, focus, onFocus }: MetricProps & { focus: string | null; onFocus: (k: string | null) => void }) => {
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const box = useObservedSize<HTMLDivElement>((el) => setW(el.clientWidth));
  const h = cssPx('--chart-height');
  const final = result.steps.length - 1;
  const direct = w >= config.directLabelMinWidth && result.series.some((s) => s.values[final] !== null);
  const m = {
    top: cssPx('--chart-margin-top'),
    right: cssPx(direct ? '--chart-margin-right' : '--chart-margin-right-narrow'),
    bottom: cssPx('--chart-margin-bottom'),
    left: cssPx('--chart-margin-left'),
  };
  const iw = Math.max(0, w - m.left - m.right);
  const ih = h - m.top - m.bottom;
  const x = (zone === 'utc' ? scaleUtc() : scaleTime()).domain([result.steps[0], result.steps[result.steps.length - 1]]).range([0, iw]);
  const yMax = max(result.series.flatMap((s) => s.values.filter((v): v is number => v !== null))) ?? 1;
  const y = scaleLinear().domain([0, yMax]).nice().range([ih, 0]);
  const path = lineShape<number | null>()
    .defined((v) => v !== null)
    .x((_, i) => x(result.steps[i]))
    .y((v) => y(v ?? 0));
  const labelGap = cssPx('--chart-label-gap');
  const stacked = result.series
    .map((s, i) => ({ s, i, last: s.values[final] }))
    .filter((l): l is { s: typeof l.s; i: number; last: number } => l.last !== null)
    .map((l) => ({ ...l, y: y(l.last) }))
    .sort((a, b) => a.y - b.y)
    .reduce<Array<{ s: typeof result.series[number]; i: number; y: number }>>((acc, l) => [...acc, { ...l, y: Math.max(l.y, (acc[acc.length - 1]?.y ?? -Infinity) + labelGap) }], []);
  const overflow = Math.max(0, (stacked[stacked.length - 1]?.y ?? 0) - ih);
  const labels = stacked.map((l) => ({ ...l, y: l.y - overflow }));
  const hovered = hover === null ? null : result.steps[hover];
  return (
    <div className="chart" ref={box} onPointerLeave={() => setHover(null)}>
      {w > 0 && (
        <svg
          width={w}
          height={h}
          aria-hidden="true"
          onPointerMove={(e) => {
            const [mx] = pointer(e);
            const t = +x.invert(mx - m.left);
            const i = bisectCenter(result.steps as number[], t);
            setHover(i >= 0 && i < result.steps.length ? i : null);
          }}
        >
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(4).map((t) => (
              <g key={t} className="grid" transform={`translate(0,${y(t)})`}>
                <line x2={iw} />
                <text x={-cssPx('--gap-cell')}>{formatNumber(t)}</text>
              </g>
            ))}
            {x.ticks(w < config.phoneWidth ? 3 : 6).map((t) => (
              <g key={+t} className="tick" data-edge={edgeOf(x(t), iw)} transform={`translate(${x(t)},${ih})`}>
                <line y2={cssPx('--chart-tick-length')} />
                <text y={m.bottom}>{formatClock(+t, zone, 'm')}</text>
              </g>
            ))}
            {result.series.map((s, i) => (
              <path
                key={s.key}
                className="series-line"
                data-dim={focus !== null && focus !== s.key}
                d={path(s.values as Array<number | null>) ?? ''}
                style={{ stroke: `var(--series-${i + 1})` }}
              />
            ))}
            {direct && labels.map((l) => (
              <text
                key={l.s.key}
                className="series-label"
                data-dim={focus !== null && focus !== l.s.key}
                x={iw + cssPx('--gap-cell')}
                y={l.y}
                style={{ fill: `var(--series-${l.i + 1})` }}
                onPointerEnter={() => onFocus(l.s.key)}
                onPointerLeave={() => onFocus(null)}
              >
                {seriesName(l.s)}
              </text>
            ))}
            {hovered !== null && <line className="crosshair" x1={x(hovered)} x2={x(hovered)} y1={0} y2={ih} />}
          </g>
        </svg>
      )}
      {hover !== null && hovered !== null && (
        <div className="timeline-tip" style={{ left: Math.min(m.left + x(hovered), w - cssPx('--popover-width') / 2) }}>
          <strong>{formatClock(hovered, zone, 's')}</strong>
          {result.series
            .map((s, i) => ({ s, i, v: s.values[hover] }))
            .filter((r) => r.v !== null)
            .sort((a, b) => (b.v ?? 0) - (a.v ?? 0))
            .map((r) => (
              <span key={r.s.key} className="tip-row">
                <span className="swatch" style={{ background: `var(--series-${r.i + 1})` }} />
                {seriesName(r.s)} {formatNumber(r.v ?? 0)}
              </span>
            ))}
        </div>
      )}
    </div>
  );
};

export const MetricView = ({ result, zone }: MetricProps) => {
  const [focus, setFocus] = useState<string | null>(null);
  const summary = useMemo(() => result.series.map((s, i) => {
    const vals = s.values.filter((v): v is number => v !== null);
    const peakIdx = s.values.reduce<number>((best, v, j) => ((v ?? -Infinity) > (s.values[best] ?? -Infinity) ? j : best), 0);
    const last = [...s.values].reverse().find((v) => v !== null) ?? null;
    return { s, i, last, peak: s.values[peakIdx] ?? 0, peakAt: result.steps[peakIdx], mean: vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length) };
  }), [result]);
  const top = summary[0];
  const capped = result.totalSeries > result.series.length;
  return (
    <div className="metric">
      {capped && (
        <p className="notice" data-tone="warning">
          <Icon name="alert" />
          <span>{`The query produced ${formatCount(result.totalSeries)} series. Showing the ${result.series.length} with the highest peaks; the rest are hidden. Group with sum by (…), or pick with topk(…), to compare fewer.`}</span>
        </p>
      )}
      {result.series.length === 0 ? (
        <div className="empty-state">
          <h3>No samples</h3>
          <p>The query is valid, but no lines fell inside its range windows. Widen the time range, the [window], or the selector.</p>
        </div>
      ) : result.instant ? (
        <ul className="stats">
          {summary.map((r) => (
            <li key={r.s.key} className="stat">
              <span className="stat-value">{formatNumber(r.last ?? 0)}</span>
              <code className="stat-label">{seriesName(r.s)}</code>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <LineChart result={result} zone={zone} focus={focus} onFocus={setFocus} />
          <p className="sr-only">
            {`${plural(result.series.length, 'series', 'series')} of ${result.unit}. ${top ? `Highest peak: ${seriesName(top.s)} at ${formatNumber(top.peak)}, ${formatClock(top.peakAt, zone, 's')}.` : ''}`}
          </p>
          <table className="series-table">
            <caption className="sr-only">Series summary</caption>
            <thead>
              <tr><th scope="col">Series</th><th scope="col">Latest</th><th scope="col">Peak</th><th scope="col">Mean</th></tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={r.s.key} data-focus={focus === r.s.key} onPointerEnter={() => setFocus(r.s.key)} onPointerLeave={() => setFocus(null)}>
                  <th scope="row"><span className="series-name"><span className="swatch" style={{ background: `var(--series-${r.i + 1})` }} /><code>{seriesName(r.s)}</code></span></th>
                  <td>{r.last === null ? '—' : formatNumber(r.last)}</td>
                  <td>{formatNumber(r.peak)} <span className="cell-sub">at {formatClock(r.peakAt, zone, 'm')}</span></td>
                  <td>{formatNumber(r.mean)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};


// Patterns
interface PatternProps {
  readonly query: Committed;
  readonly onShowLines: (p: Pattern) => void;
}

const PatternTemplate = ({ template }: { template: string }) => (
  <code className="pattern-template">
    {template.split(/(<(?:ip|num|str|bool|hex|hash|user)>)/).map((part, i) => (i % 2 ? <span key={i} className="placeholder">{part}</span> : part))}
  </code>
);

export const PatternList = ({ query, onShowLines }: PatternProps) => {
  const result = usePatterns(query, true);
  const [rareFirst, setRareFirst] = useState(false);
  return (
    <div className="patterns" data-loading={result.isFetching}>
      <QueryStatus query={result} loading="Grouping lines into patterns…">
        {(r) => {
          const list = rareFirst ? [...r.patterns].reverse() : r.patterns;
          const peak = Math.max(1, ...r.patterns.flatMap((x) => x.sparkline));
          return r.patterns.length === 0 ? <p className="empty-note">No lines match, so there's nothing to group.</p> : (
            <>
              <div className="patterns-tools">
                <span>{`${plural(r.patterns.length, 'pattern')} from ${plural(r.total, 'line')}. Placeholders like `}<span className="placeholder">&lt;ip&gt;</span>{' stand for values that vary.'}</span>
                <button type="button" className="tool-button" aria-pressed={rareFirst} onClick={() => setRareFirst((v) => !v)}>
                  <Icon name="sort" /><span>{rareFirst ? 'Rarest first' : 'Most common first'}</span>
                </button>
              </div>
              <ol className="pattern-list">
                {list.map((x) => (
                  <li key={x.id} className="pattern" data-level={x.level}>
                    <div className="pattern-meta">
                      <span className="pattern-count">{formatCount(x.count)}</span>
                      <span className="pattern-share">{formatShare(x.count, r.total)}</span>
                      <LevelTag level={x.level} />
                      <span className="row-service">{x.service}</span>
                      <Sparkline values={x.sparkline} max={peak} label={`${x.count} lines between ${formatClock(x.first, 'utc', 's')} and ${formatClock(x.last, 'utc', 's')} UTC`} />
                    </div>
                    <PatternTemplate template={x.template} />
                    <button type="button" className="text-button" onClick={() => onShowLines(x)}>Show {x.count === 1 ? 'the line' : `these ${formatCount(x.count)} lines`}</button>
                  </li>
                ))}
              </ol>
            </>
          );
        }}
      </QueryStatus>
    </div>
  );
};

