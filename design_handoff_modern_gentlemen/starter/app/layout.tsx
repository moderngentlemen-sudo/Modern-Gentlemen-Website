import type { Metadata } from "next";
import { Space_Grotesk, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeBootScript } from "@/lib/theme";

// Space Grotesk is a VARIABLE font: leave `weight` off so next/font serves the
// variable file with a 300–700 axis range. Pinning discrete weights made 300
// and 400 render at identical (too-wide) metrics, which broke line breaking in
// the light-weight body copy against the design.
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: "400",
  style: "italic",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Modern Gentlemen",
  description: "Style, grooming, watches, culture and film — for the considered man.",
};

/**
 * The document shell, and nothing else.
 *
 * The public chrome (CartProvider, Header, Footer) lives in `(site)/layout.tsx`
 * and the admin chrome in `(admin)/layout.tsx`, so /admin no longer renders
 * inside the site header and footer. Route groups are not path segments, so
 * every public URL is unchanged by that split.
 *
 * ThemeProvider stays here, above both groups: the admin uses the same
 * light/dark toggle, and the boot script below sets the theme on
 * documentElement before paint for both.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${grotesk.variable} ${serif.variable} ${mono.variable}`}
    >
      <head>
        {/* Set theme before paint to avoid a flash (see 01_ARCHITECTURE.md). */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
