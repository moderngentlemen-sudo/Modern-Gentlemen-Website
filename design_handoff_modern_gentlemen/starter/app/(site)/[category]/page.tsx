import { PagePresentation } from "@/components/PagePresentation";
import { withPageMetadata } from "@/lib/render/pageMetadata";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SectionRenderer } from "@/components/SectionRenderer";
import { resolveBindings } from "@/lib/blocks/binding";
import { supabaseBindingSources } from "@/lib/services/bindingSources";
import { getPublishedCategory, listPublishedCategorySlugs } from "@/lib/services/publicEditorial";
import {
  composePublishedCategory,
  composePublishedPage,
  getPublishedPage,
  listPublishedPageSlugs,
} from "@/lib/services/publicContent";
import { canonicalSiteUrl } from "@/lib/db/env";
import { canonicalUrl, metaDescription, pageTitle } from "@/lib/domain/seo";
import { publicPathForCategory, publicPathForPage } from "@/lib/domain/routes";

/**
 * Shared one-segment route for category landings and ordinary builder pages.
 *
 * Since Phase 7c the layout is a document — `categories.published_data` — read
 * through the anonymous client and rendered by the same `SectionRenderer` the
 * homepage uses. The composition that used to happen here in code now lives in
 * `lib/demo/category-sections.ts` as the fixture the integration test compares
 * the database against.
 *
 * **The lead and the grid are bound, not stored.** Their blocks hold `$bind`
 * descriptors that `resolveBindings` answers from the `articles` table, so
 * publishing an article puts it on its category page without anyone editing a
 * layout. That is the first real consumer of a binding engine this repo has
 * carried, unexercised, since Phase 2.
 *
 * **Still statically rendered.** Every read goes through `createPublicClient()`,
 * which touches no cookies, so Next prerenders these at build time. Publishing
 * revalidates the path; the hourly `revalidate` is only a backstop for a
 * revalidation that never arrived.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  const [categories, pages] = await Promise.all([
    listPublishedCategorySlugs(),
    listPublishedPageSlugs(),
  ]);
  return [...new Set([...categories, ...pages])].map((category) => ({ category }));
}

/**
 * Title and canonical from the row, description from its `intro`.
 *
 * The canonical is `publicPathForCategory`, not the requested path — and the
 * two are not always the same string. `getPublishedCategory` lowercases the
 * slug before it queries, so `/Style` and `/STYLE` both resolve and both
 * canonicalise to `/style`. Echoing the request back would hand a crawler three
 * URLs for one page, each declaring itself the original.
 *
 * An unknown slug still returns a `Metadata` rather than calling `notFound()`:
 * the page below does that, and doing it twice buys nothing. Next renders the
 * 404 with this title only in the window before the page function runs.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const doc = await getPublishedCategory(category);
  if (!doc) {
    const page = await getPublishedPage(category.toLowerCase());
    if (!page) return { title: pageTitle("Not found") };

    const url = canonicalUrl(canonicalSiteUrl(), publicPathForPage(page.slug));
    return withPageMetadata(
      {
        title: pageTitle(page.title),
        alternates: { canonical: url },
        openGraph: { type: "website", title: pageTitle(page.title), url },
      },
      page.pageSettings
    );
  }

  const url = canonicalUrl(canonicalSiteUrl(), publicPathForCategory(doc.slug));
  const description = metaDescription(doc.intro);

  return {
    title: pageTitle(doc.name),
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title: pageTitle(doc.name), description, url },
  };
}

export default async function RootSlugPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;

  // `notFound()` and not a throw, unlike the homepage: a category that is not
  // published genuinely is a missing resource, and this route has answered 404
  // for an unknown slug since Track A.
  const doc = await getPublishedCategory(category);
  if (!doc) {
    const page = await getPublishedPage(category.toLowerCase());
    if (!page) notFound();
    return (
      <PagePresentation settings={page.pageSettings}>
        <SectionRenderer sections={await composePublishedPage(page)} />
      </PagePresentation>
    );
  }

  /**
   * ⚠️ **Expansion runs before binding resolution, and the order is not
   * arbitrary.** A pattern's own blocks can carry `$bind` descriptors — a
   * pattern holding an `articleGrid` is an obvious thing for an editor to
   * build — and a block substituted in *after* `resolveBindings` had run would
   * reach the renderer with its descriptor unresolved, rendering an empty grid
   * on a page whose other grids were full.
   *
   * That ordering is now `composePublishedCategory`'s to keep, along with the
   * `archive` template that frames the result. The resolver is passed in rather
   * than imported there: `lib/services/publicContent.ts` is what every public
   * route reads through, and making it depend on the binding engine for one
   * caller's benefit would be the wrong trade. This route already holds both
   * halves.
   */
  const sections = await composePublishedCategory(doc, (tree) =>
    resolveBindings(tree, supabaseBindingSources)
  );

  return <SectionRenderer sections={sections} />;
}
