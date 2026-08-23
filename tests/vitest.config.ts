import { defineConfig } from "vitest/config";
import path from "node:path";

// Lives in tests/ alongside the suites, so the project root stays uncluttered.
// Paths resolve against the repo root one level up.
const root = path.resolve(__dirname, "..");

export default defineConfig({
  root,
  resolve: { alias: { "@": root } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] }
});
