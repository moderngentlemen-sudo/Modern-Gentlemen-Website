import { PagePresentation } from "@/components/PagePresentation";
import { withPageMetadata } from "@/lib/render/pageMetadata";
import type { Metadata } from "next";

import { SectionRenderer } from "@/components/SectionRenderer";
import { JsonLd } from "@/components/seo/JsonLd";
import { composePublishedPage, getPublishedPage } from "@/lib/services/publicContent";
import { canonicalSiteUrl } from "@/lib/db/env";
import { BRAND, canonicalUrl, organizationJsonLd } from "@/lib/domain/seo";

/**
 * Homepage — the first public route to render from the database rather than
 * from `lib/demo/home-sections.ts`.
 *
 * The `Block[]` shape is identical either way, which is the whole point of the
 * seam Track A left here. Verified before the switch: the stored
 * `published_data.sections` deep-equals `DEMO_SECTIONS` field for field, so the
 * rendered markup — and the visual baselines — are unchanged by the move.
 *
 * **Still statically rendered.** The read goes through `createPublicClient()`,
 * which touches no cookies, so Next prerenders this at build time exactly as it
 * did with the demo import. What keeps it current is `revalidatePath("/")` from
 * the publish actions; the hourly `revalidate` below is only a backstop for a
 * revalidation that never arrived.
 */
export const revalidate = 3600;

/**
 * The homepage keeps the bare brand as its title — no suffix, because
 * "Modern Gentlemen — Modern Gentlemen" is what `pageTitle("")` exists to avoid.
 *
 * Its canonical is the bare origin. That matters more here than anywhere else:
 * `/` and `//` and `/index` are three URLs to a crawler and one page to a user,
 * and a homepage whose ranking is split across them is the classic version of
 * this bug. `canonicalUrl(base, "/")` strips the trailing slash for exactly this.
 */
export async function generateMetadata(): Promise<Metadata> {
  const base = canonicalSiteUrl();

  const page = await getPublishedPage("home");
  return withPageMetadata(
    {
      title: BRAND,
      description: "Style, grooming, watches, culture and film — for the considered man.",
      alternates: { canonical: canonicalUrl(base, "/") },
      openGraph: {
        type: "website",
        siteName: BRAND,
        title: BRAND,
        description: "Style, grooming, watches, culture and film — for the considered man.",
        url: canonicalUrl(base, "/"),
      },
    },
    page?.pageSettings
  );
}

export default async function HomePage() {
  const page = await getPublishedPage("home");

  // Deliberately a throw, not `notFound()`. At build time this fails the build,
  // which is the correct outcome — `notFound()` would quietly prerender the 404
  // page as the site's homepage. A missing published "home" row is a broken
  // deployment, not a missing resource.
  if (!page) {
    throw new Error(
      'No published page with slug "home". Seed it with `npx tsx scripts/seed.ts`, ' +
        "or publish it from /admin/pages."
    );
  }

  return (
    <>
      {/* Site identity, emitted once and only here — an Organization block on
          every page is the same claim repeated, and search engines take the
          homepage's as canonical anyway. Renders no markup. */}
      <JsonLd data={organizationJsonLd(canonicalSiteUrl())} />
      {/*
       * `composePublishedPage` does two substitutions, in this order: synced
       * patterns are expanded, then the result is spliced into the `main` area
       * of whatever template is assigned to this page.
       *
       * A page with no pattern and no assigned template is handed back
       * untouched, which is what keeps this change invisible to the sixteen
       * baselines — and is why the homepage still renders byte-identically on a
       * project that has never created a template.
       */}
      <PagePresentation settings={page.pageSettings}>
        <SectionRenderer sections={await composePublishedPage(page)} />
      </PagePresentation>
    </>
  );
}
