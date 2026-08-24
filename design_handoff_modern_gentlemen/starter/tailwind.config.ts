import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mg: {
          bg: "var(--mg-bg)",
          fg: "var(--mg-fg)",
          surface: "var(--mg-surface)",
          bd: "var(--mg-bd)",
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
          muted: "var(--mg-muted)",
          faint: "var(--mg-faint)",
          band: "var(--mg-band-border)",
        },
      },
      fontFamily: {
        grotesk: ["var(--font-space-grotesk)", "sans-serif"],
        serif: ["var(--font-instrument-serif)", "serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
        // Prototype's exact nav stack (adds "Futura PT" ahead of the fallbacks).
        nav: ["Futura", '"Futura PT"', '"Century Gothic"', "sans-serif"],
      },
      maxWidth: { content: "1320px" },
    },
  },
  plugins: [],
};

export default config;
