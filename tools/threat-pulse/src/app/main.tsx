/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: the entry point: sets the title from the locale, provides the query client and router, reports every error in one place, and renders Threat Pulse into the page.
import { StrictMode, type ErrorInfo } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryProvider } from "./api/client.js";
import { router } from "./routes.js";
import { en as strings } from "./locales/en.js";
import { ErrorBoundary } from "./components/utilities.js";

/* ----------------------------------------
   Errors
   ---------------------------------------- */
export const reportError = (error: unknown, info?: ErrorInfo): void => {
  console.error("[threat-pulse]", error, info?.componentStack ?? "");
};

window.addEventListener("error", (event) =>
  reportError(event.error ?? event.message)
);
window.addEventListener("unhandledrejection", (event) =>
  reportError(event.reason)
);

/* ----------------------------------------
   Render
   ---------------------------------------- */
document.title = strings.documentTitle;
const mount = document.getElementById("root");

if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <ErrorBoundary
        onError={reportError}
        fallback={(error, reset) => (
          <div className="stopped" role="alert">
            <p>{strings.errors.stopped(error.message)}</p>
            <button type="button" className="solid-button" onClick={reset}>
              {strings.errors.reload}
            </button>
          </div>
        )}
      >
        <QueryProvider>
          <RouterProvider router={router} />
        </QueryProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
