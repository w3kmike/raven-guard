/// <reference path="./shims.d.ts" />
import { createContext, use, useEffect, useEffectEvent } from 'react';
import {
  keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient,
} from '@tanstack/react-query';
import { config, type SourceId } from './config.js';
import type {
  AlertSnapshot, Breakdown, Case, CaseEvent, CasePatch, CaseSummary, Catalog, Committed, CompareResult,
  Distribution, EntityActivity, EntityInfo, EntityRef, Evidence, FieldStats, Histogram, LogLine,
  PatternResult, Rule, RuleDraft, RunResult, Severity, SortOrder, TimeRange,
} from './schemas.js';
import { createMockServices } from './mock/index.js';

// Ports: the UI depends only on these; a production adapter implements the same shapes
export interface SearchParams { readonly sort: SortOrder; readonly patternId: string | null }
export interface VolumeParams { readonly target: number; readonly split: string | null }
export interface TailBatch { readonly lines: readonly LogLine[]; readonly now: number; readonly exhausted: boolean }

export interface LogSource {
  catalog(signal: AbortSignal): Promise<Catalog>;
  search(q: Committed, params: SearchParams, signal: AbortSignal): Promise<RunResult>;
  volume(q: Committed, params: VolumeParams, signal: AbortSignal): Promise<Histogram>;
  fields(q: Committed, signal: AbortSignal): Promise<FieldStats>;
  breakdown(q: Committed, field: string, signal: AbortSignal): Promise<Breakdown>;
  distribution(q: Committed, field: string, signal: AbortSignal): Promise<Distribution>;
  compare(q: Committed, focus: TimeRange, signal: AbortSignal): Promise<CompareResult>;
  patterns(q: Committed, signal: AbortSignal): Promise<PatternResult>;
  context(lineId: number, signal: AbortSignal): Promise<readonly LogLine[]>;
  entity(ref: EntityRef, signal: AbortSignal): Promise<EntityActivity>;
  tail(q: Committed, onBatch: (batch: TailBatch) => void, onError: (error: Error) => void): () => void;
}

export interface Enrichment {
  lookup(refs: readonly EntityRef[], signal: AbortSignal): Promise<Readonly<Record<string, EntityInfo>>>;
}

export interface RuleStore {
  list(signal: AbortSignal): Promise<readonly Rule[]>;
  save(draft: RuleDraft, id: string | null): Promise<Rule>;
  remove(id: string): Promise<void>;
}

export interface AlertFeed {
  subscribe(onSnapshot: (snapshot: AlertSnapshot) => void, onError: (error: Error) => void): () => void;
}

export type CaseEventDraft = Pick<CaseEvent, 'kind' | 'text' | 'query'>;
export interface CaseDraft { readonly title: string; readonly severity: Severity; readonly owner: string }

export interface CaseStore {
  list(signal: AbortSignal): Promise<readonly CaseSummary[]>;
  get(id: string, signal: AbortSignal): Promise<Case>;
  create(draft: CaseDraft): Promise<Case>;
  update(id: string, patch: CasePatch): Promise<Case>;
  pin(id: string, evidence: Omit<Evidence, 'pinnedAt' | 'pinnedBy'>): Promise<Case>;
  unpin(id: string, lineId: number): Promise<Case>;
  note(id: string, lineId: number, note: string): Promise<Case>;
  addEntity(id: string, ref: EntityRef): Promise<Case>;
  addEvent(id: string, event: CaseEventDraft): Promise<Case>;
}

export interface Services {
  readonly id: SourceId;
  readonly source: LogSource;
  readonly enrichment: Enrichment;
  readonly rules: RuleStore;
  readonly alerts: AlertFeed;
  readonly cases: CaseStore;
}

// Composition root: swap an adapter here to go to production
export const createServices = (id: SourceId, client: QueryClient): Services => {
  const adapters: Readonly<Partial<Record<SourceId, () => Omit<Services, 'id'>>>> = {
    mock: () => createMockServices(client),
  };
  const make = adapters[id];
  if (!make) throw new Error(`No adapter is registered for ${id}. Add one in app/api.ts.`);
  return { ...make(), id };
};

export const ServicesContext = createContext<Services | null>(null);

export const useServices = (): Services => {
  const services = use(ServicesContext);
  if (!services) throw new Error('useServices needs a ServicesContext above it.');
  return services;
};

// Query keys
export const entityKey = (ref: EntityRef) => `${ref.kind}:${ref.value}`;
const keys = {
  catalog: (s: SourceId) => [s, 'catalog'] as const,
  search: (s: SourceId, q: Committed, p: SearchParams) => [s, 'search', q, p] as const,
  volume: (s: SourceId, q: Committed, p: VolumeParams) => [s, 'volume', q, p] as const,
  fields: (s: SourceId, q: Committed) => [s, 'fields', q] as const,
  breakdown: (s: SourceId, q: Committed, field: string) => [s, 'breakdown', q, field] as const,
  distribution: (s: SourceId, q: Committed, field: string) => [s, 'distribution', q, field] as const,
  compare: (s: SourceId, q: Committed, focus: TimeRange | null) => [s, 'compare', q, focus] as const,
  patterns: (s: SourceId, q: Committed) => [s, 'patterns', q] as const,
  context: (s: SourceId, id: number) => [s, 'context', id] as const,
  entity: (s: SourceId, ref: EntityRef | null) => [s, 'entity', ref] as const,
  enrichment: (s: SourceId, refs: readonly string[]) => [s, 'enrichment', refs] as const,
  rules: (s: SourceId) => [s, 'rules'] as const,
  alerts: (s: SourceId) => [s, 'alerts'] as const,
  cases: (s: SourceId) => [s, 'cases'] as const,
  case: (s: SourceId, id: string | null) => [s, 'case', id] as const,
};

// Reads
export const useCatalog = () => {
  const { id, source } = useServices();
  return useQuery({ queryKey: keys.catalog(id), queryFn: ({ signal }) => source.catalog(signal), staleTime: config.staleMs });
};

export const useSearch = (q: Committed, params: SearchParams) => {
  const { id, source } = useServices();
  return useQuery({ queryKey: keys.search(id, q, params), queryFn: ({ signal }) => source.search(q, params, signal), placeholderData: keepPreviousData, staleTime: config.staleMs, retry: false });
};

export const useVolume = (q: Committed, params: VolumeParams) => {
  const { id, source } = useServices();
  return useQuery({ queryKey: keys.volume(id, q, params), queryFn: ({ signal }) => source.volume(q, params, signal), placeholderData: keepPreviousData, staleTime: config.staleMs, retry: false });
};

export const useFieldStats = (q: Committed) => {
  const { id, source } = useServices();
  return useQuery({ queryKey: keys.fields(id, q), queryFn: ({ signal }) => source.fields(q, signal), placeholderData: keepPreviousData, staleTime: config.staleMs, retry: false });
};

export const useBreakdown = (q: Committed, field: string) => {
  const { id, source } = useServices();
  return useQuery({ queryKey: keys.breakdown(id, q, field), queryFn: ({ signal }) => source.breakdown(q, field, signal), staleTime: config.staleMs, retry: false });
};

export const useDistribution = (q: Committed, field: string) => {
  const { id, source } = useServices();
  return useQuery({ queryKey: keys.distribution(id, q, field), queryFn: ({ signal }) => source.distribution(q, field, signal), staleTime: config.staleMs, retry: false });
};

export const useCompare = (q: Committed, focus: TimeRange | null) => {
  const { id, source } = useServices();
  return useQuery({
    queryKey: keys.compare(id, q, focus),
    queryFn: ({ signal }) => (focus ? source.compare(q, focus, signal) : Promise.reject(new Error('No comparison window.'))),
    enabled: focus !== null,
    staleTime: config.staleMs,
    retry: false,
  });
};

export const usePatterns = (q: Committed, enabled: boolean) => {
  const { id, source } = useServices();
  return useQuery({ queryKey: keys.patterns(id, q), queryFn: ({ signal }) => source.patterns(q, signal), enabled, placeholderData: keepPreviousData, staleTime: config.staleMs, retry: false });
};

export const useContextLines = (lineId: number | null) => {
  const { id, source } = useServices();
  return useQuery({ queryKey: keys.context(id, lineId ?? -1), queryFn: ({ signal }) => source.context(lineId ?? -1, signal), enabled: lineId !== null, staleTime: config.staleMs });
};

export const useEntity = (ref: EntityRef | null) => {
  const { id, source } = useServices();
  return useQuery({
    queryKey: keys.entity(id, ref),
    queryFn: ({ signal }) => (ref ? source.entity(ref, signal) : Promise.reject(new Error('No entity selected.'))),
    enabled: ref !== null,
    staleTime: config.staleMs,
  });
};

export const useEnrichment = (refs: readonly EntityRef[]) => {
  const { id, enrichment } = useServices();
  const ids = [...new Set(refs.map(entityKey))].sort();
  return useQuery({
    queryKey: keys.enrichment(id, ids),
    queryFn: ({ signal }) => enrichment.lookup(refs, signal),
    enabled: ids.length > 0,
    staleTime: Infinity,
  });
};

export const useRules = () => {
  const { id, rules } = useServices();
  return useQuery({ queryKey: keys.rules(id), queryFn: ({ signal }) => rules.list(signal), staleTime: config.staleMs });
};

export const useAlertSnapshot = () => {
  const { id } = useServices();
  return useQuery<AlertSnapshot>({ queryKey: keys.alerts(id), queryFn: () => new Promise<AlertSnapshot>(() => undefined), staleTime: Infinity, enabled: false });
};

export const useCases = () => {
  const { id, cases } = useServices();
  return useQuery({ queryKey: keys.cases(id), queryFn: ({ signal }) => cases.list(signal), staleTime: config.staleMs });
};

export const useCase = (caseId: string | null) => {
  const { id, cases } = useServices();
  return useQuery({
    queryKey: keys.case(id, caseId),
    queryFn: ({ signal }) => (caseId ? cases.get(caseId, signal) : Promise.reject(new Error('No case selected.'))),
    enabled: caseId !== null,
    staleTime: config.staleMs,
  });
};

// Subscriptions (push into the query cache)
export const useAlertSubscription = (onSnapshot: (s: AlertSnapshot) => void, onError: (e: Error) => void) => {
  const { id, alerts } = useServices();
  const client = useQueryClient();
  const push = useEffectEvent((s: AlertSnapshot) => {
    client.setQueryData(keys.alerts(id), s);
    onSnapshot(s);
  });
  const fail = useEffectEvent((e: Error) => onError(e));
  useEffect(() => alerts.subscribe((s) => push(s), (e) => fail(e)), [alerts]);
};

export const useTail = (q: Committed, enabled: boolean, onBatch: (b: TailBatch) => void, onError: (e: Error) => void) => {
  const { source } = useServices();
  const batch = useEffectEvent((b: TailBatch) => onBatch(b));
  const fail = useEffectEvent((e: Error) => onError(e));
  useEffect(() => (enabled ? source.tail(q, (b) => batch(b), (e) => fail(e)) : undefined), [source, q, enabled]);
};

// Writes
export const useRuleMutations = () => {
  const { id, rules } = useServices();
  const client = useQueryClient();
  const settle = () => client.invalidateQueries({ queryKey: keys.rules(id) });
  return {
    save: useMutation({ mutationFn: ({ draft, ruleId }: { draft: RuleDraft; ruleId: string | null }) => rules.save(draft, ruleId), onSuccess: settle }),
    remove: useMutation({ mutationFn: (ruleId: string) => rules.remove(ruleId), onSuccess: settle }),
  };
};

export const useCaseMutations = (caseId: string | null) => {
  const { id, cases } = useServices();
  const client = useQueryClient();
  const settle = (c: Case) => {
    client.setQueryData(keys.case(id, c.id), c);
    return client.invalidateQueries({ queryKey: keys.cases(id) });
  };
  const need = () => {
    if (!caseId) throw new Error('Open or create a case first.');
    return caseId;
  };
  return {
    create: useMutation({ mutationFn: (draft: CaseDraft) => cases.create(draft), onSuccess: settle }),
    update: useMutation({ mutationFn: (patch: CasePatch) => cases.update(need(), patch), onSuccess: settle }),
    pin: useMutation({ mutationFn: (e: Omit<Evidence, 'pinnedAt' | 'pinnedBy'>) => cases.pin(need(), e), onSuccess: settle }),
    unpin: useMutation({ mutationFn: (lineId: number) => cases.unpin(need(), lineId), onSuccess: settle }),
    note: useMutation({ mutationFn: ({ lineId, note }: { lineId: number; note: string }) => cases.note(need(), lineId, note), onSuccess: settle }),
    addEntity: useMutation({ mutationFn: (ref: EntityRef) => cases.addEntity(need(), ref), onSuccess: settle }),
    addEvent: useMutation({ mutationFn: (event: CaseEventDraft) => cases.addEvent(need(), event), onSuccess: settle }),
  };
};

export const useCaseAction = (caseId: string | null, onCreated: (id: string) => void) => {
  const { id, cases } = useServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (op: (store: CaseStore, caseKey: string) => Promise<Case>) => {
      const target = caseId ?? (await cases.create({ title: `Investigation from ${new Date().toISOString().slice(11, 16)} UTC`, severity: 'medium', owner: config.mock.analyst })).id;
      return op(cases, target);
    },
    onSuccess: (c: Case) => {
      client.setQueryData(keys.case(id, c.id), c);
      if (c.id !== caseId) onCreated(c.id);
      return client.invalidateQueries({ queryKey: keys.cases(id) });
    },
  });
};

export const useInvalidateSource = () => {
  const { id } = useServices();
  const client = useQueryClient();
  return () => client.invalidateQueries({ predicate: (query) => query.queryKey[0] === id && query.queryKey[1] !== 'alerts' && query.queryKey[1] !== 'rules' && query.queryKey[1] !== 'cases' && query.queryKey[1] !== 'case' });
};
