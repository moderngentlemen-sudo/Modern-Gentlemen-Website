import type { MetadataRoute } from "next";

import { listPublishedProducts } from "@/lib/services/publicCatalog";
import { listPublishedPageSlugs, listNoIndexPageSlugs } from "@/lib/services/publicContent";
import {
  listPublishedArticleSlugs,
  listPublishedCategorySlugs,
} from "@/lib/services/publicEditorial";
import { canonicalUrl } from "@/lib/domain/seo";
import {
  publicPathForArticle,
  publicPathForCategory,
  publicPathForProduct,
  publicPathForPage,
} from "@/lib/domain/routes";
import { canonicalSiteUrl } from "@/lib/db/env";

/**
 * The sitemap, built from what is actually published.
 *
 * Every URL here comes from the same public services the pages themselves read,
 * so a sitemap entry cannot outlive the content behind it: an unpublished
 * article disappears from both at once. Hand-maintaining a list would drift the
 * first time anyone unpublished anything, and a sitemap full of 404s is worse
 * than no sitemap — it is a signal of neglect crawlers act on.
 *
 * **Static, like the pages.** These reads go through `lib/db/public.ts`, which
 * touches no cookies, so Next prerenders this at build time and refreshes it on
 * the same hourly revalidation as the rest of the site.
 *
 * Deliberately absent: `/bag` and `/checkout` (a session's private state, and
 * nothing to index), `/sign-in`, `/admin`, `/api` and `/preview`. `robots.ts`
 * disallows the last three as well — a sitemap omission is a hint, a robots
 * disallow is an instruction, and the admin deserves both.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = canonicalSiteUrl();
  const now = new Date();

  const [pageSlugs, categorySlugs, articleSlugs, products, noIndexSlugs] = await Promise.all([
    listPublishedPageSlugs(),
    listPublishedCategorySlugs(),
    listPublishedArticleSlugs(),
    listPublishedProducts(),
    listNoIndexPageSlugs(),
  ]);

  /**
   * Priority is a hint, not a ranking, and these are ordered by how the site
   * itself treats them: the homepage first, then the sections and the store,
   * then individual items. `changeFrequency` says how often the *content* moves,
   * which for an editorial site is the category pages (a new lead whenever
   * anything publishes) rather than the articles (written once).
   */
  const excluded = new Set(noIndexSlugs.map((slug) => canonicalUrl(base, publicPathForPage(slug))));
  const staticPages: MetadataRoute.Sitemap = [
    { url: canonicalUrl(base, "/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: canonicalUrl(base, "/shop"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: canonicalUrl(base, "/articles"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: canonicalUrl(base, "/about"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: canonicalUrl(base, "/membership"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const categories: MetadataRoute.Sitemap = categorySlugs.map((slug) => ({
    url: canonicalUrl(base, publicPathForCategory(slug)),
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const pages: MetadataRoute.Sitemap = pageSlugs
    .filter((slug) => !categorySlugs.includes(slug))
    .map((slug) => ({
      url: canonicalUrl(base, publicPathForPage(slug)),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

  const articles: MetadataRoute.Sitemap = articleSlugs.map((slug) => ({
    url: canonicalUrl(base, publicPathForArticle(slug)),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: canonicalUrl(base, publicPathForProduct(product.slug)),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticPages, ...pages, ...categories, ...articles, ...productPages].filter(
    (entry) => !excluded.has(entry.url)
  );
}
