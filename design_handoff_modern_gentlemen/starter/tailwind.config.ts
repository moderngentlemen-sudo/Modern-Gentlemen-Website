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
          // one — `var(--x)` never parses. `mg.accentSerif` below is the proof
          // rather than the theory: it is already a bare `var()`, and every one
          // of its eight alpha modifiers compiles to no CSS at all today.
          //
          // `--mg-accent` stays a hex for the three raw `var(--mg-accent)` uses
          // in globals.css and for the token table in the design baseline; the
          // theme emitter derives `--mg-accent-rgb` from it, so the two cannot
          // drift and an editor still stores one value.
          accent: "rgb(var(--mg-accent-rgb) / <alpha-value>)",
          accentSerif: "var(--mg-accent-serif)",
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
