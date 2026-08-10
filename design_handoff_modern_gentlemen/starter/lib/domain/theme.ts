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
 * Scope is colours only. Typography, spacing, radii and motion are not CSS
 * variables in this codebase — they are Tailwind classes and two media queries
 * of `!important` overrides — so they cannot be made editable without first
 * being made variable, which is a separate and much larger change.
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
 * `accent` is dark-only because it is the one token `globals.css` never
 * overrides: the racing red is identical in light, in dark, and inside a dark
 * band. Emitting it into the other two would be a no-op today and a divergence
 * the first time somebody edited one of the three copies.
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
  light: ["bg", "fg", "surface", "bd", "accentSerif", "muted", "faint", "bandBorder"],
  darkBand: ["bg", "fg", "surface", "bd", "accentSerif", "muted", "faint"],
} as const satisfies Record<ThemeContext, readonly ThemeToken[]>;

/** Token name -> custom property. The one place the two vocabularies meet. */
const CSS_VAR: Record<ThemeToken, string> = {
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
  accent: "Accent",
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
    accentSerif: "#ff4d5e",
    muted: "rgba(244, 244, 244, 0.5)",
    faint: "rgba(244, 244, 244, 0.35)",
    bandBorder: "rgba(255, 255, 255, 0.12)",
  },
  light: {
    bg: "#f4f4f4",
    fg: "#141414",
    surface: "#ffffff",
    bd: "#141414",
    accentSerif: "#c8102e",
    muted: "#8a8a8a",
    faint: "#b0b0b0",
    bandBorder: "transparent",
  },
  darkBand: {
    bg: "#0d0d0d",
    fg: "#f4f4f4",
    surface: "#161618",
    bd: "#ffffff",
    accentSerif: "#ff4d5e",
    muted: "rgba(244, 244, 244, 0.5)",
    faint: "rgba(244, 244, 244, 0.35)",
  },
};

/** Payload envelope version. Bumped only by a shape change, not a value change. */
export const THEME_PAYLOAD_VERSION = 1;

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

function contextSchema(context: ThemeContext) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const token of TOKENS_BY_CONTEXT[context]) {
    shape[token] = (token === "accent" ? accentValue : colorValue).optional();
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

export const themePayloadSchema = z.object({
  version: z.number().int().optional(),
  colors: themeColorsSchema.optional(),
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
      const safe = token === "accent" ? accentSafe(incoming[token]) : safeCssColor(incoming[token]);
      if (safe !== null) kept[token] = safe;
    }
    if (Object.keys(kept).length > 0) out[context] = kept;
  }

  return Object.keys(out).length > 0 ? out : DEFAULT_THEME_COLORS;
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
      const safe = token === "accent" ? accentSafe(values[token]) : safeCssColor(values[token]);
      if (safe === null) continue;

      declarations.push(`${CSS_VAR[token]}:${safe}`);

      // The channel twin, emitted from the same stored value so the pair cannot
      // disagree. See `accentChannels` and `tailwind.config.ts`.
      if (token === "accent") {
        declarations.push(`--mg-accent-rgb:${accentChannels(safe)}`);
      }
    }

    if (declarations.length > 0) {
      blocks.push(`${SELECTOR[context]}{${declarations.join(";")}}`);
    }
  }

  return blocks.join("");
}
