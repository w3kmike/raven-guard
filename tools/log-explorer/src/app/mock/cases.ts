import { config } from '../config.js';
import {
  arrayOf, caseCheck,
  type Case, type CaseEvent, type CasePatch, type CaseSummary, type EntityRef, type Evidence,
} from '../schemas.js';
import type { CaseDraft, CaseEventDraft, CaseStore } from '../api.js';
import { formatClock } from '../utils.js';
import { readStored, respond, writeStored, type Backend } from './backend.js';

// Case store: seeded from data/cases.json, kept in memory and local storage
const summary = (c: Case): CaseSummary => ({
  id: c.id, title: c.title, severity: c.severity, status: c.status, owner: c.owner, updatedAt: c.updatedAt, evidenceCount: c.evidence.length,
});

const sameRef = (a: EntityRef, b: EntityRef) => a.kind === b.kind && a.value === b.value;

export const createCaseStore = (ready: () => Promise<Backend>): CaseStore => {
  const holder: { cases: Case[] | null } = { cases: null };

  const all = async (): Promise<Case[]> => {
    if (holder.cases) return holder.cases;
    const b = await ready();
    const stored = readStored('cases', arrayOf(caseCheck));
    holder.cases = stored ?? b.seedCases.map((r) => ({
      ...r,
      evidence: r.evidence.flatMap((e) => {
        const line = b.store.lines[e.lineId];
        return line ? [{ ...e, line }] : [];
      }),
    }));
    return holder.cases;
  };

  const find = async (id: string) => {
    const c = (await all()).find((x) => x.id === id);
    if (!c) throw new Error(`Case ${id} doesn't exist. It may have been deleted, or the link is from another workspace.`);
    return c;
  };

  const event = (draft: CaseEventDraft): CaseEvent => ({
    ...draft, id: `ev-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`, at: Date.now(), actor: config.mock.analyst,
  });

  const change = async (id: string, fn: (c: Case) => Case): Promise<Case> => {
    const current = await find(id);
    const next = { ...fn(current), updatedAt: Date.now() };
    holder.cases = (await all()).map((c) => (c.id === id ? next : c));
    writeStored('cases', holder.cases);
    return next;
  };

  const withEvent = (c: Case, draft: CaseEventDraft): Case => ({ ...c, events: [...c.events, event(draft)] });

  return {
    list: (signal) => respond(signal, () => undefined).then(async () => (await all()).map(summary).sort((a, b) => b.updatedAt - a.updatedAt)),
    get: (id, signal) => respond(signal, () => undefined).then(() => find(id)),
    create: (draft: CaseDraft) => respond(undefined, () => undefined).then(async () => {
      const created: Case = withEvent({
        id: `case-${Date.now().toString(36)}`, title: draft.title, severity: draft.severity, status: 'open', owner: draft.owner,
        createdAt: Date.now(), updatedAt: Date.now(), evidence: [], entities: [], events: [],
      }, { kind: 'created', text: 'Opened this case.', query: null });
      holder.cases = [created, ...(await all())];
      writeStored('cases', holder.cases);
      return created;
    }),
    update: (id, patch: CasePatch) => respond(undefined, () => undefined).then(() => change(id, (c) => {
      const notes: CaseEventDraft[] = [
        ...(patch.status && patch.status !== c.status ? [{ kind: 'status' as const, text: `Status: ${c.status} → ${patch.status}.`, query: null }] : []),
        ...(patch.severity && patch.severity !== c.severity ? [{ kind: 'severity' as const, text: `Severity: ${c.severity} → ${patch.severity}.`, query: null }] : []),
      ];
      return notes.reduce(withEvent, { ...c, ...patch });
    })),
    pin: (id, e: Omit<Evidence, 'pinnedAt' | 'pinnedBy'>) => respond(undefined, () => undefined).then(() => change(id, (c) => (
      c.evidence.some((x) => x.line.id === e.line.id) ? c : withEvent(
        { ...c, evidence: [...c.evidence, { ...e, pinnedAt: Date.now(), pinnedBy: config.mock.analyst }].sort((a, b) => a.line.ts - b.line.ts) },
        { kind: 'pinned', text: `Pinned a ${e.line.labels.level} line from ${e.line.labels.service} at ${formatClock(e.line.ts, 'utc')} UTC.`, query: { lang: e.lang, text: e.query, range: e.range } },
      )
    ))),
    unpin: (id, lineId) => respond(undefined, () => undefined).then(() => change(id, (c) => {
      const gone = c.evidence.find((x) => x.line.id === lineId);
      return gone ? withEvent({ ...c, evidence: c.evidence.filter((x) => x !== gone) }, { kind: 'unpinned', text: `Removed the ${formatClock(gone.line.ts, 'utc')} UTC line from evidence.`, query: null }) : c;
    })),
    note: (id, lineId, note) => respond(undefined, () => undefined).then(() => change(id, (c) => ({
      ...c, evidence: c.evidence.map((x) => (x.line.id === lineId ? { ...x, note } : x)),
    }))),
    addEntity: (id, ref) => respond(undefined, () => undefined).then(() => change(id, (c) => (
      c.entities.some((x) => sameRef(x, ref)) ? c : withEvent({ ...c, entities: [...c.entities, ref] }, { kind: 'entity', text: `Added ${ref.kind} ${ref.value}.`, query: null })
    ))),
    addEvent: (id, draft) => respond(undefined, () => undefined).then(() => change(id, (c) => withEvent(c, draft))),
  };
};
