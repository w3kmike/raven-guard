/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: the frame every view renders inside: the masthead with view tabs, span and feed telemetry, the feeds dialog with the GitHub token, and the observatory every view reads from context.
import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject
} from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { spans, reading } from "../config.js";
import { en as strings } from "../locales/en.js";
import { useSearchState } from "../navigation.js";
import {
  useObservatory,
  type Observatory,
  type FeedStatus
} from "../observatory.js";
import { forgetGithubToken, saveGithubToken, useStore } from "../state.js";
import { Segmented } from "../components/controls.js";
import { Stack } from "../components/layout.js";
import { CloseIcon, FeedsIcon, RefreshIcon } from "../components/icons.js";
import { formatClock } from "../lib/utils.js";

/* ----------------------------------------
   Observatory context
   ---------------------------------------- */
const ObservatoryContext = createContext<Observatory | null>(null);

export const useReadings = (): Observatory => {
  const value = useContext(ObservatoryContext);
  if (!value) throw new Error("useReadings needs the shell around it");
  return value;
};

const clock = (time: number) =>
  formatClock(time, reading.locale, reading.timeZone);

/* ----------------------------------------
   Feeds dialog
   ---------------------------------------- */
const FeedLine = ({ status }: { status: FeedStatus }) => {
  const state =
    status.paused > 0
      ? "paused"
      : status.failed > 0 && !status.recorded
        ? "down"
        : status.recorded < status.chunks
          ? "recording"
          : "current";
  const bytes = useStore((current) => current.progress[status.feed]);
  return (
    <li className="feed-line" data-state={state}>
      <span className="feed-lamp" aria-hidden="true" />
      <span className="feed-name">{strings.feeds.names[status.feed]}</span>
      <span className="feed-detail">
        {strings.feeds.recorded(status.recorded, status.chunks)}
        {status.paused > 0 && status.resumesAt
          ? ` · ${strings.feeds.paused(clock(status.resumesAt))}`
          : ""}
        {status.lastError ? ` · ${strings.feeds.failed(status.lastError)}` : ""}
        {status.stale ? ` · ${strings.feeds.stale}` : ""}
        {status.partial ? ` · ${strings.feeds.partial}` : ""}
        {bytes
          ? ` · ${strings.register.kevBytes((bytes / 1_000_000).toFixed(1))}`
          : ""}
      </span>
    </li>
  );
};

export const TokenForm = ({ compact = false }: { compact?: boolean }) => {
  const token = useStore((state) => state.githubToken);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<"saved" | "invalid" | null>(null);
  const id = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const saved = saveGithubToken(draft);
    setMessage(saved ? "saved" : "invalid");
    if (saved) setDraft("");
  };

  return (
    <form
      className={compact ? "token-form token-form-compact" : "token-form"}
      onSubmit={submit}
    >
      {!compact && (
        <>
          <h3 className="label">{strings.feeds.tokenHeading}</h3>
          <p className="prose-small">{strings.feeds.tokenHelp}</p>
        </>
      )}
      {token ? (
        <button
          type="button"
          className="text-button"
          onClick={forgetGithubToken}
        >
          {strings.feeds.tokenForget}
        </button>
      ) : (
        <Stack direction="row" gap="tight" wrap>
          <label className="visually-hidden" htmlFor={id}>
            {strings.feeds.tokenLabel}
          </label>
          <input
            id={id}
            className="field"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={strings.feeds.tokenLabel}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="solid-button">
            {strings.feeds.tokenSave}
          </button>
        </Stack>
      )}
      <p className="meta" role="status">
        {message === "saved"
          ? strings.feeds.tokenSaved
          : message === "invalid"
            ? strings.feeds.tokenInvalid
            : ""}
      </p>
    </form>
  );
};

const FeedsDialog = ({
  dialog,
  feeds
}: {
  dialog: RefObject<HTMLDialogElement | null>;
  feeds: FeedStatus[];
}) => {
  const budget = useStore((state) => state.githubBudget);
  const storage = useStore((state) => state.storage);

  return (
    <dialog ref={dialog} className="feeds-dialog" aria-labelledby="feeds-title">
      <Stack gap="loose" padding="loose">
        <Stack direction="row" justify="space-between" align="center">
          <h2 id="feeds-title" className="sheet-title">
            {strings.feeds.title}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label={strings.feeds.close}
            onClick={() => dialog.current?.close()}
          >
            <CloseIcon />
          </button>
        </Stack>
        <ul className="feed-list">
          {feeds.map((status) => (
            <FeedLine key={status.feed} status={status} />
          ))}
        </ul>
        {budget && (
          <p className="meta">
            {strings.feeds.budget(
              budget.remaining,
              budget.limit,
              clock(budget.resetAt)
            )}
          </p>
        )}
        {storage === "unavailable" && (
          <p className="meta">{strings.feeds.storageBlocked}</p>
        )}
        <TokenForm />
      </Stack>
    </dialog>
  );
};

/* ----------------------------------------
   Shell
   ---------------------------------------- */
export const Shell = () => {
  const [search, setSearch] = useSearchState();
  const observatory = useObservatory(search.span);
  const dialog = useRef<HTMLDialogElement>(null);
  const totals = observatory.feeds.reduce(
    (sum, feed) => ({
      recorded: sum.recorded + feed.recorded,
      chunks: sum.chunks + feed.chunks,
      paused: sum.paused + feed.paused,
      down: sum.down + (feed.failed && !feed.recorded ? 1 : 0)
    }),
    { recorded: 0, chunks: 0, paused: 0, down: 0 }
  );
  const feedState = totals.paused
    ? "paused"
    : totals.recorded < totals.chunks
      ? "recording"
      : "current";

  return (
    <ObservatoryContext.Provider value={observatory}>
      <div className="observatory">
        <header className="masthead">
          <Stack
            direction="row"
            align="baseline"
            gap="tight"
            className="masthead-mark"
          >
            <span className="wordmark">{strings.masthead.wordmark}</span>
            <span className="tagline">{strings.masthead.tagline}</span>
          </Stack>
          <nav className="view-tabs" aria-label={strings.masthead.viewsLabel}>
            {(
              [
                ["/", strings.masthead.views.now],
                ["/trends", strings.masthead.views.trends],
                ["/wire", strings.masthead.views.wire]
              ] as const
            ).map(([to, label]) => (
              <Link
                key={to}
                to={to}
                search={(previous: Record<string, unknown>) => ({
                  ...previous,
                  event: undefined
                })}
                className="view-tab"
                activeOptions={{ exact: true, includeSearch: false }}
                activeProps={{ "aria-current": "page" }}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Segmented
            label={strings.masthead.spanLabel}
            value={search.span}
            options={spans.map((span) => ({
              value: span.id,
              label: strings.masthead.spans[span.id].short,
              description: strings.masthead.spans[span.id].long
            }))}
            onChange={(span) => setSearch({ span })}
          />
          <Stack
            direction="row"
            align="center"
            gap="base"
            className="masthead-status"
          >
            <span className="meta recorded">
              {observatory.fetching
                ? strings.masthead.refreshing
                : strings.masthead.recorded(
                    clock(observatory.recordedAt ?? observatory.now.getTime())
                  )}
            </span>
            <button
              type="button"
              className="icon-button refresh-button"
              data-busy={observatory.fetching || undefined}
              aria-label={strings.masthead.refresh}
              title={strings.masthead.refresh}
              onClick={observatory.refresh}
            >
              <RefreshIcon />
            </button>
            <button
              type="button"
              className="feeds-button"
              data-state={feedState}
              aria-haspopup="dialog"
              onClick={() => dialog.current?.showModal()}
            >
              <FeedsIcon />
              <span>
                {strings.masthead.feedsButton(
                  totals.recorded,
                  totals.chunks,
                  totals.paused
                )}
              </span>
            </button>
          </Stack>
        </header>
        {totals.down === observatory.feeds.length && (
          <p className="banner" role="alert">
            {strings.errors.feedsDown}
          </p>
        )}
        <main className="instrument">
          <Outlet />
        </main>
        <FeedsDialog dialog={dialog} feeds={observatory.feeds} />
      </div>
    </ObservatoryContext.Provider>
  );
};
