/**
 * Editorial demo data for the category landing pages (/style, /grooming,
 * /watches, /culture, /film). Transcribed verbatim from the design prototype
 * design_files/MG Category.dc.html (image paths rebased to /images/*). Runs on
 * demo data today; a Supabase `getCategory()` fetch (lib/queries.ts) slots in
 * behind this same shape. Note: `culture` and `film` have no store products —
 * these pages are article-driven, not product-driven.
 */

export interface Article {
  tag: string; // e.g. "TAILORING · 040"
  title: string;
  read: string; // e.g. "5 MIN"
  image: string;
}

export interface CategoryLead {
  no: string; // issue number, e.g. "041"
  title: string;
  dek: string;
  author: string;
  read: string;
  image: string;
}

export interface CategoryData {
  name: string; // display name, e.g. "Style"
  slug: string; // lowercase route slug, e.g. "style"
  sectionNo: string; // e.g. "SEC. 01"
  blurb: string;
  heroImage: string;
  subs: string[]; // subcategory chips
  lead: CategoryLead;
  cards: Article[];
}

const CATEGORIES: Record<string, CategoryData> = {
  style: {
    name: "Style",
    slug: "style",
    sectionNo: "SEC. 01",
    blurb: "Tailoring, denim and the small decisions that separate dressing from getting dressed.",
    heroImage: "/images/style-mono.jpg",
    subs: ["Tailoring", "Denim", "Footwear", "Accessories", "The Uniform"],
    lead: {
      no: "041",
      title: "Racing Green Is the New Navy",
      dek: "The quiet case for the one colour every man already owns but never wears with intent.",
      author: "A. Bellamy",
      read: "7 MIN READ",
      image: "/images/style-mono.jpg",
    },
    cards: [
      { tag: "TAILORING · 040", title: "The Case for the Unstructured Blazer", read: "5 MIN", image: "/images/hero-cover.jpg" },
      { tag: "FOOTWEAR · 039", title: "How to Buy Shoes You Keep for a Decade", read: "6 MIN", image: "/images/film-tailor.jpg" },
      { tag: "DENIM · 038", title: "Raw Denim, and the Virtue of Patience", read: "4 MIN", image: "/images/grooming.jpg" },
      { tag: "ACCESSORIES · 037", title: "One Watch, One Belt, One Bag", read: "5 MIN", image: "/images/watch-gear.jpg" },
      { tag: "THE UNIFORM · 036", title: "Building a Wardrobe of Ten Things", read: "8 MIN", image: "/images/film-watchmaker.jpg" },
      { tag: "STYLE · 035", title: "The Return of the Proper Overcoat", read: "6 MIN", image: "/images/film-workshop.jpg" },
    ],
  },
  grooming: {
    name: "Grooming",
    slug: "grooming",
    sectionNo: "SEC. 02",
    blurb: "Skin, scent and the ritual of looking after yourself without making a project of it.",
    heroImage: "/images/grooming.jpg",
    subs: ["Skincare", "Fragrance", "Hair", "Shaving", "The Regimen"],
    lead: {
      no: "041",
      title: "The Case Against 12-Step Routines",
      dek: "Why the shortest regimen is usually the one that actually works — and lasts.",
      author: "J. Rees",
      read: "5 MIN READ",
      image: "/images/grooming.jpg",
    },
    cards: [
      { tag: "FRAGRANCE · 040", title: "A Signature Scent Is a Trap", read: "4 MIN", image: "/images/style-mono.jpg" },
      { tag: "SKINCARE · 039", title: "The Three Products You Actually Need", read: "5 MIN", image: "/images/hero-cover.jpg" },
      { tag: "SHAVING · 038", title: "The Lost Art of the Wet Shave", read: "6 MIN", image: "/images/film-tailor.jpg" },
      { tag: "HAIR · 037", title: "Finding a Barber Worth Keeping", read: "4 MIN", image: "/images/film-workshop.jpg" },
      { tag: "THE REGIMEN · 036", title: "Morning Rituals of Considered Men", read: "7 MIN", image: "/images/watch-gear.jpg" },
      { tag: "GROOMING · 035", title: "On Ageing, Gracefully", read: "5 MIN", image: "/images/film-watchmaker.jpg" },
    ],
  },
  watches: {
    name: "Watches",
    slug: "watches",
    sectionNo: "SEC. 03",
    blurb: "Movements, dials and the objects a man buys once and hands down.",
    heroImage: "/images/watch-gear.jpg",
    subs: ["Dive", "Dress", "Chronograph", "Vintage", "Watch of the Week"],
    lead: {
      no: "041",
      title: "Why Dial Symmetry Matters",
      dek: "The invisible geometry that makes one watch look right and another look wrong.",
      author: "C. Vance",
      read: "8 MIN READ",
      image: "/images/watch-gear.jpg",
    },
    cards: [
      { tag: "DIVE · 040", title: "The Only Dive Watch You Need", read: "6 MIN", image: "/images/hero-cover.jpg" },
      { tag: "VINTAGE · 039", title: "Buying Your First Vintage Piece", read: "7 MIN", image: "/images/film-watchmaker.jpg" },
      { tag: "DRESS · 038", title: "The Quiet Power of a Thin Watch", read: "5 MIN", image: "/images/style-mono.jpg" },
      { tag: "CHRONOGRAPH · 037", title: "What a Chronograph Is Actually For", read: "4 MIN", image: "/images/film-workshop.jpg" },
      { tag: "WATCH OF THE WEEK · 036", title: "The 300SL, in Studio", read: "5 MIN", image: "/images/grooming.jpg" },
      { tag: "WATCHES · 035", title: "Servicing, and When Not to Bother", read: "6 MIN", image: "/images/film-tailor.jpg" },
    ],
  },
  culture: {
    name: "Culture",
    slug: "culture",
    sectionNo: "SEC. 04",
    blurb: "Motoring, travel, design and the conversations worth having after dinner.",
    heroImage: "/images/hero-cover.jpg",
    subs: ["Motoring", "Travel", "Design", "Interviews", "Long Reads"],
    lead: {
      no: "042",
      title: "The Art of Arriving Early",
      dek: "On patience as the last luxury a gentleman can own — and why the unhurried man still commands the room.",
      author: "A. Bellamy",
      read: "6 MIN READ",
      image: "/images/hero-cover.jpg",
    },
    cards: [
      { tag: "MOTORING · 041", title: "The Slow Car, Fast Philosophy", read: "7 MIN", image: "/images/watch-gear.jpg" },
      { tag: "TRAVEL · 040", title: "Cities Best Seen on Foot", read: "5 MIN", image: "/images/style-mono.jpg" },
      { tag: "DESIGN · 039", title: "The Objects That Earn Their Place", read: "6 MIN", image: "/images/grooming.jpg" },
      { tag: "INTERVIEWS · 038", title: "What I’ve Learned: A Coachbuilder", read: "9 MIN", image: "/images/film-workshop.jpg" },
      { tag: "LONG READS · 037", title: "The Restoration", read: "11 MIN", image: "/images/film-tailor.jpg" },
      { tag: "CULTURE · 036", title: "A Brief History of the Aperitivo", read: "5 MIN", image: "/images/film-watchmaker.jpg" },
    ],
  },
  film: {
    name: "Film",
    slug: "film",
    sectionNo: "SEC. 05",
    blurb: "Short documentaries and long conversations, filmed in the workshops where taste is made.",
    heroImage: "/images/film-workshop.jpg",
    subs: ["Documentary", "Series", "Interviews", "Behind the Scenes"],
    lead: {
      no: "012",
      title: "The Coachbuilder’s Floor",
      dek: "A twelve-minute film on the last men shaping aluminium by hand — and eye.",
      author: "MG Film",
      read: "12 MIN FILM",
      image: "/images/film-workshop.jpg",
    },
    cards: [
      { tag: "DOCUMENTARY · 011", title: "The Tailor of Savile Row", read: "9 MIN", image: "/images/film-tailor.jpg" },
      { tag: "SERIES · 010", title: "Inside the Watchmaker’s Bench", read: "14 MIN", image: "/images/film-watchmaker.jpg" },
      { tag: "INTERVIEWS · 009", title: "A Conversation on Restraint", read: "18 MIN", image: "/images/style-mono.jpg" },
      { tag: "BEHIND THE SCENES · 008", title: "Shooting the Aston, at Dawn", read: "6 MIN", image: "/images/hero-cover.jpg" },
      { tag: "DOCUMENTARY · 007", title: "The Grooming Ritual, Filmed", read: "7 MIN", image: "/images/grooming.jpg" },
      { tag: "FILM · 006", title: "Objects of Desire, in Motion", read: "10 MIN", image: "/images/watch-gear.jpg" },
    ],
  },
};

/** Lowercase category slugs, in section order (drives generateStaticParams). */
export const categorySlugs = Object.keys(CATEGORIES);

/** Look up a category by slug (case-insensitive); null for unknown slugs. */
export const getCategory = (slug: string): CategoryData | null => CATEGORIES[slug.toLowerCase()] ?? null;

/** Title → article slug, matching the prototype's slugify (for /article/* hrefs). */
export const slugify = (t: string): string =>
  String(t || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
