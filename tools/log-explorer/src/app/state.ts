import { config, type Zone } from './config.js';
import type {
  Catalog, Committed, EntityRef, Lang, LogLine, RunResult, SortOrder, TimeRange,
} from './schemas.js';
import type { Translation } from './query/translate.js';

// Types
export interface HistoryEntry extends Committed {
  readonly count: number;
  readonly kind: RunResult['kind'];
  readonly ranAt: number;
}

export type NarrowView = 'results' | 'fields' | 'case';
export type SideTab = 'line' | 'entity' | 'case';
export type Sheet = 'line' | 'entity' | 'alerts' | null;
export type ResultsView = 'lines' | 'patterns';

export interface SwitchPreview { readonly to: Lang; readonly translation: Translation | null }
export interface PatternFilter { readonly id: string; readonly template: string }
export interface Selection { readonly id: number; readonly line: LogLine | null }

export interface State {
  readonly lang: Lang;
  readonly draft: string;
  readonly committed: Committed;
  readonly back: readonly Committed[];
  readonly history: readonly HistoryEntry[];
  readonly zone: Zone;
  readonly sort: SortOrder;
  readonly selected: Selection | null;
  readonly sheet: Sheet;
  readonly sideTab: SideTab;
  readonly view: NarrowView;
  readonly resultsView: ResultsView;
  readonly pattern: PatternFilter | null;
  readonly split: string | null;
  readonly openField: string | null;
  readonly compare: TimeRange | null;
  readonly preview: SwitchPreview | null;
  readonly offerDismissed: string | null;
  readonly entity: EntityRef | null;
  readonly caseId: string | null;
  readonly live: boolean;
  readonly pending: readonly LogLine[];
  readonly liveEnded: boolean;
  readonly announcement: { readonly text: string; readonly seq: number };
}

export type Action =
  | { readonly type: 'edit'; readonly text: string }
  | { readonly type: 'commit'; readonly committed: Committed; readonly openField?: string | null; readonly keepDraft?: boolean }
  | { readonly type: 'back' }
  | { readonly type: 'recordRun'; readonly committed: Committed; readonly count: number; readonly kind: RunResult['kind'] }
  | { readonly type: 'setLang'; readonly lang: Lang; readonly draft: string }
  | { readonly type: 'preview'; readonly preview: SwitchPreview | null }
  | { readonly type: 'dismissOffer'; readonly text: string }
  | { readonly type: 'select'; readonly id: number; readonly line: LogLine | null; readonly open: boolean }
  | { readonly type: 'sheet'; readonly sheet: Sheet }
  | { readonly type: 'setZone'; readonly zone: Zone }
  | { readonly type: 'setSort'; readonly sort: SortOrder }
  | { readonly type: 'setView'; readonly view: NarrowView }
  | { readonly type: 'setSideTab'; readonly tab: SideTab }
  | { readonly type: 'setResultsView'; readonly view: ResultsView }
  | { readonly type: 'setPattern'; readonly pattern: PatternFilter | null }
  | { readonly type: 'setSplit'; readonly field: string | null }
  | { readonly type: 'openField'; readonly field: string | null }
  | { readonly type: 'setCompare'; readonly focus: TimeRange | null }
  | { readonly type: 'pivot'; readonly ref: EntityRef }
  | { readonly type: 'setCase'; readonly id: string | null }
  | { readonly type: 'setLive'; readonly on: boolean }
  | { readonly type: 'tailBatch'; readonly lines: readonly LogLine[]; readonly exhausted: boolean }
  | { readonly type: 'flushLive'; readonly to: number }
  | { readonly type: 'announce'; readonly text: string };

// Helpers
export const sameCommit = (a: Committed, b: Committed) => (
  a.lang === b.lang && a.text === b.text && a.range.from === b.range.from && a.range.to === b.range.to
);

const announce = (state: State, text: string): State['announcement'] => ({ text, seq: state.announcement.seq + 1 });

const applyCommit = (state: State, committed: Committed, pushBack: boolean, keepDraft = false): State => ({
  ...state,
  lang: keepDraft ? state.lang : committed.lang,
  draft: keepDraft ? state.draft : committed.text,
  committed,
  back: pushBack && !sameCommit(committed, state.committed)
    ? [state.committed, ...state.back].slice(0, config.historyLimit)
    : state.back,
  preview: null,
  pattern: sameCommit({ ...committed, range: state.committed.range }, state.committed) ? state.pattern : null,
  compare: state.compare && committed.range.from <= state.compare.from && committed.range.to >= state.compare.to ? state.compare : null,
  pending: [],
});

// URL state
export interface UrlState {
  readonly committed: Committed | null;
  readonly lineId: number | null;
  readonly caseId: string | null;
  readonly resultsView: ResultsView | null;
  readonly entity: EntityRef | null;
}

const entityKinds: readonly EntityRef['kind'][] = ['ip', 'user', 'host', 'beneficiary', 'request'];

export const readUrl = (hash: string): UrlState => {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const lang = p.get('l');
  const from = Number(p.get('f'));
  const to = Number(p.get('t'));
  const [kind, ...value] = (p.get('e') ?? '').split(':');
  const view = p.get('v');
  return {
    committed: (lang === 'lucene' || lang === 'logql') && from > 0 && to > from ? { lang, text: p.get('q') ?? '', range: { from, to } } : null,
    lineId: p.has('line') && Number.isInteger(Number(p.get('line'))) ? Number(p.get('line')) : null,
    caseId: p.get('case'),
    resultsView: view === 'lines' || view === 'patterns' ? view : null,
    entity: (entityKinds as readonly string[]).includes(kind) && value.length ? { kind: kind as EntityRef['kind'], value: value.join(':') } : null,
  };
};

export const writeUrl = (s: State): string => {
  const p = new URLSearchParams({
    l: s.committed.lang, q: s.committed.text, f: String(s.committed.range.from), t: String(s.committed.range.to),
  });
  if (s.selected) p.set('line', String(s.selected.id));
  if (s.caseId) p.set('case', s.caseId);
  if (s.resultsView !== 'lines') p.set('v', s.resultsView);
  if (s.entity) p.set('e', `${s.entity.kind}:${s.entity.value}`);
  return `#${p.toString()}`;
};

// Initial state
export const initialState = (catalog: Catalog, url: UrlState, defaultCase: string | null): State => {
  const committed = url.committed ?? { lang: config.defaultLang, text: '', range: { from: catalog.start, to: catalog.end } };
  return {
    lang: committed.lang,
    draft: committed.text,
    committed,
    back: [],
    history: [],
    zone: config.defaultZone,
    sort: config.defaultSort,
    selected: url.lineId === null ? null : { id: url.lineId, line: null },
    sheet: null,
    sideTab: url.entity ? 'entity' : url.lineId !== null ? 'line' : 'case',
    view: 'results',
    resultsView: url.resultsView ?? 'lines',
    pattern: null,
    split: null,
    openField: null,
    compare: null,
    preview: null,
    offerDismissed: null,
    entity: url.entity,
    caseId: url.caseId ?? defaultCase,
    live: false,
    pending: [],
    liveEnded: false,
    announcement: { text: '', seq: 0 },
  };
};

// Reducer
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'edit':
      return { ...state, draft: action.text };
    case 'commit': {
      const next = applyCommit(state, action.committed, true, action.keepDraft);
      return action.openField === undefined ? next : { ...next, openField: action.openField };
    }
    case 'back': {
      const [prev, ...rest] = state.back;
      return prev ? { ...applyCommit(state, prev, false), back: rest } : state;
    }
    case 'recordRun': {
      const entry: HistoryEntry = { ...action.committed, count: action.count, kind: action.kind, ranAt: Date.now() };
      return { ...state, history: [entry, ...state.history.filter((h) => !sameCommit(h, action.committed))].slice(0, config.historyLimit) };
    }
    case 'setLang':
      return { ...state, lang: action.lang, draft: action.draft, preview: null };
    case 'preview':
      return { ...state, preview: action.preview };
    case 'dismissOffer':
      return { ...state, offerDismissed: action.text };
    case 'select':
      return {
        ...state,
        selected: { id: action.id, line: action.line },
        sheet: action.open ? 'line' : state.sheet,
        sideTab: action.open ? 'line' : state.sideTab,
      };
    case 'sheet':
      return { ...state, sheet: action.sheet };
    case 'setZone':
      return { ...state, zone: action.zone };
    case 'setSort':
      return { ...state, sort: action.sort };
    case 'setView':
      return { ...state, view: action.view };
    case 'setSideTab':
      return { ...state, sideTab: action.tab };
    case 'setResultsView':
      return { ...state, resultsView: action.view };
    case 'setPattern':
      return { ...state, pattern: action.pattern, resultsView: action.pattern ? 'lines' : state.resultsView };
    case 'setSplit':
      return { ...state, split: action.field, announcement: announce(state, action.field ? `Timeline stacked by ${action.field}.` : 'Timeline stacked by level.') };
    case 'openField':
      return { ...state, openField: action.field };
    case 'setCompare':
      return { ...state, compare: action.focus, view: action.focus ? 'fields' : state.view };
    case 'pivot':
      return { ...state, entity: action.ref, sideTab: 'entity', sheet: 'entity' };
    case 'setCase':
      return { ...state, caseId: action.id, sideTab: 'case' };
    case 'setLive':
      return { ...state, live: action.on, pending: action.on ? state.pending : [], liveEnded: action.on ? false : state.liveEnded };
    case 'tailBatch':
      return { ...state, pending: [...action.lines, ...state.pending], liveEnded: action.exhausted, live: action.exhausted ? false : state.live };
    case 'flushLive':
      return {
        ...applyCommit(state, { ...state.committed, range: { ...state.committed.range, to: action.to } }, false, true),
        announcement: announce(state, `Added ${state.pending.length} new ${state.pending.length === 1 ? 'line' : 'lines'}.`),
      };
    case 'announce':
      return { ...state, announcement: announce(state, action.text) };
    default:
      return state;
  }
};
