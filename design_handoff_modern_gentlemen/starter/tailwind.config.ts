import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mg: {
          // ⚠️ **Channel form, for the same reason `accent` is — and these four
          // were the last holdouts.** Tailwind drops an alpha utility whose
          // palette value is a bare `var()`, so `text-mg-fg/70` and its ~413
          // siblings across 129 files compiled to **no CSS at all** and had
          // done since Track A: every muted paragraph and hairline border on
          // the public site painted at full strength. Nothing errored; text
          // that is too dark just looks like a design decision.
          //
          // The hex stays the stored value (`--mg-fg`), the twin is derived
          // from it by `themeCssText`, and the raw `var(--mg-*)` uses in
          // globals.css keep working. See `CHANNEL_TWIN` in lib/domain/theme.ts.
          bg: "rgb(var(--mg-bg-rgb) / <alpha-value>)",
          fg: "rgb(var(--mg-fg-rgb) / <alpha-value>)",
          surface: "rgb(var(--mg-surface-rgb) / <alpha-value>)",
          bd: "rgb(var(--mg-bd-rgb) / <alpha-value>)",
          // Channel form, not `var(--mg-accent)`, so the theme editor can drive
          // the racing red WITHOUT breaking the ~21 alpha-modified accent
          // utilities. Tailwind 3.4's `withAlphaValue` runs `parseColor` over
          // the theme value and drops the utility entirely when it cannot parse
          // one — `var(--x)` never parses.
          //
          // `--mg-accent` stays a hex for the three raw `var(--mg-accent)` uses
          // in globals.css and for the token table in the design baseline; the
          // theme emitter derives `--mg-accent-rgb` from it, so the two cannot
          // drift and an editor still stores one value.
          accent: "rgb(var(--mg-accent-rgb) / <alpha-value>)",
          // ⚠️ **The accent as INK, and it is a separate colour from `accent`
          // because ink and fill want opposite luminances.** `text-mg-accent`
          // on a dark band was 3.30; brightening `--mg-accent` to fix it
          // dropped the white text on the red CTA band from 5.88 to 4.12,
          // measured, and took the failing-node count from 34 to 46. So the
          // fill stays #c8102e and the ink goes brighter on dark only.
          // Every `text-`/`fill-`/`stroke-` use of the accent belongs here;
          // `bg-`, `border-` and `ring-` belong on `accent` above.
          accentInk: "rgb(var(--mg-accent-ink-rgb) / <alpha-value>)",
          // ⚠️ **This line used to be `var(--mg-accent-serif)`, and this comment
          // used to cite it as the standing proof of the paragraph above** —
          // correctly, and for three phases nobody drew the obvious conclusion.
          // All thirteen `mg-accentSerif/NN` utilities compiled to nothing: the
          // admin's error borders and tints, the builder's invalid-block frame,
          // the danger Button and Badge, and the sign-in and forgot-password
          // error boxes. Nothing errored and nothing looked broken — a border
          // that is absent just looks like a design without one.
          //
          // A worked example is not a reason to leave a bug in place, so it is
          // the same channel form now. `globals.css` declares the twin in all
          // three contexts and `themeCssText` emits it, exactly as for `accent`.
          accentSerif: "rgb(var(--mg-accent-serif-rgb) / <alpha-value>)",
          // Prototype's `tMuted` / `tFaint` secondary text ramps.
          //
          // ⚠️ **These two deliberately stay a bare `var()`, unlike the four
          // above, and it is not an oversight.** A channel twin can only be
          // derived from a hex, and `--mg-muted`/`--mg-faint` are `rgba()` in
          // dark by design — "flat greys in light, translucent paper in dark".
          // Converting them would force both to hex and lose that. The cost of
          // leaving them is nil today, checked rather than assumed: there are
          // **zero** alpha-modified `mg-muted`/`mg-faint` utilities in the
          // codebase. If one is ever written it will silently compile to
          // nothing, which is what `alphaUtilities.test.ts` now watches for.
          muted: "var(--mg-muted)",
          faint: "var(--mg-faint)",
          band: "var(--mg-band-border)",
        },
      },
      fontFamily: {
        grotesk: ["var(--font-heading)"],
        serif: ["var(--font-editorial)"],
        mono: ["var(--font-label)"],
        nav: ["var(--font-navigation)"],
      },
      maxWidth: { content: "1320px" },
    },
  },
  plugins: [],
};

export default config;
