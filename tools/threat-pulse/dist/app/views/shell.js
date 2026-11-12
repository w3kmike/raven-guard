import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
// Intended use: the frame every view renders inside: the masthead with view tabs, span and feed telemetry, the feeds dialog with the GitHub token, and the observatory every view reads from context.
import { createContext, useContext, useId, useRef, useState } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { spans, reading } from "../config.js";
import { en as strings } from "../locales/en.js";
import { useSearchState } from "../navigation.js";
import { useObservatory } from "../observatory.js";
import { forgetGithubToken, saveGithubToken, useStore } from "../state.js";
import { Segmented } from "../components/controls.js";
import { Stack } from "../components/layout.js";
import { CloseIcon, FeedsIcon, RefreshIcon } from "../components/icons.js";
import { formatClock } from "../lib/utils.js";
/* ----------------------------------------
   Observatory context
   ---------------------------------------- */
const ObservatoryContext = createContext(null);
export const useReadings = () => {
  const value = useContext(ObservatoryContext);
  if (!value) throw new Error("useReadings needs the shell around it");
  return value;
};
const clock = time => formatClock(time, reading.locale, reading.timeZone);
/* ----------------------------------------
   Feeds dialog
   ---------------------------------------- */
const FeedLine = ({
  status
}) => {
  const state = status.paused > 0 ? "paused" : status.failed > 0 && !status.recorded ? "down" : status.recorded < status.chunks ? "recording" : "current";
  const bytes = useStore(current => current.progress[status.feed]);
  return _jsxs("li", {
    className: "feed-line",
    "data-state": state,
    children: [_jsx("span", {
      className: "feed-lamp",
      "aria-hidden": "true"
    }), _jsx("span", {
      className: "feed-name",
      children: strings.feeds.names[status.feed]
    }), _jsxs("span", {
      className: "feed-detail",
      children: [strings.feeds.recorded(status.recorded, status.chunks), status.paused > 0 && status.resumesAt ? ` · ${strings.feeds.paused(clock(status.resumesAt))}` : "", status.lastError ? ` · ${strings.feeds.failed(status.lastError)}` : "", status.stale ? ` · ${strings.feeds.stale}` : "", status.partial ? ` · ${strings.feeds.partial}` : "", bytes ? ` · ${strings.register.kevBytes((bytes / 1_000_000).toFixed(1))}` : ""]
    })]
  });
};
export const TokenForm = ({
  compact = false
}) => {
  const token = useStore(state => state.githubToken);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState(null);
  const id = useId();
  const submit = event => {
    event.preventDefault();
    const saved = saveGithubToken(draft);
    setMessage(saved ? "saved" : "invalid");
    if (saved) setDraft("");
  };
  return _jsxs("form", {
    className: compact ? "token-form token-form-compact" : "token-form",
    onSubmit: submit,
    children: [!compact && _jsxs(_Fragment, {
      children: [_jsx("h3", {
        className: "label",
        children: strings.feeds.tokenHeading
      }), _jsx("p", {
        className: "prose-small",
        children: strings.feeds.tokenHelp
      })]
    }), token ? _jsx("button", {
      type: "button",
      className: "text-button",
      onClick: forgetGithubToken,
      children: strings.feeds.tokenForget
    }) : _jsxs(Stack, {
      direction: "row",
      gap: "tight",
      wrap: true,
      children: [_jsx("label", {
        className: "visually-hidden",
        htmlFor: id,
        children: strings.feeds.tokenLabel
      }), _jsx("input", {
        id: id,
        className: "field",
        type: "password",
        autoComplete: "off",
        spellCheck: false,
        placeholder: strings.feeds.tokenLabel,
        value: draft,
        onChange: event => setDraft(event.target.value)
      }), _jsx("button", {
        type: "submit",
        className: "solid-button",
        children: strings.feeds.tokenSave
      })]
    }), _jsx("p", {
      className: "meta",
      role: "status",
      children: message === "saved" ? strings.feeds.tokenSaved : message === "invalid" ? strings.feeds.tokenInvalid : ""
    })]
  });
};
const FeedsDialog = ({
  dialog,
  feeds
}) => {
  const budget = useStore(state => state.githubBudget);
  const storage = useStore(state => state.storage);
  return _jsx("dialog", {
    ref: dialog,
    className: "feeds-dialog",
    "aria-labelledby": "feeds-title",
    children: _jsxs(Stack, {
      gap: "loose",
      padding: "loose",
      children: [_jsxs(Stack, {
        direction: "row",
        justify: "space-between",
        align: "center",
        children: [_jsx("h2", {
          id: "feeds-title",
          className: "sheet-title",
          children: strings.feeds.title
        }), _jsx("button", {
          type: "button",
          className: "icon-button",
          "aria-label": strings.feeds.close,
          onClick: () => dialog.current?.close(),
          children: _jsx(CloseIcon, {})
        })]
      }), _jsx("ul", {
        className: "feed-list",
        children: feeds.map(status => _jsx(FeedLine, {
          status: status
        }, status.feed))
      }), budget && _jsx("p", {
        className: "meta",
        children: strings.feeds.budget(budget.remaining, budget.limit, clock(budget.resetAt))
      }), storage === "unavailable" && _jsx("p", {
        className: "meta",
        children: strings.feeds.storageBlocked
      }), _jsx(TokenForm, {})]
    })
  });
};
/* ----------------------------------------
   Shell
   ---------------------------------------- */
export const Shell = () => {
  const [search, setSearch] = useSearchState();
  const observatory = useObservatory(search.span);
  const dialog = useRef(null);
  const totals = observatory.feeds.reduce((sum, feed) => ({
    recorded: sum.recorded + feed.recorded,
    chunks: sum.chunks + feed.chunks,
    paused: sum.paused + feed.paused,
    down: sum.down + (feed.failed && !feed.recorded ? 1 : 0)
  }), {
    recorded: 0,
    chunks: 0,
    paused: 0,
    down: 0
  });
  const feedState = totals.paused ? "paused" : totals.recorded < totals.chunks ? "recording" : "current";
  return _jsx(ObservatoryContext.Provider, {
    value: observatory,
    children: _jsxs("div", {
      className: "observatory",
      children: [_jsxs("header", {
        className: "masthead",
        children: [_jsxs(Stack, {
          direction: "row",
          align: "baseline",
          gap: "tight",
          className: "masthead-mark",
          children: [_jsx("span", {
            className: "wordmark",
            children: strings.masthead.wordmark
          }), _jsx("span", {
            className: "tagline",
            children: strings.masthead.tagline
          })]
        }), _jsx("nav", {
          className: "view-tabs",
          "aria-label": strings.masthead.viewsLabel,
          children: [["/", strings.masthead.views.now], ["/trends", strings.masthead.views.trends], ["/wire", strings.masthead.views.wire]].map(([to, label]) => _jsx(Link, {
            to: to,
            search: previous => ({
              ...previous,
              event: undefined
            }),
            className: "view-tab",
            activeOptions: {
              exact: true,
              includeSearch: false
            },
            activeProps: {
              "aria-current": "page"
            },
            children: label
          }, to))
        }), _jsx(Segmented, {
          label: strings.masthead.spanLabel,
          value: search.span,
          options: spans.map(span => ({
            value: span.id,
            label: strings.masthead.spans[span.id].short,
            description: strings.masthead.spans[span.id].long
          })),
          onChange: span => setSearch({
            span
          })
        }), _jsxs(Stack, {
          direction: "row",
          align: "center",
          gap: "base",
          className: "masthead-status",
          children: [_jsx("span", {
            className: "meta recorded",
            children: observatory.fetching ? strings.masthead.refreshing : strings.masthead.recorded(clock(observatory.recordedAt ?? observatory.now.getTime()))
          }), _jsx("button", {
            type: "button",
            className: "icon-button refresh-button",
            "data-busy": observatory.fetching || undefined,
            "aria-label": strings.masthead.refresh,
            title: strings.masthead.refresh,
            onClick: observatory.refresh,
            children: _jsx(RefreshIcon, {})
          }), _jsxs("button", {
            type: "button",
            className: "feeds-button",
            "data-state": feedState,
            "aria-haspopup": "dialog",
            onClick: () => dialog.current?.showModal(),
            children: [_jsx(FeedsIcon, {}), _jsx("span", {
              children: strings.masthead.feedsButton(totals.recorded, totals.chunks, totals.paused)
            })]
          })]
        })]
      }), totals.down === observatory.feeds.length && _jsx("p", {
        className: "banner",
        role: "alert",
        children: strings.errors.feedsDown
      }), _jsx("main", {
        className: "instrument",
        children: _jsx(Outlet, {})
      }), _jsx(FeedsDialog, {
        dialog: dialog,
        feeds: observatory.feeds
      })]
    })
  });
};