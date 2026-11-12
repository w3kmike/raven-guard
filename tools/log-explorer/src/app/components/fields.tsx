/// <reference path="../shims.d.ts" />
import {
  useEffect, useEffectEvent, useRef, useState,
} from 'react';
import { brushX, scaleLinear, select, type D3BrushEvent } from 'd3';
import { config, type Zone } from '../config.js';
import type {
  Committed, CompareResult, EntityKind, EntityRef, FieldStat, FieldValue, Lang, TimeRange,
} from '../schemas.js';
import { useBreakdown, useCompare, useDistribution, useFieldStats } from '../api.js';
import {
  cssPx, formatClock, formatCount, formatNumber, formatShare, formatSpan, formatStamp, parseStamp, plural, zoneLabel,
} from '../utils.js';
import {
  Icon, Popover, QueryStatus, useEnter, useObservedSize,
} from './shared.js';
import { EnrichmentBadge, useEnrichmentFor } from './entity.js';

// Field panel
interface FieldActions {
  readonly onFilter: (field: string, value: FieldValue, negate: boolean) => void;
  readonly onRange: (field: string, lo: number, hi: number) => void;
  readonly onPivot: (ref: EntityRef) => void;
  readonly onSplit: (field: string | null) => void;
}

interface FieldPanelProps extends FieldActions {
  readonly query: Committed;
  readonly zone: Zone;
  readonly lang: Lang;
  readonly openField: string | null;
  readonly split: string | null;
  readonly compare: TimeRange | null;
  readonly extent: TimeRange;
  readonly onOpen: (field: string | null) => void;
  readonly onCompare: (focus: TimeRange | null) => void;
}

const entityKindOf = (field: string): EntityKind | null => (
  (Object.entries(config.entityFields) as Array<[EntityKind, readonly string[]]>).find(([, fs]) => fs.includes(field))?.[0] ?? null
);

const FilterButtons = ({ field, value, raw, onFilter }: { field: string; value: string; raw: FieldValue; onFilter: FieldActions['onFilter'] }) => (
  <>
    <button type="button" className="filter-button" aria-label={`Filter for ${field} ${value}`} title={`Filter for ${field} ${value}`} onClick={() => onFilter(field, raw, false)}>=</button>
    <button type="button" className="filter-button" aria-label={`Filter out ${field} ${value}`} title={`Filter out ${field} ${value}`} onClick={() => onFilter(field, raw, true)}>≠</button>
  </>
);

const PivotButton = ({ kind, value, onPivot }: { kind: EntityKind; value: string; onPivot: FieldActions['onPivot'] }) => (
  <button type="button" className="filter-button" aria-label={`Show all activity for ${kind} ${value}`} title="Show all activity for this" onClick={() => onPivot({ kind, value })}>
    <Icon name="pivot" />
  </button>
);

// Top values
const BreakdownTable = ({ query, field, split, onFilter, onPivot, onSplit }: { query: Committed; field: string; split: string | null } & Omit<FieldActions, 'onRange'>) => {
  const result = useBreakdown(query, field);
  const kind = entityKindOf(field);
  const enrich = useEnrichmentFor(kind && result.data ? result.data.rows.map((r) => ({ kind, value: r.value })) : []);
  return (
    <QueryStatus query={result} loading={`Counting ${field} values…`}>
      {(b) => (
        <>
          <table>
            <caption className="sr-only">{`Top values of ${field} in ${plural(b.total, 'matching line')}`}</caption>
            <thead className="sr-only"><tr><th>Value, lines, share</th><th>Actions</th></tr></thead>
            <tbody>
              {b.rows.map((r) => (
                <tr key={r.value}>
                  <th scope="row" className="bd-value" title={r.value}>
                    <span className="bd-text">{r.value === '' ? '(empty)' : r.value}{kind && <EnrichmentBadge info={enrich({ kind, value: r.value })} />}</span>
                    <span className="bd-meta">
                      <span className="bd-bar" aria-hidden="true"><span style={{ width: `${(r.count / Math.max(1, b.total)) * 100}%` }} /></span>
                      <span className="bd-count">{formatCount(r.count)}</span>
                      <span className="bd-share">{formatShare(r.count, b.total)}</span>
                    </span>
                  </th>
                  <td className="bd-actions">
                    {kind && <PivotButton kind={kind} value={r.value} onPivot={onPivot} />}
                    <FilterButtons field={field} value={r.value} raw={r.raw} onFilter={onFilter} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="bd-foot">
            {b.distinct > b.rows.length ? `Top ${b.rows.length} of ${formatCount(b.distinct)} values.` : `${plural(b.distinct, 'value')}.`}
            {b.missing > 0 && ` Missing in ${plural(b.missing, 'line')}.`}
          </p>
          <button type="button" className="text-button" aria-pressed={split === field} onClick={() => onSplit(split === field ? null : field)}>
            {split === field ? 'Stack timeline by level' : `Stack timeline by ${field}`}
          </button>
        </>
      )}
    </QueryStatus>
  );
};

// Numeric distribution
const DistributionView = ({ query, field, onRange }: { query: Committed; field: string; onRange: FieldActions['onRange'] }) => {
  const result = useDistribution(query, field);
  const [w, setW] = useState(0);
  const box = useObservedSize<HTMLDivElement>((el) => setW(el.clientWidth));
  const brushRef = useRef<SVGGElement>(null);
  const d = result.data;
  const h = cssPx('--dist-height');
  const n = d?.bins.length ?? 1;
  const bw = w / Math.max(1, n);
  const y = scaleLinear().domain([0, Math.max(1, ...(d?.bins.map((b) => b.count) ?? [1]))]).range([h, 0]);
  const xOf = (v: number) => {
    if (!d) return 0;
    const i = d.bins.findIndex((b) => v <= b.hi);
    if (i < 0) return w;
    const b = d.bins[i];
    const frac = b.hi > b.lo ? (d.scale === 'log' ? Math.log(Math.max(v, b.lo) / b.lo) / Math.log(b.hi / b.lo) : (v - b.lo) / (b.hi - b.lo)) : 0.5;
    return (i + Math.max(0, Math.min(1, frac))) * bw;
  };
  const pick = useEffectEvent(([a, b]: [number, number]) => {
    if (!d) return;
    const lo = d.bins[Math.max(0, Math.floor(a / bw))]?.lo ?? d.min;
    const hi = d.bins[Math.min(n - 1, Math.ceil(b / bw) - 1)]?.hi ?? d.max;
    onRange(field, Math.floor(lo), Math.ceil(hi));
  });
  useEffect(() => {
    const g = brushRef.current;
    if (!g || !w) return undefined;
    const sel = select(g);
    const brush = brushX<unknown>().extent([[0, 0], [w, h]]).on('end', (ev: D3BrushEvent<unknown>) => {
      if (!ev.selection || !ev.sourceEvent) return;
      sel.call(brush.move, null);
      pick(ev.selection);
    });
    sel.call(brush);
    return () => { sel.on('.brush', null); sel.selectAll('*').remove(); };
  }, [w, h, d]);
  return (
    <div className="distribution" ref={box}>
      <QueryStatus query={result} loading={`Measuring ${field}…`}>
        {(dist) => (dist.count === 0 ? <p className="bd-foot">No numeric values in the matching lines.</p> : (
          <>
            <p className="dist-scale">{dist.scale === 'log' ? 'Log scale: each bar covers a wider range than the one before.' : 'Linear scale.'}</p>
            {w > 0 && (
              <svg width={w} height={h + cssPx('--chart-margin-bottom')} aria-hidden="true">
                {dist.bins.map((b, i) => <rect key={b.lo} className="dist-bar" x={i * bw} y={y(b.count)} width={Math.max(cssPx('--rule'), bw - cssPx('--chart-bar-gap'))} height={h - y(b.count)} />)}
                {([['p50', dist.p50], ['p95', dist.p95], ['p99', dist.p99]] as const)
                  .map(([label, v]) => ({ label, x: xOf(v) }))
                  .reduce<Array<{ label: string; x: number; shown: boolean }>>((acc, m) => {
                    const lastShown = [...acc].reverse().find((a) => a.shown);
                    return [...acc, { ...m, shown: !lastShown || m.x - lastShown.x >= cssPx('--axis-edge-room') }];
                  }, [])
                  .map((m) => (
                    <g key={m.label} className="dist-marker" transform={`translate(${m.x},0)`}>
                      <line y2={h} />
                      {m.shown && <text y={h + cssPx('--chart-margin-bottom') - cssPx('--gap-hair')}>{m.label}</text>}
                    </g>
                  ))}
                <line className="baseline" x1={0} x2={w} y1={h} y2={h} />
                <g ref={brushRef} className="brush" />
              </svg>
            )}
            <dl className="dist-stats">
              <div><dt>p50</dt><dd>{formatNumber(dist.p50)}</dd></div>
              <div><dt>p95</dt><dd>{formatNumber(dist.p95)}</dd></div>
              <div><dt>p99</dt><dd>{formatNumber(dist.p99)}</dd></div>
              <div><dt>max</dt><dd>{formatNumber(dist.max)}</dd></div>
            </dl>
            <div className="dist-actions">
              <button type="button" className="text-button" onClick={() => onRange(field, Math.floor(dist.p95), Math.ceil(dist.max))}>Filter to p95 and above</button>
              <button type="button" className="text-button" onClick={() => onRange(field, Math.floor(dist.p99), Math.ceil(dist.max))}>p99 and above</button>
            </div>
            <p className="bd-foot">{`${plural(dist.count, 'value')}${dist.missing ? `, missing in ${plural(dist.missing, 'line')}` : ''}. Drag across the bars to filter a range.`}</p>
          </>
        ))}
      </QueryStatus>
    </div>
  );
};

// Compare mode
const CompareRows = ({ field, result, onFilter }: { field: CompareResult['fields'][number]; result: CompareResult; onFilter: FieldActions['onFilter'] }) => (
  <table className="lift">
    <caption className="sr-only">{`How often each ${field.name} value appears in the window compared with the time around it`}</caption>
    <thead className="sr-only"><tr><th>Value</th><th>Window vs around it</th><th>Actions</th></tr></thead>
    <tbody>
      {field.values.map((v) => {
        const diff = v.focusShare - v.baseShare;
        return (
          <tr key={v.value} data-direction={diff >= 0 ? 'up' : 'down'}>
            <th scope="row" className="bd-text" title={v.value}>{v.value === '' ? '(empty)' : v.value}</th>
            <td className="lift-cell">
              <span className="lift-track" aria-hidden="true">
                <span className="lift-bar" style={{ width: `${Math.abs(diff) * 50}%`, [diff >= 0 ? 'left' : 'right']: '50%' }} />
              </span>
              <span className="lift-label">{formatShare(v.focusCount, result.focusTotal)} vs {formatShare(v.baseCount, result.baseTotal)}</span>
            </td>
            <td className="bd-actions"><FilterButtons field={field.name} value={v.value} raw={v.raw} onFilter={onFilter} /></td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

const CompareForm = ({ zone, extent, onCompare, close }: { zone: Zone; extent: TimeRange; onCompare: (r: TimeRange) => void; close: () => void }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      className="range-custom"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const a = parseStamp(from, zone);
        const b = parseStamp(to, zone);
        if (a === null || b === null) { setError(`Use the format ${formatStamp(extent.from, zone)}.`); return; }
        if (a >= b) { setError('The window must start before it ends.'); return; }
        if (a < extent.from || b > extent.to) { setError('Pick a window inside the captured time.'); return; }
        onCompare({ from: a, to: b });
        close();
      }}
    >
      <p className="range-note">Compare a window with the same length of time before and after it.</p>
      <label><span>Window starts</span><input value={from} placeholder={formatStamp(extent.from, zone)} onChange={(e) => { setFrom(e.target.value); setError(''); }} /></label>
      <label><span>Window ends</span><input value={to} placeholder={formatStamp(extent.to, zone)} onChange={(e) => { setTo(e.target.value); setError(''); }} /></label>
      <p className="field-error" role="alert">{error}</p>
      <button type="submit" className="primary-button">Compare</button>
    </form>
  );
};

const CompareList = ({ query, focus, zone, onFilter, onCompare }: { query: Committed; focus: TimeRange; zone: Zone; onFilter: FieldActions['onFilter']; onCompare: (f: TimeRange | null) => void }) => {
  const result = useCompare(query, focus);
  const ref = useRef<HTMLDivElement>(null);
  useEnter(ref, []);
  return (
    <div ref={ref} className="compare">
      <div className="compare-head">
        <p>
          <strong>{formatClock(focus.from, zone, 's')}–{formatClock(focus.to, zone, 's')} {zoneLabel(zone)}</strong>
          {` against the ${formatSpan(focus.to - focus.from)} before and after. Fields are ranked by how much they changed.`}
        </p>
        <button type="button" className="text-button" onClick={() => onCompare(null)}>Stop comparing</button>
      </div>
      <QueryStatus query={result} loading="Comparing the window with the time around it…">
        {(c) => (c.fields.length === 0 ? <p className="empty-note">Nothing differs enough to rank. Try a wider window.</p> : (
          <ol className="compare-list">
            <li className="compare-totals">{`${plural(c.focusTotal, 'line')} in the window, ${plural(c.baseTotal, 'line')} around it.`}</li>
            {c.fields.map((f) => (
              <li key={f.name}>
                <h3 className="compare-field"><span className="field-name">{f.name}</span><span className="field-cover">±{Math.round(f.score * 100)} pts</span></h3>
                <CompareRows field={f} result={c} onFilter={onFilter} />
              </li>
            ))}
          </ol>
        ))}
      </QueryStatus>
    </div>
  );
};

// The panel
const FieldRow = ({ s, total, open, lang, onOpen }: { s: FieldStat; total: number; open: boolean; lang: Lang; onOpen: (f: string | null) => void }) => (
  <button type="button" className="field-row" aria-expanded={open} onClick={() => onOpen(open ? null : s.name)}>
    <Icon name="chevron" />
    <span className="field-name">{s.name}</span>
    {s.isLabel && <span className="stream-badge" title={lang === 'logql' ? 'Usable in the {…} stream selector' : 'A LogQL stream label'}>stream</span>}
    {s.type === 'number' && !s.isLabel && <span className="type-badge" title="Numeric: shows a distribution">123</span>}
    <span className="field-cover">{formatShare(s.count, total)}</span>
  </button>
);

export const FieldPanel = (p: FieldPanelProps) => {
  const stats = useFieldStats(p.query);
  return (
    <div className="fields" data-loading={stats.isFetching}>
      <div className="pane-head">
        <h2 className="caps">Fields</h2>
        <span className="pane-sub">{stats.data ? `from ${plural(stats.data.total, 'matching line')}` : ''}</span>
        {!p.compare && (
          <Popover label="Compare a window" triggerClass="tool-button" trigger={<><Icon name="compare" /><span>Compare</span></>}>
            {(close) => <CompareForm zone={p.zone} extent={p.extent} onCompare={p.onCompare} close={close} />}
          </Popover>
        )}
      </div>
      {p.compare ? (
        <CompareList query={p.query} focus={p.compare} zone={p.zone} onFilter={p.onFilter} onCompare={p.onCompare} />
      ) : (
        <QueryStatus query={stats} loading="Listing fields…">
          {(data) => (data.total === 0 ? (
            <p className="empty-note">No lines match, so there are no fields to break down. Widen the time range or loosen the query.</p>
          ) : (
            <ul className="field-list">
              {data.fields.map((s) => (
                <li key={s.name} className="field-item" data-open={p.openField === s.name}>
                  <FieldRow s={s} total={data.total} open={p.openField === s.name} lang={p.lang} onOpen={p.onOpen} />
                  {p.openField === s.name && (
                    <div className="breakdown">
                      {s.type === 'number' && !s.isLabel
                        ? <DistributionView query={p.query} field={s.name} onRange={p.onRange} />
                        : <BreakdownTable query={p.query} field={s.name} split={p.split} onFilter={p.onFilter} onPivot={p.onPivot} onSplit={p.onSplit} />}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ))}
        </QueryStatus>
      )}
    </div>
  );
};
