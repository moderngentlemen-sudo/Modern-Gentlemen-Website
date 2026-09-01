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
  DEFAULT_THEME_COMPONENTS,
  DEFAULT_THEME_HEADER,
  DEFAULT_THEME_LAYOUT,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_THEME_TYPOGRAPHY,
  THEME_CONTEXTS,
  THEME_TOKENS,
  TOKENS_BY_CONTEXT,
  accentChannels,
  parseThemeHeader,
  parseThemeLayout,
  parseThemeColors,
  parseThemeComponentDefaults,
  parseThemeSettings,
  parseThemeStyleClasses,
  parseThemeTypography,
  safeCssColor,
  themeCssText,
  themeComponentCssText,
  themeComponentDefaultsSchema,
  themeDesignCssText,
  themeSettingsSchema,
  themeWebfontFaceCssText,
  themeWebfontStylesheets,
  toThemeStatus,
} from "./theme";

// Transcribed from app/globals.css. Kept as three separate strings so a failure
// names the block that moved.
const DARK =
  ":root:root{" +
  "--mg-bg:#0d0d0d;--mg-bg-rgb:13 13 13;--mg-fg:#f4f4f4;--mg-fg-rgb:244 244 244;" +
  "--mg-surface:#131315;--mg-surface-rgb:19 19 21;--mg-bd:#ffffff;--mg-bd-rgb:255 255 255;" +
  "--mg-accent:#c8102e;--mg-accent-rgb:200 16 46;" +
  "--mg-accent-ink:#f7142e;--mg-accent-ink-rgb:247 20 46;" +
  "--mg-accent-serif:#ff4d5e;--mg-accent-serif-rgb:255 77 94;" +
  "--mg-muted:rgba(244, 244, 244, 0.5);--mg-faint:rgba(244, 244, 244, 0.5);" +
  "--mg-band-border:rgba(255, 255, 255, 0.12)}";

const LIGHT =
  'html[data-mgtheme="light"]:root{' +
  "--mg-bg:#f4f4f4;--mg-bg-rgb:244 244 244;--mg-fg:#141414;--mg-fg-rgb:20 20 20;" +
  "--mg-surface:#ffffff;--mg-surface-rgb:255 255 255;--mg-bd:#141414;--mg-bd-rgb:20 20 20;" +
  "--mg-accent-ink:#c8102e;--mg-accent-ink-rgb:200 16 46;" +
  "--mg-accent-serif:#c8102e;--mg-accent-serif-rgb:200 16 46;" +
  "--mg-muted:#5a5a5a;--mg-faint:#707070;" +
  "--mg-band-border:transparent}";

const DARK_BAND =
  "[data-darkband][data-darkband]{" +
  "--mg-bg:#0d0d0d;--mg-bg-rgb:13 13 13;--mg-fg:#f4f4f4;--mg-fg-rgb:244 244 244;" +
  "--mg-surface:#161618;--mg-surface-rgb:22 22 24;--mg-bd:#ffffff;--mg-bd-rgb:255 255 255;" +
  "--mg-accent-ink:#f7142e;--mg-accent-ink-rgb:247 20 46;" +
  "--mg-accent-serif:#ff4d5e;--mg-accent-serif-rgb:255 77 94;" +
  "--mg-muted:rgba(244, 244, 244, 0.5);" +
  "--mg-faint:rgba(244, 244, 244, 0.5)}";

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

describe("editable typography and header settings", () => {
  it("upgrades a legacy color-only payload with design-preserving defaults", () => {
    const parsed = parseThemeSettings({ version: 1, colors: DEFAULT_THEME_COLORS });

    expect(parsed.colors).toEqual(DEFAULT_THEME_COLORS);
    expect(parsed.typography).toEqual(DEFAULT_THEME_TYPOGRAPHY);
    expect(parsed.header).toEqual(DEFAULT_THEME_HEADER);
    expect(parsed.layout).toEqual(DEFAULT_THEME_LAYOUT);
    expect(parsed.styleClasses).toEqual([]);
    expect(parsed.components).toEqual(DEFAULT_THEME_COMPONENTS);
  });

  it("parses semantic component defaults field by field", () => {
    expect(
      parseThemeComponentDefaults({
        components: {
          button: { shape: "pill", casing: "invalid", shadow: "elevated", interaction: "lift" },
          card: { shape: "rounded", border: "strong", shadow: "invalid", mediaHover: "none" },
          form: { shape: "subtle", border: "none", fill: "surface", focus: "foreground" },
        },
      })
    ).toEqual({
      button: { shape: "pill", casing: "uppercase", shadow: "elevated", interaction: "lift" },
      card: { shape: "rounded", border: "strong", shadow: "none", mediaHover: "none" },
      form: { shape: "subtle", border: "none", fill: "surface", focus: "foreground" },
    });

    expect(parseThemeComponentDefaults({})).toEqual(DEFAULT_THEME_COMPONENTS);
    expect(themeComponentDefaultsSchema.safeParse(DEFAULT_THEME_COMPONENTS).success).toBe(true);
    expect(
      themeComponentDefaultsSchema.safeParse({
        ...DEFAULT_THEME_COMPONENTS,
        button: { ...DEFAULT_THEME_COMPONENTS.button, shape: "blob" },
      }).success
    ).toBe(false);
  });

  it("emits design-preserving semantic defaults and bounded creative variants", () => {
    const defaults = themeComponentCssText(DEFAULT_THEME_COMPONENTS);
    expect(defaults).toContain(
      ".mg-button.mg-button{border-radius:0;text-transform:uppercase;box-shadow:none}"
    );
    expect(defaults).toContain(
      ".mg-card.mg-card{border-radius:0;border-width:1px;box-shadow:none}"
    );
    expect(defaults).toContain(".mg-card:hover .mg-card-media{transform:scale(1.06)}");
    expect(defaults).toContain(
      ".mg-form-field.mg-form-field{border-radius:0;border-width:1px;background:transparent}"
    );

    const custom = themeComponentCssText({
      button: { shape: "pill", casing: "natural", shadow: "subtle", interaction: "scale" },
      card: { shape: "rounded", border: "strong", shadow: "dramatic", mediaHover: "none" },
      form: { shape: "subtle", border: "none", fill: "surface", focus: "foreground" },
    });
    expect(custom).toContain("border-radius:999px;text-transform:none");
    expect(custom).toContain(".mg-button.mg-button:hover{transform:scale(1.025)}");
    expect(custom).toContain("border-radius:12px;border-width:2px");
    expect(custom).toContain("background:var(--mg-surface)");
    expect(custom).toContain("border-color:var(--mg-fg)");
    expect(custom).toContain("@media(prefers-reduced-motion:reduce)");
  });

  it("validates, parses and emits reusable responsive style classes", () => {
    const styleClasses = [
      {
        id: "feature-card",
        name: "Feature card",
        visual: {
          styles: {
            desktop: { display: "grid" as const, gap: 24 as const, radius: "rounded" as const },
            mobile: { display: "block" as const, paddingX: 16 as const },
          },
          effects: { hover: "lift" as const, motion: "gentle" as const },
        },
      },
    ];

    expect(parseThemeStyleClasses({ styleClasses })).toEqual(styleClasses);
    expect(themeDesignCssText({ ...DEFAULT_THEME_SETTINGS, styleClasses })).toContain(
      '[data-mg-style~="feature-card"]'
    );
    expect(themeSettingsSchema.safeParse({ ...DEFAULT_THEME_SETTINGS, styleClasses }).success).toBe(
      true
    );
    expect(
      themeSettingsSchema.safeParse({
        ...DEFAULT_THEME_SETTINGS,
        styleClasses: [...styleClasses, { ...styleClasses[0], name: "Duplicate" }],
      }).success
    ).toBe(false);
    expect(
      themeSettingsSchema.safeParse({
        ...DEFAULT_THEME_SETTINGS,
        styleClasses: [{ id: "missing-visual", name: "Missing visual" }],
      }).success
    ).toBe(false);
  });

  it("drops malformed stored style classes independently", () => {
    expect(
      parseThemeStyleClasses({
        styleClasses: [
          { id: "unsafe class", name: "Bad", visual: {} },
          { id: "safe-card", name: "Safe", visual: { styles: { desktop: { gap: 16 } } } },
          { id: "script", name: "Script", visual: { rawCss: "display:none" } },
        ],
      })
    ).toEqual([{ id: "safe-card", name: "Safe", visual: { styles: { desktop: { gap: 16 } } } }]);
  });

  it("keeps valid stored choices and falls back field by field", () => {
    expect(
      parseThemeTypography({
        typography: { heading: "systemSerif", body: "not-a-font", baseSize: 18 },
      })
    ).toEqual({
      ...DEFAULT_THEME_TYPOGRAPHY,
      heading: "systemSerif",
      baseSize: 18,
    });

    expect(
      parseThemeHeader({
        header: {
          scrollBehavior: "always-visible",
          background: "not-a-background",
          showSearch: false,
          height: 80,
        },
      })
    ).toEqual({
      ...DEFAULT_THEME_HEADER,
      scrollBehavior: "always-visible",
      showSearch: false,
      height: 80,
    });
  });

  it("emits role variables from presets rather than arbitrary CSS", () => {
    const css = themeDesignCssText({
      ...DEFAULT_THEME_SETTINGS,
      typography: { ...DEFAULT_THEME_TYPOGRAPHY, heading: "systemSerif" },
      header: { ...DEFAULT_THEME_HEADER, height: 80 },
    });

    expect(css.startsWith(themeCssText(DEFAULT_THEME_COLORS))).toBe(true);
    expect(css).toContain('--font-heading:ui-serif,Georgia,"Times New Roman",serif');
    expect(css).toContain("--font-body:var(--font-space-grotesk),sans-serif");
    expect(css).toContain("--font-base-size:16px");
    expect(css).toContain("--header-height:80px");
    expect(css).toContain("--layout-content-width:1320px");
    expect(css).toContain("--layout-desktop-gutter:48px");
    expect(css).toContain("--layout-mobile-gutter:22px");
  });

  it("keeps valid layout settings and falls back field by field", () => {
    expect(
      parseThemeLayout({
        layout: { contentWidth: 1440, desktopGutter: 4, mobileGutter: 28 },
      })
    ).toEqual({
      ...DEFAULT_THEME_LAYOUT,
      contentWidth: 1440,
      mobileGutter: 28,
    });
  });

  it("loads provider stylesheets once and maps their family to any role", () => {
    const typography = {
      ...DEFAULT_THEME_TYPOGRAPHY,
      heading: "webfont:brand-serif" as const,
      webfonts: [
        {
          id: "brand-serif",
          label: "Brand Serif",
          family: "Playfair Display",
          source: "stylesheet" as const,
          url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap",
          fallback: "serif" as const,
          weight: "400",
          style: "normal" as const,
        },
      ],
    };

    expect(themeWebfontStylesheets(typography)).toEqual([
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap",
    ]);
    expect(themeDesignCssText({ ...DEFAULT_THEME_SETTINGS, typography })).toContain(
      '--font-heading:"Playfair Display",ui-serif,Georgia,"Times New Roman",serif'
    );
  });

  it("emits a safe font-face for direct files, including variable weights", () => {
    const typography = {
      ...DEFAULT_THEME_TYPOGRAPHY,
      webfonts: [
        {
          id: "brand-sans",
          label: "Brand Sans",
          family: "Brand Sans",
          source: "file" as const,
          url: "https://cdn.example.com/fonts/brand.woff2?v=2",
          fallback: "sans" as const,
          weight: "100 900",
          style: "normal" as const,
        },
      ],
    };

    expect(themeWebfontFaceCssText(typography)).toBe(
      '@font-face{font-family:"Brand Sans";src:url("https://cdn.example.com/fonts/brand.woff2?v=2") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}'
    );
  });

  it("rejects unsafe webfont URLs and missing custom references on write", () => {
    const typography = {
      ...DEFAULT_THEME_TYPOGRAPHY,
      heading: "webfont:missing",
      webfonts: [
        {
          id: "bad-font",
          label: "Bad",
          family: "Bad Font",
          source: "file",
          url: "javascript:alert(1)",
          fallback: "sans",
          weight: "400",
          style: "normal",
        },
      ],
    };

    const result = themeSettingsSchema.safeParse({ ...DEFAULT_THEME_SETTINGS, typography });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["typography.webfonts.0.url", "typography.heading"])
      );
    }
  });

  it("drops malformed stored webfonts without losing valid built-in choices", () => {
    expect(
      parseThemeTypography({
        typography: {
          heading: "systemSerif",
          webfonts: [{ id: "bad", source: "file", url: "data:font/woff2;base64,xx" }],
        },
      })
    ).toEqual({ ...DEFAULT_THEME_TYPOGRAPHY, heading: "systemSerif" });
  });
});

/** The token -> property map is private to theme.ts; mirrored here to read it back. */
const CSS_VAR_FOR_TEST: Record<string, string> = {
  bg: "--mg-bg",
  fg: "--mg-fg",
  surface: "--mg-surface",
  bd: "--mg-bd",
  accent: "--mg-accent",
  accentInk: "--mg-accent-ink",
  accentSerif: "--mg-accent-serif",
  muted: "--mg-muted",
  faint: "--mg-faint",
  bandBorder: "--mg-band-border",
};

describe("themeCssText — the contract with globals.css", () => {
  it("emits exactly the stylesheet the site already ships", () => {
    expect(themeCssText(DEFAULT_THEME_COLORS)).toBe(DARK + LIGHT + DARK_BAND);
  });

  /**
   * ⚠️ **INVERTED.** This test read "declares the accent once, and only in the
   * dark block" and asserted `toHaveLength(1)`. It was correct for as long as
   * one red served both themes — and that stopped being possible, not merely
   * unfashionable: against `#0d0d0d` AA sets a luminance floor of 0.193 and
   * against `#f4f4f4` a ceiling of 0.162, and no hue sits in both. The accent
   * is now a three-context token and the assertion is its opposite.
   */
  it("declares the accent fill once and the accent ink in all three", () => {
    const css = themeCssText(DEFAULT_THEME_COLORS);

    // `--mg-accent-rgb` and `--mg-accent-ink` also match a naive count of
    // "--mg-accent", so anchor on the delimiter that follows each name.
    expect(css.match(/--mg-accent:/g)).toHaveLength(1);
    expect(css.match(/--mg-accent-ink:/g)).toHaveLength(3);

    // The split that this whole change turns on: the fill must NOT follow the
    // ink brighter, because white text sits on the fill. Brightening it took
    // the failing-node count from 34 to 46.
    expect(DEFAULT_THEME_COLORS.dark?.accent).toBe("#c8102e");
    expect(DEFAULT_THEME_COLORS.dark?.accentInk).not.toBe(DEFAULT_THEME_COLORS.dark?.accent);

    // And a dark band on a light page must not inherit light's ink.
    expect(DEFAULT_THEME_COLORS.darkBand?.accentInk).toBe(DEFAULT_THEME_COLORS.dark?.accentInk);
    expect(DEFAULT_THEME_COLORS.light?.accentInk).not.toBe(DEFAULT_THEME_COLORS.dark?.accentInk);
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
    // `bg` carries a channel twin now, so it emits the pair — and shorthand
    // hex still expands, which is what stops a stored `#fff` being refused.
    expect(themeCssText({ light: { bg: "#fff" } })).toBe(
      'html[data-mgtheme="light"]:root{--mg-bg:#fff;--mg-bg-rgb:255 255 255}'
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

  /**
   * ⚠️ **There used to be two asymmetries here and now there is one.** The
   * accent was dark-only while one red served both themes; it is a full
   * three-context token since AA forced the red to differ per theme. What
   * remains is the trap, and it is the more dangerous of the two anyway.
   */
  it("keeps the asymmetry globals.css depends on: no bandBorder on a dark band", () => {
    // `globals.css` keys the hairline off the PAGE theme — translucent white on
    // a dark page, `transparent` on a light one — so a dark band on paper still
    // takes no hairline. Letting `darkBand` declare it would draw one there.
    expect(TOKENS_BY_CONTEXT.darkBand).not.toContain("bandBorder");
    expect(TOKENS_BY_CONTEXT.light).toContain("bandBorder");
  });

  it("keeps the accent FILL dark-only — it is one value in all three contexts", () => {
    expect(TOKENS_BY_CONTEXT.dark).toContain("accent");
    expect(TOKENS_BY_CONTEXT.light).not.toContain("accent");
    expect(TOKENS_BY_CONTEXT.darkBand).not.toContain("accent");
  });

  it("lets every context declare the accent INK, because no one red passes in both", () => {
    for (const context of THEME_CONTEXTS) {
      expect(TOKENS_BY_CONTEXT[context]).toContain("accentInk");
    }
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
