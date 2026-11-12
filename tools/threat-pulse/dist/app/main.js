import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
// Intended use: the entry point: sets the title from the locale, provides the query client and router, reports every error in one place, and renders Threat Pulse into the page.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryProvider } from "./api/client.js";
import { router } from "./routes.js";
import { en as strings } from "./locales/en.js";
import { ErrorBoundary } from "./components/utilities.js";
/* ----------------------------------------
   Errors
   ---------------------------------------- */
export const reportError = (error, info) => {
  console.error("[threat-pulse]", error, info?.componentStack ?? "");
};
window.addEventListener("error", event => reportError(event.error ?? event.message));
window.addEventListener("unhandledrejection", event => reportError(event.reason));
/* ----------------------------------------
   Render
   ---------------------------------------- */
document.title = strings.documentTitle;
const mount = document.getElementById("root");
if (mount) {
  createRoot(mount).render(_jsx(StrictMode, {
    children: _jsx(ErrorBoundary, {
      onError: reportError,
      fallback: (error, reset) => _jsxs("div", {
        className: "stopped",
        role: "alert",
        children: [_jsx("p", {
          children: strings.errors.stopped(error.message)
        }), _jsx("button", {
          type: "button",
          className: "solid-button",
          onClick: reset,
          children: strings.errors.reload
        })]
      }),
      children: _jsx(QueryProvider, {
        children: _jsx(RouterProvider, {
          router: router
        })
      })
    })
  }));
}