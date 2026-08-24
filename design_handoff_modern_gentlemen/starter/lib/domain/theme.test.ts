/**
 * The theme domain, and in particular the one test that guards sixteen
 * screenshots.
 *
 * `themeCssText(DEFAULT_THEME_COLORS)` is compared against a literal transcribed
 * from `app/globals.css`. The seeded theme emits exactly this, which is what
 * makes the emitted block a semantic no-op and the visual baselines unmoved. If
 * somebody edits a token in `globals.css` and not here — or here and not there —
 * this fails in twelve seconds instead of surfacing as a pixel diff in a
 * Playwright run that needs a database, a build and a browser.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_COLORS,
  THEME_CONTEXTS,
  THEME_TOKENS,
  TOKENS_BY_CONTEXT,
  accentChannels,
  parseThemeColors,
  safeCssColor,
  themeCssText,
  toThemeStatus,
} from "./theme";

// Transcribed from app/globals.css. Kept as three separate strings so a failure
// names the block that moved.
const DARK =
  ":root:root{" +
  "--mg-bg:#0d0d0d;--mg-fg:#f4f4f4;--mg-surface:#131315;--mg-bd:#ffffff;" +
  "--mg-accent:#c8102e;--mg-accent-rgb:200 16 46;" +
  "--mg-accent-serif:#ff4d5e;--mg-accent-serif-rgb:255 77 94;" +
  "--mg-muted:rgba(244, 244, 244, 0.5);--mg-faint:rgba(244, 244, 244, 0.35);" +
  "--mg-band-border:rgba(255, 255, 255, 0.12)}";

const LIGHT =
  'html[data-mgtheme="light"]:root{' +
  "--mg-bg:#f4f4f4;--mg-fg:#141414;--mg-surface:#ffffff;--mg-bd:#141414;" +
  "--mg-accent-serif:#c8102e;--mg-accent-serif-rgb:200 16 46;" +
  "--mg-muted:#8a8a8a;--mg-faint:#b0b0b0;" +
  "--mg-band-border:transparent}";

const DARK_BAND =
  "[data-darkband][data-darkband]{" +
  "--mg-bg:#0d0d0d;--mg-fg:#f4f4f4;--mg-surface:#161618;--mg-bd:#ffffff;" +
  "--mg-accent-serif:#ff4d5e;--mg-accent-serif-rgb:255 77 94;" +
  "--mg-muted:rgba(244, 244, 244, 0.5);" +
  "--mg-faint:rgba(244, 244, 244, 0.35)}";

/**
 * Read the real stylesheet and pull the three token blocks out of it.
 *
 * The literals above are a transcription, and a transcription can be wrong in
 * the same direction as the code it describes — both were written in one sitting
 * from the same reading. This reads the source of truth instead, so
 * `DEFAULT_THEME_COLORS` is checked against `globals.css` itself rather than
 * against someone's copy of it.
 *
 * Deliberately in the test and not in `theme.ts`: `lib/domain` is a pure leaf and
 * may not touch the filesystem.
 */
function declarationsIn(selector: string): Record<string, string> {
  const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

  // Non-greedy to the first closing brace. None of the three blocks contains a
  // nested rule, and the test below fails loudly if that ever stops being true.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`No \`${selector}\` block found in app/globals.css`);

  // Strip comments from the whole block BEFORE splitting on `;` — the comments
  // in globals.css contain semicolons of their own, so the other order shreds
  // them and silently loses the declaration that follows.
  const body = block[1].replace(/\/\*[\s\S]*?\*\//g, "");

  const out: Record<string, string> = {};
  for (const line of body.split(";")) {
    const match = /^\s*(--mg-[a-z-]+)\s*:\s*(.+?)\s*$/s.exec(line);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

describe("DEFAULT_THEME_COLORS mirrors app/globals.css", () => {
  it.each([
    ["dark", ":root"],
    ["light", 'html[data-mgtheme="light"]'],
    ["darkBand", "[data-darkband]"],
  ] as const)("matches the %s block declaration for declaration", (context, selector) => {
    const declared = declarationsIn(selector);

    // The `-rgb` twins are derived rather than stored, so they are not tokens
    // and are checked separately below. Matched by suffix rather than named one
    // at a time: a second twin (`--mg-accent-serif-rgb`) arrived with the
    // accentSerif fix, and a list would have had to be remembered.
    for (const key of Object.keys(declared)) {
      if (key.endsWith("-rgb")) delete declared[key];
    }

    const fromDefaults: Record<string, string> = {};
    for (const token of TOKENS_BY_CONTEXT[context]) {
      const value = DEFAULT_THEME_COLORS[context]?.[token];
      if (value !== undefined) fromDefaults[CSS_VAR_FOR_TEST[token]] = value;
    }

    expect(fromDefaults).toEqual(declared);
  });

  it("derives the same channel triples globals.css declares by hand", () => {
    expect(declarationsIn(":root")["--mg-accent-rgb"]).toBe(
      accentChannels(DEFAULT_THEME_COLORS.dark?.accent)
    );
    // The serif accent changes per context, so its twin is checked in all
    // three: a hand-written triple is exactly the thing that drifts, and a
    // wrong one here paints every admin error border the wrong red rather than
    // failing.
    expect(declarationsIn(":root")["--mg-accent-serif-rgb"]).toBe(
      accentChannels(DEFAULT_THEME_COLORS.dark?.accentSerif)
    );
    expect(declarationsIn('html[data-mgtheme="light"]')["--mg-accent-serif-rgb"]).toBe(
      accentChannels(DEFAULT_THEME_COLORS.light?.accentSerif)
    );
    expect(declarationsIn("[data-darkband]")["--mg-accent-serif-rgb"]).toBe(
      accentChannels(DEFAULT_THEME_COLORS.darkBand?.accentSerif)
    );
  });
});

/** The token -> property map is private to theme.ts; mirrored here to read it back. */
const CSS_VAR_FOR_TEST: Record<string, string> = {
  bg: "--mg-bg",
  fg: "--mg-fg",
  surface: "--mg-surface",
  bd: "--mg-bd",
  accent: "--mg-accent",
  accentSerif: "--mg-accent-serif",
  muted: "--mg-muted",
  faint: "--mg-faint",
  bandBorder: "--mg-band-border",
};

describe("themeCssText — the contract with globals.css", () => {
  it("emits exactly the stylesheet the site already ships", () => {
    expect(themeCssText(DEFAULT_THEME_COLORS)).toBe(DARK + LIGHT + DARK_BAND);
  });

  it("declares the accent once, and only in the dark block", () => {
    const css = themeCssText(DEFAULT_THEME_COLORS);

    // `--mg-accent-rgb` also matches a naive count of "--mg-accent", so anchor
    // on the delimiter that follows the property name.
    expect(css.match(/--mg-accent:/g)).toHaveLength(1);
    expect(css.indexOf("--mg-accent:")).toBeLessThan(css.indexOf(LIGHT));
  });

  it("emits the accent's channel twin beside it, derived from the same value", () => {
    expect(themeCssText({ dark: { accent: "#c8102e" } })).toBe(
      ":root:root{--mg-accent:#c8102e;--mg-accent-rgb:200 16 46}"
    );
  });

  it("emits the serif accent's twin too, in every context it is declared in", () => {
    // The regression that mattered: without the twin, `mg-accentSerif/40`
    // compiles to nothing and every admin error border silently disappears.
    expect(themeCssText({ light: { accentSerif: "#c8102e" } })).toBe(
      'html[data-mgtheme="light"]:root{--mg-accent-serif:#c8102e;--mg-accent-serif-rgb:200 16 46}'
    );
    expect(themeCssText({ darkBand: { accentSerif: "#ff4d5e" } })).toBe(
      "[data-darkband][data-darkband]{--mg-accent-serif:#ff4d5e;--mg-accent-serif-rgb:255 77 94}"
    );
  });

  it("refuses a non-hex serif accent, because a twin cannot be derived from one", () => {
    // The cost of the fix, asserted rather than left in a comment: `accentSerif`
    // took any CSS colour until now. An rgba() value is dropped and the default
    // stands, the same way the accent has always behaved.
    expect(themeCssText({ light: { accentSerif: "rgba(200, 16, 46, 0.8)" } })).toBe("");
  });

  it("never declares the band hairline inside a dark band", () => {
    const css = themeCssText(DEFAULT_THEME_COLORS);

    expect(css.match(/--mg-band-border:/g)).toHaveLength(2);
    expect(DARK_BAND).not.toContain("--mg-band-border");
    // The hairline is keyed off the PAGE theme (globals.css:27-30), so a value
    // supplied for the band context must be discarded rather than emitted.
    expect(themeCssText({ darkBand: { bandBorder: "#ff0000" } as never })).toBe("");
  });

  it("omits a block with nothing to say, and returns empty for an empty theme", () => {
    expect(themeCssText({})).toBe("");
    expect(themeCssText({ light: {} })).toBe("");
    expect(themeCssText({ light: { bg: "#fff" } })).toBe(
      'html[data-mgtheme="light"]:root{--mg-bg:#fff}'
    );
  });

  it("cannot leak an unrecognised key from a passthrough payload", () => {
    const colors = parseThemeColors({
      colors: { light: { bg: "#fff", somethingNew: "#00ff00" } },
    });

    expect(themeCssText(colors)).not.toContain("00ff00");
    expect(themeCssText(colors)).not.toContain("somethingNew");
  });
});

describe("safeCssColor — the injection boundary", () => {
  it.each([
    "#abc",
    "#abcd",
    "#aabbcc",
    "#aabbccdd",
    "rgb(1, 2, 3)",
    "rgba(244, 244, 244, 0.35)",
    "hsl(210 4% 8%)",
    "hsla(210, 4%, 8%, 0.5)",
    "transparent",
    "currentColor",
  ])("accepts %s", (value) => {
    expect(safeCssColor(value)).toBe(value);
  });

  it.each([
    ["a declaration break", "red;color:blue"],
    ["a closed style element", "red}</style><script>alert(1)</script>"],
    ["a comment", "red/*x*/"],
    ["a url", "url(https://example.com/x.png)"],
    ["a brace", "red}"],
    ["a quote", `red"`],
    ["a backslash", "red\\"],
    ["a newline", "red\ncolor:blue"],
    ["a bare keyword", "red"],
    ["an empty string", ""],
    ["a non-string", 42],
    ["null", null],
  ])("rejects %s", (_label, value) => {
    expect(safeCssColor(value)).toBeNull();
  });

  it("rejects anything long enough to be a payload rather than a colour", () => {
    expect(safeCssColor(`rgba(${"1,".repeat(200)}1)`)).toBeNull();
  });

  it("trims, because a paste artefact is not an attack", () => {
    expect(safeCssColor("  #c8102e  ")).toBe("#c8102e");
  });
});

describe("accentChannels", () => {
  it.each([
    ["#c8102e", "200 16 46"],
    ["#C8102E", "200 16 46"],
    ["#fff", "255 255 255"],
    ["#000000", "0 0 0"],
  ])("converts %s to %s", (input, expected) => {
    expect(accentChannels(input)).toBe(expected);
  });

  it("refuses anything that is not a hex, because there are no channels to take", () => {
    // The accent is hex-only by consequence, not by preference: --mg-accent-rgb
    // has nothing sensible to hold for these.
    expect(accentChannels("rgba(200, 16, 46, 1)")).toBeNull();
    expect(accentChannels("transparent")).toBeNull();
    expect(accentChannels("red}</style>")).toBeNull();
  });
});

describe("parseThemeColors — forgiving on the way out of the database", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty object", {}],
    ["an array", []],
    ["a string", "nope"],
    ["a number", 7],
    ["colors of the wrong type", { colors: "nope" }],
    ["a context of the wrong type", { colors: { light: "nope" } }],
    ["an unknown envelope version with no colours", { version: 99 }],
  ])("falls back to the built-in defaults for %s", (_label, value) => {
    expect(parseThemeColors(value)).toEqual(DEFAULT_THEME_COLORS);
  });

  it("never throws, whatever it is handed", () => {
    for (const value of [null, undefined, [], "x", 0, { colors: { dark: { bg: 1 } } }]) {
      expect(() => parseThemeColors(value)).not.toThrow();
    }
  });

  it("drops only the bad value, so the rest of the context survives", () => {
    const colors = parseThemeColors({
      colors: { light: { bg: "#ffffff", fg: "red;color:blue" } },
    });

    expect(colors.light).toEqual({ bg: "#ffffff" });
  });

  it("drops a non-hex accent rather than emitting a broken channel triple", () => {
    const colors = parseThemeColors({
      colors: { dark: { accent: "rgba(200, 16, 46, 1)", bg: "#0d0d0d" } },
    });

    expect(colors.dark).toEqual({ bg: "#0d0d0d" });
  });

  it("round-trips the defaults unchanged", () => {
    expect(parseThemeColors({ version: 1, colors: DEFAULT_THEME_COLORS })).toEqual(
      DEFAULT_THEME_COLORS
    );
  });
});

describe("token tables", () => {
  it("gives every context a subset of the nine tokens", () => {
    for (const context of THEME_CONTEXTS) {
      for (const token of TOKENS_BY_CONTEXT[context]) {
        expect(THEME_TOKENS).toContain(token);
      }
    }
  });

  it("keeps the two asymmetries that globals.css depends on", () => {
    expect(TOKENS_BY_CONTEXT.dark).toContain("accent");
    expect(TOKENS_BY_CONTEXT.light).not.toContain("accent");
    expect(TOKENS_BY_CONTEXT.darkBand).not.toContain("accent");
    expect(TOKENS_BY_CONTEXT.darkBand).not.toContain("bandBorder");
  });

  it("supplies a default for every token a context declares", () => {
    for (const context of THEME_CONTEXTS) {
      for (const token of TOKENS_BY_CONTEXT[context]) {
        expect(DEFAULT_THEME_COLORS[context]?.[token]).toBeTruthy();
      }
    }
  });
});

describe("toThemeStatus", () => {
  it("passes through the three the CHECK allows", () => {
    expect(toThemeStatus("draft")).toBe("draft");
    expect(toThemeStatus("published")).toBe("published");
    expect(toThemeStatus("archived")).toBe("archived");
  });

  it("reads anything else as a draft, which is the safe direction", () => {
    expect(toThemeStatus("scheduled")).toBe("draft");
    expect(toThemeStatus(null)).toBe("draft");
    expect(toThemeStatus(undefined)).toBe("draft");
  });
});
