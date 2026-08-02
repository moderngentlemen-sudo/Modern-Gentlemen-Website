import { SectionRenderer, type Block } from "@/components/SectionRenderer";

/**
 * About — a composable Block[] (verbatim copy from design_files/MG About.dc.html):
 * editorial hero → manifesto → by-the-numbers → what we cover → pull quote →
 * masthead → join band. Runs on demo data; a Supabase `getPage("about")` fetch
 * slots in behind this same shape.
 */
export default function AboutPage() {
  return <SectionRenderer sections={SECTIONS} />;
}

const SECTIONS: Block[] = [
  {
    _key: "hero",
    _type: "editorialHero",
    eyebrow: "ABOUT MODERN GENTLEMEN · EST. 2026",
    headline: "Preserving taste while ",
    accent: "defining new style.",
    dek: "An editorial house for the considered man — style, grooming, watches, motoring and the culture around a life well kept.",
  },
  {
    _key: "manifesto",
    _type: "manifesto",
    label: "OUR POSITION",
    paragraphs: [
      "We believe luxury and utility don't have to be at odds. Modern Gentlemen exists for men who care about how things are made and why they endure — the hand-welted shoe, the serviced movement, the car kept rather than replaced.",
      "We publish slowly and on purpose. No hot takes, no filler — just considered writing, honest recommendations, and films made in the workshops where taste is actually made. It was always the better way to live.",
    ],
  },
  {
    _key: "numbers",
    _type: "statsBand",
    variant: "cards",
    stats: [
      { value: "42", label: "Issues Published" },
      { value: "180k", label: "Readers Weekly" },
      { value: "31", label: "Films Produced" },
      { value: "5", label: "Countries on Staff" },
    ],
  },
  {
    _key: "cover",
    _type: "coverCards",
    label: "WHAT WE COVER",
    cards: [
      {
        title: "Style",
        body: "Tailoring, denim, footwear, and the discipline of dressing with intent.",
        href: "/style",
      },
      {
        title: "Watches",
        body: "Movements, dials, and the objects a man buys once and hands down.",
        href: "/watches",
      },
      {
        title: "Culture",
        body: "Motoring, travel, design, and conversations worth having after dinner.",
        href: "/culture",
      },
    ],
  },
  {
    _key: "quote",
    _type: "pullQuote",
    size: "lg",
    quote:
      "Urgency is cheap, and it flatters no one for long. What endures is the willingness to move deliberately.",
    attribution: "— THE EDITORS",
  },
  {
    _key: "masthead",
    _type: "masthead",
    label: "THE MASTHEAD",
    people: [
      { initial: "A", name: "A. Bellamy", role: "EDITOR-IN-CHIEF" },
      { initial: "C", name: "C. Vance", role: "WATCHES EDITOR" },
      { initial: "J", name: "J. Rees", role: "GROOMING EDITOR" },
      { initial: "E", name: "E. Marlowe", role: "PHOTOGRAPHY" },
      { initial: "S", name: "S. Okafor", role: "STYLE DIRECTOR" },
      { initial: "M", name: "M. Laurent", role: "CULTURE EDITOR" },
      { initial: "D", name: "D. Whitfield", role: "FILMS" },
      { initial: "R", name: "R. Ishikawa", role: "ART DIRECTOR" },
    ],
  },
  {
    _key: "join",
    _type: "ctaBand",
    variant: "link",
    gutter: 22,
    eyebrow: "JOIN THE FAMILY",
    heading: "Become a member of Modern Gentlemen.",
    sub: "The Debrief newsletter, the full archive, member films and events.",
    cta: { label: "SEE MEMBERSHIPS →", href: "/membership" },
  },
];
