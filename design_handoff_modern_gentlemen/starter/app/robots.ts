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
 * `/sign-in` is deliberately *not* disallowed: it is an ordinary public page,
 * and hiding it from crawlers while linking to it from every admin redirect is
 * the sort of inconsistency that looks like a mistake later.
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
