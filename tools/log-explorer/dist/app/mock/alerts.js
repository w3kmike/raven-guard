import { config } from '../config.js';
import { parseQuery } from '../query/index.js';
import { durationMs, evalMetric } from '../query/logql.js';
import { lowerBound } from '../utils.js';
import { match } from './engine.js';
// Rule evaluation over the store, one step per simulated minute
const holds = (op, v, threshold) => {
    if (v === null)
        return false;
    const ops = { '>': v > threshold, '>=': v >= threshold, '<': v < threshold, '<=': v <= threshold };
    return ops[op];
};
const seriesFor = (store, rule, steps) => {
    const parsed = parseQuery(rule.lang, rule.query);
    if (!parsed.ok)
        throw new Error(parsed.diagnostics[0]?.message ?? 'The rule query has an error.');
    if (parsed.lang === 'logql' && parsed.ast.kind !== 'log')
        return evalMetric(parsed.ast, store.lines, steps);
    const window = durationMs(rule.window);
    if (!window)
        throw new Error(`"${rule.window}" isn't a window. Use a duration such as 5m.`);
    const times = match(store, { lang: rule.lang, text: rule.query, range: { from: store.start, to: store.end + 1 } }).lines.map((l) => l.ts);
    return [{ key: 'count', labels: {}, values: steps.map((t) => lowerBound(times, t + 1) - lowerBound(times, t - window + 1)) }];
};
const runsOf = (rule, s, steps) => s.values
    .reduce((acc, v, i) => {
    if (!holds(rule.op, v, rule.threshold))
        return acc;
    const last = acc[acc.length - 1];
    return last && last.to === i - 1
        ? [...acc.slice(0, -1), { ...last, to: i, peak: Math.max(last.peak, v ?? 0) }]
        : [...acc, { from: i, to: i, peak: v ?? 0 }];
}, [])
    .map((run) => ({
    id: `${rule.id}|${s.key}|${run.from}`,
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    labels: s.labels,
    startsAt: steps[run.from],
    endsAt: run.to === steps.length - 1 ? null : steps[run.to + 1],
    peak: run.peak,
}));
const evaluateRule = (store, rule, steps) => {
    if (!rule.enabled)
        return { state: { ruleId: rule.id, state: 'disabled', value: null, error: null, history: [] }, alerts: [] };
    try {
        const series = seriesFor(store, rule, steps);
        const maxAt = (i) => series.reduce((m, s) => {
            const v = s.values[i];
            return v === null || v === undefined ? m : Math.max(m ?? -Infinity, v);
        }, null);
        const last = steps.length - 1;
        const firing = series.some((s) => holds(rule.op, s.values[last] ?? null, rule.threshold));
        const history = steps.slice(-config.ruleHistorySteps).map((t, k) => ({ t, v: maxAt(steps.length - Math.min(steps.length, config.ruleHistorySteps) + k) }));
        return {
            state: { ruleId: rule.id, state: firing ? 'firing' : 'ok', value: maxAt(last), error: null, history },
            alerts: series.flatMap((s) => runsOf(rule, s, steps)),
        };
    }
    catch (e) {
        return { state: { ruleId: rule.id, state: 'error', value: null, error: e instanceof Error ? e.message : String(e), history: [] }, alerts: [] };
    }
};
const snapshotCache = new Map();
export const evaluateRules = (store, rules) => {
    const key = `${store.version}|${JSON.stringify(rules)}`;
    const hit = snapshotCache.get(key);
    if (hit)
        return hit;
    const step = config.ruleEvalStepMs;
    const steps = Array.from({ length: Math.floor((store.end - store.start) / step) }, (_, i) => store.start + step * (i + 1));
    const results = rules.map((r) => evaluateRule(store, r, steps));
    const snapshot = {
        now: store.end,
        states: results.map((r) => r.state),
        alerts: results.flatMap((r) => r.alerts).sort((a, b) => b.startsAt - a.startsAt),
    };
    snapshotCache.clear();
    snapshotCache.set(key, snapshot);
    return snapshot;
};
