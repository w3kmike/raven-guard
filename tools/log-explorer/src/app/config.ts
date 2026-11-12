import type { EntityKind, Lang, SortOrder } from './schemas.js';

export type Zone = 'utc' | 'local';
export type SourceId = 'mock' | 'elasticsearch' | 'loki';

export interface RangePreset {
  readonly label: string;
  readonly ms: number | null;
}

export interface SourceOption {
  readonly id: SourceId;
  readonly label: string;
  readonly available: boolean;
}

export interface MockSettings {
  readonly latencyMs: readonly [number, number];
  readonly failureRate: number;
  readonly tailSpeed: number;
  readonly tailTickMs: number;
  readonly storageKey: string;
  readonly analyst: string;
}

export interface Config {
  readonly defaultLang: Lang;
  readonly defaultZone: Zone;
  readonly defaultSort: SortOrder;
  readonly presets: readonly RangePreset[];
  readonly sources: readonly SourceOption[];
  readonly defaultSource: SourceId;
  readonly dataPath: string;
  readonly mock: MockSettings;
  readonly searchLimit: number;
  readonly luceneDefaultField: string;
  readonly logqlNoSelectorFallback: string;
  readonly histogramTargetBuckets: number;
  readonly histogramTargetBucketsPhone: number;
  readonly phoneWidth: number;
  readonly bucketSteps: readonly number[];
  readonly gapMinBuckets: number;
  readonly splitTopN: number;
  readonly breakdownTopN: number;
  readonly metricTargetPoints: number;
  readonly maxSeries: number;
  readonly directLabelMinWidth: number;
  readonly contextLines: number;
  readonly historyLimit: number;
  readonly suggestionLimit: number;
  readonly overscanRows: number;
  readonly excerptChars: number;
  readonly didYouMeanDistance: number;
  readonly placeholders: Readonly<Record<Lang, string>>;
  readonly entityFields: Readonly<Record<EntityKind, readonly string[]>>;
  readonly entityLineLimit: number;
  readonly patternMaxDistinct: number;
  readonly patternSparkBuckets: number;
  readonly compareMinSupport: number;
  readonly compareTopValues: number;
  readonly distributionBins: number;
  readonly logScaleRatio: number;
  readonly ruleHistorySteps: number;
  readonly ruleEvalStepMs: number;
  readonly staleMs: number;
}

const minute = 60000;

export const config: Config = {
  defaultLang: 'lucene',
  defaultZone: 'utc',
  defaultSort: 'newest',
  presets: [
    { label: 'Last 15 minutes', ms: 15 * minute },
    { label: 'Last hour', ms: 60 * minute },
    { label: 'Last 3 hours', ms: 180 * minute },
    { label: 'Everything captured', ms: null },
  ],
  sources: [
    { id: 'mock', label: 'Northwind demo capture', available: true },
    { id: 'elasticsearch', label: 'Elasticsearch', available: false },
    { id: 'loki', label: 'Grafana Loki', available: false },
  ],
  defaultSource: 'mock',
  dataPath: 'data/',
  mock: {
    latencyMs: [120, 420],
    failureRate: 0,
    tailSpeed: 15,
    tailTickMs: 1000,
    storageKey: 'log-workspace:v1',
    analyst: 'You',
  },
  searchLimit: 5000,
  luceneDefaultField: 'message',
  logqlNoSelectorFallback: 'env=~".+"',
  histogramTargetBuckets: 90,
  histogramTargetBucketsPhone: 40,
  phoneWidth: 600,
  bucketSteps: [1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].map((s) => s * 1000),
  gapMinBuckets: 3,
  splitTopN: 5,
  breakdownTopN: 10,
  metricTargetPoints: 72,
  maxSeries: 8,
  directLabelMinWidth: 560,
  contextLines: 5,
  historyLimit: 20,
  suggestionLimit: 8,
  overscanRows: 12,
  excerptChars: 220,
  didYouMeanDistance: 2,
  placeholders: {
    lucene: 'service:auth AND status:401',
    logql: '{service="auth"} |= "401"',
  },
  entityFields: {
    ip: ['src_ip'],
    user: ['user'],
    host: ['host'],
    beneficiary: ['beneficiary'],
    request: ['req_id'],
  },
  entityLineLimit: 400,
  patternMaxDistinct: 4,
  patternSparkBuckets: 24,
  compareMinSupport: 5,
  compareTopValues: 6,
  distributionBins: 24,
  logScaleRatio: 100,
  ruleHistorySteps: 60,
  ruleEvalStepMs: minute,
  staleMs: 30000,
};
