import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * Browsers are preinstalled in this environment at /opt/pw-browsers and
 * PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set — never run `playwright install`.
 *
 * Two projects:
 *   e2e    — critical user journeys across UI, API and persistence.
 *   visual — screenshot diffing. Public pages guard the pixel-verified design
 *            in handoff/screenshots/; admin surfaces are captured in BOTH
 *            themes so the on-brand admin styling cannot drift.
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
