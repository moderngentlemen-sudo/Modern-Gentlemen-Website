import { SectionRenderer, type Block } from "@/components/SectionRenderer";
// import { sanityFetch } from "@/lib/sanity/client";
// import { categoryQuery } from "@/lib/sanity/queries";

const KNOWN = ["style", "grooming", "watches", "culture", "film"];

/** Reusable category landing (/style, /grooming, /watches, /culture, /film).
 *  Full-bleed hero band + composable sections below (from the CMS). */
export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  // const data = await sanityFetch(categoryQuery, { slug: category });
  const title = category.charAt(0).toUpperCase() + category.slice(1);
  const sections: Block[] = []; // data?.sections ?? []

  const valid = KNOWN.includes(category.toLowerCase());
  return (
    <>
      <section data-darkband className="relative bg-[#0d0d0d] text-[#f4f4f4] py-24 md:py-32">
        <div className="container-mg">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-mg-accent">{valid ? "Section" : "Not found"}</p>
          <h1 className="font-grotesk font-semibold text-5xl md:text-7xl mt-4">{title}</h1>
        </div>
      </section>
      <SectionRenderer sections={sections} />
    </>
  );
}
