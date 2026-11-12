import { config } from '../config.js';
import { labelNames, levelOrder, } from '../schemas.js';
import { NONE_KEY, OTHER_KEY } from '../schemas.js';
import { parseQuery } from '../query/index.js';
import { compileLucene } from '../query/lucene.js';
import { compilePipeline, evalMetric, innerLog, innerRange, unitOf, } from '../query/logql.js';
import { isLabel, tokensOf, valueOf } from '../query/common.js';
import { lowerBound, niceStep } from '../utils.js';
const unquote = (v) => (v.startsWith('"') ? JSON.parse(v) : v);
const typed = (v) => (/^-?\d+(?:\.\d+)?$/.test(v) ? Number(v) : v);
const parseFields = (raw, format) => {
    if (format === 'json') {
        try {
            const obj = JSON.parse(raw);
            return Object.fromEntries(Object.entries(obj).filter((e) => (typeof e[1] === 'string' || typeof e[1] === 'number' || typeof e[1] === 'boolean')));
        }
        catch {
            return {};
        }
    }
    if (format === 'logfmt') {
        return Object.fromEntries([...raw.matchAll(/([\w.]+)=("(?:[^"\\]|\\.)*"|\S+)/g)].map((m) => [m[1], typed(unquote(m[2]))]));
    }
    return {};
};
const toLine = (streams) => ([ts, si, raw], id) => {
    const stream = streams[si] ?? streams[0];
    return { id, ts, labels: stream.labels, format: stream.format, fields: parseFields(raw, stream.format), raw };
};
export const createStore = (file) => {
    const lines = file.lines.map(toLine(file.streams));
    return { label: file.label, start: file.start, end: file.end, version: 0, lines, timestamps: lines.map((l) => l.ts), streams: file.streams };
};
export const appendLines = (store, wire, now) => {
    const added = wire.map((w, i) => toLine(store.streams)(w, store.lines.length + i));
    Object.assign(store, {
        lines: [...store.lines, ...added],
        timestamps: [...store.timestamps, ...added.map((l) => l.ts)],
        end: Math.max(store.end, now),
        version: store.version + 1,
    });
    return added;
};
export const linesIn = (store, range) => (store.lines.slice(lowerBound(store.timestamps, range.from), lowerBound(store.timestamps, range.to)));
const matchCache = new Map();
export const match = (store, q) => {
    const key = `${store.version}|${q.lang}|${q.range.from}|${q.range.to}|${q.text}`;
    const hit = matchCache.get(key);
    if (hit)
        return hit;
    const scope = linesIn(store, q.range);
    const parsed = parseQuery(q.lang, q.text);
    if (!parsed.ok)
        throw new Error(parsed.diagnostics[0]?.message ?? 'The query has an error.');
    const result = parsed.lang === 'lucene'
        ? { scope, lines: scope.filter(compileLucene(parsed.ast)), ast: null }
        : (() => {
            const pipe = compilePipeline(innerLog(parsed.ast));
            return { scope, lines: scope.filter((l) => pipe(l) !== null), ast: parsed.ast };
        })();
    if (matchCache.size > 40)
        matchCache.clear();
    matchCache.set(key, result);
    return result;
};
// Search
const peakOf = (s) => Math.max(...s.values.map((v) => v ?? -Infinity));
export const search = (store, q, sort, patternId) => {
    const m = match(store, q);
    if (m.ast && m.ast.kind !== 'log') {
        const span = q.range.to - q.range.from;
        const window = innerRange(m.ast).rangeMs;
        const instant = window >= span;
        const step = niceStep(span, config.metricTargetPoints, config.bucketSteps);
        const steps = instant ? [q.range.to] : Array.from({ length: Math.floor(span / step) }, (_, i) => q.range.from + step * (i + 1));
        const history = linesIn(store, { from: q.range.from - window, to: q.range.to });
        const all = evalMetric(m.ast, history, steps).filter((s) => s.values.some((v) => v !== null));
        const series = [...all].sort((a, b) => peakOf(b) - peakOf(a)).slice(0, config.maxSeries);
        const result = {
            kind: 'metric', steps, series, totalSeries: all.length, instant, unit: unitOf(m.ast), scanned: m.scope.length, total: m.lines.length,
        };
        return result;
    }
    const filtered = patternId ? m.lines.filter((l) => patternOf(store, l).id === patternId) : m.lines;
    const ordered = sort === 'newest' ? [...filtered].reverse() : filtered;
    const result = { kind: 'logs', lines: ordered.slice(0, config.searchLimit), total: filtered.length, scanned: m.scope.length };
    return result;
};
// Catalog
const catalogCache = new Map();
export const catalogOf = (store) => {
    const hit = catalogCache.get(store.version);
    if (hit)
        return hit;
    const tally = store.lines.reduce((acc, l) => {
        [...labelNames.map((k) => [k, l.labels[k]]), ...Object.entries(l.fields).filter(([k]) => !isLabel(k))]
            .forEach(([k, v]) => {
            const e = acc.get(k) ?? { count: 0, values: new Map(), types: new Set(), formats: new Set() };
            e.count += 1;
            e.values.set(String(v), (e.values.get(String(v)) ?? 0) + 1);
            e.types.add(typeof v);
            e.formats.add(l.format);
            acc.set(k, e);
        });
        return acc;
    }, new Map());
    const fields = [...tally.entries()].map(([name, e]) => ({
        name,
        isLabel: isLabel(name),
        type: e.types.size === 1 && e.types.has('number') ? 'number' : e.types.size === 1 && e.types.has('boolean') ? 'boolean' : 'string',
        count: e.count,
        distinct: e.values.size,
        formats: [...e.formats],
        top: [...e.values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50).map(([value, count]) => ({ value, count })),
    }));
    const catalog = { label: store.label, start: store.start, end: store.end, total: store.lines.length, streams: store.streams, fields };
    catalogCache.clear();
    catalogCache.set(store.version, catalog);
    return catalog;
};
// Field statistics
export const fieldStats = (lines) => {
    const tally = lines.reduce((acc, l) => {
        [...labelNames.map((k) => [k, l.labels[k]]), ...Object.entries(l.fields).filter(([k]) => !isLabel(k))]
            .forEach(([k, v]) => {
            const e = acc.get(k) ?? { count: 0, values: new Set(), numeric: true };
            e.count += 1;
            e.values.add(String(v));
            e.numeric = e.numeric && typeof v === 'number';
            acc.set(k, e);
        });
        return acc;
    }, new Map());
    const fields = [...tally.entries()]
        .map(([name, e]) => ({ name, isLabel: isLabel(name), type: e.numeric ? 'number' : 'string', count: e.count, distinct: e.values.size }))
        .sort((a, b) => (a.isLabel !== b.isLabel ? (a.isLabel ? -1 : 1)
        : a.isLabel ? labelNames.indexOf(a.name) - labelNames.indexOf(b.name)
            : b.count - a.count || a.name.localeCompare(b.name)));
    return { total: lines.length, fields };
};
export const breakdown = (lines, field, n) => {
    const counts = lines.reduce((acc, l) => {
        const v = valueOf(l, field);
        if (v === undefined)
            return acc;
        const k = String(v);
        return acc.set(k, { raw: v, count: (acc.get(k)?.count ?? 0) + 1 });
    }, new Map());
    const present = [...counts.values()].reduce((a, e) => a + e.count, 0);
    const rows = [...counts.entries()]
        .map(([value, e]) => ({ value, raw: e.raw, count: e.count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
        .slice(0, n);
    return { total: lines.length, rows, distinct: counts.size, missing: lines.length - present };
};
// Volume histogram
export const histogram = (lines, range, target, split) => {
    const step = niceStep(range.to - range.from, target, config.bucketSteps);
    const origin = Math.floor(range.from / step) * step;
    const n = Math.max(1, Math.ceil((range.to - origin) / step));
    const top = split ? breakdown(lines, split, config.splitTopN).rows.map((r) => r.value) : [];
    const keyFor = (l) => {
        if (!split)
            return l.labels.level;
        const v = valueOf(l, split);
        if (v === undefined)
            return NONE_KEY;
        return top.includes(String(v)) ? String(v) : OTHER_KEY;
    };
    const grid = lines.reduce((acc, l) => {
        const i = Math.min(n - 1, Math.floor((l.ts - origin) / step));
        acc[i].set(keyFor(l), (acc[i].get(keyFor(l)) ?? 0) + 1);
        return acc;
    }, Array.from({ length: n }, () => new Map()));
    const seen = new Set(grid.flatMap((m) => [...m.keys()]));
    const order = split ? [...top, OTHER_KEY, NONE_KEY] : levelOrder;
    const buckets = grid.map((m, i) => ({ start: origin + i * step, counts: Object.fromEntries(m), total: [...m.values()].reduce((a, b) => a + b, 0) }));
    const runs = buckets.reduce((acc, b, i) => {
        if (b.total === 0)
            return acc.open === null ? { ...acc, open: i } : acc;
        if (acc.open === null)
            return acc;
        return { runs: [...acc.runs, [acc.open, i]], open: null };
    }, { runs: [], open: null }).runs;
    const gaps = lines.length
        ? runs.filter(([a, b]) => a > 0 && b - a >= config.gapMinBuckets).map(([a, b]) => ({ from: origin + a * step, to: origin + b * step }))
        : [];
    return { step, total: lines.length, buckets, keys: order.filter((k) => seen.has(k)), gaps };
};
// Numeric distribution
const quantile = (sorted, q) => {
    if (!sorted.length)
        return 0;
    const rank = q * (sorted.length - 1);
    const lo = Math.floor(rank);
    const hi = Math.min(sorted.length - 1, lo + 1);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
};
export const distribution = (lines, field) => {
    const values = lines.map((l) => valueOf(l, field)).filter((v) => typeof v === 'number').sort((a, b) => a - b);
    const min = values[0] ?? 0;
    const max = values[values.length - 1] ?? 0;
    const positive = values.find((v) => v > 0) ?? 0;
    const log = min >= 0 && positive > 0 && max / positive >= config.logScaleRatio;
    const n = config.distributionBins;
    const edges = log
        ? Array.from({ length: n + 1 }, (_, i) => positive * (max / positive) ** (i / n))
        : Array.from({ length: n + 1 }, (_, i) => min + ((max - min) * i) / n);
    const binOf = (v) => {
        if (log && v < positive)
            return -1;
        const i = log ? Math.floor((Math.log(v / positive) / Math.log(max / positive)) * n) : Math.floor(((v - min) / Math.max(1e-9, max - min)) * n);
        return Math.max(0, Math.min(n - 1, i));
    };
    const counts = values.reduce((acc, v) => {
        const i = binOf(v);
        acc[i + 1] += 1;
        return acc;
    }, Array.from({ length: n + 1 }, () => 0));
    const bins = [
        ...(log && counts[0] ? [{ lo: 0, hi: 0, count: counts[0] }] : []),
        ...Array.from({ length: n }, (_, i) => ({ lo: edges[i], hi: edges[i + 1], count: counts[i + 1] })),
    ];
    return {
        field,
        count: values.length,
        missing: lines.length - values.length,
        scale: log ? 'log' : 'linear',
        bins,
        min,
        max,
        p50: quantile(values, 0.5),
        p95: quantile(values, 0.95),
        p99: quantile(values, 0.99),
    };
};
// Compare a window with the time around it
export const compare = (store, q, focus) => {
    const len = focus.to - focus.from;
    const baselines = [
        { from: Math.max(store.start, focus.from - len), to: focus.from },
        { from: focus.to, to: Math.min(store.end, focus.to + len) },
    ].filter((r) => r.to > r.from);
    if (!baselines.length)
        throw new Error('Nothing was captured around this window, so there is no baseline to compare with.');
    const wide = match(store, { ...q, range: { from: baselines[0].from, to: baselines[baselines.length - 1].to } }).lines;
    const inRange = (r) => (l) => l.ts >= r.from && l.ts < r.to;
    const focusLines = wide.filter(inRange(focus));
    const baseLines = wide.filter((l) => baselines.some((r) => inRange(r)(l)));
    const tally = (lines) => lines.reduce((acc, l) => {
        [...labelNames.map((k) => [k, l.labels[k]]), ...Object.entries(l.fields).filter(([k]) => !isLabel(k))]
            .forEach(([k, v]) => {
            const m = acc.get(k) ?? new Map();
            m.set(String(v), { raw: v, count: (m.get(String(v))?.count ?? 0) + 1 });
            acc.set(k, m);
        });
        return acc;
    }, new Map());
    const f = tally(focusLines);
    const b = tally(baseLines);
    const share = (n, total) => (total ? n / total : 0);
    const fields = [...new Set([...f.keys(), ...b.keys()])].map((name) => {
        const fv = f.get(name) ?? new Map();
        const bv = b.get(name) ?? new Map();
        const values = [...new Set([...fv.keys(), ...bv.keys()])]
            .map((value) => {
            const fc = fv.get(value)?.count ?? 0;
            const bc = bv.get(value)?.count ?? 0;
            return { value, raw: (fv.get(value) ?? bv.get(value))?.raw ?? value, focusCount: fc, baseCount: bc, focusShare: share(fc, focusLines.length), baseShare: share(bc, baseLines.length) };
        })
            .filter((v) => v.focusCount + v.baseCount >= config.compareMinSupport)
            .sort((x, y) => Math.abs(y.focusShare - y.baseShare) - Math.abs(x.focusShare - x.baseShare))
            .slice(0, config.compareTopValues);
        return { name, score: Math.max(0, ...values.map((v) => Math.abs(v.focusShare - v.baseShare))), values };
    }).filter((x) => x.values.length).sort((x, y) => y.score - x.score);
    return { focus, baselines, focusTotal: focusLines.length, baseTotal: baseLines.length, fields };
};
// Log patterns
const hash = (s) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7).toString(36).replace('-', 'n');
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const placeholder = (v) => {
    if (typeof v === 'number')
        return '<num>';
    if (typeof v === 'boolean')
        return '<bool>';
    return IPV4.test(v) ? '<ip>' : '<str>';
};
const maskText = (raw) => raw
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>')
    .replace(/SHA256:\S+/g, 'SHA256:<hash>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
    .replace(/"(?:[^"\\]|\\.)*"/g, '<str>')
    .replace(/\b(user|for) (?!<)(?!invalid\b)([\w.@-]+)/g, '$1 <user>')
    .replace(/\b\d+(?:\.\d+)?\b/g, '<num>');
const patternCache = new WeakMap();
const distinctCache = new Map();
const distinctByService = (store) => {
    const hit = distinctCache.get(store.version);
    if (hit)
        return hit;
    const sets = store.lines.reduce((acc, l) => {
        Object.entries(l.fields).forEach(([k, v]) => {
            const key = `${l.labels.service}|${k}`;
            acc.set(key, (acc.get(key) ?? new Set()).add(String(v)));
        });
        return acc;
    }, new Map());
    const counts = new Map([...sets.entries()].map(([k, v]) => [k, v.size]));
    distinctCache.clear();
    distinctCache.set(store.version, counts);
    return counts;
};
const logfmtValue = (v) => (/[\s"=]/.test(String(v)) ? JSON.stringify(String(v)) : String(v));
export const patternOf = (store, line) => {
    const hit = patternCache.get(line);
    if (hit)
        return hit;
    const distinct = distinctByService(store);
    const keep = (k) => (distinct.get(`${line.labels.service}|${k}`) ?? Infinity) <= config.patternMaxDistinct;
    const entries = Object.entries(line.fields);
    const body = line.format === 'text'
        ? maskText(line.raw)
        : line.format === 'json'
            ? `{${entries.map(([k, v]) => `"${k}":${keep(k) ? JSON.stringify(v) : placeholder(v)}`).join(',')}}`
            : entries.map(([k, v]) => `${k}=${keep(k) ? logfmtValue(v) : placeholder(v)}`).join(' ');
    const template = `${line.labels.service} ${body}`;
    const result = { id: hash(template), template: body };
    patternCache.set(line, result);
    return result;
};
export const patterns = (store, q) => {
    const m = match(store, q);
    const n = config.patternSparkBuckets;
    const span = Math.max(1, q.range.to - q.range.from);
    const groups = m.lines.reduce((acc, l) => {
        const p = patternOf(store, l);
        const g = acc.get(p.id) ?? { template: p.template, service: l.labels.service, count: 0, first: l.ts, last: l.ts, levels: new Map(), spark: Array.from({ length: n }, () => 0) };
        g.count += 1;
        g.first = Math.min(g.first, l.ts);
        g.last = Math.max(g.last, l.ts);
        g.levels.set(l.labels.level, (g.levels.get(l.labels.level) ?? 0) + 1);
        g.spark[Math.min(n - 1, Math.floor(((l.ts - q.range.from) / span) * n))] += 1;
        return acc.set(p.id, g);
    }, new Map());
    const list = [...groups.entries()].map(([id, g]) => ({
        id,
        template: g.template,
        service: g.service,
        count: g.count,
        first: g.first,
        last: g.last,
        level: [...g.levels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown',
        sparkline: g.spark,
    })).sort((a, b) => b.count - a.count);
    return { total: m.lines.length, patterns: list };
};
// Stream context and entities
export const context = (store, id, n) => {
    const line = store.lines[id];
    if (!line)
        return [];
    const same = (l) => l.labels.host === line.labels.host && l.labels.service === line.labels.service && l.labels.env === line.labels.env;
    const before = store.lines.slice(Math.max(0, id - n * 40), id).filter(same).slice(-n);
    const after = store.lines.slice(id + 1, id + 1 + n * 40).filter(same).slice(0, n);
    return [...before, line, ...after];
};
export const entityActivity = (store, ref) => {
    const fields = config.entityFields[ref.kind];
    const hits = store.lines.filter((l) => fields.some((f) => String(valueOf(l, f) ?? '') === ref.value)
        || (ref.kind === 'ip' && tokensOf(l).has(ref.value)));
    const byService = hits.reduce((acc, l) => acc.set(l.labels.service, [...(acc.get(l.labels.service) ?? []), l.ts]), new Map());
    return {
        ref,
        total: hits.length,
        first: hits[0]?.ts ?? null,
        last: hits[hits.length - 1]?.ts ?? null,
        services: [...byService.entries()].map(([service, times]) => ({ service, count: times.length, times })).sort((a, b) => b.count - a.count),
        lines: hits.slice(-config.entityLineLimit).reverse(),
    };
};
