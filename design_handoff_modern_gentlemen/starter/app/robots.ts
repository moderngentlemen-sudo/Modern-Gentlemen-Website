import type { MetadataRoute } from "next";

import { canonicalUrl } from "@/lib/domain/seo";
import { canonicalSiteUrl } from "@/lib/db/env";

/**
 * robots.txt.
 *
 * The disallows are the interesting part, and each is here for its own reason
 * rather than as a blanket "keep out of anything non-public":
 *
 * - `/admin` — gated by `middleware.ts` anyway, so this is defence in depth. A
 *   crawler that follows a link into it gets a redirect to `/sign-in`, and
 *   indexing a sign-in page under the admin's URLs helps nobody.
 * - `/api` — the jobs route lives here. It refuses unauthenticated callers, but
 *   an endpoint that publishes content has no business in an index.
 * - `/preview` — **the one that genuinely matters.** A preview link renders a
 *   document's *draft* to whoever holds the token. Those links get pasted into
 *   Slack and email; a crawler that finds one and indexes it publishes
 *   unpublished work. The route already sets `noindex, nofollow, nocache` in its
 *   own metadata, and this is the second lock.
 * - `/bag`, `/checkout` — a session's private state. Nothing to index, and a
 *   crawler walking checkout is a crawler filling in forms.
 *
 * `/sign-in` is deliberately *not* disallowed, and the reason is the one thing
 * about robots.txt that is most often got backwards. The page sets
 * `robots: { index: false }` in its own metadata — has since Track A — and **a
 * disallowed URL is never fetched, so its noindex is never read.** Disallowing
 * it here would therefore make it *more* likely to be indexed, not less: a
 * crawler that finds the link elsewhere may list the bare URL it was forbidden
 * to look at. Allowing the crawl is what lets the page say "do not index me".
 *
 * The same logic is why `/bag` and `/checkout` carry a `noindex` of their own
 * as well as a disallow here: the disallow is the cheap first line, the meta tag
 * is the one that survives being linked to from outside.
 */
export default function robots(): MetadataRoute.Robots {
  const base = canonicalSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/preview", "/bag", "/checkout"],
      },
    ],
    sitemap: canonicalUrl(base, "/sitemap.xml"),
    host: canonicalUrl(base, "/"),
  };
}
