import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { CartProvider } from "@/lib/cart/CartProvider";
import { listPublishedProducts } from "@/lib/services/publicCatalog";
import { getChromeNavigation } from "@/lib/services/publicNavigation";
import { getPublishedThemeSettings } from "@/lib/services/publicTheme";
import { CHROME_MENU_KEYS } from "@/lib/domain/navigation";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { SectionRenderer } from "@/components/SectionRenderer";
import { getPublishedGlobalTemplate } from "@/lib/services/publicContent";

/**
 * The public site's chrome, lifted verbatim out of the root layout so that
 * /admin can have chrome of its own. Route groups are not path segments, so
 * every URL under here is exactly what it was before the split.
 *
 * `pt-[72px]` is load-bearing — the header is fixed at 72px and the main column
 * is offset by exactly that. Do not fold it into a component or "tidy" it.
 *
 * The catalogue is fetched here, once, rather than in the store pages: the bag
 * drawer is in the header, so every route needs to resolve a stored slug to a
 * product. `CatalogProvider` must wrap `CartProvider`, which reads it.
 *
 * The navigation is fetched here for the same reason: the header and footer wrap
 * every public route, so one read at the top serves all of them.
 *
 * Both reads go through `lib/db/public.ts`, which touches no cookies — so the
 * routes below stay statically rendered. Conditional menu entries are resolved
 * by the client chrome after this static tree arrives; unconditional menus make
 * no auth request at all.
 */
export const revalidate = 3600;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [products, nav, design, headerTemplate, footerTemplate] = await Promise.all([
    listPublishedProducts(),
    getChromeNavigation(CHROME_MENU_KEYS),
    getPublishedThemeSettings(),
    getPublishedGlobalTemplate("header"),
    getPublishedGlobalTemplate("footer"),
  ]);

  // Thrown, not rendered empty — the same stance the homepage takes towards a
  // missing `home` page, and for the same reason: during a build this fails
  // loudly, which is what an unseeded database deserves, and during revalidation
  // Next keeps serving the last good output. A header that quietly lost its nav
  // on every page of the site is the failure nobody notices for a week.
  if (nav.header.length === 0) {
    throw new Error(
      `No published menu with key "${CHROME_MENU_KEYS.header}". Seed the database: npx tsx scripts/seed.ts`
    );
  }

  return (
    <CatalogProvider products={products}>
      <CartProvider>
        <div data-site-chrome="header" style={{ display: "contents" }}>
          {headerTemplate ? (
            <SectionRenderer
              sections={headerTemplate}
              documentContent={
                <Header
                  nav={nav.header}
                  drawerSecondary={nav.drawerSecondary}
                  settings={design.header}
                />
              }
            />
          ) : (
            <Header
              nav={nav.header}
              drawerSecondary={nav.drawerSecondary}
              settings={design.header}
            />
          )}
        </div>
        <main data-site-main style={{ paddingTop: design.header.height }}>
          {children}
        </main>
        <div data-site-chrome="footer" style={{ display: "contents" }}>
          {footerTemplate ? (
            <SectionRenderer
              sections={footerTemplate}
              documentContent={
                <Footer nav={nav.footer} legal={nav.footerLegal} settings={design.footer} />
              }
            />
          ) : (
            <Footer nav={nav.footer} legal={nav.footerLegal} settings={design.footer} />
          )}
        </div>
      </CartProvider>
    </CatalogProvider>
  );
}
