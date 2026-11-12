/// <reference path="../shims.d.ts" />
import { useEffect, useRef, useState } from 'react';
import { config, type Zone } from '../config.js';
import type {
  Case, CaseStatus, Committed, EntityRef, Evidence, LogLine, Severity,
} from '../schemas.js';
import { useCase, useCaseMutations, useCases } from '../api.js';
import {
  formatClock, formatDate, formatIso, plural, zoneLabel,
} from '../utils.js';
import {
  Icon, LangTag, LevelTag, Popover, QueryStatus, SeverityTag, copyText, langName, useEnter,
} from './shared.js';
import { EnrichmentBadge, useEnrichmentFor } from './entity.js';

// Case vocabulary
const severities: readonly Severity[] = ['low', 'medium', 'high', 'critical'];
const statuses: readonly CaseStatus[] = ['open', 'investigating', 'contained', 'closed'];
const eventIcon = {
  created: 'case', query: 'lines', pinned: 'pin', unpinned: 'close', comment: 'exchange', status: 'retry', severity: 'alert', entity: 'pivot', alert: 'bell', note: 'copy',
} as const;

export const caseText = (c: Case) => [
  `# ${c.title}`,
  `Severity: ${c.severity} · Status: ${c.status} · Owner: ${c.owner}`,
  '',
  '## Evidence',
  ...c.evidence.map((e) => [
    `- ${formatIso(e.line.ts)} ${e.line.labels.service} · ${e.line.labels.host} ${e.line.labels.level}`,
    `  ${e.line.raw}`,
    `  Found with ${langName[e.lang]}: ${e.query || '(every line)'} [${formatIso(e.range.from)} – ${formatIso(e.range.to)}]`,
    ...(e.note ? [`  Note: ${e.note}`] : []),
  ].join('\n')),
  '',
  '## Entities',
  ...c.entities.map((r) => `- ${r.kind}: ${r.value}`),
  '',
  '## Activity',
  ...c.events.map((ev) => `- ${formatIso(ev.at)} ${ev.actor}: ${ev.text}${ev.query ? ` (${langName[ev.query.lang]}: ${ev.query.text || '(every line)'})` : ''}`),
].join('\n');

// New case
const NewCaseForm = ({ onCreate, close, busy }: { onCreate: (title: string, severity: Severity) => void; close: () => void; busy: boolean }) => {
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  return (
    <form
      className="range-custom"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onCreate(title.trim(), severity);
        close();
      }}
    >
      <label><span>What are you investigating?</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Payout to an unfamiliar beneficiary" required /></label>
      <label>
        <span>Severity</span>
        <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
          {severities.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <button type="submit" className="primary-button" disabled={busy || !title.trim()}>Open case</button>
    </form>
  );
};

// Evidence
const Exhibit = ({ e, zone, fresh, onOpen, onRemove, onNote }: {
  e: Evidence; zone: Zone; fresh: boolean; onOpen: (q: Committed, line: LogLine) => void; onRemove: (lineId: number) => void; onNote: (lineId: number, note: string) => void;
}) => {
  const ref = useRef<HTMLElement>(null);
  const [note, setNote] = useState(e.note);
  useEnter(ref, [], 'slide', fresh);
  useEffect(() => { setNote(e.note); }, [e.note]);
  const when = `${formatClock(e.line.ts, zone)} ${zoneLabel(zone)}`;
  return (
    <article ref={ref} className="exhibit" aria-label={`Evidence line at ${when}`}>
      <div className="exhibit-meta">
        <time dateTime={formatIso(e.line.ts)}>{when}</time>
        <LevelTag level={e.line.labels.level} />
        <span>{e.line.labels.service}</span>
        <span className="exhibit-by">pinned by {e.pinnedBy}</span>
      </div>
      <p className="exhibit-raw">{e.line.raw}</p>
      <p className="exhibit-source">
        <LangTag lang={e.lang} />
        <code>{e.query || '(every line)'}</code>
        <span>{formatClock(e.range.from, zone, 'm')}–{formatClock(e.range.to, zone, 'm')}</span>
      </p>
      <label className="exhibit-note">
        <span className="sr-only">Note for the line at {when}</span>
        <textarea rows={2} value={note} placeholder="Why this line matters" onChange={(ev) => setNote(ev.target.value)} onBlur={() => { if (note !== e.note) onNote(e.line.id, note); }} />
      </label>
      <div className="exhibit-actions">
        <button type="button" className="text-button" onClick={() => onOpen({ lang: e.lang, text: e.query, range: e.range }, e.line)}>Open the query that found it</button>
        <button type="button" className="text-button" onClick={() => onRemove(e.line.id)}>Remove</button>
      </div>
    </article>
  );
};

const Entities = ({ refs, onPivot }: { refs: readonly EntityRef[]; onPivot: (r: EntityRef) => void }) => {
  const enrich = useEnrichmentFor(refs);
  return refs.length ? (
    <ul className="entity-chips">
      {refs.map((r) => (
        <li key={`${r.kind}:${r.value}`}>
          <button type="button" className="chip" onClick={() => onPivot(r)} aria-label={`Show all activity for ${r.kind} ${r.value}`}>
            <span className="chip-kind">{r.kind}</span>
            <span className="chip-text">{r.value}</span>
            <EnrichmentBadge info={enrich(r)} />
          </button>
        </li>
      ))}
    </ul>
  ) : <p className="case-hint">Add IPs, users, or beneficiaries from their activity view.</p>;
};

// Case panel
interface CaseProps {
  readonly caseId: string | null;
  readonly zone: Zone;
  readonly onCase: (id: string | null) => void;
  readonly onOpenQuery: (q: Committed, line: LogLine | null) => void;
  readonly onPivot: (r: EntityRef) => void;
  readonly onAnnounce: (message: string) => void;
}

const CaseBody = ({ c, zone, onOpenQuery, onPivot, onAnnounce }: { c: Case } & Omit<CaseProps, 'caseId' | 'onCase'>) => {
  const m = useCaseMutations(c.id);
  const [title, setTitle] = useState(c.title);
  const [comment, setComment] = useState('');
  const [fallback, setFallback] = useState<string | null>(null);
  const seen = useRef(new Set(c.evidence.map((e) => e.line.id)));
  useEffect(() => { c.evidence.forEach((e) => seen.current.add(e.line.id)); }, [c.evidence]);
  useEffect(() => { setTitle(c.title); }, [c.title]);
  const failed = (e: Error) => onAnnounce(`Couldn't save the case: ${e.message}`);
  const exportCase = async () => {
    const text = caseText(c);
    if (await copyText(text)) { setFallback(null); onAnnounce('Copied the case as Markdown.'); } else setFallback(text);
  };
  return (
    <>
      <div className="case-head">
        <label className="case-title">
          <span className="sr-only">Case title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => { if (title.trim() && title !== c.title) m.update.mutate({ title: title.trim() }, { onError: failed }); }} />
        </label>
        <div className="case-fields">
          <label>
            <span>Severity</span>
            <select value={c.severity} onChange={(e) => m.update.mutate({ severity: e.target.value as Severity }, { onError: failed })}>
              {severities.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={c.status} onChange={(e) => m.update.mutate({ status: e.target.value as CaseStatus }, { onError: failed })}>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <span className="case-owner">Owner <strong>{c.owner}</strong></span>
          <SeverityTag severity={c.severity} />
        </div>
      </div>

      <section className="case-section" aria-labelledby="case-evidence">
        <div className="case-section-head">
          <h3 id="case-evidence" className="caps">{`Evidence · ${c.evidence.length}`}</h3>
          <button type="button" className="tool-button" onClick={exportCase}><Icon name="copy" /><span>Copy case</span></button>
        </div>
        {fallback !== null && (
          <label className="copy-fallback">
            <span>The browser blocked the clipboard. Select this text and copy it.</span>
            <textarea readOnly value={fallback} onFocus={(e) => e.target.select()} />
          </label>
        )}
        {c.evidence.length === 0 ? (
          <p className="case-hint">Pin a line with P or its Pin button. Each pin keeps the query, language, and range that found it.</p>
        ) : (
          <div className="exhibits">
            {c.evidence.map((e) => (
              <Exhibit
                key={e.line.id}
                e={e}
                zone={zone}
                fresh={!seen.current.has(e.line.id)}
                onOpen={onOpenQuery}
                onRemove={(id) => m.unpin.mutate(id, { onError: failed })}
                onNote={(id, note) => m.note.mutate({ lineId: id, note }, { onError: failed })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="case-section" aria-labelledby="case-entities">
        <h3 id="case-entities" className="caps">Entities</h3>
        <Entities refs={c.entities} onPivot={onPivot} />
      </section>

      <section className="case-section" aria-labelledby="case-activity">
        <h3 id="case-activity" className="caps">Activity</h3>
        <ol className="case-events">
          {[...c.events].reverse().map((ev) => (
            <li key={ev.id} data-kind={ev.kind}>
              <Icon name={eventIcon[ev.kind]} />
              <div>
                <p><strong>{ev.actor}</strong> {ev.text}</p>
                {ev.query && (
                  <button type="button" className="event-query" onClick={() => onOpenQuery(ev.query as Committed, null)} title="Run this query again">
                    <LangTag lang={ev.query.lang} /><code>{ev.query.text || '(every line)'}</code>
                  </button>
                )}
                <time dateTime={formatIso(ev.at)}>{formatDate(ev.at, zone)} {formatClock(ev.at, zone, 's')}</time>
              </div>
            </li>
          ))}
        </ol>
        <form
          className="comment-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!comment.trim()) return;
            m.addEvent.mutate({ kind: 'comment', text: comment.trim(), query: null }, { onSuccess: () => setComment(''), onError: failed });
          }}
        >
          <label>
            <span className="sr-only">Comment</span>
            <textarea rows={2} value={comment} placeholder="Leave a note for whoever picks this up" onChange={(e) => setComment(e.target.value)} />
          </label>
          <button type="submit" className="primary-button" disabled={!comment.trim() || m.addEvent.isPending}>Comment</button>
        </form>
      </section>
    </>
  );
};

export const CasePanel = ({ caseId, zone, onCase, onOpenQuery, onPivot, onAnnounce }: CaseProps) => {
  const list = useCases();
  const current = useCase(caseId);
  const create = useCaseMutations(null).create;
  return (
    <div className="case">
      <div className="pane-head">
        <h2 className="caps">Case</h2>
        <label className="case-pick">
          <span className="sr-only">Open case</span>
          <select value={caseId ?? ''} onChange={(e) => onCase(e.target.value || null)} disabled={!list.data?.length}>
            {!caseId && <option value="">No case open</option>}
            {list.data?.map((c) => <option key={c.id} value={c.id}>{`${c.title} · ${c.status}`}</option>)}
          </select>
        </label>
        <Popover label="Open a new case" triggerClass="tool-button" trigger={<><Icon name="plus" /><span>New</span></>}>
          {(close) => (
            <NewCaseForm
              busy={create.isPending}
              close={close}
              onCreate={(title, severity) => create.mutate({ title, severity, owner: config.mock.analyst }, {
                onSuccess: (c) => { onCase(c.id); onAnnounce(`Opened case "${c.title}".`); },
                onError: (e) => onAnnounce(`Couldn't open the case: ${e.message}`),
              })}
            />
          )}
        </Popover>
      </div>
      {caseId === null ? (
        <p className="empty-note">No case is open. Open one to collect evidence, entities, and the queries that found them, so a teammate can pick it up.</p>
      ) : (
        <QueryStatus query={current} loading="Opening the case…">
          {(c) => <CaseBody c={c} zone={zone} onOpenQuery={onOpenQuery} onPivot={onPivot} onAnnounce={onAnnounce} />}
        </QueryStatus>
      )}
      {list.data && <p className="sr-only">{plural(list.data.length, 'case')} available.</p>}
    </div>
  );
};
