import Link from "next/link";
import { CartProvider } from "@/lib/cart/CartProvider";
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
 */
export default function NotFound() {
  return (
    <CartProvider>
      <Header />
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
      <Footer />
    </CartProvider>
  );
}
