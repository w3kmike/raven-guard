/// <reference path="../shims.d.ts" />
import { useState } from 'react';
import { scaleUtc } from 'd3';
import type { Zone } from '../config.js';
import type {
  EntityInfo, EntityRef, LogLine, TimeRange,
} from '../schemas.js';
import { entityKey, useEnrichment, useEntity } from '../api.js';
import {
  cssPx, formatClock, formatDate, formatIso, plural, zoneLabel,
} from '../utils.js';
import {
  Icon, LevelTag, QueryStatus, edgeOf, useObservedSize,
} from './shared.js';

// Enrichment
const kindName: Readonly<Record<EntityRef['kind'], string>> = {
  ip: 'IP address', user: 'User', host: 'Host', beneficiary: 'Payout beneficiary', request: 'Request',
};

const badgeOf = (info: EntityInfo | undefined): { text: string; tone: string } | null => {
  if (!info) return null;
  if (info.kind === 'ip') return info.info.reputation === 'benign' || info.info.reputation === 'internal' ? null : { text: info.info.reputation, tone: info.info.reputation };
  if (info.kind === 'user') {
    if (info.info.status === 'nonexistent') return { text: 'no such user', tone: 'suspicious' };
    return info.info.mfa === 'enrolled' ? null : { text: info.info.mfa === 'legacy-exempt' ? 'MFA exempt' : 'no MFA', tone: 'suspicious' };
  }
  if (info.kind === 'beneficiary') return { text: `new · ${info.info.country}`, tone: 'suspicious' };
  return null;
};

export const EnrichmentBadge = ({ info }: { info: EntityInfo | undefined }) => {
  const badge = badgeOf(info);
  return badge ? <span className="enrich-badge" data-tone={badge.tone}>{badge.text}</span> : null;
};

export const useEnrichmentFor = (refs: readonly EntityRef[]) => {
  const result = useEnrichment(refs);
  return (ref: EntityRef) => result.data?.[entityKey(ref)];
};

const Facts = ({ info }: { info: EntityInfo | undefined }) => {
  if (!info || info.kind === 'none') return <p className="entity-none">No enrichment on record.</p>;
  const rows: Array<[string, string]> = info.kind === 'ip'
    ? [['Reputation', info.info.reputation], ['Network', info.info.asn ? `AS${info.info.asn} · ${info.info.asOrg}` : info.info.asOrg], ['Country', info.info.country], ['Tags', info.info.tags.join(', ') || '—']]
    : info.kind === 'user'
      ? [['Name', info.info.displayName], ['Department', info.info.department], ['MFA', info.info.mfa.replace('-', ' ')], ['Account', info.info.status === 'nonexistent' ? 'does not exist' : `${info.info.status}, created ${formatDate(info.info.created, 'utc')}`]]
      : info.kind === 'host'
        ? [['Role', info.info.role], ['Team', info.info.team], ['OS', info.info.os]]
        : [['Country', info.info.country], ['Added', `${formatDate(info.info.created, 'utc')} ${formatClock(info.info.created, 'utc', 's')} UTC`], ['Added by', info.info.addedBy]];
  return (
    <dl className="facts">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
};

// Activity strip: one row per service on a shared time axis
const Strip = ({ services, extent, zone }: { services: ReadonlyArray<{ service: string; count: number; times: readonly number[] }>; extent: TimeRange; zone: Zone }) => {
  const [w, setW] = useState(0);
  const box = useObservedSize<HTMLDivElement>((el) => setW(el.clientWidth));
  const row = cssPx('--strip-row');
  const label = cssPx('--strip-label');
  const x = scaleUtc().domain([extent.from, extent.to]).range([label, Math.max(label, w)]);
  return (
    <div className="strip" ref={box}>
      {w > 0 && (
        <svg width={w} height={services.length * row + cssPx('--chart-margin-bottom')} aria-hidden="true">
          {services.map((s, i) => (
            <g key={s.service} transform={`translate(0,${i * row})`}>
              <text className="strip-name" y={row / 2}>{s.service}</text>
              <line className="strip-rule" x1={label} x2={w} y1={row / 2} y2={row / 2} />
              {s.times.map((t) => <line key={t} className="strip-tick" x1={x(t)} x2={x(t)} y1={row * 0.2} y2={row * 0.8} />)}
            </g>
          ))}
          {x.ticks(4).map((t) => (
            <text key={+t} className="strip-axis" data-edge={edgeOf(x(t) - label, w - label)} x={x(t)} y={services.length * row + cssPx('--chart-margin-bottom') - cssPx('--gap-hair')}>{formatClock(+t, zone, 'm')}</text>
          ))}
        </svg>
      )}
    </div>
  );
};

// Entity view
interface EntityProps {
  readonly entity: EntityRef | null;
  readonly zone: Zone;
  readonly extent: TimeRange;
  readonly onSearch: (ref: EntityRef) => void;
  readonly onAddToCase: (ref: EntityRef) => void;
  readonly onSelect: (line: LogLine) => void;
  readonly onClose: () => void;
}

export const EntityView = ({ entity, zone, extent, onSearch, onAddToCase, onSelect, onClose }: EntityProps) => {
  const activity = useEntity(entity);
  const info = useEnrichmentFor(entity ? [entity] : []);
  if (!entity) {
    return <p className="empty-note">Choose the arrow next to an IP, user, host, or beneficiary to see everything it did across every service.</p>;
  }
  return (
    <div className="entity" role="region" aria-labelledby="entity-heading" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <header className="detail-head">
        <h2 id="entity-heading" tabIndex={-1}>
          <span className="entity-kind">{kindName[entity.kind]}</span>
          <span className="entity-value">{entity.value}</span>
        </h2>
        <div className="detail-actions">
          <button type="button" className="icon-button detail-close" aria-label="Close entity" onClick={onClose}><Icon name="close" /></button>
        </div>
      </header>
      <section className="entity-section" aria-label="Enrichment">
        <Facts info={info(entity)} />
      </section>
      <div className="entity-actions">
        <button type="button" className="tool-button" onClick={() => onSearch(entity)}><Icon name="lines" /> Search for it</button>
        <button type="button" className="tool-button" onClick={() => onAddToCase(entity)}><Icon name="case" /> Add to case</button>
      </div>
      <QueryStatus query={activity} loading={`Gathering activity for ${entity.value}…`}>
        {(a) => (a.total === 0 ? <p className="empty-note">{`${entity.value} doesn't appear in anything captured.`}</p> : (
          <>
            <section className="entity-section" aria-labelledby="entity-activity">
              <h3 id="entity-activity" className="caps">Activity across services</h3>
              <p className="entity-summary">
                {`${plural(a.total, 'line')} in ${plural(a.services.length, 'service')}, ${formatClock(a.first ?? 0, zone, 's')} to ${formatClock(a.last ?? 0, zone, 's')} ${zoneLabel(zone)}.`}
              </p>
              <Strip services={a.services} extent={extent} zone={zone} />
              <ul className="sr-only">
                {a.services.map((s) => <li key={s.service}>{`${s.service}: ${plural(s.count, 'line')}, ${formatClock(s.times[0], zone, 's')} to ${formatClock(s.times[s.times.length - 1], zone, 's')}`}</li>)}
              </ul>
            </section>
            <section className="entity-section" aria-labelledby="entity-lines">
              <h3 id="entity-lines" className="caps">{a.lines.length < a.total ? `Latest ${a.lines.length} lines` : 'Lines'}</h3>
              <ol className="entity-lines">
                {a.lines.slice(0, 60).map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => onSelect(l)}>
                      <time dateTime={formatIso(l.ts)}>{formatClock(l.ts, zone)}</time>
                      <LevelTag level={l.labels.level} />
                      <span className="entity-service">{l.labels.service}</span>
                      <span className="context-raw">{l.raw}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          </>
        ))}
      </QueryStatus>
    </div>
  );
};
