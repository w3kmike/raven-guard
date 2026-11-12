/// <reference path="./shims.d.ts" />
import {
  useCallback, useEffect, useEffectEvent, useMemo, useReducer, useRef, useState, type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config, type SourceId } from './config.js';
import type {
  Alert, AlertSnapshot, Catalog, Committed, EntityRef, FieldValue, Lang, LogLine, TimeRange,
} from './schemas.js';
import {
  ServicesContext, createServices, useAlertSnapshot, useAlertSubscription, useCase, useCaseAction, useCases,
  useCatalog, useFieldStats, useInvalidateSource, useSearch, useServices, useTail,
} from './api.js';
import {
  addFilter, addRange, entityQuery, highlightTerms, parseQuery,
} from './query/index.js';
import { fieldInfo } from './query/common.js';
import { translate } from './query/translate.js';
import {
  initialState, readUrl, reducer, writeUrl, type Action, type HistoryEntry,
} from './state.js';
import {
  Icon, QueryStatus, Switcher, langName, otherLang, useEnter,
} from './components/shared.js';
import {
  AlertBell, CopyAs, CopyLink, HistoryMenu, LangSwitch, LiveToggle, Notices, QueryEditor, SourcePicker,
  SwitchPreviewPanel, TimeRangeControl,
} from './components/querybar.js';
import { Timeline } from './components/timeline.js';
import { FieldPanel } from './components/fields.js';
import {
  LogStream, MetricView, PatternList, ResultsHeader,
} from './components/results.js';
import { LineDetail } from './components/detail.js';
import { EntityView } from './components/entity.js';
import { CasePanel } from './components/cases.js';
import { AlertsPanel } from './components/alerts.js';
import { formatClock, formatCount, plural } from './utils.js';

// Results area (remounts when its shape changes, so the change is animated)
const ResultsShape = ({ shape, children }: { shape: string; children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEnter(ref, [shape]);
  return <div ref={ref} className="results-shape">{children}</div>;
};

// Workspace
interface WorkspaceProps {
  readonly boot: Catalog;
  readonly defaultCase: string | null;
  readonly source: SourceId;
  readonly onSource: (id: SourceId) => void;
}

const Workspace = ({ boot, defaultCase, source, onSource }: WorkspaceProps) => {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(boot, readUrl(window.location.hash), defaultCase));
  const services = useServices();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastNow = useRef<number | null>(null);
  const firingBefore = useRef<ReadonlySet<string> | null>(null);
  const logged = useRef<string>('');
  const catalog = useCatalog().data ?? boot;
  const invalidate = useInvalidateSource();
  const {
    lang, draft, committed, zone, preview,
  } = state;
  const extent: TimeRange = { from: catalog.start, to: catalog.end };

  const parsed = useMemo(() => parseQuery(lang, draft, catalog), [lang, draft, catalog]);
  const metricQuery = useMemo(() => {
    const p = parseQuery(committed.lang, committed.text);
    return p.ok && p.metric;
  }, [committed]);
  const search = useSearch(committed, { sort: state.sort, patternId: state.pattern?.id ?? null });
  const stats = useFieldStats(committed);
  const openCase = useCase(state.caseId);
  const snapshot = useAlertSnapshot().data;
  const terms = useMemo(() => highlightTerms(committed), [committed]);
  const pinned = useMemo(() => new Set(openCase.data?.evidence.map((e) => e.line.id) ?? []), [openCase.data]);
  const splitOptions = useMemo(() => stats.data?.fields.filter((s) => s.distinct > 1 && s.name !== 'level') ?? [], [stats.data]);
  const stale = draft !== committed.text || lang !== committed.lang;
  const announce = useCallback((text: string) => dispatch({ type: 'announce', text }), []);
  const caseAction = useCaseAction(state.caseId, (id) => {
    dispatch({ type: 'setCase', id });
    announce('Opened a new case for this investigation.');
  });

  const commit = useCallback((q: Committed, extra: Partial<Extract<Action, { type: 'commit' }>> = {}) => {
    dispatch({ type: 'commit', committed: q, ...extra });
  }, []);

  // Running
  const run = () => {
    if (!parsed.ok) {
      announce(`Can't run: ${parsed.diagnostics[0]?.message ?? 'the query has an error.'}`);
      inputRef.current?.focus();
      return;
    }
    commit({ lang, text: draft, range: committed.range });
  };

  const setRange = (range: TimeRange) => commit({ ...committed, range }, { keepDraft: true });

  const zoomOut = () => {
    const span = committed.range.to - committed.range.from;
    setRange({ from: Math.max(extent.from, committed.range.from - span / 2), to: Math.min(extent.to, committed.range.to + span / 2) });
  };

  const baseQuery = (): { l: Lang; text: string } => (parsed.ok ? { l: lang, text: draft } : { l: committed.lang, text: committed.text });

  const filter = (field: string, value: FieldValue, negate: boolean, line: LogLine | null) => {
    const base = baseQuery();
    const formats = fieldInfo(catalog, field)?.formats ?? [];
    const format = line?.format ?? (formats.length === 1 ? formats[0] : 'json');
    const service = line?.labels.service ?? catalog.streams.find((s) => s.format === format)?.labels.service ?? 'auth';
    commit({ lang: base.l, text: addFilter(base.l, base.text, { field, value, negate, format, service }), range: committed.range });
  };

  const filterRange = (field: string, lo: number, hi: number) => {
    const base = baseQuery();
    const formats = fieldInfo(catalog, field)?.formats ?? [];
    const format = formats.length === 1 && formats[0] === 'logfmt' ? 'logfmt' : 'json';
    const service = catalog.streams.find((s) => s.format === format)?.labels.service ?? 'auth';
    commit({ lang: base.l, text: addRange(base.l, base.text, field, lo, hi, format, service), range: committed.range });
  };

  // Language switching
  const pickLang = (to: Lang) => {
    if (to === lang) return;
    if (!draft.trim()) {
      dispatch({ type: 'setLang', lang: to, draft: '' });
      return;
    }
    dispatch({ type: 'preview', preview: { to, translation: translate(lang, draft, catalog) } });
  };

  const confirmSwitch = () => {
    if (!preview) return;
    if (!preview.translation) {
      dispatch({ type: 'setLang', lang: preview.to, draft: '' });
      inputRef.current?.focus();
      return;
    }
    commit({ lang: preview.to, text: preview.translation.text, range: committed.range }, { openField: preview.translation.breakdownField ?? undefined });
    inputRef.current?.focus();
  };

  const offer = useMemo(() => {
    const other = otherLang(lang);
    return !parsed.ok && draft.trim() !== '' && draft !== state.offerDismissed && parseQuery(other, draft).ok ? other : null;
  }, [lang, draft, parsed.ok, state.offerDismissed]);

  // Lines, entities, cases
  const select = (line: LogLine, open: boolean) => dispatch({ type: 'select', id: line.id, line, open });

  const togglePin = (line: LogLine) => {
    const wasPinned = pinned.has(line.id);
    caseAction.mutate(
      (store, id) => (wasPinned ? store.unpin(id, line.id) : store.pin(id, { line, lang: committed.lang, query: committed.text, range: committed.range, note: '' })),
      {
        onSuccess: (c) => announce(wasPinned ? 'Removed from the case.' : `Pinned to "${c.title}". ${plural(c.evidence.length, 'line')} pinned.`),
        onError: (e) => announce(`Couldn't update the case: ${e.message}`),
      },
    );
  };

  const pivot = (ref: EntityRef) => dispatch({ type: 'pivot', ref });
  const searchEntity = (ref: EntityRef) => commit({ lang, text: entityQuery(lang, ref), range: extent });
  const addEntity = (ref: EntityRef) => caseAction.mutate((store, id) => store.addEntity(id, ref), {
    onSuccess: (c) => announce(`Added ${ref.value} to "${c.title}".`),
    onError: (e) => announce(`Couldn't update the case: ${e.message}`),
  });
  const addAlert = (a: Alert) => caseAction.mutate((store, id) => store.addEvent(id, {
    kind: 'alert',
    text: `Linked alert "${a.ruleName}"${Object.keys(a.labels).length ? ` (${Object.entries(a.labels).map(([k, v]) => `${k}=${v}`).join(', ')})` : ''}, ${formatClock(a.startsAt, 'utc', 'm')} UTC.`,
    query: null,
  }), {
    onSuccess: (c) => announce(`Linked the alert to "${c.title}".`),
    onError: (e) => announce(`Couldn't update the case: ${e.message}`),
  });

  const openQuery = (q: Committed, line: LogLine | null) => {
    commit(q);
    if (line) dispatch({ type: 'select', id: line.id, line, open: true });
    dispatch({ type: 'setView', view: 'results' });
  };

  const pickHistory = (h: HistoryEntry) => commit({ lang: h.lang, text: h.text, range: h.range });

  const closeSheet = () => {
    dispatch({ type: 'sheet', sheet: null });
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.stream')?.focus());
  };

  // Record each finished run, and audit it on the open case
  useEffect(() => {
    if (!search.data || search.isPlaceholderData) return;
    const count = search.data.kind === 'logs' ? search.data.total : search.data.totalSeries;
    dispatch({ type: 'recordRun', committed, count, kind: search.data.kind });
    const key = JSON.stringify([state.caseId, committed]);
    if (state.caseId && logged.current !== key && logged.current !== '') {
      services.cases.addEvent(state.caseId, { kind: 'query', text: `Ran a ${langName[committed.lang]} query (${formatCount(count)} ${search.data.kind === 'logs' ? 'lines' : 'series'}).`, query: committed })
        .catch(() => undefined);
    }
    logged.current = key;
  }, [search.data, search.isPlaceholderData]);

  // Announce result changes
  useEffect(() => {
    if (!search.data || search.isPlaceholderData) return;
    const d = search.data;
    announce(d.kind === 'logs'
      ? `${formatCount(d.total)} of ${formatCount(d.scanned)} lines match.`
      : `Metric query returned ${formatCount(d.totalSeries)} series, ${d.unit}.`);
  }, [search.data, search.isPlaceholderData]);

  // Alerts and live tail
  useAlertSubscription((s: AlertSnapshot) => {
    const firing = new Set(s.states.filter((x) => x.state === 'firing').map((x) => x.ruleId));
    const before = firingBefore.current;
    if (before) {
      const started = [...firing].filter((id) => !before.has(id));
      if (started.length) announce(`Alert firing: ${started.map((id) => s.alerts.find((a) => a.ruleId === id)?.ruleName ?? id).join(', ')}.`);
    }
    firingBefore.current = firing;
  }, (e) => announce(`Alerts are unavailable: ${e.message}`));

  useTail(committed, state.live, (b) => {
    lastNow.current = b.now;
    if (b.lines.length || b.exhausted) dispatch({ type: 'tailBatch', lines: b.lines, exhausted: b.exhausted });
    if (b.exhausted) announce('The demo recording has no more lines.');
  }, (e) => {
    dispatch({ type: 'setLive', on: false });
    announce(e.message);
  });

  const flushLive = () => {
    const to = lastNow.current ?? committed.range.to;
    invalidate();
    dispatch({ type: 'flushLive', to });
  };

  // URL state and shortcuts
  useEffect(() => {
    window.history.replaceState(null, '', writeUrl(state));
  }, [state.committed, state.selected, state.caseId, state.resultsView, state.entity]);

  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      inputRef.current?.focus();
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onShortcut(e);
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const result = search.data;
  const summary = !result ? '' : result.kind === 'metric'
    ? result.unit
    : result.total > result.lines.length
      ? `${state.sort === 'newest' ? 'Newest' : 'Oldest'} ${formatCount(result.lines.length)} of ${formatCount(result.total)} matching · ${formatCount(result.scanned)} in range`
      : `${formatCount(result.total)} of ${formatCount(result.scanned)} in range`;
  const resultCount = !result ? '…' : result.kind === 'logs' ? formatCount(result.total) : String(result.series.length);
  const firing = snapshot?.states.filter((s) => s.state === 'firing').length ?? 0;
  const href = `${window.location.href.split('#')[0]}${writeUrl(state)}`;
  const isWhole = committed.range.from <= extent.from && committed.range.to >= extent.to;

  return (
    <div
      className="workspace"
      data-view={state.view}
      data-sheet={state.sheet ?? 'none'}
      data-lang={lang}
      data-searching={search.isFetching}
    >
      <title>{`${committed.text ? `${committed.text} · ` : ''}${resultCount} ${result?.kind === 'metric' ? 'series' : 'lines'}`}</title>
      <section className="band" aria-label="Query">
        <div className="querybar">
          <LangSwitch lang={lang} onPick={pickLang} />
          <QueryEditor
            lang={lang}
            value={draft}
            diagnostics={parsed.diagnostics}
            catalog={catalog}
            inputRef={inputRef}
            onChange={(text) => dispatch({ type: 'edit', text })}
            onRun={run}
          />
          <button type="button" className="run-button" data-lang={lang} onClick={run} aria-disabled={!parsed.ok} aria-busy={search.isFetching}>
            <Icon name="run" /><span>{search.isFetching ? 'Searching' : 'Run'}</span><kbd>Enter</kbd>
          </button>
        </div>
        <div className="toolbar">
          <SourcePicker source={source} onSource={onSource} />
          <TimeRangeControl extent={catalog} range={committed.range} zone={zone} onApply={setRange} onZone={(z) => dispatch({ type: 'setZone', zone: z })} />
          <LiveToggle
            live={state.live}
            ended={state.liveEnded}
            blocked={metricQuery ? 'Live tail follows log queries. Metric queries update when you run them again.' : null}
            onLive={(on) => { dispatch({ type: 'setLive', on }); announce(on ? 'Following new lines as they arrive.' : 'Stopped following new lines.'); }}
          />
          <button
            type="button"
            className="tool-button"
            disabled={!state.back.length}
            title={state.back[0] ? `Back to ${langName[state.back[0].lang]}: ${state.back[0].text || '(every line)'}` : 'Nothing to go back to'}
            onClick={() => dispatch({ type: 'back' })}
          >
            <Icon name="back" /><span className="tool-label">Back</span>
          </button>
          <HistoryMenu history={state.history} zone={zone} onPick={pickHistory} />
          <CopyAs lang={lang} text={draft} translate={(to) => (to === lang ? null : translate(lang, draft, catalog))} onCopied={announce} />
          <CopyLink href={href} onCopied={announce} />
          <span className="toolbar-spacer" />
          <AlertBell snapshot={snapshot} onOpen={() => dispatch({ type: 'sheet', sheet: 'alerts' })} />
        </div>
        <Notices
          diagnostics={parsed.diagnostics}
          stale={stale}
          offer={offer}
          lang={lang}
          onFix={(text) => dispatch({ type: 'edit', text })}
          onAcceptOffer={() => { if (offer) commit({ lang: offer, text: draft, range: committed.range }); }}
          onDismissOffer={() => dispatch({ type: 'dismissOffer', text: draft })}
        />
        {search.isError && (
          <p className="notice" data-tone="error">
            <Icon name="alert" />
            <span>{`The search failed: ${search.error?.message ?? 'unknown error'}. Results below are from the last search that worked.`}</span>
            <button type="button" className="text-button" onClick={() => { search.refetch(); }}><Icon name="retry" /> Try again</button>
          </p>
        )}
        {preview && (
          <SwitchPreviewPanel
            from={lang}
            to={preview.to}
            translation={preview.translation}
            onConfirm={confirmSwitch}
            onCancel={() => dispatch({ type: 'preview', preview: null })}
          />
        )}
        <Timeline
          query={committed}
          extent={extent}
          zone={zone}
          split={state.split}
          splitOptions={splitOptions}
          compare={state.compare}
          onSplit={(field) => dispatch({ type: 'setSplit', field })}
          onZoom={setRange}
          onCompare={(focus) => { dispatch({ type: 'setCompare', focus }); announce('Comparing the window with the time around it. See Fields.'); }}
          onZoomOut={zoomOut}
        />
      </section>

      <section className="pane pane-fields" aria-label="Fields">
        <FieldPanel
          query={committed}
          zone={zone}
          lang={lang}
          openField={state.openField}
          split={state.split}
          compare={state.compare}
          extent={extent}
          onOpen={(field) => dispatch({ type: 'openField', field })}
          onCompare={(focus) => dispatch({ type: 'setCompare', focus })}
          onFilter={(field, value, negate) => filter(field, value, negate, null)}
          onRange={filterRange}
          onPivot={pivot}
          onSplit={(field) => dispatch({ type: 'setSplit', field })}
        />
      </section>

      <main className="pane pane-results" aria-label="Results" aria-busy={search.isFetching}>
        <ResultsHeader
          view={state.resultsView}
          metric={result?.kind !== 'metric' ? null : result.instant ? 'Values' : 'Series'}
          summary={summary}
          sort={state.sort}
          pattern={state.pattern}
          pending={state.pending.length}
          onView={(view) => dispatch({ type: 'setResultsView', view })}
          onSort={(sort) => dispatch({ type: 'setSort', sort })}
          onClearPattern={() => dispatch({ type: 'setPattern', pattern: null })}
          onFlush={flushLive}
        />
        <QueryStatus query={search} loading="Searching the capture…">
          {(r) => (
            <ResultsShape shape={r.kind === 'metric' ? 'metric' : state.resultsView}>
              {r.kind === 'metric' ? <MetricView result={r} zone={zone} />
                : state.resultsView === 'patterns' ? (
                  <PatternList
                    query={committed}
                    onShowLines={(p) => { dispatch({ type: 'setPattern', pattern: { id: p.id, template: p.template } }); announce(`Showing the ${plural(p.count, 'line')} in this pattern.`); }}
                  />
                ) : (
                  <LogStream
                    lines={r.lines}
                    sort={state.sort}
                    zone={zone}
                    terms={terms}
                    selectedId={state.selected?.id ?? null}
                    pinned={pinned}
                    canWiden={!isWhole}
                    canGoBack={state.back.length > 0}
                    queryText={committed.text}
                    onSelect={select}
                    onPin={togglePin}
                    onClose={closeSheet}
                    onWiden={() => setRange(extent)}
                    onBack={() => dispatch({ type: 'back' })}
                  />
                )}
            </ResultsShape>
          )}
        </QueryStatus>
      </main>

      <aside className="pane pane-side" aria-label="Line, entity, and case">
        <div className="side-tabs" role="tablist" aria-label="Side panel">
          {(['line', 'entity', 'case'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`tab-${tab}`}
              aria-selected={state.sideTab === tab}
              aria-controls={`panel-${tab}`}
              onClick={() => dispatch({ type: 'setSideTab', tab })}
            >
              {tab === 'line' ? 'Line' : tab === 'entity' ? 'Entity' : `Case · ${openCase.data?.evidence.length ?? 0}`}
            </button>
          ))}
        </div>
        <div className="side-panel side-line" role="tabpanel" id="panel-line" aria-labelledby="tab-line" data-active={state.sideTab === 'line'}>
          <LineDetail
            selection={state.selected}
            open={state.sheet === 'line'}
            zone={zone}
            pinned={state.selected !== null && pinned.has(state.selected.id)}
            caseTitle={openCase.data?.title ?? null}
            onPin={togglePin}
            onFilter={filter}
            onPivot={pivot}
            onSelect={(line) => select(line, true)}
            onClose={closeSheet}
          />
        </div>
        <div className="side-panel side-entity" role="tabpanel" id="panel-entity" aria-labelledby="tab-entity" data-active={state.sideTab === 'entity'}>
          <EntityView
            entity={state.entity}
            zone={zone}
            extent={extent}
            onSearch={searchEntity}
            onAddToCase={addEntity}
            onSelect={(line) => select(line, true)}
            onClose={closeSheet}
          />
        </div>
        <div className="side-panel side-case" role="tabpanel" id="panel-case" aria-labelledby="tab-case" data-active={state.sideTab === 'case'}>
          <CasePanel
            caseId={state.caseId}
            zone={zone}
            onCase={(id) => dispatch({ type: 'setCase', id })}
            onOpenQuery={openQuery}
            onPivot={pivot}
            onAnnounce={announce}
          />
        </div>
      </aside>

      {state.sheet === 'alerts' && (
        <div className="alerts-sheet">
          <AlertsPanel
            snapshot={snapshot}
            zone={zone}
            current={committed}
            extent={extent}
            onInvestigate={(q) => { commit(q); closeSheet(); }}
            onAddToCase={addAlert}
            onClose={closeSheet}
            onAnnounce={announce}
          />
        </div>
      )}

      {state.sheet !== null && (
        <button type="button" className="scrim" aria-label="Close panel" tabIndex={-1} onClick={closeSheet} />
      )}

      <Switcher
        view={state.view}
        resultCount={resultCount}
        evidenceCount={openCase.data?.evidence.length ?? 0}
        firing={firing}
        onView={(view) => dispatch({ type: 'setView', view })}
        onAlerts={() => dispatch({ type: 'sheet', sheet: 'alerts' })}
      />

      <p className="sr-only" aria-live="polite">{`${state.announcement.text}${state.announcement.seq % 2 ? ' ' : ''}`}</p>
    </div>
  );
};

// Boot: load the catalog, then start the workspace
const Boot = ({ source, onSource }: { source: SourceId; onSource: (id: SourceId) => void }) => {
  const catalog = useCatalog();
  const cases = useCases();
  const ready = catalog.data && (cases.data || cases.isError);
  return ready && catalog.data ? (
    <Workspace boot={catalog.data} defaultCase={cases.data?.[0]?.id ?? null} source={source} onSource={onSource} />
  ) : (
    <div className="boot">
      <QueryStatus query={catalog} loading={`Loading ${config.sources.find((s) => s.id === source)?.label ?? 'the capture'}…`}>
        {() => <p className="status" role="status"><span className="status-pulse" aria-hidden="true" />Opening cases…</p>}
      </QueryStatus>
    </div>
  );
};

const client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

const Root = () => {
  const [source, setSource] = useState<SourceId>(config.defaultSource);
  const services = useMemo(() => createServices(source, client), [source]);
  return (
    <QueryClientProvider client={client}>
      <ServicesContext value={services}>
        <Boot key={source} source={source} onSource={setSource} />
      </ServicesContext>
    </QueryClientProvider>
  );
};

// Mount
const mount = document.getElementById('app');
if (mount) createRoot(mount).render(<Root />);

