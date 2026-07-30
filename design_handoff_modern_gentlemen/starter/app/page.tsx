import { SectionRenderer, type Block } from "@/components/SectionRenderer";
import { FILM_PREVIEW_VIDEO, HERO_COVER_VIDEO } from "@/lib/media";
// Track B (Supabase) seam — swap DEMO_SECTIONS for a live fetch:
// import { getPage } from "@/lib/queries";

/**
 * Homepage — 7 canonical sections rendered from an ordered Block[] (verbatim
 * copy from design_files/Modern Gentlemen Homepage.dc.html). Runs on demo data
 * today; a Supabase `pages.sections` fetch slots in behind this same shape.
 */
export default async function HomePage() {
  // const page = await getPage("home");
  // const sections = page?.sections ?? DEMO_SECTIONS;
  const sections = DEMO_SECTIONS;
  return <SectionRenderer sections={sections} />;
}

const DEMO_SECTIONS: Block[] = [
  {
    _key: "hero",
    _type: "heroCoverStar",
    badge: "COVER STORY — ISSUE 042",
    eyebrow: "The Cover Interview",
    headline: "Speed,\nConsidered",
    sub: "Why the modern gentleman drives slow cars fast — on patience, stewardship, and the machines we keep.",
    // Moving cover, with the still as its poster (prototype `heroVideoUrl`).
    media: { kind: "video", videoUrl: HERO_COVER_VIDEO, image: "/images/hero-cover.jpg" },
    cta: { label: "READ THE COVER STORY", href: "/article/speed-considered" },
    credit: "PHOTOGRAPHY · E. MARLOWE",
    meta: "NO. 042 — A. BELLAMY — 11 MIN",
    mobileHeight: "fullscreen",
  },
  {
    _key: "latest",
    _type: "latestGrid",
    variant: "sixUp",
    eyebrow: "New this week",
    heading: "The Latest",
    viewAllHref: "/culture",
    viewAllLabel: "View all →",
    items: [
      { kind: "feature", kicker: "Culture · 042 — New", title: "The Art of Arriving Early", body: "On patience as the last luxury a gentleman can own.", meta: "6 min", href: "/culture" },
      { kind: "image", kicker: "Style · 041", title: "Racing Green Is the New Navy", image: "/images/style-mono.jpg", href: "/style" },
      { kind: "image", kicker: "Watches · 040", title: "Why Dial Symmetry Matters", image: "/images/watch-gear.jpg", href: "/watches" },
      { kind: "image", kicker: "Grooming · 039", title: "The Case Against 12-Step Routines", image: "/images/grooming.jpg", href: "/grooming" },
      { kind: "image", kicker: "Culture · 038", title: "The Analog Weekend", image: "/images/film-workshop.jpg", href: "/culture" },
      { kind: "membership", kicker: "Membership", title: "Join The Debrief →", body: "One considered email a week", href: "/membership" },
    ],
  },
  {
    _key: "style-feature",
    _type: "featureSplit",
    variant: "fullBleed",
    eyebrow: "Style",
    headline: "The Monochrome Wardrobe, Engineered",
    image: "/images/style-mono.jpg",
    cta: { label: "DISCOVER MORE →", href: "/style" },
  },
  {
    _key: "two-up",
    _type: "twoUpCategory",
    items: [
      { kicker: "Grooming", title: "The Seven-Minute Standard", body: "Four products, seven minutes, done properly. A pit-stop routine for sharp mornings.", href: "/grooming", image: "/images/grooming.jpg" },
      { kicker: "Watches & Gear", title: "Chronographs Born on the Grid", body: "From pit wall to dinner table — six racing chronographs that earned their place.", href: "/watches", image: "/images/watch-gear.jpg" },
    ],
  },
  {
    _key: "promise",
    _type: "storyBand",
    eyebrow: "Our promise",
    quote: "PRESERVING TASTE WHILE DEFINING NEW STYLE",
    body: "We believe luxury and utility don't have to be at odds. Modern Gentlemen exists to help men keep their most precious possession — their time — and spend it well.",
    cta: { label: "Continue reading →", href: "/about", style: "outline" },
  },
  {
    _key: "film",
    _type: "filmStills",
    eyebrow: "Watch",
    heading: "MG Film",
    allHref: "/film",
    allLabel: "All episodes →",
    items: [
      { title: "Inside a Coachbuilder’s Workshop", still: "/images/film-workshop.jpg", duration: "14:20", videoUrl: FILM_PREVIEW_VIDEO },
      { title: "A Tailor’s Archive", still: "/images/film-tailor.jpg", duration: "09:52", videoUrl: FILM_PREVIEW_VIDEO },
      { title: "The Watchmaker of the Grid", still: "/images/film-watchmaker.jpg", duration: "11:38", videoUrl: FILM_PREVIEW_VIDEO },
    ],
  },
  {
    _key: "newsletter",
    _type: "newsletter",
    eyebrow: "Join the family",
    heading: "The Debrief. Weekly, considered.",
    buttonLabel: "Subscribe",
    placeholder: "your@address.com",
    sub: "One considered email a week. No noise, ever.",
  },
];
