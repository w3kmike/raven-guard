/// <reference path="../shims.d.ts" />
import {
  useEffect, useEffectEvent, useRef, useState, type ReactNode,
} from 'react';
import {
  brushX, max, pointer, scaleLinear, scaleTime, scaleUtc, select, type D3BrushEvent,
} from 'd3';
import { config, type Zone } from '../config.js';
import {
  NONE_KEY, OTHER_KEY, type Committed, type FieldStat, type Histogram, type TimeRange,
} from '../schemas.js';
import { useVolume } from '../api.js';
import {
  cssPx, formatClock, formatCount, formatSpan, plural, zoneLabel,
} from '../utils.js';
import {
  Icon, QueryStatus, edgeOf, useEnter, useObservedSize,
} from './shared.js';

// Timeline
interface TimelineProps {
  readonly query: Committed;
  readonly extent: TimeRange;
  readonly zone: Zone;
  readonly split: string | null;
  readonly splitOptions: readonly FieldStat[];
  readonly compare: TimeRange | null;
  readonly onSplit: (field: string | null) => void;
  readonly onZoom: (range: TimeRange) => void;
  readonly onCompare: (focus: TimeRange) => void;
  readonly onZoomOut: () => void;
}

const keyColor = (key: string, keys: readonly string[], split: string | null) => {
  if (!split) return `var(--level-${key})`;
  if (key === OTHER_KEY) return 'var(--series-8)';
  if (key === NONE_KEY) return 'var(--level-unknown)';
  return `var(--series-${keys.indexOf(key) + 1})`;
};

const BrushChoice = ({ focus, zone, left, onZoom, onCompare, onCancel }: {
  focus: TimeRange; zone: Zone; left: number; onZoom: () => void; onCompare: () => void; onCancel: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEnter(ref, []);
  useEffect(() => { ref.current?.querySelector('button')?.focus(); }, []);
  return (
    <div ref={ref} className="brush-choice" role="dialog" aria-label="Use the selected time" style={{ left }} onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}>
      <strong>{formatClock(focus.from, zone, 's')}–{formatClock(focus.to, zone, 's')}</strong>
      <button type="button" className="tool-button" onClick={onZoom}><Icon name="zoomOut" /> Zoom to this</button>
      <button type="button" className="tool-button" onClick={onCompare}><Icon name="compare" /> Compare with the time around it</button>
      <button type="button" className="icon-button" aria-label="Cancel" onClick={onCancel}><Icon name="close" /></button>
    </div>
  );
};

const Plot = ({ hist, range, zone, split, compare, w, h, axis, onPick }: {
  hist: Histogram; range: TimeRange; zone: Zone; split: string | null; compare: TimeRange | null; w: number; h: number; axis: number; onPick: (focus: TimeRange) => void;
}) => {
  const brushRef = useRef<SVGGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const x = (zone === 'utc' ? scaleUtc() : scaleTime()).domain([range.from, range.to]).range([0, w]);
  const y = scaleLinear().domain([0, Math.max(1, max(hist.buckets, (b) => b.total) ?? 0)]).range([h, 0]);
  const gap = cssPx('--chart-bar-gap');

  const pick = useEffectEvent(([a, b]: [number, number]) => {
    const from = Math.max(range.from, Math.floor(+x.invert(a) / hist.step) * hist.step);
    const to = Math.min(range.to, Math.ceil(+x.invert(b) / hist.step) * hist.step);
    if (to - from >= hist.step) onPick({ from, to });
  });

  useEffect(() => {
    const g = brushRef.current;
    if (!g || w === 0) return undefined;
    const sel = select(g);
    const brush = brushX<unknown>()
      .extent([[0, 0], [w, h]])
      .on('end', (ev: D3BrushEvent<unknown>) => {
        if (!ev.selection || !ev.sourceEvent) return;
        sel.call(brush.move, null);
        pick(ev.selection);
      });
    sel.call(brush);
    return () => { sel.on('.brush', null); sel.selectAll('*').remove(); };
  }, [w, h]);

  const hovered = hover === null ? null : hist.buckets[hover] ?? null;
  return (
    <>
      <svg
        width={w}
        height={h + axis}
        aria-hidden="true"
        onPointerMove={(e) => {
          const [mx] = pointer(e);
          const i = Math.floor((+x.invert(mx) - (hist.buckets[0]?.start ?? 0)) / hist.step);
          setHover(i >= 0 && i < hist.buckets.length ? i : null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        {compare && <rect className="focus-band" x={x(compare.from)} y={0} width={Math.max(0, x(compare.to) - x(compare.from))} height={h} />}
        {hist.gaps.map((g) => (
          <g key={g.from} className="gap">
            <rect x={x(g.from)} y={0} width={Math.max(0, x(g.to) - x(g.from))} height={h} />
            {x(g.to) - x(g.from) > cssPx('--gap-label-min') && (
              <text x={(x(g.from) + x(g.to)) / 2} y={cssPx('--gap-row')}>no lines · {formatSpan(g.to - g.from)}</text>
            )}
          </g>
        ))}
        {hist.buckets.map((b, i) => {
          const bx = x(b.start);
          const bw = Math.max(gap, x(b.start + hist.step) - bx - gap);
          const stacked = hist.keys.reduce<{ top: number; rects: ReactNode[] }>((acc, k) => {
            const v = b.counts[k] ?? 0;
            if (!v) return acc;
            const top = acc.top + v;
            return { top, rects: [...acc.rects, <rect key={k} x={bx} width={bw} y={y(top)} height={Math.max(0, y(acc.top) - y(top))} style={{ fill: keyColor(k, hist.keys, split) }} />] };
          }, { top: 0, rects: [] });
          return <g key={b.start} className={hover === i ? 'bucket is-hover' : 'bucket'}>{stacked.rects}</g>;
        })}
        <line className="baseline" x1={0} x2={w} y1={h} y2={h} />
        {hist.total === 0 && <text className="plot-empty" x={w / 2} y={h / 2}>No matching lines in this range</text>}
        {x.ticks(w < config.phoneWidth ? 4 : 8).map((t) => (
          <g key={+t} className="tick" data-edge={edgeOf(x(t), w)} transform={`translate(${x(t)},${h})`}>
            <line y2={cssPx('--chart-tick-length')} />
            <text y={axis}>{formatClock(+t, zone, 'm')}</text>
          </g>
        ))}
        <g ref={brushRef} className="brush" />
      </svg>
      {hovered && (
        <div className="timeline-tip" style={{ left: Math.min(x(hovered.start), w - cssPx('--popover-width') / 2) }}>
          <strong>{formatClock(hovered.start, zone, 's')}–{formatClock(hovered.start + hist.step, zone, 's')}</strong>
          <span>{plural(hovered.total, 'line')}</span>
          {hist.keys.filter((k) => hovered.counts[k]).map((k) => (
            <span key={k} className="tip-row"><span className="swatch" style={{ background: keyColor(k, hist.keys, split) }} />{k} {formatCount(hovered.counts[k])}</span>
          ))}
        </div>
      )}
    </>
  );
};

export const Timeline = ({
  query, extent, zone, split, splitOptions, compare, onSplit, onZoom, onCompare, onZoomOut,
}: TimelineProps) => {
  const [size, setSize] = useState({ w: 0, h: 0, axis: 0 });
  const [choice, setChoice] = useState<TimeRange | null>(null);
  const box = useObservedSize<HTMLDivElement>((el) => setSize({ w: el.clientWidth, h: cssPx('--hist-height', el), axis: cssPx('--chart-margin-bottom', el) }));
  const target = size.w < config.phoneWidth ? config.histogramTargetBucketsPhone : config.histogramTargetBuckets;
  const volume = useVolume(query, { target, split });
  const hist = volume.data;
  const range = query.range;
  const peak = hist?.buckets.reduce<Histogram['buckets'][number] | null>((best, b) => (!best || b.total > best.total ? b : best), null) ?? null;
  const peakKey = peak && hist ? hist.keys.reduce((a, k) => ((peak.counts[k] ?? 0) > (peak.counts[a] ?? 0) ? k : a), hist.keys[0]) : '';
  const isWhole = range.from <= extent.from && range.to >= extent.to;
  const choiceLeft = choice && size.w ? Math.min(size.w - cssPx('--popover-width'), Math.max(0, ((choice.from - range.from) / (range.to - range.from)) * size.w)) : 0;

  return (
    <section className="timeline" aria-labelledby="timeline-heading" data-loading={volume.isFetching}>
      <div className="timeline-head">
        <h2 id="timeline-heading" className="caps">Lines over time</h2>
        {hist && <span className="timeline-step">{formatSpan(hist.step)} buckets · tallest {formatCount(peak?.total ?? 0)}</span>}
        <ul className="legend" aria-label={split ? `Stacked by ${split}` : 'Stacked by level'}>
          {hist?.keys.map((k) => (
            <li key={k}>
              <span className="swatch" style={{ background: keyColor(k, hist.keys, split) }} />
              {split || k !== 'unknown' ? k : 'none'}
            </li>
          ))}
        </ul>
        <label className="split-pick">
          <span className="tool-label">Stack by</span>
          <select value={split ?? ''} onChange={(e) => onSplit(e.target.value || null)}>
            <option value="">level</option>
            {splitOptions.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
          </select>
        </label>
        <button type="button" className="tool-button" onClick={onZoomOut} disabled={isWhole}>
          <Icon name="zoomOut" /><span className="tool-label">Zoom out</span>
        </button>
      </div>
      <div className="timeline-plot" ref={box}>
        {size.w > 0 && (
          <QueryStatus query={volume} loading="Counting lines over time…">
            {(h) => <Plot hist={h} range={range} zone={zone} split={split} compare={compare} w={size.w} h={size.h} axis={size.axis} onPick={setChoice} />}
          </QueryStatus>
        )}
        {choice && (
          <BrushChoice
            focus={choice}
            zone={zone}
            left={choiceLeft}
            onZoom={() => { onZoom(choice); setChoice(null); }}
            onCompare={() => { onCompare(choice); setChoice(null); }}
            onCancel={() => setChoice(null)}
          />
        )}
      </div>
      {hist && (
        <p className="sr-only">
          {`${plural(hist.total, 'line')} from ${formatClock(range.from, zone, 'm')} to ${formatClock(range.to, zone, 'm')} ${zoneLabel(zone)}.`}
          {peak && peak.total > 0 ? ` Busiest ${formatSpan(hist.step)} starts at ${formatClock(peak.start, zone, 's')} with ${plural(peak.total, 'line')}, mostly ${peakKey}.` : ''}
          {hist.gaps.map((g) => ` No lines from ${formatClock(g.from, zone, 's')} to ${formatClock(g.to, zone, 's')}.`).join('')}
          {' Drag across the chart, or use the time range control, to zoom or compare a window.'}
        </p>
      )}
    </section>
  );
};
