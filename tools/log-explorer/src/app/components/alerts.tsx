/// <reference path="../shims.d.ts" />
import { useEffect, useRef, useState } from 'react';
import { line as lineShape, scaleLinear } from 'd3';
import { config, type Zone } from '../config.js';
import type {
  Alert, AlertSnapshot, Committed, Comparison, Lang, Rule, RuleDraft, RuleState, Severity, TimeRange,
} from '../schemas.js';
import { parseQuery } from '../query/index.js';
import { useRuleMutations, useRules } from '../api.js';
import {
  cssPx, formatClock, formatNumber, formatSpan, plural, zoneLabel,
} from '../utils.js';
import {
  Icon, LangTag, QueryStatus, SeverityTag, useObservedSize,
} from './shared.js';

// Rule vocabulary
const opWords: Readonly<Record<Comparison, string>> = { '>': 'above', '>=': 'at or above', '<': 'below', '<=': 'at or below' };
const isMetric = (lang: Lang, query: string) => {
  const parsed = parseQuery(lang, query);
  return parsed.ok && parsed.metric;
};
export const ruleSentence = (r: Pick<Rule, 'lang' | 'query' | 'op' | 'threshold' | 'window'>) => (
  isMetric(r.lang, r.query)
    ? `Fires when any series is ${opWords[r.op]} ${formatNumber(r.threshold)}.`
    : `Fires when matching lines in ${r.window} are ${opWords[r.op]} ${formatNumber(r.threshold)}.`
);
const stateWords: Readonly<Record<RuleState['state'], string>> = { firing: 'Firing', ok: 'Quiet', error: 'Error', disabled: 'Off' };

// Rule history with its threshold
const RuleSpark = ({ state, rule }: { state: RuleState; rule: Rule }) => {
  const [w, setW] = useState(0);
  const box = useObservedSize<HTMLDivElement>((el) => setW(el.clientWidth));
  const h = cssPx('--rule-spark-height');
  const values = state.history.map((p) => p.v);
  const top = Math.max(rule.threshold, ...values.map((v) => v ?? 0)) * 1.1 || 1;
  const y = scaleLinear().domain([0, top]).range([h, 0]);
  const step = w / Math.max(1, values.length - 1);
  const path = lineShape<number | null>().defined((v) => v !== null).x((_, i) => i * step).y((v) => y(v ?? 0))(values) ?? '';
  return (
    <div className="rule-spark" ref={box}>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label={`Last ${formatSpan(state.history.length * config.ruleEvalStepMs)}: latest ${state.value === null ? 'no data' : formatNumber(state.value)} against a threshold of ${formatNumber(rule.threshold)}`}>
          <line className="rule-threshold" x1={0} x2={w} y1={y(rule.threshold)} y2={y(rule.threshold)} />
          <path className="rule-line" d={path} />
        </svg>
      )}
    </div>
  );
};

// Rule editor
interface RuleFormProps {
  readonly initial: RuleDraft;
  readonly ruleId: string | null;
  readonly onDone: (message: string) => void;
  readonly onCancel: () => void;
}

const RuleForm = ({ initial, ruleId, onDone, onCancel }: RuleFormProps) => {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const { save } = useRuleMutations();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { ref.current?.querySelector('input')?.focus(); }, []);
  const metric = isMetric(draft.lang, draft.query);
  const set = <K extends keyof RuleDraft>(k: K, v: RuleDraft[K]) => { setDraft((d) => ({ ...d, [k]: v })); setError(''); };
  return (
    <form
      ref={ref}
      className="rule-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.name.trim()) { setError('Give the rule a name your teammates will recognize in an alert.'); return; }
        if (!Number.isFinite(draft.threshold)) { setError('The threshold needs to be a number.'); return; }
        save.mutate({ draft: { ...draft, name: draft.name.trim() }, ruleId }, {
          onSuccess: (r) => onDone(`Saved rule "${r.name}".`),
          onError: (err) => setError(err.message),
        });
      }}
    >
      <label><span>Name</span><input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Payout to a new beneficiary" /></label>
      <p className="rule-query"><LangTag lang={draft.lang} /><code>{draft.query || '(every line)'}</code></p>
      <div className="rule-row">
        <label>
          <span>{metric ? 'When any series is' : 'When matching lines are'}</span>
          <select value={draft.op} onChange={(e) => set('op', e.target.value as Comparison)}>
            {(['>', '>=', '<', '<='] as const).map((o) => <option key={o} value={o}>{opWords[o]}</option>)}
          </select>
        </label>
        <label><span>Threshold</span><input inputMode="decimal" value={String(draft.threshold)} onChange={(e) => set('threshold', Number(e.target.value))} /></label>
        {!metric && (
          <label>
            <span>Within</span>
            <select value={draft.window} onChange={(e) => set('window', e.target.value)}>
              {['1m', '5m', '15m', '1h'].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
        )}
        <label>
          <span>Severity</span>
          <select value={draft.severity} onChange={(e) => set('severity', e.target.value as Severity)}>
            {(['low', 'medium', 'high', 'critical'] as const).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <p className="rule-preview">{ruleSentence(draft)}</p>
      <p className="field-error" role="alert">{error}</p>
      <div className="translate-actions">
        <button type="submit" className="primary-button" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save rule'}</button>
        <button type="button" className="text-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};

// Panel
interface AlertsProps {
  readonly snapshot: AlertSnapshot | undefined;
  readonly zone: Zone;
  readonly current: Committed;
  readonly extent: TimeRange;
  readonly onInvestigate: (q: Committed) => void;
  readonly onAddToCase: (a: Alert) => void;
  readonly onClose: () => void;
  readonly onAnnounce: (message: string) => void;
}

const RuleCard = ({ rule, state, onEdit, onInvestigate, onAnnounce }: { rule: Rule; state: RuleState | undefined; onEdit: () => void; onInvestigate: () => void; onAnnounce: (m: string) => void }) => {
  const { save, remove } = useRuleMutations();
  const [confirm, setConfirm] = useState(false);
  const s = state?.state ?? 'ok';
  return (
    <li className="rule" data-state={s}>
      <div className="rule-head">
        <span className="rule-state">{stateWords[s]}</span>
        <h3>{rule.name}</h3>
        <SeverityTag severity={rule.severity} />
      </div>
      <p className="rule-query"><LangTag lang={rule.lang} /><code>{rule.query}</code></p>
      <p className="rule-sentence">{ruleSentence(rule)}{state?.value !== null && state?.value !== undefined ? ` Now ${formatNumber(state.value)}.` : ''}</p>
      {state?.error && <p className="status" data-tone="error"><Icon name="alert" />{state.error}</p>}
      {state && state.history.length > 1 && <RuleSpark state={state} rule={rule} />}
      <div className="rule-actions">
        <button type="button" className="text-button" onClick={onInvestigate}>Investigate</button>
        <button type="button" className="text-button" onClick={onEdit}>Edit</button>
        <button
          type="button"
          className="text-button"
          onClick={() => save.mutate({ draft: { ...rule, enabled: !rule.enabled }, ruleId: rule.id }, { onSuccess: () => onAnnounce(`${rule.enabled ? 'Turned off' : 'Turned on'} "${rule.name}".`) })}
        >
          {rule.enabled ? 'Turn off' : 'Turn on'}
        </button>
        {confirm ? (
          <span className="confirm">
            Delete this rule?
            <button type="button" className="text-button danger" onClick={() => remove.mutate(rule.id, { onSuccess: () => onAnnounce(`Deleted "${rule.name}".`) })}>Delete</button>
            <button type="button" className="text-button" onClick={() => setConfirm(false)}>Keep</button>
          </span>
        ) : <button type="button" className="text-button" onClick={() => setConfirm(true)}>Delete</button>}
      </div>
    </li>
  );
};

export const AlertsPanel = ({
  snapshot, zone, current, extent, onInvestigate, onAddToCase, onClose, onAnnounce,
}: AlertsProps) => {
  const rules = useRules();
  const [editing, setEditing] = useState<{ draft: RuleDraft; id: string | null } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const around = (from: number, to: number): TimeRange => ({
    from: Math.max(extent.from, from - 15 * 60000), to: Math.min(extent.to, to + 15 * 60000),
  });
  const newDraft: RuleDraft = {
    name: '', lang: current.lang, query: current.text, op: '>', threshold: 0, window: '5m', severity: 'medium', enabled: true, createdBy: config.mock.analyst,
  };
  const stateOf = (id: string) => snapshot?.states.find((s) => s.ruleId === id);
  const ruleOf = (id: string) => rules.data?.find((r) => r.id === id);
  return (
    <div className="alerts" role="region" aria-labelledby="alerts-heading" onKeyDown={(e) => { if (e.key === 'Escape' && !editing) onClose(); }}>
      <header className="detail-head">
        <h2 id="alerts-heading" ref={heading} tabIndex={-1}>Alerts</h2>
        <div className="detail-actions">
          <button type="button" className="icon-button" aria-label="Close alerts" onClick={onClose}><Icon name="close" /></button>
        </div>
      </header>
      <p className="alerts-clock">{snapshot ? `Evaluated every minute up to ${formatClock(snapshot.now, zone, 'm')} ${zoneLabel(zone)}.` : 'Evaluating rules…'}</p>

      {editing ? (
        <section className="case-section" aria-label={editing.id ? 'Edit rule' : 'New rule'}>
          <RuleForm initial={editing.draft} ruleId={editing.id} onCancel={() => setEditing(null)} onDone={(m) => { setEditing(null); onAnnounce(m); }} />
        </section>
      ) : (
        <button type="button" className="tool-button new-rule" onClick={() => setEditing({ draft: newDraft, id: null })}>
          <Icon name="plus" /> Save the current query as a rule
        </button>
      )}

      <section className="case-section" aria-labelledby="rules-heading">
        <h3 id="rules-heading" className="caps">Rules</h3>
        <QueryStatus query={rules} loading="Loading rules…">
          {(list) => (list.length === 0 ? <p className="case-hint">No rules yet. Save a query as a rule to be alerted when it crosses a threshold.</p> : (
            <ul className="rule-list">
              {list.map((r) => (
                <RuleCard
                  key={r.id}
                  rule={r}
                  state={stateOf(r.id)}
                  onAnnounce={onAnnounce}
                  onEdit={() => setEditing({ draft: r, id: r.id })}
                  onInvestigate={() => {
                    const latest = snapshot?.alerts.find((a) => a.ruleId === r.id);
                    onInvestigate({ lang: r.lang, text: r.query, range: latest ? around(latest.startsAt, latest.endsAt ?? extent.to) : extent });
                  }}
                />
              ))}
            </ul>
          ))}
        </QueryStatus>
      </section>

      <section className="case-section" aria-labelledby="history-heading">
        <h3 id="history-heading" className="caps">{snapshot ? `History · ${plural(snapshot.alerts.length, 'alert')}` : 'History'}</h3>
        {snapshot && snapshot.alerts.length === 0 && <p className="case-hint">Nothing has fired in the captured time.</p>}
        <ol className="alert-list">
          {snapshot?.alerts.map((a) => {
            const labels = Object.entries(a.labels).map(([k, v]) => `${k}=${v}`).join(', ');
            const rule = ruleOf(a.ruleId);
            return (
              <li key={a.id} className="alert-item" data-firing={a.endsAt === null}>
                <div className="alert-head">
                  <SeverityTag severity={a.severity} />
                  <strong>{a.ruleName}</strong>
                  {labels && <code>{labels}</code>}
                </div>
                <p className="alert-when">
                  {a.endsAt === null
                    ? `Firing since ${formatClock(a.startsAt, zone, 'm')} ${zoneLabel(zone)}`
                    : `${formatClock(a.startsAt, zone, 'm')}–${formatClock(a.endsAt, zone, 'm')} ${zoneLabel(zone)} · ${formatSpan(a.endsAt - a.startsAt)}`}
                  {` · peak ${formatNumber(a.peak)}`}
                </p>
                <div className="rule-actions">
                  {rule && <button type="button" className="text-button" onClick={() => onInvestigate({ lang: rule.lang, text: rule.query, range: around(a.startsAt, a.endsAt ?? extent.to) })}>Investigate</button>}
                  <button type="button" className="text-button" onClick={() => onAddToCase(a)}>Add to case</button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
};
