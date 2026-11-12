/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: the Stations view: every station's strip and departure from normal in one ordered register, the focused station's events, swarm and news, and the record of a selected event.
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject
} from "react";
import gsap from "gsap";
import { reading as readingConfig, scoring } from "../config.js";
import { en as strings } from "../locales/en.js";
import { useSearchState } from "../navigation.js";
import { motion } from "../tokens.js";
import {
  cvesIn,
  inTrace,
  matchesWatch,
  traceDays,
  vendorTally,
  orderReadings,
  spanOrigin,
  type Reading,
  type WeightedEvent
} from "../model.js";
import type { Story } from "../api/schemas.js";
import { TokenForm, useReadings } from "./shell.js";
import {
  addWatchTerm,
  removeWatchTerm,
  togglePin,
  useStore
} from "../state.js";
import { Box, Stack } from "../components/layout.js";
import { Segmented } from "../components/controls.js";
import { DataTable } from "../components/data.js";
import {
  BackIcon,
  CloseIcon,
  OutboundIcon,
  PinIcon,
  PinnedIcon
} from "../components/icons.js";
import {
  HorizonStrip,
  ledgerPosition,
  ledgerTicks,
  RangeLedger,
  Swarm,
  type SwarmPoint
} from "../components/charts.js";
import {
  addDays,
  addMonths,
  dayIndex,
  daysBetween,
  formatClock,
  formatCount,
  formatDay,
  formatMonth,
  formatPercent,
  formatRatio,
  monthStart,
  tokenMs
} from "../lib/utils.js";

const { locale, timeZone } = readingConfig;
const day = (iso: string, withYear = false) =>
  formatDay(iso, locale, timeZone, withYear);

const kindLabel = (reading: Reading, long = false): string =>
  reading.station.catchAll
    ? long
      ? strings.focus.catchAllKind
      : strings.register.catchAll
    : strings.register.kind[reading.station.kind];

const vendorName = (vendor: string): string => {
  const known = strings.focus.unassigned.reporters[vendor];
  const plain = vendor.replaceAll("_", " ");
  return known ?? plain.charAt(0).toUpperCase() + plain.slice(1);
};

/* ----------------------------------------
   Register: one row per station
   ---------------------------------------- */
const StripAxis = ({ days, now }: { days: number; now: Date }) => {
  const origin = spanOrigin(now, days);
  const first = addMonths(monthStart(origin), 1);
  const count = Math.floor(days / 30);
  const step = count > 14 ? 3 : 1;
  const ticks = Array.from({ length: count }, (_, index) =>
    addMonths(first, index * step)
  ).filter((date) => date <= now);
  return (
    <div className="strip-axis" aria-hidden="true">
      {ticks.map((date) => (
        <span
          key={date.toISOString()}
          style={{
            left: `${(dayIndex(date.toISOString(), origin) / days) * 100}%`
          }}
        >
          {formatMonth(date, locale, date.getUTCMonth() === 0 || step > 1)}
        </span>
      ))}
    </div>
  );
};

const LedgerAxis = () => (
  <div className="ledger-axis-labels" aria-hidden="true">
    {ledgerTicks.map((tick) => (
      <span key={tick} style={{ left: `${ledgerPosition(tick)}%` }}>
        {tick < 1 ? `${tick === 0.5 ? "½" : "¼"}×` : `${tick}×`}
      </span>
    ))}
  </div>
);

type Cursor = { day: number; station: string } | null;

const StationRow = ({
  reading,
  selected,
  pinned,
  watched,
  cursor,
  onCursor,
  onSelect
}: {
  reading: Reading;
  selected: boolean;
  pinned: boolean;
  watched: number;
  cursor: Cursor;
  onCursor: (cursor: Cursor) => void;
  onSelect: (day?: number) => void;
}) => {
  const { now, days } = useReadings();
  const ratios = reading.rolling.map((value) => value / reading.normal);
  const unusual = reading.settled && reading.ratio >= scoring.unusualRatio;
  const recorded = reading.gaps.some((gap) => !gap);
  const change = reading.ratio / Math.max(0.01, reading.previousRatio);
  const trend = change >= 1.15 ? "up" : change <= 0.87 ? "down" : "flat";
  const track = (event: PointerEvent<HTMLSpanElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const at = Math.floor(((event.clientX - box.left) / box.width) * days);
    onCursor({
      day: Math.min(days - 1, Math.max(0, at)),
      station: reading.station.id
    });
  };
  const here = cursor?.station === reading.station.id ? cursor : null;
  const date = here
    ? day(addDays(spanOrigin(now, days), here.day).toISOString())
    : "";
  const dayEvents = here
    ? reading.events.filter((event) => inTrace(event, here.day)).length
    : 0;
  const pinLabel = pinned
    ? strings.register.watch.unpin(reading.station.name)
    : strings.register.watch.pin(reading.station.name);
  return (
    <li
      className="station"
      data-station={reading.station.id}
      data-catch-all={reading.station.catchAll || undefined}
    >
      <button
        type="button"
        className="station-pin"
        aria-pressed={pinned}
        aria-label={pinLabel}
        title={pinLabel}
        onClick={() => togglePin(reading.station.id)}
      >
        {pinned ? <PinnedIcon /> : <PinIcon />}
      </button>
      <button
        type="button"
        className="station-row"
        aria-current={selected || undefined}
        data-unusual={unusual || undefined}
        aria-label={strings.register.rowLabel(
          reading.station.name,
          formatRatio(reading.ratio),
          reading.recent.exploited,
          reading.recent.compromises
        )}
        onClick={(event) =>
          onSelect(
            (event.target as Element).closest(".station-strip") && here
              ? here.day
              : undefined
          )
        }
      >
        <span className="station-name">
          <span className="station-title">{reading.station.name}</span>
          <span className="station-kind">
            {watched > 0 && (
              <span className="station-watched">
                {strings.register.watch.watched(watched)} ·{" "}
              </span>
            )}
            {kindLabel(reading)}
            {!reading.settled && (
              <span className="station-state">
                {" "}
                · {strings.register.recording}
              </span>
            )}
            {reading.settled && reading.quiet && (
              <span className="station-state"> · {strings.register.quiet}</span>
            )}
          </span>
        </span>
        <span
          className="station-strip"
          onPointerMove={track}
          onPointerDown={track}
          onPointerLeave={() => onCursor(null)}
        >
          <HorizonStrip
            key={recorded ? "recorded" : "waiting"}
            ratios={ratios}
            gaps={reading.gaps}
            marks={reading.exploitedDays}
            rug={reading.compromisesByDay}
            cursor={cursor?.day ?? null}
          />
          {here && (
            <span
              className="strip-reading"
              style={{ left: `${((here.day + 0.5) / days) * 100}%` }}
            >
              {strings.register.stripReading(
                date,
                formatRatio(ratios[here.day] ?? 0),
                dayEvents
              )}
            </span>
          )}
        </span>
        <span className="station-ledger">
          <RangeLedger
            ratio={reading.ratio}
            bandLow={reading.bandLow}
            bandHigh={reading.bandHigh}
            unusualAt={scoring.unusualRatio}
            pending={!reading.settled}
            previous={reading.previousRatio}
          />
          <span
            className="station-ratio"
            data-trend={reading.settled ? trend : undefined}
            title={strings.register.lastWeek(
              formatRatio(reading.previousRatio)
            )}
          >
            {reading.settled ? formatRatio(reading.ratio) : "—"}
          </span>
        </span>
        <span className="station-counts">
          <span
            className="count-exploited"
            data-zero={!reading.recent.exploited || undefined}
          >
            {reading.recent.exploited}
          </span>
          <span className="count-sep" aria-hidden="true">
            ·
          </span>
          <span
            className="count-malicious"
            data-zero={!reading.recent.compromises || undefined}
          >
            {formatCount(reading.recent.compromises, locale)}
          </span>
        </span>
      </button>
    </li>
  );
};

const useReorderMotion = (
  list: RefObject<HTMLOListElement | null>,
  order: string
) => {
  const previous = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const rows = [
      ...(list.current?.querySelectorAll<HTMLElement>("[data-station]") ?? [])
    ];
    const duration = tokenMs("--dur-reorder") / 1000;
    rows.forEach((row) => {
      const id = row.dataset.station ?? "";
      const top = row.getBoundingClientRect().top;
      const before = previous.current.get(id);
      if (before !== undefined && before !== top && duration > 0) {
        gsap.fromTo(
          row,
          { y: before - top },
          { y: 0, duration, ease: motion.ease, overwrite: true }
        );
      }
    });
    previous.current = new Map(
      rows.map((row) => [
        row.dataset.station ?? "",
        row.getBoundingClientRect().top - Number(gsap.getProperty(row, "y"))
      ])
    );
  }, [list, order]);
};

const recentWatched = (
  reading: Reading,
  terms: readonly string[],
  days: number
): number =>
  reading.events.filter(
    (event) =>
      event.day >= days - scoring.recentDays && matchesWatch(event, terms)
  ).length;

const Watchlist = ({ readings }: { readings: Reading[] }) => {
  const { days } = useReadings();
  const { pins, terms } = useStore((state) => state.watchlist);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const matched = readings.reduce(
    (total, reading) => total + recentWatched(reading, terms, days),
    0
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const added = addWatchTerm(draft);
    setInvalid(!added);
    if (added) setDraft("");
  };
  const note =
    !pins.length && !terms.length
      ? strings.register.watch.empty
      : !terms.length
        ? ""
        : matched
          ? strings.register.watch.summary(matched)
          : strings.register.watch.none;
  return (
    <section className="watchlist" aria-labelledby="watchlist-heading">
      <h2 id="watchlist-heading" className="segmented-legend">
        {strings.register.watch.heading}
      </h2>
      <form className="watch-form" onSubmit={submit}>
        {terms.length > 0 && (
          <ul className="chips">
            {terms.map((term) => (
              <li key={term}>
                <button
                  type="button"
                  className="chip chip-watch"
                  aria-label={strings.register.watch.remove(term)}
                  onClick={() => removeWatchTerm(term)}
                >
                  <span>{term}</span>
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="visually-hidden" htmlFor="watch-term">
          {strings.register.watch.fieldLabel}
        </label>
        <input
          id="watch-term"
          className="field watch-field"
          placeholder={strings.register.watch.fieldLabel}
          value={draft}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
        />
        <button type="submit" className="solid-button">
          {strings.register.watch.add}
        </button>
      </form>
      <p
        className="meta"
        role={invalid ? "alert" : undefined}
        aria-live="polite"
      >
        {invalid ? strings.register.watch.invalid : note}
      </p>
    </section>
  );
};

const Progress = () => {
  const { feeds } = useReadings();
  const kevBytes = useStore((state) => state.progress.kev);
  const token = useStore((state) => state.githubToken);
  const reviewed = feeds.find((feed) => feed.feed === "ghsa-reviewed");
  const critical = feeds.find((feed) => feed.feed === "nvd-critical");
  const paused = feeds.find((feed) => feed.paused > 0 && feed.resumesAt);
  const recording =
    Boolean(kevBytes) ||
    (reviewed !== undefined && reviewed.recorded < reviewed.chunks) ||
    (critical !== undefined && critical.recorded < critical.chunks);
  if (!recording && !paused) return null;
  return (
    <div className="progress" role="status">
      {reviewed && critical && recording && (
        <p className="progress-line">
          {strings.register.progress(
            reviewed.recorded,
            reviewed.chunks,
            critical.recorded,
            critical.chunks
          )}
          {kevBytes
            ? ` ${strings.register.kevBytes((kevBytes / 1_000_000).toFixed(1))}`
            : ""}
        </p>
      )}
      {paused?.resumesAt && !token && (
        <div className="paused-prompt">
          <p>
            {strings.register.pausedPrompt(
              formatClock(paused.resumesAt, locale, timeZone)
            )}
          </p>
          <TokenForm compact />
        </div>
      )}
    </div>
  );
};

const Register = ({
  readings,
  selectedId,
  onSelect
}: {
  readings: Reading[];
  selectedId: string | undefined;
  onSelect: (id: string, day?: number) => void;
}) => {
  const { now, days } = useReadings();
  const [search, setSearch] = useSearchState();
  const { pins, terms } = useStore((state) => state.watchlist);
  const [cursor, setCursor] = useState<Cursor>(null);
  const list = useRef<HTMLOListElement>(null);
  const pinned = readings.filter((reading) =>
    pins.includes(reading.station.id)
  );
  const rest = readings.filter((reading) => !pins.includes(reading.station.id));
  const row = (reading: Reading) => (
    <StationRow
      key={reading.station.id}
      reading={reading}
      selected={reading.station.id === selectedId}
      pinned={pins.includes(reading.station.id)}
      watched={recentWatched(reading, terms, days)}
      cursor={cursor}
      onCursor={setCursor}
      onSelect={(day) => onSelect(reading.station.id, day)}
    />
  );
  useReorderMotion(
    list,
    [...pinned, ...rest].map((reading) => reading.station.id).join(",")
  );

  const settled = readings.filter(
    (reading) => reading.settled && !reading.station.catchAll
  );
  const unusual = settled.filter(
    (reading) => reading.ratio >= scoring.unusualRatio
  ).length;
  const top = orderReadings(settled, "departure")[0];

  const move = (event: KeyboardEvent<HTMLOListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = [
      ...(list.current?.querySelectorAll<HTMLButtonElement>(".station-row") ??
        [])
    ];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : Math.min(
              buttons.length - 1,
              Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1))
            );
    event.preventDefault();
    buttons[next]?.focus();
  };

  return (
    <section className="register" aria-labelledby="register-heading">
      <Stack gap="tight" className="register-head">
        <h1 id="register-heading" className="headline">
          {strings.register.heading}
        </h1>
        <p className="lede">{strings.register.lede}</p>
        <p className="register-summary" aria-live="polite">
          {top
            ? strings.register.summary(
                top.station.name,
                formatRatio(top.ratio),
                unusual
              )
            : ""}
        </p>
        <Progress />
      </Stack>
      <Stack
        direction="row"
        gap="loose"
        wrap
        align="flex-start"
        className="register-controls"
      >
        <Segmented
          label={strings.register.kindLabel}
          value={search.kind}
          options={(["all", "ecosystem", "platform"] as const).map((kind) => ({
            value: kind,
            label: strings.register.kinds[kind]
          }))}
          onChange={(kind) => setSearch({ kind })}
        />
        <Segmented
          label={strings.register.sortLabel}
          value={search.sort}
          options={(["departure", "pressure", "name"] as const).map((sort) => ({
            value: sort,
            label: strings.register.sorts[sort]
          }))}
          onChange={(sort) => setSearch({ sort })}
        />
        <Watchlist readings={readings} />
      </Stack>
      <div className="register-columns" aria-hidden="true">
        <span className="column-label">{strings.register.columns.station}</span>
        <span className="column-strip">
          <span className="column-label">{strings.register.columns.strip}</span>
          <StripAxis days={days} now={now} />
        </span>
        <span className="column-ledger">
          <span className="column-label">
            {strings.register.columns.ledger}
          </span>
          <LedgerAxis />
        </span>
        <span className="column-label column-counts">
          <span className="count-exploited">
            {strings.register.columns.exploited}
          </span>
          <span className="count-malicious">
            {strings.register.columns.malicious}
          </span>
        </span>
      </div>
      {readings.length ? (
        <ol ref={list} className="register-rows" onKeyDown={move}>
          {pinned.map(row)}
          {pinned.length > 0 && rest.length > 0 && (
            <li className="register-divider" aria-hidden="true" />
          )}
          {rest.map(row)}
        </ol>
      ) : (
        <p className="empty">{strings.register.empty}</p>
      )}
      <ul className="legend" aria-hidden="true">
        <li className="legend-band">{strings.register.legend.normal}</li>
        <li className="legend-unusual">{strings.register.legend.unusual}</li>
        <li className="legend-exploited">
          {strings.register.legend.exploited}
        </li>
        <li className="legend-malicious">
          {strings.register.legend.malicious}
        </li>
        <li className="legend-unrecorded">
          {strings.register.legend.unrecorded}
        </li>
      </ul>
      <DataTable
        caption={strings.register.tableCaption}
        showLabel={strings.table.show}
        hideLabel={strings.table.hide}
        rows={readings}
        rowKey={(reading) => reading.station.id}
        columns={[
          {
            key: "name",
            label: strings.register.columns.station,
            cell: (reading) => reading.station.name
          },
          {
            key: "ratio",
            label: strings.focus.stats.ratio,
            numeric: true,
            cell: (reading) =>
              reading.settled
                ? formatRatio(reading.ratio)
                : strings.register.recording
          },
          {
            key: "adv",
            label: strings.focus.stats.advisories,
            numeric: true,
            cell: (reading) => reading.recent.advisories
          },
          {
            key: "exp",
            label: strings.focus.stats.exploited,
            numeric: true,
            cell: (reading) => reading.recent.exploited
          },
          {
            key: "mal",
            label: strings.focus.stats.malicious,
            numeric: true,
            cell: (reading) => reading.recent.compromises
          }
        ]}
      />
    </section>
  );
};

/* ----------------------------------------
   Focus: the selected station
   ---------------------------------------- */
const eventTitle = (event: WeightedEvent): string =>
  event.exploitation?.name ?? event.advisory?.title ?? event.id;

const eventLabel = (event: WeightedEvent): string =>
  event.advisory?.cve && event.advisory.cve !== event.id
    ? `${event.id} · ${event.advisory.cve}`
    : event.id;

const Figure = ({
  value,
  label,
  tone
}: {
  value: string;
  label: string;
  tone?: "signal" | "compromise";
}) => (
  <div className="figure" data-tone={tone}>
    <span className="figure-value">{value}</span>
    <span className="figure-label">{label}</span>
  </div>
);

const StoryList = ({ stories }: { stories: Story[] }) => (
  <ul className="story-list">
    {stories.map((story) => (
      <li key={story.id} className="story">
        <a
          href={story.url}
          target="_blank"
          rel="noreferrer"
          className="story-title"
        >
          {story.title}
        </a>
        <span className="meta">
          {day(story.published)} · {strings.wire.points(story.points)} ·{" "}
          <a href={story.discussion} target="_blank" rel="noreferrer">
            {strings.wire.discussion}
          </a>
        </span>
      </li>
    ))}
  </ul>
);

const headline = (reading: Reading): string => {
  const name = reading.station.name;
  if (!reading.settled) return strings.focus.headline.recording(name);
  if (reading.ratio >= scoring.unusualRatio)
    return strings.focus.headline.unusual(name, formatRatio(reading.ratio));
  if (reading.ratio < reading.bandLow)
    return strings.focus.headline.below(name, formatRatio(reading.ratio));
  return reading.quiet
    ? strings.focus.headline.quiet(name)
    : strings.focus.headline.steady(name);
};

const EventList = ({
  events,
  onEvent
}: {
  events: WeightedEvent[];
  onEvent: (id: string) => void;
}) => (
  <ol className="event-list">
    {events.map((event) => (
      <li key={`${event.kind}-${event.id}`}>
        <button
          type="button"
          className="event-row"
          data-kind={event.kind}
          onClick={() => onEvent(event.id)}
        >
          <span className="event-id">{eventLabel(event)}</span>
          <span className="event-title">{eventTitle(event)}</span>
          <span className="event-facts">
            {event.kind === "exploited" ? (
              <span className="chip chip-signal">
                {strings.event.exploited}
              </span>
            ) : (
              <span className="chip" data-severity={event.advisory?.severity}>
                {event.advisory?.severity}
              </span>
            )}
            {event.epss !== null && (
              <span className="meta">
                EPSS {formatPercent(event.epss, locale)}
              </span>
            )}
            <span className="meta">{day(event.date)}</span>
          </span>
        </button>
      </li>
    ))}
  </ol>
);

const VendorRanking = ({ reading }: { reading: Reading }) => {
  const tally = vendorTally(reading.events, 0).slice(
    0,
    readingConfig.vendorLimit
  );
  const most = Math.max(1, ...tally.map((entry) => entry.events));
  const copy = strings.focus.unassigned;
  return (
    <section className="vendors" aria-labelledby="vendors-heading">
      <p className="prose-small">{copy.lede}</p>
      <h3 id="vendors-heading" className="label">
        {copy.heading}
      </h3>
      <p className="meta">{copy.caption}</p>
      {tally.length ? (
        <table className="vendor-table">
          <thead>
            <tr>
              <th scope="col">{copy.columns.vendor}</th>
              <th scope="col" data-numeric>
                {copy.columns.events}
              </th>
              <th scope="col" data-numeric>
                {copy.columns.exploited}
              </th>
              <th scope="col" data-numeric>
                {copy.columns.latest}
              </th>
            </tr>
          </thead>
          <tbody>
            {tally.map((entry) => (
              <tr key={entry.vendor}>
                <th scope="row">
                  <span className="vendor-name">
                    {vendorName(entry.vendor)}
                  </span>
                  <span
                    className="vendor-bar"
                    style={{ width: `${(entry.events / most) * 100}%` }}
                    aria-hidden="true"
                  />
                </th>
                <td data-numeric>{entry.events}</td>
                <td data-numeric data-signal={entry.exploited > 0 || undefined}>
                  {entry.exploited}
                </td>
                <td data-numeric>{day(entry.latest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">{copy.empty}</p>
      )}
    </section>
  );
};

const StationFocus = ({
  reading,
  focusDay,
  onEvent,
  onClearDay,
  onClose
}: {
  reading: Reading;
  focusDay: number | undefined;
  onEvent: (id: string) => void;
  onClearDay: () => void;
  onClose: () => void;
}) => {
  const { now, days } = useReadings();
  const terms = useStore((state) => state.watchlist.terms);
  const origin = spanOrigin(now, days);
  const recentFrom = days - scoring.recentDays;
  const heaviest = reading.events
    .filter((event) => event.day >= recentFrom)
    .slice(0, readingConfig.focusEventLimit);
  const watched = reading.events
    .filter((event) => event.day >= recentFrom && matchesWatch(event, terms))
    .slice(0, readingConfig.focusEventLimit);
  const onDay =
    focusDay === undefined
      ? []
      : reading.events.filter((event) => inTrace(event, focusDay));
  const dayName =
    focusDay === undefined
      ? ""
      : `${day(
          addDays(origin, Math.max(0, focusDay - traceDays + 1)).toISOString()
        )} – ${day(addDays(origin, focusDay).toISOString(), true)}`;
  const { drivers } = reading;
  const driver = strings.focus.driver(
    drivers.exploitedCount,
    drivers.exploited,
    drivers.critical,
    drivers.advisories,
    drivers.top,
    reading.station.kind
  );
  const cutoff =
    reading.events.length > readingConfig.swarmLimit
      ? reading.events[readingConfig.swarmLimit].weight
      : 0;
  const shown = reading.events.filter((event) => event.weight > cutoff);
  const points: SwarmPoint[] = useMemo(
    () =>
      shown.map((event) => ({
        id: event.id,
        day: event.day,
        weight: event.weight,
        tone:
          event.kind === "exploited"
            ? "signal"
            : (event.epss ?? 0) >= 0.1
              ? "ring"
              : "ink",
        label: eventLabel(event),
        title: eventTitle(event),
        meta: [
          day(event.date, true),
          event.kind === "exploited"
            ? strings.event.exploited
            : (event.advisory?.severity ?? ""),
          event.epss !== null
            ? `EPSS ${formatPercent(event.epss, locale)}`
            : "",
          `${strings.event.weight} ${event.weight.toFixed(1)}`
        ]
          .filter(Boolean)
          .join(" · "),
        watched: matchesWatch(event, terms)
      })),
    [reading.events, terms]
  );
  const change = strings.focus.maliciousChange(
    reading.recent.compromises,
    reading.recent.compromisesBefore
  );

  return (
    <Stack gap="section" className="focus">
      <Stack gap="tight">
        <Stack direction="row" justify="space-between" align="center">
          <span className="label">{kindLabel(reading, true)}</span>
          <button
            type="button"
            className="icon-button sheet-close"
            aria-label={strings.focus.close}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </Stack>
        <h2 className="sheet-title">{reading.station.name}</h2>
        <p className="lede" aria-live="polite">
          {headline(reading)}
          {driver && reading.settled ? ` ${driver}` : ""}
        </p>
      </Stack>
      <div className="figures">
        <span className="label figures-caption">
          {strings.focus.figuresCaption}
        </span>
        <Figure
          value={reading.settled ? formatRatio(reading.ratio) : "—"}
          label={strings.focus.stats.ratio}
        />
        <Figure
          value={String(reading.recent.advisories)}
          label={strings.focus.advisoriesFor[reading.station.kind]}
        />
        {reading.station.kind === "ecosystem" && (
          <Figure
            value={String(reading.recent.critical)}
            label={strings.focus.stats.critical}
          />
        )}
        <Figure
          value={String(reading.recent.exploited)}
          label={strings.focus.stats.exploited}
          tone="signal"
        />
        <Figure
          value={formatCount(reading.recent.compromises, locale)}
          label={`${strings.focus.stats.malicious}${change ? ` · ${change}` : ""}`}
          tone="compromise"
        />
      </div>
      {reading.station.catchAll && <VendorRanking reading={reading} />}
      <figure className="chart">
        <figcaption>
          <span className="label">{strings.focus.swarmTitle}</span>
          <span className="meta">
            {strings.focus.swarmCaption(
              reading.events.length,
              shown.length,
              cutoff.toFixed(1)
            )}
          </span>
        </figcaption>
        <Swarm
          points={points}
          days={days}
          onSelect={onEvent}
          dayLabel={(offset) => day(addDays(origin, offset).toISOString())}
          axisLabel={strings.focus.swarmAxis}
          keysLabel={strings.focus.swarmKeys}
          focusRange={
            focusDay === undefined
              ? null
              : [Math.max(0, focusDay - traceDays + 1), focusDay]
          }
        />
      </figure>
      {focusDay !== undefined && (
        <section aria-labelledby="day-heading" className="day-filter">
          <Stack direction="row" justify="space-between" align="baseline">
            <h3 id="day-heading" className="label">
              {strings.focus.dayHeading(dayName)}
            </h3>
            <button type="button" className="text-button" onClick={onClearDay}>
              {strings.focus.clearDay}
            </button>
          </Stack>
          {onDay.length ? (
            <EventList events={onDay} onEvent={onEvent} />
          ) : (
            <p className="empty">{strings.focus.dayEmpty}</p>
          )}
        </section>
      )}
      {watched.length > 0 && (
        <section aria-labelledby="watched-heading">
          <h3 id="watched-heading" className="label">
            {strings.focus.watchedHeading}
          </h3>
          <EventList events={watched} onEvent={onEvent} />
        </section>
      )}
      <section aria-labelledby="heaviest-heading">
        <h3 id="heaviest-heading" className="label">
          {strings.focus.eventsHeading}
        </h3>
        {heaviest.length ? (
          <EventList events={heaviest} onEvent={onEvent} />
        ) : (
          <p className="empty">{strings.focus.eventsEmpty}</p>
        )}
      </section>
      <section aria-labelledby="news-heading">
        <h3 id="news-heading" className="label">
          {strings.focus.newsHeading}
        </h3>
        {reading.stories.length ? (
          <StoryList
            stories={reading.stories.slice(0, readingConfig.focusNewsLimit)}
          />
        ) : (
          <p className="empty">
            {strings.focus.newsEmpty(reading.station.name)}
          </p>
        )}
      </section>
      <DataTable
        caption={`${strings.focus.tableCaption}: ${reading.station.name}`}
        showLabel={strings.table.show}
        hideLabel={strings.table.hide}
        rows={shown}
        rowKey={(event) => `${event.kind}-${event.id}`}
        columns={[
          { key: "id", label: "ID", cell: eventLabel },
          {
            key: "date",
            label: strings.event.published,
            cell: (event) => day(event.date, true)
          },
          {
            key: "weight",
            label: strings.event.weight,
            numeric: true,
            cell: (event) => event.weight.toFixed(1)
          },
          { key: "title", label: strings.event.affected, cell: eventTitle }
        ]}
      />
    </Stack>
  );
};

/* ----------------------------------------
   Event record
   ---------------------------------------- */
const EventRecord = ({
  readings,
  eventId,
  stories,
  onBack
}: {
  readings: Reading[];
  eventId: string;
  stories: Story[];
  onBack: () => void;
}) => {
  const all = readings.flatMap((reading) => reading.events);
  const match = all.filter(
    (event) =>
      event.id.toUpperCase() === eventId.toUpperCase() ||
      event.advisory?.cve === eventId.toUpperCase()
  );
  const advisory = match.find((event) => event.advisory)?.advisory;
  const cve =
    advisory?.cve ??
    (eventId.toUpperCase().startsWith("CVE-") ? eventId.toUpperCase() : null);
  const exploitation =
    match.find((event) => event.exploitation)?.exploitation ??
    all.find((event) => event.exploitation && event.exploitation.cve === cve)
      ?.exploitation;
  const epss = match.find((event) => event.epss !== null)?.epss ?? null;
  const mentions = stories.filter(
    (story) => cve && cvesIn(story.title).includes(cve)
  );
  const title = exploitation?.name ?? advisory?.title ?? eventId;
  const products = advisory?.products.length
    ? advisory.products
    : (exploitation?.products ?? []);

  return (
    <Stack gap="section" className="focus record">
      <Stack gap="tight">
        <button
          type="button"
          className="text-button back-button"
          onClick={onBack}
        >
          <BackIcon />
          <span>{strings.event.back}</span>
        </button>
        <span className="record-id">
          {advisory && cve && advisory.id !== cve
            ? `${advisory.id} · ${cve}`
            : eventId}
        </span>
        <h2 className="sheet-title record-title">{title}</h2>
        {exploitation && (
          <p className="exploited-banner">
            {strings.event.exploited} ·{" "}
            {strings.event.delay(
              daysBetween(exploitation.published, exploitation.added)
            )}
          </p>
        )}
      </Stack>
      <dl className="facts">
        {(advisory?.cvss ?? exploitation?.cvss) !== null &&
          (advisory?.cvss ?? exploitation?.cvss) !== undefined && (
            <div>
              <dt>{strings.event.cvss}</dt>
              <dd className="fact-figure">
                {(advisory?.cvss ?? exploitation?.cvss)?.toFixed(1)}
              </dd>
            </div>
          )}
        <div>
          <dt>{strings.event.epss}</dt>
          <dd className="fact-figure">
            {epss !== null
              ? formatPercent(epss, locale)
              : strings.event.epssLow}
          </dd>
        </div>
        {exploitation && (
          <div>
            <dt>{strings.event.listed}</dt>
            <dd>{day(exploitation.added, true)}</dd>
          </div>
        )}
        <div>
          <dt>{strings.event.published}</dt>
          <dd>
            {day(
              advisory?.published ??
                exploitation?.published ??
                new Date().toISOString(),
              true
            )}
          </dd>
        </div>
        {products.length > 0 && !advisory?.fixes.length && (
          <div>
            <dt>{strings.event.affected}</dt>
            <dd className="fact-products">{products.join(", ")}</dd>
          </div>
        )}
        {advisory && advisory.fixes.length > 0 && (
          <div>
            <dt>{strings.event.fixes}</dt>
            <dd>
              <ul className="fixes">
                {advisory.fixes.map((fix) => (
                  <li key={`${fix.pkg}-${fix.affected}`}>
                    <span className="fix-package">{fix.pkg}</span>
                    {fix.affected && (
                      <span className="fix-range">{fix.affected}</span>
                    )}
                    <span
                      className="fix-patched"
                      data-missing={!fix.patched || undefined}
                    >
                      {fix.patched
                        ? strings.event.patched(fix.patched)
                        : strings.event.unpatched}
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
      {exploitation?.action && (
        <div className="cisa-action">
          <span className="label">{strings.event.action}</span>
          <p>{exploitation.action}</p>
          {exploitation.due && (
            <p className="meta">
              {strings.event.due}: {day(exploitation.due, true)}
            </p>
          )}
        </div>
      )}
      {(advisory || exploitation) && (
        <a
          className="outbound"
          href={advisory?.url ?? exploitation?.url}
          target="_blank"
          rel="noreferrer"
        >
          <span>
            {strings.event.open}:{" "}
            {strings.event.source[advisory?.source ?? "nvd"]}
          </span>
          <OutboundIcon />
        </a>
      )}
      {mentions.length > 0 && (
        <section aria-labelledby="mentions-heading">
          <h3 id="mentions-heading" className="label">
            {strings.event.mentions}
          </h3>
          <StoryList stories={mentions} />
        </section>
      )}
    </Stack>
  );
};

/* ----------------------------------------
   View
   ---------------------------------------- */
export const NowView = () => {
  const { readings, stories } = useReadings();
  const [search, setSearch] = useSearchState();
  const shown = orderReadings(
    readings.filter(
      (reading) => search.kind === "all" || reading.station.kind === search.kind
    ),
    search.sort
  );
  const chosen = readings.find(
    (reading) => reading.station.id === search.station
  );
  const focused = chosen ?? shown[0];

  return (
    <div className="now" data-sheet={chosen ? "open" : "closed"}>
      <Register
        readings={shown}
        selectedId={focused?.station.id}
        onSelect={(station, focusDay) =>
          setSearch({ station, event: undefined, day: focusDay })
        }
      />
      <Box as="aside" className="sheet" label={focused?.station.name}>
        {search.event ? (
          <EventRecord
            readings={readings}
            eventId={search.event}
            stories={stories}
            onBack={() => setSearch({ event: undefined })}
          />
        ) : (
          focused && (
            <StationFocus
              reading={focused}
              focusDay={search.day}
              onClearDay={() => setSearch({ day: undefined })}
              onEvent={(event) =>
                setSearch({ station: focused.station.id, event })
              }
              onClose={() =>
                setSearch({
                  station: undefined,
                  event: undefined,
                  day: undefined
                })
              }
            />
          )
        )}
      </Box>
    </div>
  );
};
