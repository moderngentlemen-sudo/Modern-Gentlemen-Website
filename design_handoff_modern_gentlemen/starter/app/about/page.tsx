import { SectionRenderer, type Block } from "@/components/SectionRenderer";
// import { sanityFetch } from "@/lib/sanity/client";
// import { pageBySlugQuery } from "@/lib/sanity/queries";

export default async function AboutPage() {
  // const data = await sanityFetch<{ sections: Block[] }>(pageBySlugQuery, { slug: "about" });
  const sections: Block[] = [
    {
      _key: "1",
      _type: "featureSplit",
      eyebrow: "Since 2019",
      headline: "A magazine that happens to sell things.",
      body: "Modern Gentlemen began as an editorial project about doing a few things well. The shop came later, and only for objects we'd actually own.",
      image: "/images/film-tailor.jpg",
      variant: "imageRight",
    },
  ];
  return <SectionRenderer sections={sections} />;
}
