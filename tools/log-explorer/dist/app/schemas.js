export const labelNames = ['service', 'env', 'region', 'host', 'level'];
export const levelOrder = ['error', 'warn', 'info', 'debug', 'unknown'];
export const OTHER_KEY = 'other';
export const NONE_KEY = '(no value)';
const fail = (path, expected, value) => {
    throw new TypeError(`${path}: expected ${expected}, got ${value === null ? 'null' : typeof value}`);
};
export const isString = (v, p) => (typeof v === 'string' ? v : fail(p, 'string', v));
export const isNumber = (v, p) => (typeof v === 'number' && Number.isFinite(v) ? v : fail(p, 'number', v));
export const isBoolean = (v, p) => (typeof v === 'boolean' ? v : fail(p, 'boolean', v));
export const oneOf = (options) => (v, p) => (typeof v === 'string' && options.includes(v) ? v : fail(p, options.join(' | '), v));
export const nullable = (check) => (v, p) => (v === null ? null : check(v, p));
export const arrayOf = (check) => (v, p) => (Array.isArray(v) ? v.map((x, i) => check(x, `${p}[${i}]`)) : fail(p, 'array', v));
export const recordOf = (check) => (v, p) => (typeof v === 'object' && v !== null && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, check(x, `${p}.${k}`)]))
    : fail(p, 'object', v));
export const shape = (checks) => (v, p) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v))
        return fail(p, 'object', v);
    const source = v;
    return Object.fromEntries(Object.entries(checks).map(([k, check]) => [k, check(source[k], `${p}.${k}`)]));
};
const levelCheck = oneOf(levelOrder);
const labelsCheck = shape({ service: isString, env: isString, region: isString, host: isString, level: levelCheck });
const formatCheck = oneOf(['json', 'logfmt', 'text']);
const langCheck = oneOf(['lucene', 'logql']);
const severityCheck = oneOf(['low', 'medium', 'high', 'critical']);
const rangeCheck = shape({ from: isNumber, to: isNumber });
const wireLineCheck = (v, p) => {
    if (!Array.isArray(v) || v.length !== 3)
        return fail(p, '[ts, stream, raw]', v);
    return [isNumber(v[0], `${p}[0]`), isNumber(v[1], `${p}[1]`), isString(v[2], `${p}[2]`)];
};
export const captureCheck = shape({
    label: isString,
    start: isNumber,
    end: isNumber,
    streams: arrayOf(shape({ labels: labelsCheck, format: formatCheck })),
    parts: arrayOf(isString),
    lines: arrayOf(wireLineCheck),
});
export const linesCheck = shape({ lines: arrayOf(wireLineCheck) });
export const enrichmentCheck = shape({
    ip: recordOf(shape({
        reputation: oneOf(['malicious', 'suspicious', 'benign', 'internal', 'unknown']),
        asn: isNumber,
        asOrg: isString,
        country: isString,
        tags: arrayOf(isString),
    })),
    user: recordOf(shape({
        displayName: isString,
        department: isString,
        mfa: oneOf(['enrolled', 'not-enrolled', 'legacy-exempt']),
        created: isNumber,
        status: oneOf(['active', 'locked', 'service', 'nonexistent']),
    })),
    host: recordOf(shape({ role: isString, team: isString, os: isString })),
    beneficiary: recordOf(shape({ country: isString, created: isNumber, addedBy: isString })),
});
export const ruleCheck = shape({
    id: isString,
    name: isString,
    lang: langCheck,
    query: isString,
    op: oneOf(['>', '>=', '<', '<=']),
    threshold: isNumber,
    window: isString,
    severity: severityCheck,
    enabled: isBoolean,
    createdBy: isString,
    createdAt: isNumber,
});
const committedCheck = shape({ lang: langCheck, text: isString, range: rangeCheck });
const eventCheck = shape({
    id: isString,
    at: isNumber,
    actor: isString,
    kind: oneOf(['created', 'query', 'pinned', 'unpinned', 'comment', 'status', 'severity', 'entity', 'alert', 'note']),
    text: isString,
    query: nullable(committedCheck),
});
const entityRefCheck = shape({ kind: oneOf(['ip', 'user', 'host', 'beneficiary', 'request']), value: isString });
export const caseRecordCheck = shape({
    id: isString,
    title: isString,
    severity: severityCheck,
    status: oneOf(['open', 'investigating', 'contained', 'closed']),
    owner: isString,
    createdAt: isNumber,
    updatedAt: isNumber,
    evidence: arrayOf(shape({
        lineId: isNumber,
        lang: langCheck,
        query: isString,
        range: rangeCheck,
        note: isString,
        pinnedAt: isNumber,
        pinnedBy: isString,
    })),
    entities: arrayOf(entityRefCheck),
    events: arrayOf(eventCheck),
});
const fieldValueCheck = (v, p) => (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : fail(p, 'string | number | boolean', v));
export const lineCheck = shape({
    id: isNumber,
    ts: isNumber,
    labels: labelsCheck,
    format: formatCheck,
    fields: recordOf(fieldValueCheck),
    raw: isString,
});
export const caseCheck = shape({
    id: isString,
    title: isString,
    severity: severityCheck,
    status: oneOf(['open', 'investigating', 'contained', 'closed']),
    owner: isString,
    createdAt: isNumber,
    updatedAt: isNumber,
    evidence: arrayOf(shape({
        line: lineCheck,
        lang: langCheck,
        query: isString,
        range: rangeCheck,
        note: isString,
        pinnedAt: isNumber,
        pinnedBy: isString,
    })),
    entities: arrayOf(entityRefCheck),
    events: arrayOf(eventCheck),
});
