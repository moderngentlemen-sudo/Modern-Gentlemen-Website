import type { Metadata } from "next";

import { pageTitle } from "@/lib/domain/seo";

/**
 * `noindex`, and no canonical.
 *
 * A bag is one visitor's private state. There is nothing here to rank, and an
 * indexed bag page is an empty one — the crawler has no localStorage, so what it
 * would index is the "Your bag is empty" state under the site's name.
 *
 * **`follow: true` alongside it.** The bag links to `/shop` and to every product
 * in it; `nofollow` would waste those links for no gain. "Do not index this" and
 * "do not trust its links" are separate claims and only the first is true here.
 *
 * `robots.ts` also disallows `/bag`. The two are not redundant in the way they
 * look: a disallow stops the crawl, this stops the *indexing* of a URL that gets
 * linked from elsewhere and indexed without ever being fetched.
 */
export const metadata: Metadata = {
  title: pageTitle("Your Bag"),
  robots: { index: false, follow: true },
};

export default function BagLayout({ children }: { children: React.ReactNode }) {
  return children;
}
