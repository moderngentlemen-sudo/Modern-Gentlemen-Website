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
 * ✅ **INVERTED — `KNOWN_BROKEN` is now empty, and this is the fifth
 * characterisation test in this repo to complete the full cycle** after
 * `is_system` (`0018`), `draft_data` (`0020`), `taxonomy.write` on categories
 * (`0023`) and the accent's dark-only context table.
 *
 * It read: "`fg`, `bd` and `bg` have 417 alpha usages across 129 files between
 * them and none of them has ever rendered". The brand took the decision and all
 * four — `surface` was a latent fourth, unused with an alpha but one keystroke
 * from the same bug — are in channel form now.
 *
 * ⚠️ **The instructions this comment carried were followed exactly and were
 * still incomplete in one way worth recording.** It said to give each token a
 * twin, register it in `CHANNEL_TWIN`, point the palette entry at the channel
 * form and re-record the baselines. All true. What it did not say is that the
 * repair *reintroduces contrast failures the bug was accidentally hiding*: text
 * that had been painting at full strength starts rendering at its designed
 * opacity, and a `/45` step over `--mg-bg` is well under AA. **The fix and the
 * opacity re-tune are one change, not two**, and pretending otherwise leaves
 * the site failing AA in a new place the moment it starts looking right.
 *
 * `muted` and `faint` stay bare `var()` deliberately — they are `rgba()` in
 * dark, a channel twin can only be derived from a hex, and they have **zero**
 * alpha usages. The test below still guards them: write one and it fails.
 */

const ROOT = join(__dirname, "../..");
const SCANNED = ["app", "components", "lib"];

/**
 * Empty, and it must stay empty. Every token used with an alpha anywhere in the
 * codebase now resolves to a real declaration; a new bare-`var()` token used
 * with an alpha puts its name back in here and fails the test below.
 */
const KNOWN_BROKEN: string[] = [];

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

  it("has no alpha-modified colour left compiling to nothing", () => {
    // ⚠️ **INVERTED.** This asserted `["bd", "bg", "fg"]` — the wrong-but-current
    // behaviour — until the brand took the decision. An empty list is now the
    // property, and a regression names the offending token rather than a count.
    expect(bareVarTokens()).toEqual([]);
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

  it("keeps every channel-form colour pointed at its own twin", () => {
    // Copy-paste between these entries would render one token's alphas in
    // another's colour, which no other gate would notice — a `bg` pointed at
    // `--mg-fg-rgb` inverts every translucent panel on the site and throws no
    // error. Checked exhaustively rather than for the two that existed when
    // this was written.
    for (const [token, cssVar] of Object.entries({
      bg: "--mg-bg-rgb",
      fg: "--mg-fg-rgb",
      surface: "--mg-surface-rgb",
      bd: "--mg-bd-rgb",
      accent: "--mg-accent-rgb",
      accentInk: "--mg-accent-ink-rgb",
      accentSerif: "--mg-accent-serif-rgb",
    })) {
      expect(palette[token], `mg.${token} must read its own twin`).toBe(
        `rgb(var(${cssVar}) / <alpha-value>)`
      );
    }
  });

  it("leaves muted and faint bare, because a twin cannot be derived from rgba()", () => {
    // Not an oversight: both are `rgba()` in dark by design. Their safety is
    // that nothing uses them with an alpha — asserted, so the day someone does,
    // the test above turns red instead of the class silently vanishing.
    expect(palette.muted).toBe("var(--mg-muted)");
    expect(palette.faint).toBe("var(--mg-faint)");
    expect(tokensUsedWithAlpha()).not.toContain("muted");
    expect(tokensUsedWithAlpha()).not.toContain("faint");
  });
});
