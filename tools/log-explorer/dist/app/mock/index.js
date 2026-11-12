import { arrayOf, ruleCheck, } from '../schemas.js';
import { parseQuery } from '../query/index.js';
import { compileLucene } from '../query/lucene.js';
import { compilePipeline, innerLog } from '../query/logql.js';
import { backendFor, readStored, respond, startClock, stopClockIfIdle, writeStored, } from './backend.js';
import { breakdown, catalogOf, compare, context, distribution, entityActivity, fieldStats, histogram, match, patterns, search, } from './engine.js';
import { evaluateRules } from './alerts.js';
import { createCaseStore } from './cases.js';
// Mock adapters for every port, backed by data/ and an in-memory store
export const createMockServices = (client) => {
    const ready = () => backendFor(client);
    const run = (signal, work) => ready().then((b) => respond(signal, () => work(b)));
    const source = {
        catalog: (signal) => run(signal, (b) => catalogOf(b.store)),
        search: (q, params, signal) => run(signal, (b) => search(b.store, q, params.sort, params.patternId)),
        volume: (q, params, signal) => run(signal, (b) => histogram(match(b.store, q).lines, q.range, params.target, params.split)),
        fields: (q, signal) => run(signal, (b) => fieldStats(match(b.store, q).lines)),
        breakdown: (q, field, signal) => run(signal, (b) => breakdown(match(b.store, q).lines, field, 10)),
        distribution: (q, field, signal) => run(signal, (b) => distribution(match(b.store, q).lines, field)),
        compare: (q, focus, signal) => run(signal, (b) => compare(b.store, q, focus)),
        patterns: (q, signal) => run(signal, (b) => patterns(b.store, q)),
        context: (lineId, signal) => run(signal, (b) => context(b.store, lineId, 5)),
        entity: (ref, signal) => run(signal, (b) => entityActivity(b.store, ref)),
        tail: (q, onBatch, onError) => {
            const state = { cancelled: false, off: null };
            ready().then((b) => {
                if (state.cancelled)
                    return;
                const parsed = parseQuery(q.lang, q.text);
                if (!parsed.ok)
                    throw new Error('Fix the query before following it live.');
                if (parsed.lang === 'logql' && parsed.ast.kind !== 'log')
                    throw new Error('Live tail follows log queries. Metric queries update when you run them again.');
                const keep = parsed.lang === 'lucene'
                    ? compileLucene(parsed.ast)
                    : ((pipe) => (l) => pipe(l) !== null)(compilePipeline(innerLog(parsed.ast)));
                const listener = (added, now, exhausted) => onBatch({ lines: added.filter(keep), now, exhausted });
                b.tailListeners.add(listener);
                startClock(b);
                state.off = () => {
                    b.tailListeners.delete(listener);
                    stopClockIfIdle(b);
                };
            }).catch((e) => onError(e instanceof Error ? e : new Error(String(e))));
            return () => {
                state.cancelled = true;
                state.off?.();
            };
        },
    };
    const enrichment = {
        lookup: (refs, signal) => run(signal, (b) => Object.fromEntries(refs.map((ref) => {
            const key = `${ref.kind}:${ref.value}`;
            if (ref.kind === 'ip' && b.enrichment.ip[ref.value])
                return [key, { kind: 'ip', info: b.enrichment.ip[ref.value] }];
            if (ref.kind === 'user' && b.enrichment.user[ref.value])
                return [key, { kind: 'user', info: b.enrichment.user[ref.value] }];
            if (ref.kind === 'host' && b.enrichment.host[ref.value])
                return [key, { kind: 'host', info: b.enrichment.host[ref.value] }];
            if (ref.kind === 'beneficiary' && b.enrichment.beneficiary[ref.value])
                return [key, { kind: 'beneficiary', info: b.enrichment.beneficiary[ref.value] }];
            return [key, { kind: 'none' }];
        }))),
    };
    const ruleHolder = { rules: null };
    const allRules = async () => {
        if (ruleHolder.rules)
            return ruleHolder.rules;
        const b = await ready();
        ruleHolder.rules = readStored('rules', arrayOf(ruleCheck)) ?? [...b.seedRules];
        return ruleHolder.rules;
    };
    const changed = async (next) => {
        ruleHolder.rules = next;
        writeStored('rules', next);
        (await ready()).changeListeners.forEach((fn) => fn());
    };
    const rules = {
        list: (signal) => respond(signal, () => undefined).then(allRules),
        save: (draft, id) => respond(undefined, () => undefined).then(async () => {
            const parsed = parseQuery(draft.lang, draft.query);
            if (!parsed.ok)
                throw new Error(`The rule query has an error: ${parsed.diagnostics[0]?.message ?? ''}`);
            const current = await allRules();
            const existing = id ? current.find((r) => r.id === id) : undefined;
            const rule = { ...draft, id: existing?.id ?? `rule-${Date.now().toString(36)}`, createdAt: existing?.createdAt ?? Date.now() };
            await changed(existing ? current.map((r) => (r.id === rule.id ? rule : r)) : [...current, rule]);
            return rule;
        }),
        remove: (id) => respond(undefined, () => undefined).then(async () => changed((await allRules()).filter((r) => r.id !== id))),
    };
    const alerts = {
        subscribe: (onSnapshot, onError) => {
            const state = { cancelled: false, off: null };
            Promise.all([ready(), allRules()]).then(([b]) => {
                if (state.cancelled)
                    return;
                const emit = () => allRules().then((list) => onSnapshot(evaluateRules(b.store, list)));
                b.changeListeners.add(emit);
                state.off = () => b.changeListeners.delete(emit);
                return emit();
            }).catch((e) => onError(e instanceof Error ? e : new Error(String(e))));
            return () => {
                state.cancelled = true;
                state.off?.();
            };
        },
    };
    return { source, enrichment, rules, alerts, cases: createCaseStore(ready) };
};
