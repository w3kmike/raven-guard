/// <reference path="./shims.d.ts" />
import { createContext, use, useEffect, useEffectEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient, } from '@tanstack/react-query';
import { config } from './config.js';
import { createMockServices } from './mock/index.js';
// Composition root: swap an adapter here to go to production
export const createServices = (id, client) => {
    const adapters = {
        mock: () => createMockServices(client),
    };
    const make = adapters[id];
    if (!make)
        throw new Error(`No adapter is registered for ${id}. Add one in app/api.ts.`);
    return { ...make(), id };
};
export const ServicesContext = createContext(null);
export const useServices = () => {
    const services = use(ServicesContext);
    if (!services)
        throw new Error('useServices needs a ServicesContext above it.');
    return services;
};
// Query keys
export const entityKey = (ref) => `${ref.kind}:${ref.value}`;
const keys = {
    catalog: (s) => [s, 'catalog'],
    search: (s, q, p) => [s, 'search', q, p],
    volume: (s, q, p) => [s, 'volume', q, p],
    fields: (s, q) => [s, 'fields', q],
    breakdown: (s, q, field) => [s, 'breakdown', q, field],
    distribution: (s, q, field) => [s, 'distribution', q, field],
    compare: (s, q, focus) => [s, 'compare', q, focus],
    patterns: (s, q) => [s, 'patterns', q],
    context: (s, id) => [s, 'context', id],
    entity: (s, ref) => [s, 'entity', ref],
    enrichment: (s, refs) => [s, 'enrichment', refs],
    rules: (s) => [s, 'rules'],
    alerts: (s) => [s, 'alerts'],
    cases: (s) => [s, 'cases'],
    case: (s, id) => [s, 'case', id],
};
// Reads
export const useCatalog = () => {
    const { id, source } = useServices();
    return useQuery({ queryKey: keys.catalog(id), queryFn: ({ signal }) => source.catalog(signal), staleTime: config.staleMs });
};
export const useSearch = (q, params) => {
    const { id, source } = useServices();
    return useQuery({ queryKey: keys.search(id, q, params), queryFn: ({ signal }) => source.search(q, params, signal), placeholderData: keepPreviousData, staleTime: config.staleMs, retry: false });
};
export const useVolume = (q, params) => {
    const { id, source } = useServices();
    return useQuery({ queryKey: keys.volume(id, q, params), queryFn: ({ signal }) => source.volume(q, params, signal), placeholderData: keepPreviousData, staleTime: config.staleMs, retry: false });
};
export const useFieldStats = (q) => {
    const { id, source } = useServices();
    return useQuery({ queryKey: keys.fields(id, q), queryFn: ({ signal }) => source.fields(q, signal), placeholderData: keepPreviousData, staleTime: config.staleMs, retry: false });
};
export const useBreakdown = (q, field) => {
    const { id, source } = useServices();
    return useQuery({ queryKey: keys.breakdown(id, q, field), queryFn: ({ signal }) => source.breakdown(q, field, signal), staleTime: config.staleMs, retry: false });
};
export const useDistribution = (q, field) => {
    const { id, source } = useServices();
    return useQuery({ queryKey: keys.distribution(id, q, field), queryFn: ({ signal }) => source.distribution(q, field, signal), staleTime: config.staleMs, retry: false });
};
export const useCompare = (q, focus) => {
    const { id, source } = useServices();
    return useQuery({
        queryKey: keys.compare(id, q, focus),
        queryFn: ({ signal }) => (focus ? source.compare(q, focus, signal) : Promise.reject(new Error('No comparison window.'))),
        enabled: focus !== null,
        staleTime: config.staleMs,
        retry: false,
    });
};
export const usePatterns = (q, enabled) => {
    const { id, source } = useServices();
    return useQuery({ queryKey: keys.patterns(id, q), queryFn: ({ signal }) => source.patterns(q, signal), enabled, placeholderData: keepPreviousData, staleTime: config.staleMs, retry: false });
};
export const useContextLines = (lineId) => {
    const { id, source } = useServices();
    return useQuery({ queryKey: keys.context(id, lineId ?? -1), queryFn: ({ signal }) => source.context(lineId ?? -1, signal), enabled: lineId !== null, staleTime: config.staleMs });
};
export const useEntity = (ref) => {
    const { id, source } = useServices();
    return useQuery({
        queryKey: keys.entity(id, ref),
        queryFn: ({ signal }) => (ref ? source.entity(ref, signal) : Promise.reject(new Error('No entity selected.'))),
        enabled: ref !== null,
        staleTime: config.staleMs,
    });
};
export const useEnrichment = (refs) => {
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
    return useQuery({ queryKey: keys.alerts(id), queryFn: () => new Promise(() => undefined), staleTime: Infinity, enabled: false });
};
export const useCases = () => {
    const { id, cases } = useServices();
    return useQuery({ queryKey: keys.cases(id), queryFn: ({ signal }) => cases.list(signal), staleTime: config.staleMs });
};
export const useCase = (caseId) => {
    const { id, cases } = useServices();
    return useQuery({
        queryKey: keys.case(id, caseId),
        queryFn: ({ signal }) => (caseId ? cases.get(caseId, signal) : Promise.reject(new Error('No case selected.'))),
        enabled: caseId !== null,
        staleTime: config.staleMs,
    });
};
// Subscriptions (push into the query cache)
export const useAlertSubscription = (onSnapshot, onError) => {
    const { id, alerts } = useServices();
    const client = useQueryClient();
    const push = useEffectEvent((s) => {
        client.setQueryData(keys.alerts(id), s);
        onSnapshot(s);
    });
    const fail = useEffectEvent((e) => onError(e));
    useEffect(() => alerts.subscribe((s) => push(s), (e) => fail(e)), [alerts]);
};
export const useTail = (q, enabled, onBatch, onError) => {
    const { source } = useServices();
    const batch = useEffectEvent((b) => onBatch(b));
    const fail = useEffectEvent((e) => onError(e));
    useEffect(() => (enabled ? source.tail(q, (b) => batch(b), (e) => fail(e)) : undefined), [source, q, enabled]);
};
// Writes
export const useRuleMutations = () => {
    const { id, rules } = useServices();
    const client = useQueryClient();
    const settle = () => client.invalidateQueries({ queryKey: keys.rules(id) });
    return {
        save: useMutation({ mutationFn: ({ draft, ruleId }) => rules.save(draft, ruleId), onSuccess: settle }),
        remove: useMutation({ mutationFn: (ruleId) => rules.remove(ruleId), onSuccess: settle }),
    };
};
export const useCaseMutations = (caseId) => {
    const { id, cases } = useServices();
    const client = useQueryClient();
    const settle = (c) => {
        client.setQueryData(keys.case(id, c.id), c);
        return client.invalidateQueries({ queryKey: keys.cases(id) });
    };
    const need = () => {
        if (!caseId)
            throw new Error('Open or create a case first.');
        return caseId;
    };
    return {
        create: useMutation({ mutationFn: (draft) => cases.create(draft), onSuccess: settle }),
        update: useMutation({ mutationFn: (patch) => cases.update(need(), patch), onSuccess: settle }),
        pin: useMutation({ mutationFn: (e) => cases.pin(need(), e), onSuccess: settle }),
        unpin: useMutation({ mutationFn: (lineId) => cases.unpin(need(), lineId), onSuccess: settle }),
        note: useMutation({ mutationFn: ({ lineId, note }) => cases.note(need(), lineId, note), onSuccess: settle }),
        addEntity: useMutation({ mutationFn: (ref) => cases.addEntity(need(), ref), onSuccess: settle }),
        addEvent: useMutation({ mutationFn: (event) => cases.addEvent(need(), event), onSuccess: settle }),
    };
};
export const useCaseAction = (caseId, onCreated) => {
    const { id, cases } = useServices();
    const client = useQueryClient();
    return useMutation({
        mutationFn: async (op) => {
            const target = caseId ?? (await cases.create({ title: `Investigation from ${new Date().toISOString().slice(11, 16)} UTC`, severity: 'medium', owner: config.mock.analyst })).id;
            return op(cases, target);
        },
        onSuccess: (c) => {
            client.setQueryData(keys.case(id, c.id), c);
            if (c.id !== caseId)
                onCreated(c.id);
            return client.invalidateQueries({ queryKey: keys.cases(id) });
        },
    });
};
export const useInvalidateSource = () => {
    const { id } = useServices();
    const client = useQueryClient();
    return () => client.invalidateQueries({ predicate: (query) => query.queryKey[0] === id && query.queryKey[1] !== 'alerts' && query.queryKey[1] !== 'rules' && query.queryKey[1] !== 'cases' && query.queryKey[1] !== 'case' });
};
