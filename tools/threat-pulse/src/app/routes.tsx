/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: TanStack Router for Threat Pulse: the root route with the shell and its checked search parameters, one route per view, and the router on hash history.
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter
} from "@tanstack/react-router";
import { searchSchema } from "./schemas.js";
import { Shell } from "./views/shell.js";
import { NowView } from "./views/now.js";
import { TrendsView } from "./views/trends.js";
import { WireView } from "./views/wire.js";

/* ----------------------------------------
   Routes
   ---------------------------------------- */
const rootRoute = createRootRoute({
  component: Shell,
  validateSearch: (search: Record<string, unknown>) =>
    searchSchema.parse(search)
});

const nowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: NowView
});
const trendsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trends",
  component: TrendsView
});
const wireRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wire",
  component: WireView
});

/* ----------------------------------------
   Router
   ---------------------------------------- */
export const router = createRouter({
  routeTree: rootRoute.addChildren([nowRoute, trendsRoute, wireRoute]),
  history: createHashHistory(),
  defaultNotFoundComponent: NowView
});
