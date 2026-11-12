/// <reference path="../shims.d.ts" />
import { useEffect, useRef } from 'react';
import { config, type Zone } from '../config.js';
import type {
  EntityKind, EntityRef, FieldValue, LogLine,
} from '../schemas.js';
import { useContextLines } from '../api.js';
import type { Selection } from '../state.js';
import {
  formatClock, formatDate, formatIso, zoneLabel,
} from '../utils.js';
import { Icon, LevelTag, QueryStatus } from './shared.js';
import { EnrichmentBadge, useEnrichmentFor } from './entity.js';

// Line detail
interface DetailProps {
  readonly selection: Selection | null;
  readonly open: boolean;
  readonly zone: Zone;
  readonly pinned: boolean;
  readonly caseTitle: string | null;
  readonly onPin: (line: LogLine) => void;
  readonly onFilter: (field: string, value: FieldValue, negate: boolean, line: LogLine) => void;
  readonly onPivot: (ref: EntityRef) => void;
  readonly onSelect: (line: LogLine) => void;
  readonly onClose: () => void;
}

const entityKindOf = (field: string): EntityKind | null => (
  (Object.entries(config.entityFields) as Array<[EntityKind, readonly string[]]>).find(([, fs]) => fs.includes(field))?.[0] ?? null
);

const FieldTable = ({ caption, entries, line, onFilter, onPivot }: {
  caption: string; entries: ReadonlyArray<readonly [string, FieldValue]>; line: LogLine; onFilter: DetailProps['onFilter']; onPivot: DetailProps['onPivot'];
}) => {
  const refs = entries.flatMap(([k, v]) => {
    const kind = entityKindOf(k);
    return kind ? [{ kind, value: String(v) }] : [];
  });
  const enrich = useEnrichmentFor(refs);
  return (
    <table className="kv">
      <caption className="caps">{caption}</caption>
      <tbody>
        {entries.map(([k, v]) => {
          const kind = entityKindOf(k);
          return (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td><span className="kv-value">{String(v)}</span>{kind && <EnrichmentBadge info={enrich({ kind, value: String(v) })} />}</td>
              <td className="kv-actions">
                {kind && (
                  <button type="button" className="filter-button" aria-label={`Show all activity for ${k} ${String(v)}`} title="Show all activity for this" onClick={() => onPivot({ kind, value: String(v) })}>
                    <Icon name="pivot" />
                  </button>
                )}
                <button type="button" className="filter-button" aria-label={`Filter for ${k} ${String(v)}`} title={`Filter for ${k}`} onClick={() => onFilter(k, v, false, line)}>=</button>
                <button type="button" className="filter-button" aria-label={`Filter out ${k} ${String(v)}`} title={`Filter out ${k}`} onClick={() => onFilter(k, v, true, line)}>≠</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export const LineDetail = ({
  selection, open, zone, pinned, caseTitle, onPin, onFilter, onPivot, onSelect, onClose,
}: DetailProps) => {
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const context = useContextLines(selection?.id ?? null);
  const line = selection?.line ?? context.data?.find((l) => l.id === selection?.id) ?? null;
  useEffect(() => {
    const sheet = root.current?.parentElement;
    if (open && line && sheet && getComputedStyle(sheet).position === 'fixed') heading.current?.focus();
  }, [open, line]);
  if (!selection) {
    return (
      <div className="detail" ref={root}>
        <p className="empty-note">Select a line to see its labels, parsed fields, raw text, and the lines around it from the same stream.</p>
      </div>
    );
  }
  if (!line) {
    return (
      <div className="detail" ref={root}>
        <QueryStatus query={context} loading="Loading the line…">
          {() => <p className="empty-note">That line isn&apos;t in this capture anymore.</p>}
        </QueryStatus>
      </div>
    );
  }
  const fields = Object.entries(line.fields).filter(([k]) => k !== 'level');
  const host = line.labels.host;
  return (
    <div className="detail" ref={root} role="region" aria-labelledby="detail-heading" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <header className="detail-head">
        <h2 id="detail-heading" ref={heading} tabIndex={-1}>
          <time dateTime={formatIso(line.ts)}>{formatDate(line.ts, zone)} {formatClock(line.ts, zone)}</time>
          <span className="detail-zone">{zoneLabel(zone)}</span>
        </h2>
        <div className="detail-meta">
          <LevelTag level={line.labels.level} />
          <span>{line.labels.service}</span>
          <span className="detail-host">{host}</span>
        </div>
        <div className="detail-actions">
          <button type="button" className="tool-button" aria-pressed={pinned} onClick={() => onPin(line)} title={caseTitle ? `Pin to ${caseTitle}` : 'Pin to a new case'}>
            <Icon name="pin" /><span>{pinned ? 'Pinned' : 'Pin to case'}</span>
          </button>
          <button type="button" className="icon-button detail-close" aria-label="Close line" onClick={onClose}><Icon name="close" /></button>
        </div>
      </header>
      <FieldTable caption="Stream labels" entries={Object.entries(line.labels)} line={line} onFilter={onFilter} onPivot={onPivot} />
      {fields.length ? (
        <FieldTable caption={`Parsed fields · ${line.format}`} entries={fields} line={line} onFilter={onFilter} onPivot={onPivot} />
      ) : (
        <p className="empty-note">This line is unstructured text, so no fields were parsed. Search its words with a bare term in Lucene or a |= line filter in LogQL.</p>
      )}
      <section className="detail-raw" aria-label="Raw line">
        <h3 className="caps">Raw</h3>
        <pre>{line.raw}</pre>
      </section>
      <section className="detail-context" aria-labelledby="context-heading">
        <h3 id="context-heading" className="caps">Same stream · {host}</h3>
        <QueryStatus query={context} loading="Loading nearby lines…">
          {(lines) => (
            <ol>
              {lines.map((c) => (
                <li key={c.id} aria-current={c.id === line.id ? 'true' : undefined}>
                  <button type="button" onClick={() => onSelect(c)} disabled={c.id === line.id}>
                    <time dateTime={formatIso(c.ts)}>{formatClock(c.ts, zone)}</time>
                    <span className="context-raw">{c.raw}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </QueryStatus>
      </section>
    </div>
  );
};
