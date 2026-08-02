import { SectionRenderer } from "@/components/SectionRenderer";
import { getPublishedPage } from "@/lib/services/publicContent";

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

  return <SectionRenderer sections={page.sections} />;
}
