// Log lines
export type Level = 'error' | 'warn' | 'info' | 'debug' | 'unknown';
export type LogFormat = 'json' | 'logfmt' | 'text';
export type FieldValue = string | number | boolean;
export type LabelName = 'service' | 'env' | 'region' | 'host' | 'level';
export type Labels = Readonly<Record<LabelName, string>>;
export type Fields = Readonly<Record<string, FieldValue>>;
export type Lang = 'lucene' | 'logql';
export type SortOrder = 'newest' | 'oldest';

export const labelNames: readonly LabelName[] = ['service', 'env', 'region', 'host', 'level'];
export const levelOrder: readonly Level[] = ['error', 'warn', 'info', 'debug', 'unknown'];
export const OTHER_KEY = 'other';
export const NONE_KEY = '(no value)';

export interface LogLine {
  readonly id: number;
  readonly ts: number;
  readonly labels: Labels;
  readonly format: LogFormat;
  readonly fields: Fields;
  readonly raw: string;
}

export interface TimeRange { readonly from: number; readonly to: number }
export interface Committed { readonly lang: Lang; readonly text: string; readonly range: TimeRange }

// Catalog: what the source knows about its streams and fields
export interface StreamInfo { readonly labels: Labels; readonly format: LogFormat }
export interface FieldInfo {
  readonly name: string;
  readonly isLabel: boolean;
  readonly type: 'string' | 'number' | 'boolean';
  readonly count: number;
  readonly distinct: number;
  readonly formats: readonly LogFormat[];
  readonly top: ReadonlyArray<{ readonly value: string; readonly count: number }>;
}
export interface Catalog {
  readonly label: string;
  readonly start: number;
  readonly end: number;
  readonly total: number;
  readonly streams: readonly StreamInfo[];
  readonly fields: readonly FieldInfo[];
}

// Query results
export interface Series { readonly key: string; readonly labels: Readonly<Record<string, string>>; readonly values: readonly (number | null)[] }
export interface LogsResult {
  readonly kind: 'logs';
  readonly lines: readonly LogLine[];
  readonly total: number;
  readonly scanned: number;
}
export interface MetricResult {
  readonly kind: 'metric';
  readonly steps: readonly number[];
  readonly series: readonly Series[];
  readonly totalSeries: number;
  readonly instant: boolean;
  readonly unit: string;
  readonly scanned: number;
  readonly total: number;
}
export type RunResult = LogsResult | MetricResult;

export interface FieldStat {
  readonly name: string;
  readonly isLabel: boolean;
  readonly type: FieldInfo['type'];
  readonly count: number;
  readonly distinct: number;
}
export interface FieldStats { readonly total: number; readonly fields: readonly FieldStat[] }

export interface Breakdown {
  readonly total: number;
  readonly rows: ReadonlyArray<{ readonly value: string; readonly raw: FieldValue; readonly count: number }>;
  readonly distinct: number;
  readonly missing: number;
}

export interface Bucket { readonly start: number; readonly counts: Readonly<Record<string, number>>; readonly total: number }
export interface Histogram {
  readonly step: number;
  readonly total: number;
  readonly buckets: readonly Bucket[];
  readonly keys: readonly string[];
  readonly gaps: readonly TimeRange[];
}

export interface Distribution {
  readonly field: string;
  readonly count: number;
  readonly missing: number;
  readonly scale: 'linear' | 'log';
  readonly bins: ReadonlyArray<{ readonly lo: number; readonly hi: number; readonly count: number }>;
  readonly min: number;
  readonly max: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
}

export interface CompareValue {
  readonly value: string;
  readonly raw: FieldValue;
  readonly focusCount: number;
  readonly baseCount: number;
  readonly focusShare: number;
  readonly baseShare: number;
}
export interface CompareField { readonly name: string; readonly score: number; readonly values: readonly CompareValue[] }
export interface CompareResult {
  readonly focus: TimeRange;
  readonly baselines: readonly TimeRange[];
  readonly focusTotal: number;
  readonly baseTotal: number;
  readonly fields: readonly CompareField[];
}

export interface Pattern {
  readonly id: string;
  readonly template: string;
  readonly count: number;
  readonly level: string;
  readonly service: string;
  readonly first: number;
  readonly last: number;
  readonly sparkline: readonly number[];
}
export interface PatternResult { readonly total: number; readonly patterns: readonly Pattern[] }

// Entities and enrichment
export type EntityKind = 'ip' | 'user' | 'host' | 'beneficiary' | 'request';
export interface EntityRef { readonly kind: EntityKind; readonly value: string }

export type Reputation = 'malicious' | 'suspicious' | 'benign' | 'internal' | 'unknown';
export interface IpInfo {
  readonly reputation: Reputation;
  readonly asn: number;
  readonly asOrg: string;
  readonly country: string;
  readonly tags: readonly string[];
}
export interface UserInfo {
  readonly displayName: string;
  readonly department: string;
  readonly mfa: 'enrolled' | 'not-enrolled' | 'legacy-exempt';
  readonly created: number;
  readonly status: 'active' | 'locked' | 'service' | 'nonexistent';
}
export interface HostInfo { readonly role: string; readonly team: string; readonly os: string }
export interface BeneficiaryInfo { readonly country: string; readonly created: number; readonly addedBy: string }
export type EntityInfo =
  | { readonly kind: 'ip'; readonly info: IpInfo }
  | { readonly kind: 'user'; readonly info: UserInfo }
  | { readonly kind: 'host'; readonly info: HostInfo }
  | { readonly kind: 'beneficiary'; readonly info: BeneficiaryInfo }
  | { readonly kind: 'none' };

export interface EntityActivity {
  readonly ref: EntityRef;
  readonly total: number;
  readonly first: number | null;
  readonly last: number | null;
  readonly services: ReadonlyArray<{ readonly service: string; readonly count: number; readonly times: readonly number[] }>;
  readonly lines: readonly LogLine[];
}

// Rules and alerts
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Comparison = '>' | '>=' | '<' | '<=';
export interface Rule {
  readonly id: string;
  readonly name: string;
  readonly lang: Lang;
  readonly query: string;
  readonly op: Comparison;
  readonly threshold: number;
  readonly window: string;
  readonly severity: Severity;
  readonly enabled: boolean;
  readonly createdBy: string;
  readonly createdAt: number;
}
export type RuleDraft = Omit<Rule, 'id' | 'createdAt'>;
export interface RuleState {
  readonly ruleId: string;
  readonly state: 'firing' | 'ok' | 'error' | 'disabled';
  readonly value: number | null;
  readonly error: string | null;
  readonly history: ReadonlyArray<{ readonly t: number; readonly v: number | null }>;
}
export interface Alert {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: Severity;
  readonly labels: Readonly<Record<string, string>>;
  readonly startsAt: number;
  readonly endsAt: number | null;
  readonly peak: number;
}
export interface AlertSnapshot { readonly now: number; readonly states: readonly RuleState[]; readonly alerts: readonly Alert[] }

// Cases
export type CaseStatus = 'open' | 'investigating' | 'contained' | 'closed';
export interface Evidence {
  readonly line: LogLine;
  readonly lang: Lang;
  readonly query: string;
  readonly range: TimeRange;
  readonly note: string;
  readonly pinnedAt: number;
  readonly pinnedBy: string;
}
export type CaseEventKind = 'created' | 'query' | 'pinned' | 'unpinned' | 'comment' | 'status' | 'severity' | 'entity' | 'alert' | 'note';
export interface CaseEvent {
  readonly id: string;
  readonly at: number;
  readonly actor: string;
  readonly kind: CaseEventKind;
  readonly text: string;
  readonly query: Committed | null;
}
export interface Case {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  readonly status: CaseStatus;
  readonly owner: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly evidence: readonly Evidence[];
  readonly entities: readonly EntityRef[];
  readonly events: readonly CaseEvent[];
}
export interface CaseSummary {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  readonly status: CaseStatus;
  readonly owner: string;
  readonly updatedAt: number;
  readonly evidenceCount: number;
}
export type CasePatch = Partial<Pick<Case, 'title' | 'severity' | 'status' | 'owner'>>;

// Static data files (the mock backend's storage)
export type WireLine = readonly [number, number, string];
export interface CaptureFile {
  readonly label: string;
  readonly start: number;
  readonly end: number;
  readonly streams: readonly StreamInfo[];
  readonly parts: readonly string[];
  readonly lines: readonly WireLine[];
}
export interface LinesFile { readonly lines: readonly WireLine[] }
export interface EnrichmentFile {
  readonly ip: Readonly<Record<string, IpInfo>>;
  readonly user: Readonly<Record<string, UserInfo>>;
  readonly host: Readonly<Record<string, HostInfo>>;
  readonly beneficiary: Readonly<Record<string, BeneficiaryInfo>>;
}
export interface CaseRecord extends Omit<Case, 'evidence'> {
  readonly evidence: ReadonlyArray<Omit<Evidence, 'line'> & { readonly lineId: number }>;
}

// Validation at the boundary
export type Check<T> = (value: unknown, path: string) => T;

const fail = (path: string, expected: string, value: unknown): never => {
  throw new TypeError(`${path}: expected ${expected}, got ${value === null ? 'null' : typeof value}`);
};

export const isString: Check<string> = (v, p) => (typeof v === 'string' ? v : fail(p, 'string', v));
export const isNumber: Check<number> = (v, p) => (typeof v === 'number' && Number.isFinite(v) ? v : fail(p, 'number', v));
export const isBoolean: Check<boolean> = (v, p) => (typeof v === 'boolean' ? v : fail(p, 'boolean', v));
export const oneOf = <T extends string>(options: readonly T[]): Check<T> => (v, p) => (
  typeof v === 'string' && (options as readonly string[]).includes(v) ? v as T : fail(p, options.join(' | '), v)
);
export const nullable = <T>(check: Check<T>): Check<T | null> => (v, p) => (v === null ? null : check(v, p));
export const arrayOf = <T>(check: Check<T>): Check<T[]> => (v, p) => (
  Array.isArray(v) ? v.map((x, i) => check(x, `${p}[${i}]`)) : fail(p, 'array', v)
);
export const recordOf = <T>(check: Check<T>): Check<Record<string, T>> => (v, p) => (
  typeof v === 'object' && v !== null && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, check(x, `${p}.${k}`)]))
    : fail(p, 'object', v)
);
export const shape = <T>(checks: { readonly [K in keyof T]: Check<T[K]> }): Check<T> => (v, p) => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return fail(p, 'object', v);
  const source = v as Record<string, unknown>;
  return Object.fromEntries(Object.entries(checks).map(([k, check]) => [k, (check as Check<unknown>)(source[k], `${p}.${k}`)])) as T;
};

const levelCheck = oneOf<string>(levelOrder as readonly string[]);
const labelsCheck: Check<Labels> = shape<Labels>({ service: isString, env: isString, region: isString, host: isString, level: levelCheck });
const formatCheck = oneOf<LogFormat>(['json', 'logfmt', 'text']);
const langCheck = oneOf<Lang>(['lucene', 'logql']);
const severityCheck = oneOf<Severity>(['low', 'medium', 'high', 'critical']);
const rangeCheck = shape<TimeRange>({ from: isNumber, to: isNumber });
const wireLineCheck: Check<WireLine> = (v, p) => {
  if (!Array.isArray(v) || v.length !== 3) return fail(p, '[ts, stream, raw]', v);
  return [isNumber(v[0], `${p}[0]`), isNumber(v[1], `${p}[1]`), isString(v[2], `${p}[2]`)];
};

export const captureCheck = shape<CaptureFile>({
  label: isString,
  start: isNumber,
  end: isNumber,
  streams: arrayOf(shape<StreamInfo>({ labels: labelsCheck, format: formatCheck })),
  parts: arrayOf(isString),
  lines: arrayOf(wireLineCheck),
});

export const linesCheck = shape<LinesFile>({ lines: arrayOf(wireLineCheck) });

export const enrichmentCheck = shape<EnrichmentFile>({
  ip: recordOf(shape<IpInfo>({
    reputation: oneOf<Reputation>(['malicious', 'suspicious', 'benign', 'internal', 'unknown']),
    asn: isNumber,
    asOrg: isString,
    country: isString,
    tags: arrayOf(isString),
  })),
  user: recordOf(shape<UserInfo>({
    displayName: isString,
    department: isString,
    mfa: oneOf<UserInfo['mfa']>(['enrolled', 'not-enrolled', 'legacy-exempt']),
    created: isNumber,
    status: oneOf<UserInfo['status']>(['active', 'locked', 'service', 'nonexistent']),
  })),
  host: recordOf(shape<HostInfo>({ role: isString, team: isString, os: isString })),
  beneficiary: recordOf(shape<BeneficiaryInfo>({ country: isString, created: isNumber, addedBy: isString })),
});

export const ruleCheck = shape<Rule>({
  id: isString,
  name: isString,
  lang: langCheck,
  query: isString,
  op: oneOf<Comparison>(['>', '>=', '<', '<=']),
  threshold: isNumber,
  window: isString,
  severity: severityCheck,
  enabled: isBoolean,
  createdBy: isString,
  createdAt: isNumber,
});

const committedCheck = shape<Committed>({ lang: langCheck, text: isString, range: rangeCheck });
const eventCheck = shape<CaseEvent>({
  id: isString,
  at: isNumber,
  actor: isString,
  kind: oneOf<CaseEventKind>(['created', 'query', 'pinned', 'unpinned', 'comment', 'status', 'severity', 'entity', 'alert', 'note']),
  text: isString,
  query: nullable(committedCheck),
});
const entityRefCheck = shape<EntityRef>({ kind: oneOf<EntityKind>(['ip', 'user', 'host', 'beneficiary', 'request']), value: isString });

export const caseRecordCheck = shape<CaseRecord>({
  id: isString,
  title: isString,
  severity: severityCheck,
  status: oneOf<CaseStatus>(['open', 'investigating', 'contained', 'closed']),
  owner: isString,
  createdAt: isNumber,
  updatedAt: isNumber,
  evidence: arrayOf(shape<Omit<Evidence, 'line'> & { lineId: number }>({
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

const fieldValueCheck: Check<FieldValue> = (v, p) => (
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : fail(p, 'string | number | boolean', v)
);

export const lineCheck = shape<LogLine>({
  id: isNumber,
  ts: isNumber,
  labels: labelsCheck,
  format: formatCheck,
  fields: recordOf(fieldValueCheck),
  raw: isString,
});

export const caseCheck = shape<Case>({
  id: isString,
  title: isString,
  severity: severityCheck,
  status: oneOf<CaseStatus>(['open', 'investigating', 'contained', 'closed']),
  owner: isString,
  createdAt: isNumber,
  updatedAt: isNumber,
  evidence: arrayOf(shape<Evidence>({
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
