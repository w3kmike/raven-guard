# Log Investigation Workspace

A shared workspace where security analysts and SREs search the same distributed logs in Lucene or LogQL, follow an entity across services, compare a spike to its baseline, and build a case from evidence they can hand off.

## Intent

- **Form:** An investigation workspace, built for long, focused sessions: hypothesize, query, narrow, pivot, keep.
- **People and context:** Security analysts (who think in Lucene and fields) and SREs (who think in LogQL, streams, and rates) working one incident together, at a desk, often under pressure. Alerts start the work; cases end it.
- **Core experience:** Get from a question to the lines, patterns, or entities that answer it, in whichever language suits the question, without losing context when switching languages, pivoting, or handing off.
- **Must keep achieving:** Both languages are first-class. Switching between them never silently drops meaning. Every result can be narrowed by clicking what you see. Every piece of evidence records the query that found it, so a teammate can rerun it. The UI talks only to ports, so the mock backend can be replaced without touching components.

## Design decisions

**Information architecture.** The query bar, toolbar, notices, and histogram form one band at the top, because the query and its shape over time are read together. Below it are three columns on desktop and iPad landscape: Fields (summarize and compare), Results (lines, patterns, or series), and a side panel with Line, Entity, and Case tabs (inspect, pivot, keep). Alerts and rules open as a sheet from the bell, because they are where work starts and are visited between queries. On iPad portrait and phones, a bottom switcher holds Results, Fields, Case, and Alerts; Line and Entity open as sheets over Results, because reading lines is the primary task.

**User experience.** The first view is the whole capture with an empty query, so the credential-stuffing spike is visible before anything is typed. The seeded case (`case-2417`) is open, so a newcomer sees what evidence looks like. Results never blank on a mistake: an invalid query keeps the last good results and says so. Empty results name the query and range and offer the way back. Each network call shows a loading state in the subject's words ("Gathering activity for 203.0.113.77…") and an error state with Retry.

**Interaction design.** Enter runs the query, and an edited query is marked "Not run yet," because running on every keystroke would hide which results belong to which query. `=` and `≠` buttons insert a clause in the active language and run it. A single Back stack covers query, language, and time-range changes. Brushing the histogram asks whether to zoom or compare, because both are common next steps after spotting a spike. Brushing a numeric distribution adds a range filter.

**Concept-specific problems.**
1. *Which language is active:* The switch, the editor's left rule, the Run button, and language tags take the accent of the active language (`--mode-lucene`, `--mode-logql`).
2. *Translation on switch:* Both languages translate through one shared filter model (`app/query/translate.ts`). The preview lists every clause as Kept, Changed, or Dropped with the reason, and the switch runs only on confirm.
3. *Two data models:* Fields marks LogQL stream labels with a STREAM badge. LogQL warns when a selector uses a parsed field or a filter needs a parser stage, and offers the fix.
4. *Language traps:* Lucene uses real clause semantics (must, should, must-not; default OR). Mixed `AND`/`OR` without parentheses shows how Lucene reads it and offers a one-click grouping. Escaping errors for `/` and `:` are explained with the quoted fix.
5. *Following an entity (feature 1):* IPs, users, hosts, beneficiaries, and request IDs carry a pivot button wherever they appear. The Entity view shows enrichment, an activity strip with one row per service on a shared time axis, and the entity's lines, so "what else did this IP do" is one click. "Search for it" writes the entity query in the active language.
6. *Too many lines to read (feature 2):* Patterns groups lines by template. Values are kept when a field has 4 or fewer distinct values in that service and masked as `<ip>`, `<num>`, `<user>` otherwise, so templates read as events. Each pattern has a sparkline and a count. "Rarest first" puts the one-off events (the MFA-bypass login) on top.
7. *Is this spike unusual (feature 3):* Compare ranks fields by how much their value shares changed between the focus window and equal-length windows around it. A lift bar shows focus versus baseline share per value. Values with fewer than 5 lines in both windows are skipped, because tiny counts produce noisy lifts.
8. *Handoff by link (feature 4):* The URL hash holds language, query, range, selected line, open case, results view, and entity. Link copies it.
9. *Numbers in fields (feature 5):* Numeric fields show a distribution. It switches to a log scale when max/min is at least 100, so latency tails stay visible; zero gets its own bin. p95 and p99 buttons add a range filter above that percentile.
10. *Context that isn't in the logs (feature 6):* Enrichment badges flag malicious or suspicious IPs, nonexistent or MFA-exempt users, and new beneficiaries next to the value itself. The Entity view lists the full record.
11. *Knowing when to look (feature 7):* Rules are written in either language with a threshold and window. Each card states the rule as a sentence, shows a sparkline against the threshold, and offers Investigate, which runs the rule's query over the alert's window.
12. *Keeping and handing off (feature 8):* Cases hold evidence (each line with the query and range that found it and a note), entities, and an activity log that records pins, status changes, and the queries run while the case is open, each with "Run again." Copy case produces Markdown.
13. *Watching it happen (feature 9):* Live replays the tail at simulated speed. New lines collect in a "N new lines · Show" bar so the list doesn't move under the reader. The bell announces newly firing rules. The source picker lists Elasticsearch and Loki as not connected, because the ports exist for them.

**Visual interface.** IBM Plex Mono is used for all data (lines, labels, queries) because its dotted zero and distinct l/1/I matter for IPs and IDs. IBM Plex Sans Condensed is used for chrome. Mono versus sans is how the person tells evidence from tool. The stream is a cool slate surface. The case is a warm manila surface, so kept material reads as separate from the live stream. Severity, reputation tone, and rule state each have their own token family and always carry a text label. Dark is the default because SOC and on-call rooms are dim; light follows the system setting.

**Content.** Copy uses each language's vocabulary ("stream selector," "line filter," "parser stage," "clause") and the incident's ("Pin to case," "firing," "resolved," "beneficiary"). Errors give the column and the fix.

**Motion.** Panels drop in from where they open; new evidence slides in from the stream's side; counts bump when they change; the results area re-enters when its shape changes. Durations are short because a log tool shouldn't perform. Under reduced motion, movement becomes a fade and bumps are skipped.

**Accessibility.** The editor is an ARIA combobox. The stream is a listbox using `aria-activedescendant`, because rows are virtualized. One polite live region announces runs, filters, pins, live lines, and firing rules. Every chart has a text or table equivalent (see Data visualization). Compare has a form, so it works without brushing.

## Design system

- **Source:** The log row. The row height sets the grid, and spacing tokens step from it. Color comes from the stream (cool), the case file (warm), severity levels, syntax roles shared by both languages, one accent per language, reputation tones, and rule states.
- **Files:** `app/tokens.css` holds every CSS value: type, grid and sizes, radius, depth, motion, layers, and color (dark default plus a light block). `app/tokens.ts` holds only the GSAP ease names, because GSAP can't read CSS easing without a plugin.
- **Naming:** By role: `--surface-case`, `--level-warn`, `--severity-critical`, `--tone-malicious`, `--signal-firing`, `--mode-logql`, `--strip-row`, `--dist-height`.
- **Applying:** Use `var(--token)` in CSS. TypeScript reads px and ms tokens with `cssPx` and `cssMs` from `app/utils.ts`, so values have one source. Local properties (`--mode-active`, `--level-color`, `--severity-color`, `--state-color`, `--tone`, `--row-current`, `--filter-size`) are derived in `styles.css` from tokens and data attributes.
- **Adding:** Define it in `tokens.css` (and in the light block if it's a color), then reference it.
- **Known exception:** Breakpoints (600px, 1024px) are literal in media queries, because custom properties can't be used there.
- **Data is exempt:** Values in `data/` (IPs, latencies, thresholds) are content, so they never use tokens.

## Data visualization

- **Volume histogram.** For both roles, glanced at repeatedly. Data: line counts per bucket, stacked by level or by a field's top values. Insight: spikes, gaps, and what drives them. Goal: diagnose and navigate time. Form: stacked bars on a zero baseline, because counts compare by length. Brush to zoom or compare. Gaps of 3+ empty buckets are annotated, because a missing region is a finding. Equivalent: a text summary.
- **Field breakdown.** Data: one field's top values. Goal: pick the next filter. Form: a sorted table with share bars, so bars compare across fields.
- **Compare lift.** Data: value shares in focus versus baseline. Insight: what changed. Goal: diagnose. Form: paired position marks per value, ranked by change, with the percentages as text, because position reads more accurately than color.
- **Numeric distribution.** Data: a numeric field's values. Insight: the shape and the tail. Goal: find outliers and filter to them. Form: a histogram, log-binned when the range spans two orders of magnitude, with p95 and p99 marked. Equivalent: a text summary of min, median, p95, p99, and max.
- **Pattern and rule sparklines.** For scanning a list. Form: small lines with no axes, because only shape matters there; rule sparklines show the threshold as a line. The count and state beside them carry the number.
- **Entity activity strip.** Data: one entity's line times per service. Insight: sequence across services (sshd probing, then auth, then payments). Form: a tick strip per service on a shared axis. Equivalent: a list with each service's count and first and last times.
- **Metric series.** Form: lines on a zero baseline with direct labels where they fit, a hover crosshair, and a summary table (latest, peak with time, mean). Capped at 8 series with a notice; a window covering the whole range shows stat values.

## Usage

- Type a query and press Enter (Shift+Enter for a new line). Ctrl+Space opens suggestions; Tab or Enter accepts.
- `/` focuses the query from anywhere.
- In the stream: ↑/↓, Page Up/Down, Home/End move; Enter opens the line; P pins or unpins; Esc closes.
- Drag across the histogram, then choose "Zoom to this" or "Compare with the time around it."
- On touch: tap a row to open its sheet; tap the scrim or ✕ to close; switch views in the bottom bar.

Example path through the mock incident: `service:auth AND status:401` → Patterns, rarest first → open the 02:37:12.481 login → pivot on `203.0.113.77` → pin to case → Compare 02:05–02:40 → turn on Live and watch "Failed logins from one source" fire.

## Architecture

Source files live in `app/`; static data in `data/`; the generator in `scripts/`; the document and project files in the pen's root.

- `index.html`: Document, font links, links to `app/tokens.css` and `app/styles.css`, mount point, and `app/main.js` (compiled from `app/main.tsx`).
- `package.json`: Pinned runtime dependencies, from which CodePen builds the import map.
- `tsconfig.json`: Strict settings; compiles `app/` with `"types": []`, so only the shims supply library types.
- `data/capture-1.json`, `data/capture-2.json`: 7,013 lines in 40 streams over six hours (the incident). The first file holds the label, range, streams, the list of remaining parts, and the first half of the lines; the second holds the rest. CodePen rejects text files of 1 MB or more, so the generator splits the capture into equal parts under 900 KB, and `loadCapture` in `app/mock/backend.ts` joins them in order.
- `data/tail.json`: 645 lines replayed by Live, offset from the capture's end, including a second attack wave.
- `data/enrichment.json`, `data/rules.json`, `data/cases.json`: Reputation and directory records, four alert rules, and the seeded case.
- `scripts/generate-data.ts`: Deterministic generator for every file in `data/`.
- `app/shims.d.ts`: Types for the parts of react, react/jsx-runtime, react-dom/client, d3, gsap, and @tanstack/react-query the pen uses.
- `app/tokens.css`, `app/tokens.ts`, `app/styles.css`: Design system and styles.
- `app/config.ts`: Behavior settings, sources, and mock settings.
- `app/schemas.ts`: All domain types and boundary validators for data read from `data/`.
- `app/api.ts`: Port interfaces, `createServices` (the composition root), `ServicesContext`, query keys, and TanStack Query hooks.
- `app/state.ts`: Reducer, actions, and URL hash read/write.
- `app/utils.ts`: Search, regex, time, and number helpers; token readers.
- `app/query/`: Language layer. `lucene.ts` and `logql.ts` (parsers, compilers, warnings, lexers), `common.ts` (shared types and helpers), `translate.ts`, `suggest.ts`, and `index.ts` (parse, click-to-filter, range and entity queries).
- `app/mock/`: Mock adapters. `engine.ts` (search, stats, patterns, compare, distribution, entity activity), `backend.ts` (loading `data/`, simulated latency and failure, the simulated clock), `alerts.ts` (rule evaluation), `cases.ts` (case store), `index.ts` (`createMockServices`).
- `app/components/`: `shared.tsx`, `querybar.tsx`, `timeline.tsx`, `fields.tsx`, `results.tsx`, `detail.tsx`, `entity.tsx`, `cases.tsx`, `alerts.tsx`.
- `app/main.tsx`: Providers, boot, workspace wiring, layout, and mount.

**Ports and adapters.** Components call hooks in `app/api.ts`, and hooks call the `Services` ports (`LogSource`, `Enrichment`, `RuleStore`, `AlertFeed`, `CaseStore`). Only `createServices(sourceId, client)` knows which adapter is used. To go to production, write an adapter per port (for example, an Elasticsearch `LogSource` that sends Lucene to `_search`, and a Loki one that sends LogQL to `query_range`), register it in `createServices`, and mark the source available in `config.sources`. Query keys start with the source id, so switching sources never shows another backend's cache.

**TanStack Query** owns server state: `useQuery` with `keepPreviousData` so results don't blank between runs, AbortSignal passed to every port so superseded runs are cancelled, `useMutation` for rules and cases, and `setQueryData` from the alert and tail subscriptions. Static files load through `client.fetchQuery`, so `data/` is cached like any other request. The mock adapters add latency (`config.mock.latencyMs`) and can fail (`config.mock.failureRate`), so loading and error states are exercised.

**React 19,** because many panels share query, result, selection, and case state. Patterns used: context as a provider (`<ServicesContext value>`) read with `use()`; ref callbacks with cleanup for ResizeObserver measurement; `useEffectEvent` for document listeners, subscriptions, and brushes; `<title>` rendered in the tree; `useReducer` with an init function that reads the URL.

**D3** computes scales, shapes, and brushes; React renders the SVG, so marks are styled by tokens.

## Customizing

- **Data:** Edit `scripts/generate-data.ts` and run `npx tsx scripts/generate-data.ts` from the pen's root to rewrite `data/`. The seed (20261024) keeps output identical between runs. New fields appear automatically in Fields, autocomplete, translation, and patterns.
- **Behavior (`app/config.ts`):**
  - `presets`, `defaultLang`, `defaultZone`, `defaultSort`: starting state and range shortcuts.
  - `sources`, `defaultSource`, `dataPath`: backends offered and where static data loads from.
  - `mock.latencyMs`, `mock.failureRate`: simulated network; set `failureRate` above 0 to see error states.
  - `mock.tailSpeed`, `mock.tailTickMs`: how fast Live replays the tail.
  - `searchLimit`: lines returned per search.
  - `entityFields`: which fields count as which entity kind (add a field here to make it pivotable).
  - `patternMaxDistinct`: the distinct-value count at or below which a field's values stay literal in templates.
  - `compareMinSupport`, `compareTopValues`: noise floor and values shown per field in Compare.
  - `distributionBins`, `logScaleRatio`: distribution resolution and when it switches to log scale.
  - `ruleEvalStepMs`, `ruleHistorySteps`, `staleMs`: rule evaluation resolution, sparkline length, and cache freshness.
  - `histogramTargetBuckets`, `maxSeries`, `contextLines`, `historyLimit`, `suggestionLimit`, `placeholders`: as before (keep `maxSeries` ≤ the 8 `--series-*` colors).
- **Design:** Edit `app/tokens.css`.
- **A new view:** Add a component in `app/components/`, a value in the `view` or `sheet` union in `app/state.ts`, a switcher item, and a grid placement in `app/styles.css`.
- **A new backend capability:** Add the method to the port in `app/api.ts`, a hook with a source-prefixed key, and the mock implementation in `app/mock/index.ts`.

## Dependencies

| Package | Version | Use |
|---|---|---|
| react, react-dom | 19.3.1 | UI and state |
| @tanstack/react-query | 5.104.5 (`?deps=react@19.3.1`) | Server state, caching, cancellation, mutations |
| d3 | 7.9.0 | Scales, line shapes, brushes, ticks |
| gsap | 3.13.0 | Entrance and feedback motion, via `gsap.matchMedia()` |

TanStack Query is pinned with `?deps=react@19.3.1` so it resolves to the pen's copy of React; a second copy would break hooks without an error message. Library types come from `app/shims.d.ts`. Every file that imports a library starts with `/// <reference path="…/shims.d.ts" />`, so the compiler finds the shims even when it starts from that file. When the pen uses another export from one of these libraries, declare it in the shim first, typed without `any`.

## Accessibility and devices

- Keyboard: every action is reachable; see Usage. Focus moves into sheets on narrow screens and back on close.
- Screen readers: combobox and listbox semantics, one live region, and table or text equivalents for every chart.
- Reduced motion: movement becomes fades; bumps are skipped.
- Devices: desktop is primary. iPad landscape gets three columns; iPad portrait and phones get the switcher layout with 44px targets, 16px inputs (no iOS zoom), safe-area padding, `dvh` height, and a horizontally scrolling toolbar. Popovers become bottom sheets under 600px.

## Guardrails

- Components must not import from `app/mock/`; they reach data only through `app/api.ts` hooks.
- Every query key starts with the source id.
- Never run a query on keystroke; never blank results on an invalid draft or while a new run loads.
- Language switches go through the translation preview, and the preview lists every dropped clause.
- Lucene keeps clause-occur semantics; don't change it to standard precedence, because the mixed-operator warning depends on it.
- LogQL selectors require a non-empty matcher, and parsed fields require a parser stage, as in Loki.
- Click-to-filter, range filters, and entity queries emit valid syntax in the active language.
- Evidence always stores the query, language, and range that found it.
- New live lines wait in the live bar; the list never moves under the reader.
- Data is mono and chrome is sans; the case surface stays warm; color is never the only carrier of meaning.
- All values come from tokens, except data in `data/`.
- `scripts/generate-data.ts` stays deterministic so the incident is reproducible. Regenerate `data/` instead of hand-editing it.
- Every file in `data/` stays under 1 MB. The generator throws if one doesn't; lower `partBudget` and it writes more capture parts, which the loader picks up from the `parts` list without code changes. Line IDs are positions in the joined capture, so parts must stay in time order.
- Every package in `package.json` is imported, and every library API used is declared in `app/shims.d.ts`.

Known simplifications: LogQL numeric label filters drop lines with missing values (Loki keeps them with `__error__`). `without`, `line_format`, and `pattern` aren't supported. Lucene boosts and fuzzy matching are rejected with an explanation. Cases persist in this browser's local storage only.

## Credits

- IBM Plex Mono and IBM Plex Sans Condensed: SIL Open Font License, via Google Fonts.
- Icons: path data from Tabler Icons, MIT License.
- Mock data is generated. IPs use documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) and private ranges; ASNs use the documentation range 64496–64511; domains use `.example`.
