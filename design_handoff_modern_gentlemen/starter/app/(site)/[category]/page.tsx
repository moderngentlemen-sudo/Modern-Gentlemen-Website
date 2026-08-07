import { notFound } from "next/navigation";
import { SectionRenderer } from "@/components/SectionRenderer";
import { resolveBindings } from "@/lib/blocks/binding";
import { supabaseBindingSources } from "@/lib/services/bindingSources";
import { getPublishedCategory, listPublishedCategorySlugs } from "@/lib/services/publicEditorial";

/**
 * Category landing (/style, /grooming, /watches, /culture, /film).
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
  return (await listPublishedCategorySlugs()).map((category) => ({ category }));
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;

  // `notFound()` and not a throw, unlike the homepage: a category that is not
  // published genuinely is a missing resource, and this route has answered 404
  // for an unknown slug since Track A.
  const doc = await getPublishedCategory(category);
  if (!doc) notFound();

  const sections = await resolveBindings(doc.sections, supabaseBindingSources);

  return <SectionRenderer sections={sections} />;
}
