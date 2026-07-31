import { CartProvider } from "@/lib/cart/CartProvider";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";

/**
 * The public site's chrome, lifted verbatim out of the root layout so that
 * /admin can have chrome of its own. Route groups are not path segments, so
 * every URL under here is exactly what it was before the split.
 *
 * `pt-[72px]` is load-bearing — the header is fixed at 72px and the main column
 * is offset by exactly that. Do not fold it into a component or "tidy" it.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Header />
      <main className="pt-[72px]">{children}</main>
      <Footer />
    </CartProvider>
  );
}
