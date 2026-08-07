import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { CartProvider } from "@/lib/cart/CartProvider";
import { listPublishedProducts } from "@/lib/services/publicCatalog";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";

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
 * This read goes through `lib/db/public.ts`, which touches no cookies — so the
 * routes below stay statically rendered. Swapping it for `lib/db/server.ts`
 * would opt the entire public site out of static rendering with no error and no
 * failing test; see the standing rule in CLAUDE.md.
 */
export const revalidate = 3600;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const products = await listPublishedProducts();

  return (
    <CatalogProvider products={products}>
      <CartProvider>
        <Header />
        <main className="pt-[72px]">{children}</main>
        <Footer />
      </CartProvider>
    </CatalogProvider>
  );
}
