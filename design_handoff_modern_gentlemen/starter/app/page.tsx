import { SectionRenderer, type Block } from "@/components/SectionRenderer";
// import { sanityFetch } from "@/lib/sanity/client";
// import { homepageQuery } from "@/lib/sanity/queries";

/**
 * Homepage — driven entirely by an ordered sections[] array (composable via the
 * builder). Wire the CMS by uncommenting the sanityFetch call; the demo blocks
 * below let you run the scaffold with no CMS connected.
 */
export default async function HomePage() {
  // const data = await sanityFetch<{ sections: Block[] }>(homepageQuery);
  // const sections = data?.sections ?? DEMO_SECTIONS;
  const sections = DEMO_SECTIONS;
  return <SectionRenderer sections={sections} />;
}

const DEMO_SECTIONS: Block[] = [
  {
    _key: "1",
    _type: "heroCoverStar",
    eyebrow: "The July Issue",
    headline: "The art of the unhurried arrival.",
    sub: "On driving gloves, dive watches, and the quiet confidence of being early.",
    media: { kind: "image", image: "/images/hero-cover.jpg" },
    cta: { label: "Read the issue", href: "/culture", style: "solid" },
    mobileHeight: "tall",
  },
  {
    _key: "2",
    _type: "latestGrid",
    heading: "The Latest",
    variant: "threeCol",
    items: [
      { kicker: "STYLE", title: "The only five jackets a man needs", href: "/style", meta: "6 min read", image: "/images/style-mono.jpg" },
      { kicker: "WATCHES", title: "Why the field watch never went away", href: "/watches", meta: "8 min read", image: "/images/watch-gear.jpg" },
      { kicker: "GROOMING", title: "A seven-minute morning, refined", href: "/grooming", meta: "4 min read", image: "/images/grooming.jpg" },
    ],
  },
  {
    _key: "3",
    _type: "twoUpCategory",
    items: [
      { kicker: "STYLE", title: "The Tailor's Table", href: "/style", image: "/images/film-tailor.jpg" },
      { kicker: "FILM", title: "In the Workshop", href: "/film", image: "/images/film-workshop.jpg" },
    ],
  },
  {
    _key: "4",
    _type: "storyBand",
    eyebrow: "The Debrief",
    quote: "Style is not what you wear. It is the decisions you no longer have to make.",
    attribution: "From the July editor's letter",
    backgroundImage: "/images/hero-cover.jpg",
    cta: { label: "Become a member", href: "/membership", style: "outline" },
  },
  {
    _key: "5",
    _type: "newsletter",
    heading: "The weekly dispatch.",
    sub: "One considered email each Sunday. No noise.",
    buttonLabel: "Subscribe",
  },
];
