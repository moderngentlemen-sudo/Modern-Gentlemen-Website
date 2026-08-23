import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * Browsers are preinstalled in this environment at /opt/pw-browsers and
 * PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set — never run `playwright install`.
 *
 * Three projects:
 *   e2e    — critical user journeys across UI, API and persistence.
 *   visual — screenshot diffing. Public pages guard the pixel-verified design
 *            in handoff/screenshots/; admin surfaces are captured in BOTH
 *            themes so the on-brand admin styling cannot drift.
 *   a11y   — axe-core against every public route in both themes, plus the
 *            keyboard behaviour of the three overlays. Separate from `visual`
 *            because it asserts the DOM rather than the pixels, and separate
 *            from `e2e` because it needs no credentials and must therefore
 *            run everywhere — including a container that has none.
 *   perf    — the image-weight budget. Needs no credentials either, for the
 *            same reason a11y does not, and guards the one property no other
 *            suite can see: how many bytes a route actually ships.
 */
export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // The design gates every animation on prefers-reduced-motion. Forcing it
    // here makes screenshots deterministic AND exercises the accessible path.
    contextOptions: { reducedMotion: "reduce" },
  },

  expect: {
    toHaveScreenshot: {
      // Font antialiasing differs subtly between machines; this tolerance is
      // tight enough to catch a layout or colour regression and loose enough
      // to survive a different rendering host.
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      caret: "hide",
    },
  },

  projects: [
    {
      name: "e2e",
      testDir: "./tests/e2e",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "visual",
      testDir: "./tests/visual",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "a11y",
      testDir: "./tests/a11y",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "perf",
      testDir: "./tests/perf",
      // Viewport and deviceScaleFactor are set per-describe: the byte budget is
      // measured on mobile (the constrained case) and the oversize check at
      // desktop DPR 1 (where a correctly-sized source has a ratio near 1).
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
