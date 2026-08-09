import type { Metadata } from "next";

import { pageTitle } from "@/lib/domain/seo";

/**
 * `noindex, nofollow` — and unlike `/bag`, the `nofollow` is meant.
 *
 * Checkout is a four-step form holding an email address, a shipping address and
 * (in production) a payment step. Nothing on it should be indexed, and nothing
 * on it is worth a crawler following: its links go backwards into the flow it
 * has no business walking.
 */
export const metadata: Metadata = {
  title: pageTitle("Checkout"),
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
