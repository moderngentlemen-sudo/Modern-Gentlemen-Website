import Link from "next/link";
import { CartProvider } from "@/lib/cart/CartProvider";
import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { listPublishedProducts } from "@/lib/services/publicCatalog";
import { getChromeNavigation } from "@/lib/services/publicNavigation";
import { CHROME_MENU_KEYS } from "@/lib/domain/navigation";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { MonoLabel } from "@/components/ui/Eyebrow";

/**
 * The global 404.
 *
 * This file exists because of the route-group split. Before it, the root layout
 * carried the site chrome, so Next's built-in not-found page rendered inside the
 * header and footer. With the chrome moved down into `(site)/layout.tsx`, a
 * root-level not-found would have rendered bare — a real regression the
 * prerender diff caught on `_not-found.html`.
 *
 * The chrome is therefore composed here explicitly. Root `not-found.tsx` renders
 * inside the ROOT layout, not the site one, so it cannot inherit it.
 *
 * Which is why the catalogue is fetched here too. `Header` mounts
 * `SearchOverlay`, whose Shop results come from `useCatalog()`, so not
 * inheriting the site layout means not inheriting its provider either — the
 * build catches it as a prerender failure on `_not-found`, exactly as the
 * missing-chrome regression above was caught. Search from a 404 finds products.
 *
 * And the navigation, since Phase 6b, for the third time for the same reason: a
 * 404 that renders the chrome has to read what the chrome renders from. Unlike
 * the site layout this does not throw on an empty menu — the 404 page is where
 * someone lands when something is already wrong, and it should still draw.
 */
export default async function NotFound() {
  const [products, nav] = await Promise.all([
    listPublishedProducts(),
    getChromeNavigation(CHROME_MENU_KEYS),
  ]);

  return (
    <CatalogProvider products={products}>
      <CartProvider>
        <Header nav={nav.header} drawerSecondary={nav.drawerSecondary} />
        <main className="pt-[72px]">
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
            <MonoLabel>Error 404</MonoLabel>
            <h1 className="mt-3 font-grotesk text-[38px] font-semibold leading-[1.05] tracking-[-0.03em]">
              This page doesn&rsquo;t exist
            </h1>
            <p className="mt-4 max-w-[440px] text-mg-fg/60">
              The page you were looking for has moved, or never existed. The desk regrets the
              inconvenience.
            </p>
            <Link
              href="/"
              className="mt-8 border border-mg-bd px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors hover:bg-mg-fg hover:text-mg-bg"
            >
              Back to the homepage
            </Link>
          </div>
        </main>
        <Footer nav={nav.footer} legal={nav.footerLegal} />
      </CartProvider>
    </CatalogProvider>
  );
}
