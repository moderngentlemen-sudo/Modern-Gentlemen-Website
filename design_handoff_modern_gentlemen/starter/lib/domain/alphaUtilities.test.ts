import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import config from "../../tailwind.config";

/**
 * Which `mg` colours can carry an alpha modifier, and which silently cannot.
 *
 * Tailwind 3.4's `withAlphaValue` runs `parseColor` over a theme value and
 * **drops the utility entirely** when it cannot parse one. `var(--x)` never
 * parses. So a palette entry declared as a bare `var()` makes every
 * `…-mg-<token>/NN` class in the codebase compile to **no CSS at all** — while
 * the class name sits in the markup looking correct.
 *
 * Nothing catches this on its own. `tsc`, ESLint, the unit suite and the visual
 * baselines are all green either way, because **a border that is absent looks
 * like a design that never had one**, and text at 100% where 70% was asked for
 * looks like a deliberately darker paragraph. Reading the component tells you
 * nothing; the class is right there.
 *
 * That was measured by running Tailwind over a probe file and reading the
 * output, not deduced. `text-mg-accent/40` and `border-mg-accentSerif/40` emit
 * `rgb(var(--…-rgb) / 0.4)`; `text-mg-fg/70`, `border-mg-bd/25` and
 * `bg-mg-bg/50` emit nothing whatsoever.
 *
 * ⚠️ **KNOWN GAP — the site-wide half of this is a design decision and is
 * deliberately NOT fixed.** `accent` was always in channel form and
 * `accentSerif` joined it (see below). `fg`, `bd` and `bg` have **417 alpha
 * usages across 129 files** between them and none of them has ever rendered:
 * every `text-mg-fg/70` on the public site paints at full opacity today, and
 * the sixteen baselines in `handoff/screenshots/` were verified against that.
 * Repairing them would lighten muted text and hairline borders across the whole
 * site at once — a visible change to a pixel-verified design, which is the
 * brand's call and not a session's.
 *
 * **The gap is asserted rather than described**, which is this repo's technique
 * for exactly this situation and the fifth time it has been used: a gap
 * recorded only in prose is a gap nobody notices closing. **When the decision
 * is made, invert `KNOWN_BROKEN` to `[]` in the same commit as the fix** — give
 * each token an `R G B` twin in `app/globals.css` (in every context that
 * redeclares it), add it to `CHANNEL_TWIN` in `lib/domain/theme.ts`, point the
 * palette entry at `rgb(var(--…-rgb) / <alpha-value>)`, and re-record the
 * baselines.
 */

const ROOT = join(__dirname, "../..");
const SCANNED = ["app", "components", "lib"];

/**
 * The tokens whose alpha utilities currently emit nothing, and are staying that
 * way until the design decision above is taken. Inverting this to `[]` is the
 * whole point of the test.
 */
const KNOWN_BROKEN = ["bd", "bg", "fg"];

/** Every `mg-<token>/<alpha>` in the codebase, as the set of token names. */
function tokensUsedWithAlpha(): Set<string> {
  const found = new Set<string>();

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".next") continue;
      const path = join(dir, entry);

      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(path)) continue;

      const source = readFileSync(path, "utf8");
      // Matches `text-mg-accentSerif/40` and `bg-mg-accent/[0.02]` alike; the
      // token name is what matters.
      for (const match of source.matchAll(/-mg-([A-Za-z]+)\/(?:\[[^\]]+\]|\d+)/g)) {
        found.add(match[1]);
      }
    }
  };

  for (const dir of SCANNED) walk(join(ROOT, dir));
  return found;
}

const palette = (config.theme?.extend?.colors as { mg: Record<string, string> }).mg;

const bareVarTokens = () =>
  [...tokensUsedWithAlpha()]
    .filter((token) => token in palette)
    .filter((token) => /^var\(/.test(palette[token]))
    .sort();

describe("alpha-modified Tailwind colours", () => {
  it("finds the usages it is meant to be guarding", () => {
    // A scanner that silently matched nothing would make every assertion below
    // vacuously true — the exact failure mode this file exists to catch.
    const used = tokensUsedWithAlpha();

    expect(used.size).toBeGreaterThan(0);
    expect(used).toContain("accentSerif");
    expect(used).toContain("fg");
  });

  it("KNOWN GAP: fg, bd and bg still compile to nothing, pending a design decision", () => {
    // Asserted as the wrong-but-current behaviour. When the brand decides to
    // repair the ramp, this goes red on the day of the fix and says so — which
    // is the entire reason it is a test and not a paragraph.
    expect(bareVarTokens()).toEqual(KNOWN_BROKEN);
  });

  it("keeps every other alpha-modified colour in working channel form", () => {
    // The live half of the rule: anything *not* on the known-broken list must
    // actually render. A new token added as a bare `var()` and used with an
    // alpha fails here rather than shipping invisible.
    const broken = new Set(KNOWN_BROKEN);
    const shouldWork = [...tokensUsedWithAlpha()].filter(
      (token) => token in palette && !broken.has(token)
    );

    expect(shouldWork.length).toBeGreaterThan(0);
    for (const token of shouldWork) {
      expect(palette[token], `mg.${token} must be in channel form`).toMatch(
        /^rgb\(var\(--[a-z-]+\) \/ <alpha-value>\)$/
      );
    }
  });

  it("keeps the two channel-form colours pointed at their own twin", () => {
    // Copy-paste between these entries would render every serif-accent alpha in
    // the racing red instead, which no other gate would notice.
    expect(palette.accent).toBe("rgb(var(--mg-accent-rgb) / <alpha-value>)");
    expect(palette.accentSerif).toBe("rgb(var(--mg-accent-serif-rgb) / <alpha-value>)");
  });
});
