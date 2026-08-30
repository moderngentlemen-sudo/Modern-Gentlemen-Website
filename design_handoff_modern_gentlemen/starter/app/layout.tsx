import type { Metadata } from "next";
import { Space_Grotesk, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeBootScript } from "@/lib/theme";
import { canonicalSiteUrl } from "@/lib/db/env";
import { BRAND } from "@/lib/domain/seo";
import { getPublishedThemeSettings } from "@/lib/services/publicTheme";
import { themeDesignCssText } from "@/lib/domain/theme";

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

/**
 * The document-wide defaults. Every route below overrides the title and most
 * override the description; what only lives here is `metadataBase`.
 *
 * **`metadataBase` is what stops Next warning on, and mangling, relative URLs**
 * in Open Graph images. The routes below hand it absolute URLs already — built
 * through `canonicalUrl`, because a canonical tag has to be absolute to mean
 * anything — so this is the belt to that braces: anything added later that
 * passes a bare `/images/x.jpg` resolves against the real origin rather than
 * against `localhost`.
 *
 * `new URL()` and not a string, which is the type Next wants here. It throws on
 * a malformed origin, and `canonicalSiteUrl()` has already refused an unset
 * `NEXT_PUBLIC_SITE_URL` in production before this line runs.
 */
export const metadata: Metadata = {
  metadataBase: new URL(canonicalSiteUrl()),
  title: BRAND,
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
 *
 * **The design tokens are read here for the same reason.** They are a
 * document-level concern, like the fonts and the boot script beside them, and
 * the admin renders in `mg.*` tokens too — `AdminShell` is `bg-mg-bg text-mg-fg`
 * — so a theme applied only to `(site)` would leave the Theme editor screen
 * lying about the change the editor had just made.
 *
 * Two things this must not become. It reads through `lib/services/publicTheme.ts`
 * and therefore `lib/db/public.ts`, which touches **no cookies**: swapping in
 * `lib/db/server.ts` here would opt every static page in the site out of static
 * rendering silently. And it never throws — see that file for why this read
 * takes the opposite stance to the homepage's.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const themeCss = themeDesignCssText(await getPublishedThemeSettings());

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${grotesk.variable} ${serif.variable} ${mono.variable}`}
    >
      <head>
        {/* Set theme before paint to avoid a flash (see 01_ARCHITECTURE.md). */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />

        {/*
          The stored design tokens, overriding the defaults in globals.css.
          Omitted entirely when there is nothing to say, which is the state
          until the theme is first seeded.

          No `precedence` prop: React 19 hoists and dedupes styles that carry
          one, and this block's position and specificity are load-bearing. The
          text is built by `themeCssText`, whose values have all passed
          `safeCssColor` — that allowlist is what makes this
          `dangerouslySetInnerHTML` safe, since anyone with `theme.write` writes
          into it.
        */}
        {themeCss && <style data-mg-theme="" dangerouslySetInnerHTML={{ __html: themeCss }} />}
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
