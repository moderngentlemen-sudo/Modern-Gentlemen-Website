import { notFound } from "next/navigation";
import { SectionRenderer, type Block } from "@/components/SectionRenderer";
import { getCategory, categorySlugs, slugify } from "@/lib/editorial";

/** Pre-render the five known category slugs. */
export function generateStaticParams() {
  return categorySlugs.map((category) => ({ category }));
}

/**
 * Reusable category landing (/style, /grooming, /watches, /culture, /film).
 * One page keyed by slug; content is an ordered Block[] composed from the
 * editorial demo data (lib/editorial.ts). Unknown slugs → 404. Runs on demo
 * data today; a Supabase `getCategory(slug)` fetch slots in behind this shape.
 */
export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const d = getCategory(category);
  if (!d) notFound();

  const upper = d.name.toUpperCase();
  const sections: Block[] = [
    {
      _key: "hero",
      _type: "categoryHero",
      eyebrow: `MODERN GENTLEMEN · ${d.sectionNo}`,
      title: d.name,
      blurb: d.blurb,
      image: d.heroImage,
      chips: d.subs,
    },
    {
      _key: "lead",
      _type: "featuredLead",
      article: {
        kicker: `${upper} · ${d.lead.no}`,
        title: d.lead.title,
        dek: d.lead.dek,
        author: d.lead.author,
        read: d.lead.read,
        image: d.lead.image,
        href: `/article/${slugify(d.lead.title)}`,
      },
    },
    {
      _key: "grid",
      _type: "articleGrid",
      label: `MORE IN ${upper}`,
      items: d.cards.map((c) => ({
        tag: c.tag,
        title: c.title,
        read: c.read,
        image: c.image,
        href: `/article/${slugify(c.title)}`,
      })),
    },
    {
      _key: "newsletter",
      _type: "ctaBand",
      variant: "split",
      eyebrow: "THE DEBRIEF",
      heading: `The best of ${d.name}, every Sunday.`,
      buttonLabel: "SUBSCRIBE",
      successLabel: "SUBSCRIBED ✓",
    },
  ];

  return <SectionRenderer sections={sections} />;
}
