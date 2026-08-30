/**
 * The design tokens, as editable data — pure, and free of data access.
 *
 * `0007_navigation_and_theme.sql` built `theme_settings` as a single versioned
 * document whose header comment says its payload "mirrors the CSS custom
 * properties in app/globals.css; the renderer emits them as a `:root` style
 * block". Nothing read it for ten phases. This file is that mirror, and the only
 * place that knows how a stored payload becomes a stylesheet.
 *
 * **This module is the contract with `app/globals.css`, and the two can drift.**
 * `theme.test.ts` compares the emitted text against a literal so the drift fails
 * a unit test rather than sixteen screenshots.
 *
 * Colors, typography roles and header behavior live here. Typography is mapped
 * through curated font identifiers rather than arbitrary CSS; the existing
 * Tailwind role classes consume the emitted variables. Spacing, radii and motion
 * remain component/block concerns and are intentionally outside this document.
 *
 * NOT a `DocumentType`. `theme_settings` carries every column a document has and
 * `0017` puts it on the SQL `document_table()` allowlist, so the publishing
 * machinery works — but `DOCUMENT_TYPES` in `./documents` stays at five,
 * because `permissionFor` in `lib/services/documents.ts` builds
 * `` `${type}.${action}` `` and narrows it to `Permission`: there is no
 * `theme.delete`, so widening the union is an immediate type error that then
 * cascades into `DOCUMENT_TABLES`, `BLOCK_TREE_KEY`, `isDocumentType` (which
 * gates `media_usages` entity types) and `createPreview`. The theme service
 * passes the literal below to the RPC instead.
 */

import { z } from "zod";

/** `revisions.entity_type` / the `p_entity_type` argument. See the note above. */
export const THEME_ENTITY_TYPE = "theme";

/** `theme_settings.key` — `0007` seeds exactly this one row. */
export const THEME_KEY = "default";

/** `theme_settings.status` — the CHECK in `0007`. */
export const THEME_STATUSES = ["draft", "published", "archived"] as const;
export type ThemeStatus = (typeof THEME_STATUSES)[number];

/** An unrecognised status reads as a draft, which is the safe direction. */
export function toThemeStatus(value: string | null | undefined): ThemeStatus {
  return (THEME_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as ThemeStatus)
    : "draft";
}

// ---------------------------------------------------------------------------
// The tokens
// ---------------------------------------------------------------------------

/** The nine `--mg-*` custom properties in `app/globals.css`. */
export const THEME_TOKENS = [
  "bg",
  "fg",
  "surface",
  "bd",
  "accent",
  "accentInk",
  "accentSerif",
  "muted",
  "faint",
  "bandBorder",
] as const;
export type ThemeToken = (typeof THEME_TOKENS)[number];

/**
 * The three selector contexts `globals.css` declares.
 *
 * `dark` is `:root` — dark is the base and light overrides it, which is the
 * reverse of the runtime default (the boot script defaults to light). That
 * inversion is `globals.css`'s, not this file's.
 */
export const THEME_CONTEXTS = ["dark", "light", "darkBand"] as const;
export type ThemeContext = (typeof THEME_CONTEXTS)[number];

/**
 * Which tokens each context may declare.
 *
 * **These asymmetries are the whole reason this table exists.** A "just emit all
 * nine into all three" implementation is wrong in two specific ways, and both
 * failures are silent — the site still renders, it renders differently.
 *
 * `accent` is dark-only, and still is: the racing red as a **fill** is identical
 * in light, in dark and inside a dark band, so emitting it into the other two
 * would be a no-op and an invitation to let three copies drift.
 *
 * ⚠️ **`accentInk` is the three-context one, and the split between the two is
 * the hard-won part.** The accent as text failed AA on dark — `#c8102e` reads
 * 3.30 on `#0d0d0d` — and no single value can fix that, because against
 * `#0d0d0d` AA sets a luminance floor of 0.193 and against light's `#f4f4f4` a
 * ceiling of 0.162, windows that do not overlap for any hue. The obvious repair
 * was to brighten `--mg-accent` itself. **Measured, that made things worse: 34
 * failing nodes became 46**, because the same token fills the red CTA band and
 * lifting its luminance dropped the white text sitting on it from 5.88 to 4.12.
 * Ink and fill want opposite directions, so they are two tokens. `darkBand`
 * declares the ink for the case a delta model hides — a dark band on a LIGHT
 * page, which would otherwise inherit light's `#c8102e` onto `#0d0d0d`.
 *
 * `bandBorder` is absent from `darkBand` on purpose. `globals.css:27-30`: the
 * hairline is keyed off the PAGE theme — translucent white on a dark page,
 * `transparent` on a light one — so `[data-darkband]` must not override it. A
 * dark band on a light page still takes no hairline. This is the trap.
 *
 * `darkBand` is a full map rather than a delta off `dark`, because it genuinely
 * differs: `--mg-surface` is `#161618` there and `#131315` in `:root`. A delta
 * model would encode that as an override and invite a later tidy-up that loses
 * it.
 */
export const TOKENS_BY_CONTEXT = {
  dark: THEME_TOKENS,
  light: ["bg", "fg", "surface", "bd", "accentInk", "accentSerif", "muted", "faint", "bandBorder"],
  darkBand: ["bg", "fg", "surface", "bd", "accentInk", "accentSerif", "muted", "faint"],
} as const satisfies Record<ThemeContext, readonly ThemeToken[]>;

/** Token name -> custom property. The one place the two vocabularies meet. */
const CSS_VAR: Record<ThemeToken, string> = {
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

/**
 * One step more specific than the matching rule in `globals.css`, so the cascade
 * decides this and document order does not.
 *
 * Next serves compiled CSS as a `<link>` in production and as injected `<style>`
 * tags in development, in an order no component controls. At equal specificity
 * the winner would then depend on the build mode — the emitted theme would win
 * in one and lose in the other, which is the kind of bug that reproduces only on
 * someone else's machine. Doubling the selector removes the question:
 *
 *   :root:root                      (0,2,0) beats :root                   (0,1,0)
 *   html[data-mgtheme="light"]:root (0,2,1) beats html[data-mgtheme=…]     (0,1,1)
 *   [data-darkband][data-darkband]  (0,2,0) beats [data-darkband]         (0,1,0)
 *
 * The dark and light rules contest each other on `<html>` and resolve by
 * specificity exactly as the originals do. The band rule only ever contests band
 * rules, on a different element — and custom properties inherit, so a
 * declaration on the band element beats an inherited one regardless.
 */
const SELECTOR: Record<ThemeContext, string> = {
  dark: ":root:root",
  light: 'html[data-mgtheme="light"]:root',
  darkBand: "[data-darkband][data-darkband]",
};

/** Human labels for the admin form. */
export const THEME_TOKEN_LABELS: Record<ThemeToken, string> = {
  bg: "Background",
  fg: "Foreground",
  surface: "Surface",
  bd: "Border",
  accent: "Accent fill",
  accentInk: "Accent text",
  accentSerif: "Serif accent",
  muted: "Muted text",
  faint: "Faint text",
  bandBorder: "Band hairline",
};

export const THEME_CONTEXT_LABELS: Record<ThemeContext, string> = {
  light: "Light theme",
  dark: "Dark theme",
  darkBand: "Dark bands",
};

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

export type ThemeColors = {
  [C in ThemeContext]?: Partial<Record<ThemeToken, string>>;
};

/**
 * Exactly the values in `app/globals.css` today.
 *
 * Both the seed source's basis and the fallback served when the database has no
 * published theme — which is the live state until the theme is first seeded, so
 * this path is the normal one on day one rather than an error branch.
 *
 * `muted` and `faint` are four independent values, NOT opacity ramps off `fg`.
 * `globals.css:13-14` is explicit: "Flat greys in light, translucent paper in
 * dark — not opacities of --mg-fg." (`design_handoff/CLAUDE.md` claims they are
 * a `color-mix` of `--mg-fg`; the implementation won that disagreement long ago
 * and the doc is being corrected alongside this change.)
 */
export const DEFAULT_THEME_COLORS: ThemeColors = {
  dark: {
    bg: "#0d0d0d",
    fg: "#f4f4f4",
    surface: "#131315",
    bd: "#ffffff",
    accent: "#c8102e",
    accentInk: "#f7142e",
    accentSerif: "#ff4d5e",
    muted: "rgba(244, 244, 244, 0.5)",
    faint: "rgba(244, 244, 244, 0.5)",
    bandBorder: "rgba(255, 255, 255, 0.12)",
  },
  light: {
    bg: "#f4f4f4",
    fg: "#141414",
    surface: "#ffffff",
    bd: "#141414",
    accentInk: "#c8102e",
    accentSerif: "#c8102e",
    muted: "#5a5a5a",
    faint: "#707070",
    bandBorder: "transparent",
  },
  darkBand: {
    bg: "#0d0d0d",
    fg: "#f4f4f4",
    surface: "#161618",
    bd: "#ffffff",
    accentInk: "#f7142e",
    accentSerif: "#ff4d5e",
    muted: "rgba(244, 244, 244, 0.5)",
    faint: "rgba(244, 244, 244, 0.5)",
  },
};

// ---------------------------------------------------------------------------
// Typography and site chrome
// ---------------------------------------------------------------------------

/**
 * Curated font stacks available to editors.
 *
 * These are identifiers rather than free-form CSS. A theme is emitted through
 * a style element on every page, so an allowlist keeps the setting both
 * predictable and safe. The three branded faces are already loaded by
 * `next/font`; the remaining stacks are local fallbacks with no network cost.
 */
export const FONT_PRESETS = [
  "spaceGrotesk",
  "instrumentSerif",
  "ibmPlexMono",
  "futura",
  "systemSans",
  "systemSerif",
  "modernSans",
  "humanistSans",
  "geometricSans",
  "transitionalSerif",
  "oldStyleSerif",
  "displaySerif",
  "systemMono",
] as const;
export type FontPreset = (typeof FONT_PRESETS)[number];

export const FONT_PRESET_OPTIONS: readonly { value: FontPreset; label: string }[] = [
  { value: "spaceGrotesk", label: "Space Grotesk" },
  { value: "instrumentSerif", label: "Instrument Serif" },
  { value: "ibmPlexMono", label: "IBM Plex Mono" },
  { value: "futura", label: "Futura stack" },
  { value: "systemSans", label: "System sans" },
  { value: "systemSerif", label: "System serif" },
  { value: "modernSans", label: "Modern sans — Helvetica / Arial" },
  { value: "humanistSans", label: "Humanist sans — Avenir / Gill Sans" },
  { value: "geometricSans", label: "Geometric sans — Century Gothic" },
  { value: "transitionalSerif", label: "Transitional serif — Baskerville" },
  { value: "oldStyleSerif", label: "Old-style serif — Garamond" },
  { value: "displaySerif", label: "Display serif — Didot / Bodoni" },
  { value: "systemMono", label: "System monospace" },
];

const FONT_STACK: Record<FontPreset, string> = {
  spaceGrotesk: "var(--font-space-grotesk),sans-serif",
  instrumentSerif: "var(--font-instrument-serif),Georgia,serif",
  ibmPlexMono: "var(--font-ibm-plex-mono),monospace",
  futura: 'Futura,"Futura PT","Century Gothic",sans-serif',
  systemSans: 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif',
  systemSerif: 'ui-serif,Georgia,"Times New Roman",serif',
  modernSans: '"Helvetica Neue",Helvetica,Arial,sans-serif',
  humanistSans: 'Avenir,"Avenir Next","Gill Sans",Calibri,sans-serif',
  geometricSans: 'Futura,"Century Gothic","Trebuchet MS",sans-serif',
  transitionalSerif: 'Baskerville,"Baskerville Old Face","Times New Roman",serif',
  oldStyleSerif: 'Garamond,"Adobe Garamond Pro",Georgia,serif',
  displaySerif: 'Didot,"Bodoni MT","Times New Roman",serif',
  systemMono: 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace',
};

export const WEBFONT_SOURCES = ["stylesheet", "file"] as const;
export type WebfontSource = (typeof WEBFONT_SOURCES)[number];
export const WEBFONT_FALLBACKS = ["sans", "serif", "mono"] as const;
export type WebfontFallback = (typeof WEBFONT_FALLBACKS)[number];
export const WEBFONT_STYLES = ["normal", "italic"] as const;
export type WebfontStyle = (typeof WEBFONT_STYLES)[number];

export interface ThemeWebfont {
  /** Stable internal key referenced by typography roles. */
  id: string;
  /** Editor-facing name; may differ from the CSS family. */
  label: string;
  family: string;
  source: WebfontSource;
  /** HTTPS provider stylesheet or direct WOFF/WOFF2 file. */
  url: string;
  fallback: WebfontFallback;
  /** A single CSS weight or a variable range such as `100 900`. */
  weight: string;
  style: WebfontStyle;
}

export type FontSelection = FontPreset | `webfont:${string}`;

export const TYPOGRAPHY_ROLES = ["body", "heading", "editorial", "label", "navigation"] as const;
export type TypographyRole = (typeof TYPOGRAPHY_ROLES)[number];

export interface ThemeTypography {
  body: FontSelection;
  heading: FontSelection;
  editorial: FontSelection;
  label: FontSelection;
  navigation: FontSelection;
  /** Root body size. Components with an explicit size remain intentionally explicit. */
  baseSize: number;
  webfonts: ThemeWebfont[];
}

export const DEFAULT_THEME_TYPOGRAPHY: ThemeTypography = {
  body: "spaceGrotesk",
  heading: "spaceGrotesk",
  editorial: "instrumentSerif",
  label: "ibmPlexMono",
  navigation: "futura",
  baseSize: 16,
  webfonts: [],
};

export const HEADER_SCROLL_BEHAVIORS = ["hide-on-scroll", "always-visible"] as const;
export type HeaderScrollBehavior = (typeof HEADER_SCROLL_BEHAVIORS)[number];
export const HEADER_BACKGROUNDS = ["dynamic", "solid", "transparent"] as const;
export type HeaderBackground = (typeof HEADER_BACKGROUNDS)[number];
export const HEADER_CART_VISIBILITY = ["store-only", "always", "hidden"] as const;
export type HeaderCartVisibility = (typeof HEADER_CART_VISIBILITY)[number];

export interface ThemeHeader {
  scrollBehavior: HeaderScrollBehavior;
  background: HeaderBackground;
  showSearch: boolean;
  showThemeToggle: boolean;
  cartVisibility: HeaderCartVisibility;
  /** Header and page offset, in pixels. */
  height: number;
}

export const DEFAULT_THEME_HEADER: ThemeHeader = {
  scrollBehavior: "hide-on-scroll",
  background: "dynamic",
  showSearch: true,
  showThemeToggle: true,
  cartVisibility: "store-only",
  height: 72,
};

export interface ThemeLayout {
  /** Maximum width of the site's standard content column. */
  contentWidth: number;
  /** Minimum page inset above the mobile breakpoint. */
  desktopGutter: number;
  /** Page inset at 680px and below. */
  mobileGutter: number;
}

export const DEFAULT_THEME_LAYOUT: ThemeLayout = {
  contentWidth: 1320,
  desktopGutter: 48,
  mobileGutter: 22,
};

export interface ThemeSettings {
  colors: ThemeColors;
  typography: ThemeTypography;
  header: ThemeHeader;
  layout: ThemeLayout;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  colors: DEFAULT_THEME_COLORS,
  typography: DEFAULT_THEME_TYPOGRAPHY,
  header: DEFAULT_THEME_HEADER,
  layout: DEFAULT_THEME_LAYOUT,
};

/** Payload envelope version. Bumped only by a shape change, not a value change. */
export const THEME_PAYLOAD_VERSION = 4;

// ---------------------------------------------------------------------------
// The injection boundary
// ---------------------------------------------------------------------------

/**
 * Colours that are safe to write into a `<style>` element.
 *
 * The emitted block goes out through `dangerouslySetInnerHTML`, so this is a
 * security boundary and not a formatting nicety: without it, anyone holding
 * `theme.write` could store `red}</style><script>…</script>` and get stored XSS
 * on **every page of the site**, public and admin, for every visitor. An
 * allowlist rather than an escape, because the set of legitimate values is small
 * and closed.
 *
 * Applied on read as well as on write. The row is also writable by
 * `scripts/seed.ts`, by the service-role client and by anyone with SQL access,
 * none of which pass through the admin form's validation.
 */
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FUNCTIONAL = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9a-zA-Z.,%/\s-]+\s*\)$/;
const KEYWORDS = new Set(["transparent", "currentColor"]);

/** Long enough for `rgba(244, 244, 244, 0.35)` and nothing like a payload. */
const MAX_COLOR_LENGTH = 64;

export function safeCssColor(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > MAX_COLOR_LENGTH) return null;

  // Cheap structural rejects first, so the intent is legible rather than
  // implied by the absence of a character class in the patterns below.
  if (/[<>;{}\\"'`]/.test(trimmed)) return null;
  if (trimmed.includes("/*") || trimmed.includes("*/")) return null;
  if (/url\(/i.test(trimmed)) return null;
  if (/[\r\n\t]/.test(trimmed)) return null;

  if (KEYWORDS.has(trimmed)) return trimmed;
  if (HEX.test(trimmed)) return trimmed;
  if (FUNCTIONAL.test(trimmed)) return trimmed;
  return null;
}

/**
 * `#c8102e` -> `200 16 46`, for `--mg-accent-rgb`.
 *
 * Tailwind cannot compute an alpha from a colour whose value is `var(--x)`, so
 * `mg.accent` is declared in channel form and the ~21 alpha-modified accent
 * utilities need this. Deriving it here rather than storing it means an editor
 * stores one value and the two cannot drift.
 *
 * The consequence, and it is deliberate: **`accent` is hex-only.** `rgba()` and
 * `transparent` are rejected for that one token, because there is nothing
 * sensible to put in `--mg-accent-rgb` for them. `themeColorsSchema` says so
 * with a message an editor can act on.
 */
export function accentChannels(value: unknown): string | null {
  const color = safeCssColor(value);
  if (color === null || !color.startsWith("#")) return null;

  const hex = color.slice(1);
  const full =
    hex.length === 3 || hex.length === 4
      ? hex
          .slice(0, 3)
          .split("")
          .map((c) => c + c)
          .join("")
      : hex.slice(0, 6);

  if (full.length !== 6) return null;

  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;

  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

// ---------------------------------------------------------------------------
// Schema and parsing
// ---------------------------------------------------------------------------

const colorValue = z.string().refine((v) => safeCssColor(v) !== null, {
  message: "Use a hex colour, rgb()/rgba()/hsl()/hsla(), or transparent",
});

const accentValue = z.string().refine((v) => accentChannels(v) !== null, {
  message: "The accent must be a hex colour — it also drives an rgb() channel triple",
});

/**
 * The tokens that also emit an `R G B` channel twin, and the variable each
 * writes it to.
 *
 * A map rather than three `token === "accent"` comparisons because a second
 * token joined `accent` here and the comparisons were in three places — the
 * schema, the parse and the emitter — with nothing tying them together. Adding
 * `accentSerif` to two of the three would have produced a token that validates
 * as hex-only while emitting no twin, which is a stylesheet that silently drops
 * every alpha utility: precisely the bug this change is fixing.
 *
 * ⚠️ **Membership here makes a token hex-only**, because `rgba()` and
 * `transparent` have no sensible channel triple. That is a real narrowing for
 * `accentSerif`, which accepted any CSS colour until now — every default is a
 * hex, so nothing stored needs migrating, but an editor who had typed an
 * `rgba()` serif accent would find it rejected and the default restored.
 */
const CHANNEL_TWIN: Partial<Record<ThemeToken, string>> = {
  // ⚠️ These four joined late, and the bug they close is the largest this
  // codebase has had: without a twin, Tailwind drops every alpha-modified
  // utility for the token, so ~413 `text-mg-fg/70`-shaped classes across 129
  // files emitted no CSS at all. `muted` and `faint` are deliberately absent —
  // they are `rgba()` in dark, a twin can only come from a hex, and they have
  // no alpha usages to lose.
  //
  // ⚠️ Membership narrows these four to **hex only** (see the note above this
  // map): an editor can no longer store `rgba()` or a named colour for the
  // background, foreground, surface or border. Nothing stored needs migrating —
  // every default is a hex and no theme has ever been published — and shorthand
  // (`#fff`) still expands, so the narrowing bites only on a form nobody uses.
  bg: "--mg-bg-rgb",
  fg: "--mg-fg-rgb",
  surface: "--mg-surface-rgb",
  bd: "--mg-bd-rgb",
  accent: "--mg-accent-rgb",
  accentInk: "--mg-accent-ink-rgb",
  accentSerif: "--mg-accent-serif-rgb",
};

function contextSchema(context: ThemeContext) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const token of TOKENS_BY_CONTEXT[context]) {
    shape[token] = (CHANNEL_TWIN[token] ? accentValue : colorValue).optional();
  }
  // `.passthrough()` is this codebase's convention for a jsonb payload: a schema
  // that quietly discards what it does not recognise turns "another feature
  // added a key" into silent data loss on the next save. Safe here only because
  // the emitter below iterates TOKENS_BY_CONTEXT and never the parsed object, so
  // a passthrough key cannot reach the stylesheet.
  return z.object(shape).passthrough();
}

export const themeColorsSchema = z.object({
  dark: contextSchema("dark").optional(),
  light: contextSchema("light").optional(),
  darkBand: contextSchema("darkBand").optional(),
});

const WEBFONT_ID = /^[a-z][a-z0-9-]{0,39}$/;
const WEBFONT_FAMILY = /^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,79}$/;
const WEBFONT_WEIGHT = /^(?:[1-9]00)(?: [1-9]00)?$/;

function safeWebfontUrl(value: unknown, source?: WebfontSource): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (source === "file" && !/\.(?:woff2?|ttf|otf)$/i.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const themeWebfontSchema = z
  .object({
    id: z.string().regex(WEBFONT_ID, "Use a lowercase id such as brand-sans"),
    label: z.string().trim().min(1).max(60),
    family: z
      .string()
      .trim()
      .regex(WEBFONT_FAMILY, "Use letters, numbers, spaces, periods, underscores or hyphens"),
    source: z.enum(WEBFONT_SOURCES),
    url: z.string().trim().max(2048),
    fallback: z.enum(WEBFONT_FALLBACKS),
    weight: z
      .string()
      .trim()
      .regex(WEBFONT_WEIGHT, "Use a weight such as 400 or a variable range such as 100 900"),
    style: z.enum(WEBFONT_STYLES),
  })
  .superRefine((font, context) => {
    if (safeWebfontUrl(font.url, font.source) === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message:
          font.source === "file"
            ? "Use an HTTPS .woff, .woff2, .ttf or .otf URL"
            : "Use an HTTPS stylesheet URL without embedded credentials",
      });
    }
  });

const fontSelectionSchema = z
  .string()
  .refine(
    (value) =>
      (FONT_PRESETS as readonly string[]).includes(value) ||
      (value.startsWith("webfont:") && WEBFONT_ID.test(value.slice("webfont:".length))),
    { message: "Choose a built-in font or a configured webfont" }
  );

export const themeTypographySchema = z
  .object({
    body: fontSelectionSchema,
    heading: fontSelectionSchema,
    editorial: fontSelectionSchema,
    label: fontSelectionSchema,
    navigation: fontSelectionSchema,
    webfonts: z.array(themeWebfontSchema).max(12),
    baseSize: z.number().int().min(14).max(20),
  })
  .superRefine((typography, context) => {
    const ids = new Set<string>();
    typography.webfonts.forEach((font, index) => {
      if (ids.has(font.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["webfonts", index, "id"],
          message: "Webfont ids must be unique",
        });
      }
      ids.add(font.id);
    });

    for (const role of TYPOGRAPHY_ROLES) {
      const value = typography[role];
      if (value.startsWith("webfont:") && !ids.has(value.slice("webfont:".length))) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [role],
          message: "This webfont no longer exists",
        });
      }
    }
  });

export const themeHeaderSchema = z.object({
  scrollBehavior: z.enum(HEADER_SCROLL_BEHAVIORS),
  background: z.enum(HEADER_BACKGROUNDS),
  showSearch: z.boolean(),
  showThemeToggle: z.boolean(),
  cartVisibility: z.enum(HEADER_CART_VISIBILITY),
  height: z.number().int().min(56).max(96),
});

export const themeLayoutSchema = z.object({
  contentWidth: z.number().int().min(960).max(1600),
  desktopGutter: z.number().int().min(24).max(96),
  mobileGutter: z.number().int().min(12).max(40),
});

export const themeSettingsSchema = z.object({
  colors: themeColorsSchema,
  typography: themeTypographySchema,
  header: themeHeaderSchema,
  layout: themeLayoutSchema,
});

export const themePayloadSchema = z.object({
  version: z.number().int().optional(),
  colors: themeColorsSchema.optional(),
  typography: themeTypographySchema.optional(),
  header: themeHeaderSchema.optional(),
  layout: themeLayoutSchema.optional(),
});
export type ThemePayload = z.infer<typeof themePayloadSchema>;

/**
 * Forgiving on the way out of the database, like `parseMenuItemOptions`.
 *
 * **Deliberately does not use `themePayloadSchema`.** That schema is the strict
 * write path — it tells an editor which value they got wrong, and it must reject
 * the whole submission to do that. This is the read path, and the two want
 * opposite things: the same split `lib/blocks/normalize.ts` and `validate.ts`
 * already draw, for the same reason. Running the strict schema here would make
 * one bad token anywhere discard all twenty-five, and a payload written by
 * `scripts/seed.ts` or by hand in SQL — neither of which passes through the
 * form — could blank the site's colours wholesale.
 *
 * So: walk the structure, keep every value that is safe, drop the ones that are
 * not. A dropped token falls through to the declaration still compiled into
 * `globals.css`. Falling back entirely is reserved for a payload with nothing
 * usable in it at all, and even that fallback is not a guess — it is exactly
 * what the site rendered before this feature existed.
 */
export function parseThemeColors(value: unknown): ThemeColors {
  const colors = asRecord(asRecord(value)?.colors);
  if (!colors) return DEFAULT_THEME_COLORS;

  const out: ThemeColors = {};

  for (const context of THEME_CONTEXTS) {
    const incoming = asRecord(colors[context]);
    if (!incoming) continue;

    const kept: Partial<Record<ThemeToken, string>> = {};
    for (const token of TOKENS_BY_CONTEXT[context]) {
      const safe = CHANNEL_TWIN[token]
        ? accentSafe(incoming[token])
        : safeCssColor(incoming[token]);
      if (safe !== null) kept[token] = safe;
    }
    if (Object.keys(kept).length > 0) out[context] = kept;
  }

  return Object.keys(out).length > 0 ? out : DEFAULT_THEME_COLORS;
}

/**
 * Read typography field-by-field so one bad stored value falls back without
 * discarding the editor's other choices. This is the same forgiving read / strict
 * write split used by colours above.
 */
export function parseThemeTypography(value: unknown): ThemeTypography {
  const incoming = asRecord(asRecord(value)?.typography);
  if (!incoming) return { ...DEFAULT_THEME_TYPOGRAPHY };

  const webfonts = Array.isArray(incoming.webfonts)
    ? incoming.webfonts.flatMap((candidate) => {
        const parsed = themeWebfontSchema.safeParse(candidate);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  const uniqueWebfonts = webfonts.filter(
    (font, index) => webfonts.findIndex((candidate) => candidate.id === font.id) === index
  );
  const webfontIds = new Set(uniqueWebfonts.map((font) => font.id));
  const out: ThemeTypography = {
    ...DEFAULT_THEME_TYPOGRAPHY,
    webfonts: uniqueWebfonts,
  };
  for (const role of TYPOGRAPHY_ROLES) {
    const selection = incoming[role];
    if ((FONT_PRESETS as readonly unknown[]).includes(selection)) {
      out[role] = selection as FontPreset;
    } else if (
      typeof selection === "string" &&
      selection.startsWith("webfont:") &&
      webfontIds.has(selection.slice("webfont:".length))
    ) {
      out[role] = selection as FontSelection;
    }
  }
  const baseSize = incoming.baseSize;
  if (
    typeof baseSize === "number" &&
    Number.isInteger(baseSize) &&
    baseSize >= 14 &&
    baseSize <= 20
  ) {
    out.baseSize = baseSize;
  }
  return out;
}

/** Forgiving public read for the header portion of a stored theme payload. */
export function parseThemeHeader(value: unknown): ThemeHeader {
  const incoming = asRecord(asRecord(value)?.header);
  if (!incoming) return { ...DEFAULT_THEME_HEADER };

  const out = { ...DEFAULT_THEME_HEADER };
  if ((HEADER_SCROLL_BEHAVIORS as readonly unknown[]).includes(incoming.scrollBehavior)) {
    out.scrollBehavior = incoming.scrollBehavior as HeaderScrollBehavior;
  }
  if ((HEADER_BACKGROUNDS as readonly unknown[]).includes(incoming.background)) {
    out.background = incoming.background as HeaderBackground;
  }
  if (typeof incoming.showSearch === "boolean") out.showSearch = incoming.showSearch;
  if (typeof incoming.showThemeToggle === "boolean") {
    out.showThemeToggle = incoming.showThemeToggle;
  }
  if ((HEADER_CART_VISIBILITY as readonly unknown[]).includes(incoming.cartVisibility)) {
    out.cartVisibility = incoming.cartVisibility as HeaderCartVisibility;
  }
  const height = incoming.height;
  if (typeof height === "number" && Number.isInteger(height) && height >= 56 && height <= 96) {
    out.height = height;
  }
  return out;
}

/** Forgiving public read for site-wide content width and page gutters. */
export function parseThemeLayout(value: unknown): ThemeLayout {
  const incoming = asRecord(asRecord(value)?.layout);
  if (!incoming) return { ...DEFAULT_THEME_LAYOUT };

  const out = { ...DEFAULT_THEME_LAYOUT };
  const ranges = {
    contentWidth: [960, 1600],
    desktopGutter: [24, 96],
    mobileGutter: [12, 40],
  } as const;
  for (const key of Object.keys(ranges) as (keyof ThemeLayout)[]) {
    const candidate = incoming[key];
    const [min, max] = ranges[key];
    if (
      typeof candidate === "number" &&
      Number.isInteger(candidate) &&
      candidate >= min &&
      candidate <= max
    ) {
      out[key] = candidate;
    }
  }
  return out;
}

export function parseThemeSettings(value: unknown): ThemeSettings {
  return {
    colors: parseThemeColors(value),
    typography: parseThemeTypography(value),
    header: parseThemeHeader(value),
    layout: parseThemeLayout(value),
  };
}

/** A plain object, or nothing. Arrays and null are not objects for this purpose. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** A hex that also yields channels, or nothing. */
function accentSafe(value: unknown): string | null {
  return accentChannels(value) === null ? null : safeCssColor(value);
}

// ---------------------------------------------------------------------------
// Emission
// ---------------------------------------------------------------------------

/**
 * The stylesheet, as text.
 *
 * Iterates `TOKENS_BY_CONTEXT` and never `Object.keys(colors)` — that is what
 * makes the `.passthrough()` above safe, and what keeps the two asymmetries from
 * being flattened by a payload that happens to carry an extra key.
 *
 * Returns `""` when there is nothing to say, so the caller can omit the element
 * entirely rather than ship an empty one.
 */
export function themeCssText(colors: ThemeColors): string {
  const blocks: string[] = [];

  for (const context of THEME_CONTEXTS) {
    const values = colors[context];
    if (!values) continue;

    const declarations: string[] = [];
    for (const token of TOKENS_BY_CONTEXT[context]) {
      const safe = CHANNEL_TWIN[token] ? accentSafe(values[token]) : safeCssColor(values[token]);
      if (safe === null) continue;

      declarations.push(`${CSS_VAR[token]}:${safe}`);

      // The channel twin, emitted from the same stored value so the pair cannot
      // disagree. See `accentChannels` and `tailwind.config.ts`.
      const twin = CHANNEL_TWIN[token];
      if (twin) {
        declarations.push(`${twin}:${accentChannels(safe)}`);
      }
    }

    if (declarations.length > 0) {
      blocks.push(`${SELECTOR[context]}{${declarations.join(";")}}`);
    }
  }

  return blocks.join("");
}

const FONT_ROLE_VAR: Record<TypographyRole, string> = {
  body: "--font-body",
  heading: "--font-heading",
  editorial: "--font-editorial",
  label: "--font-label",
  navigation: "--font-navigation",
};

const WEBFONT_FALLBACK_STACK: Record<WebfontFallback, string> = {
  sans: 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif',
  serif: 'ui-serif,Georgia,"Times New Roman",serif',
  mono: 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace',
};

function webfontForSelection(
  selection: FontSelection,
  webfonts: readonly ThemeWebfont[]
): ThemeWebfont | undefined {
  if (!selection.startsWith("webfont:")) return undefined;
  const id = selection.slice("webfont:".length);
  return webfonts.find((font) => font.id === id);
}

export function fontStackForSelection(
  selection: FontSelection,
  webfonts: readonly ThemeWebfont[]
): string {
  if ((FONT_PRESETS as readonly string[]).includes(selection)) {
    return FONT_STACK[selection as FontPreset];
  }
  const custom = webfontForSelection(selection, webfonts);
  if (!custom) return FONT_STACK.systemSans;
  return `${JSON.stringify(custom.family)},${WEBFONT_FALLBACK_STACK[custom.fallback]}`;
}

export function themeWebfontStylesheets(typography: ThemeTypography): string[] {
  return Array.from(
    new Set(
      typography.webfonts
        .filter((font) => font.source === "stylesheet")
        .map((font) => safeWebfontUrl(font.url, "stylesheet"))
        .filter((url): url is string => url !== null)
    )
  );
}

export function themeWebfontFaceCssText(typography: ThemeTypography): string {
  return typography.webfonts
    .filter((font) => font.source === "file")
    .flatMap((font) => {
      const url = safeWebfontUrl(font.url, "file");
      if (!url) return [];
      const format = url.toLowerCase().includes(".woff2")
        ? "woff2"
        : url.toLowerCase().includes(".woff")
          ? "woff"
          : url.toLowerCase().includes(".ttf")
            ? "truetype"
            : "opentype";
      return [
        `@font-face{font-family:${JSON.stringify(font.family)};src:url(${JSON.stringify(url)}) format("${format}");font-weight:${font.weight};font-style:${font.style};font-display:swap}`,
      ];
    })
    .join("");
}

/**
 * Typography and dimensional design settings. Every value is selected from a
 * closed preset or a bounded integer before it reaches this string.
 */
export function themeDesignCssText(settings: ThemeSettings): string {
  const declarations = TYPOGRAPHY_ROLES.map(
    (role) =>
      `${FONT_ROLE_VAR[role]}:${fontStackForSelection(settings.typography[role], settings.typography.webfonts)}`
  );
  declarations.push(`--font-base-size:${settings.typography.baseSize}px`);
  declarations.push(`--header-height:${settings.header.height}px`);
  declarations.push(`--layout-content-width:${settings.layout.contentWidth}px`);
  declarations.push(`--layout-desktop-gutter:${settings.layout.desktopGutter}px`);
  declarations.push(`--layout-mobile-gutter:${settings.layout.mobileGutter}px`);
  return `${themeWebfontFaceCssText(settings.typography)}${themeCssText(settings.colors)}:root:root{${declarations.join(";")}}`;
}
