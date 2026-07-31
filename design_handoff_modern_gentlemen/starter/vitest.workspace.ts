import { defineWorkspace } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

/**
 * Two projects, matching the testing pyramid:
 *
 *   unit        — fast, isolated. Pure domain rules + React component tests in
 *                 jsdom. No network, no database. This is the bulk of the suite
 *                 and runs on every save.
 *   integration — real Postgres (local Supabase stack, or the remote project
 *                 when SUPABASE_TEST_URL points at one). Verifies that services,
 *                 repositories and RLS policies actually work together.
 *
 * End-to-end and visual regression live in Playwright, not here.
 */
export default defineWorkspace([
  {
    plugins: [react()],
    resolve: { alias },
    test: {
      name: "unit",
      environment: "jsdom",
      globals: true,
      setupFiles: ["./tests/setup/unit.setup.ts"],
      include: [
        "lib/**/*.test.{ts,tsx}",
        "components/**/*.test.{ts,tsx}",
        "app/**/*.test.{ts,tsx}",
        "tests/unit/**/*.test.{ts,tsx}",
      ],
      css: false,
    },
  },
  {
    resolve: { alias },
    test: {
      name: "integration",
      environment: "node",
      globals: true,
      setupFiles: ["./tests/setup/integration.setup.ts"],
      include: ["tests/integration/**/*.test.ts"],
      // Integration tests share one database, so they must not race each
      // other's fixtures. File-level serialisation is set by the
      // `--no-file-parallelism` flag in the `test:integration` script
      // (it is a runner-level option, not a per-project one).
      testTimeout: 30_000,
      hookTimeout: 60_000,
    },
  },
]);
