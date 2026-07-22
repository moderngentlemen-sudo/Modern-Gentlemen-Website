import type { Metadata } from "next";
import { Space_Grotesk, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeBootScript } from "@/lib/theme";
import { CartProvider } from "@/lib/cart/CartProvider";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", weight: ["300", "400", "500", "600", "700"] });
const serif = Instrument_Serif({ subsets: ["latin"], variable: "--font-instrument-serif", weight: "400", style: "italic" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-ibm-plex-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Modern Gentlemen",
  description: "Style, grooming, watches, culture and film — for the considered man.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${grotesk.variable} ${serif.variable} ${mono.variable}`}>
      <head>
        {/* Set theme before paint to avoid a flash (see 01_ARCHITECTURE.md). */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeProvider>
          <CartProvider>
            <Header />
            <main className="pt-[72px]">{children}</main>
            <Footer />
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
