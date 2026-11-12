/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: the Wire view: security stories by day, each tied to the stations and CVEs it names, with a daily volume strip whose signal bars mark stories about exploited vulnerabilities.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { reading as readingConfig, stations } from "../config.js";
import { en as strings } from "../locales/en.js";
import { cvesIn, spanOrigin } from "../model.js";
import { useReadings } from "./shell.js";
import { Stack } from "../components/layout.js";
import { MirroredBars } from "../components/charts.js";
import { DAY_MS, dayIndex, formatDay, groupBy } from "../lib/utils.js";

const { locale, timeZone } = readingConfig;

export const WireView = () => {
  const { readings, stories, now } = useReadings();
  const [station, setStation] = useState("all");
  const days = Math.min(120, readings[0]?.rolling.length ?? 120);
  const origin = spanOrigin(now, days);

  const exploited = new Set(
    readings.flatMap((reading) =>
      reading.events.flatMap((event) => event.exploitation?.cve ?? [])
    )
  );
  const owners = new Map(
    readings.flatMap((reading) =>
      reading.stories.map((story) => [story.id, reading.station.id] as const)
    )
  );
  const tagged = stories.map((story) => ({
    story,
    cves: cvesIn(story.title),
    stationIds: readings
      .filter((reading) => reading.stories.includes(story))
      .map((reading) => reading.station.id)
  }));
  const filtered = tagged
    .filter((entry) => station === "all" || entry.stationIds.includes(station))
    .slice(0, readingConfig.wireLimit);

  const perDay = Array.from({ length: days }, () => 0);
  const signalPerDay = Array.from({ length: days }, () => 0);
  tagged
    .filter((entry) => station === "all" || entry.stationIds.includes(station))
    .forEach((entry) => {
      const index = dayIndex(entry.story.published, origin);
      if (index < 0 || index >= days) return;
      perDay[index] += 1;
      if (entry.cves.some((cve) => exploited.has(cve)))
        signalPerDay[index] += 1;
    });

  const weekAgo = Date.now() - 7 * DAY_MS;
  const thisWeek = tagged.filter(
    (entry) => Date.parse(entry.story.published) >= weekAgo
  );
  const discussed = [...thisWeek]
    .sort((a, b) => b.story.comments - a.story.comments)
    .slice(0, readingConfig.focusNewsLimit);
  const inTheNews = stations
    .map((entry) => ({
      station: entry,
      count: thisWeek.filter((item) => item.stationIds.includes(entry.id))
        .length
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  const byDay = groupBy(filtered, (entry) =>
    entry.story.published.slice(0, 10)
  );

  return (
    <Stack gap="section" className="wire">
      <Stack gap="tight">
        <h1 className="headline">{strings.wire.heading}</h1>
        <p className="lede">{strings.wire.lede}</p>
      </Stack>
      <Stack direction="row" gap="loose" align="flex-end" wrap>
        <label className="select-field">
          <span className="segmented-legend">{strings.wire.stationFilter}</span>
          <select
            className="field"
            value={station}
            onChange={(event) => setStation(event.target.value)}
          >
            <option value="all">{strings.wire.allStations}</option>
            {stations.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <figure className="wire-volume" aria-label={strings.wire.volumeLabel}>
          <MirroredBars
            above={perDay}
            below={signalPerDay}
            gaps={perDay.map(() => false)}
            aboveMax={Math.max(1, ...perDay)}
            belowMax={Math.max(1, ...signalPerDay)}
          />
          <figcaption className="meta">{strings.wire.volumeLabel}</figcaption>
        </figure>
      </Stack>
      <div className="wire-body">
        {filtered.length ? (
          <div className="wire-days">
            {[...byDay.entries()].map(([date, entries]) => (
              <section
                key={date}
                className="wire-day"
                aria-label={formatDay(date, locale, timeZone, true)}
              >
                <h2 className="wire-date">
                  {formatDay(date, locale, timeZone)}
                </h2>
                <ol className="wire-stories">
                  {entries.map(({ story, cves, stationIds }) => (
                    <li
                      key={story.id}
                      className="wire-story"
                      data-signal={
                        cves.some((cve) => exploited.has(cve)) || undefined
                      }
                    >
                      <a
                        href={story.url}
                        target="_blank"
                        rel="noreferrer"
                        className="story-title"
                      >
                        {story.title}
                      </a>
                      <span className="meta">
                        {(() => {
                          try {
                            return new URL(story.url).hostname.replace(
                              /^www\./,
                              ""
                            );
                          } catch {
                            return "";
                          }
                        })()}{" "}
                        · {strings.wire.points(story.points)} ·{" "}
                        <a
                          href={story.discussion}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {strings.wire.comments(story.comments)}
                        </a>
                      </span>
                      {(stationIds.length > 0 || cves.length > 0) && (
                        <span className="chips">
                          {stationIds.map((id) => (
                            <Link
                              key={id}
                              to="/"
                              search={(previous: Record<string, unknown>) => ({
                                ...previous,
                                station: id,
                                event: undefined
                              })}
                              className="chip chip-link"
                            >
                              {stations.find((entry) => entry.id === id)?.name}
                            </Link>
                          ))}
                          {cves.map((cve) => (
                            <Link
                              key={cve}
                              to="/"
                              search={(previous: Record<string, unknown>) => ({
                                ...previous,
                                station: owners.get(story.id) ?? stationIds[0],
                                event: cve
                              })}
                              className={
                                exploited.has(cve)
                                  ? "chip chip-link chip-signal"
                                  : "chip chip-link chip-id"
                              }
                            >
                              {cve}
                            </Link>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <p className="empty">{strings.wire.empty}</p>
        )}
        <aside className="wire-aside">
          {inTheNews.length > 0 && (
            <section aria-labelledby="in-the-news">
              <h2 id="in-the-news" className="label">
                {strings.wire.inTheNews}
              </h2>
              <ul className="chips">
                {inTheNews.map((entry) => (
                  <li key={entry.station.id}>
                    <button
                      type="button"
                      className="chip chip-filter"
                      aria-pressed={station === entry.station.id}
                      onClick={() =>
                        setStation(
                          station === entry.station.id
                            ? "all"
                            : entry.station.id
                        )
                      }
                    >
                      {entry.station.name} · {entry.count}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {discussed.length > 0 && (
            <section aria-labelledby="most-discussed">
              <h2 id="most-discussed" className="label">
                {strings.wire.discussed}
              </h2>
              <ol className="story-list">
                {discussed.map(({ story }) => (
                  <li key={story.id} className="story">
                    <a
                      href={story.url}
                      target="_blank"
                      rel="noreferrer"
                      className="story-title"
                    >
                      {story.title}
                    </a>
                    <a
                      className="meta"
                      href={story.discussion}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {strings.wire.comments(story.comments)}
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </Stack>
  );
};
