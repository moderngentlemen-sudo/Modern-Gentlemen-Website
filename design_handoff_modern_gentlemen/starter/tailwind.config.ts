import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mg: {
          bg: "var(--mg-bg)",
          fg: "var(--mg-fg)",
          surface: "var(--mg-surface)",
          bd: "var(--mg-bd)",
          accent: "#C8102E",
          accentSerif: "var(--mg-accent-serif)",
        },
      },
      fontFamily: {
        grotesk: ["var(--font-space-grotesk)", "sans-serif"],
        serif: ["var(--font-instrument-serif)", "serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
        nav: ["Futura", '"Century Gothic"', '"Trebuchet MS"', "sans-serif"],
      },
      maxWidth: { content: "1320px" },
    },
  },
  plugins: [],
};

export default config;
