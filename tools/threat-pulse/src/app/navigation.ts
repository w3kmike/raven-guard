/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: reading and writing the URL search state every view shares (span, filters, order, station, event), checked against its schema and written with replace so history stays clean.
import { useNavigate, useSearch } from "@tanstack/react-router";
import { searchSchema, type Search } from "./schemas.js";

export const useSearchState = (): [
  Search,
  (patch: Partial<Search>) => void
] => {
  const raw = useSearch({ strict: false });
  const navigate = useNavigate();
  const search = searchSchema.parse(raw);
  const update = (patch: Partial<Search>) =>
    navigate({
      to: ".",
      search: (previous: Record<string, unknown>) =>
        searchSchema.parse({ ...previous, ...patch }),
      replace: true
    });
  return [search, update];
};
