/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: build settings for CodePen's React (Vite) Block: the React plugin, every HTML file as an entry, an esnext target, and the "@" alias for the pen root.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));
const pages = readdirSync(root).filter((name) => name.endsWith(".html"));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": root } },
  build: {
    target: "esnext",
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((page) => [page.replace(/\.html$/, ""), `${root}${page}`])
      )
    }
  }
});
