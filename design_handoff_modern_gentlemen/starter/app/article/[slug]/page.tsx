// import { sanityFetch } from "@/lib/sanity/client";
// import { articleQuery, articleSlugsQuery } from "@/lib/sanity/queries";

/**
 * Article system. The `template` field on the article document selects the
 * hero+body variant (replaces the prototype's per-article localStorage choice).
 * Build a hero component per template value and switch on it here.
 */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // const article = await sanityFetch(articleQuery, { slug });
  // const Hero = HERO_BY_TEMPLATE[article.template] ?? HERO_BY_TEMPLATE.standard;

  return (
    <article className="pb-20">
      <section data-darkband className="relative bg-[#0d0d0d] text-[#f4f4f4] py-24 md:py-36">
        <div className="container-mg max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-mg-accent">Culture</p>
          <h1 className="font-grotesk font-semibold text-4xl md:text-6xl mt-4 text-balance">Article: {slug}</h1>
          <p className="mt-4 text-white/60 font-mono text-sm">Swap the hero by article.template — see 03_PAGES_AND_COMPONENTS.md</p>
        </div>
      </section>
      <div className="container-mg max-w-2xl mt-12 prose-mg">
        <p className="text-lg leading-relaxed text-mg-fg/80">
          Render Sanity portable-text body here (blocks, images, pull-quotes).
        </p>
      </div>
    </article>
  );
}

// export async function generateStaticParams() {
//   const slugs = await sanityFetch<{ slug: string }[]>(articleSlugsQuery);
//   return slugs.map((s) => ({ slug: s.slug }));
// }
