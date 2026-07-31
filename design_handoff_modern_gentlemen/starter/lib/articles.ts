import { getCategory, categorySlugs, slugify } from "./editorial";

/**
 * Article template system (demo data). Each of the 20 named templates is a
 * hero-variant × body-variant combo, transcribed from design_files/MG
 * Article.dc.html `config()`. Article stubs are seeded from the category
 * demo data (lib/editorial.ts) so every /article/{slugify(title)} link the
 * category pages emit resolves, plus a canonical showcase per template so all
 * 20 are reachable. Body *content* is fixed per body-variant and lives in the
 * body components (the prototype's own model). Behind the getArticle() seam:
 * a Supabase `articles` row (slug/title/template/category/hero/body) maps onto
 * this same resolved shape later.
 */

export type HeroVariant =
  | "full"
  | "contained"
  | "cover"
  | "wide"
  | "portrait"
  | "split"
  | "masthead"
  | "centered"
  | "video";
export type BodyVariant =
  | "prose"
  | "essay"
  | "letter"
  | "qa"
  | "ask"
  | "profile"
  | "review"
  | "spec"
  | "photo"
  | "gallery"
  | "film"
  | "list"
  | "steps"
  | "regimen"
  | "timeline"
  | "rundown"
  | "manifesto";

interface TemplateDef {
  hero: HeroVariant;
  body: BodyVariant;
  cat: string;
  no: string;
  title: string;
  dek: string;
  author: string;
  read: string;
  img: string; // "" or "/images/*.jpg"
}

/** The 20 templates → {hero, body, default copy}, 1:1 with the prototype config(). */
export const ARTICLE_TEMPLATES: Record<string, TemplateDef> = {
  Feature: {
    hero: "full",
    body: "prose",
    cat: "Culture",
    no: "042",
    title: "The Art of Arriving Early",
    dek: "On patience as the last luxury a gentleman can own — and why the unhurried man still commands the room.",
    author: "A. Bellamy",
    read: "6 MIN",
    img: "/images/hero-cover.jpg",
  },
  "Feature — Standard": {
    hero: "contained",
    body: "prose",
    cat: "Culture",
    no: "042",
    title: "The Art of Arriving Early",
    dek: "On patience as the last luxury a gentleman can own — and why the unhurried man still commands the room.",
    author: "A. Bellamy",
    read: "6 MIN",
    img: "/images/hero-cover.jpg",
  },
  "Cover Story": {
    hero: "cover",
    body: "prose",
    cat: "Culture",
    no: "042",
    title: "Slow Down",
    dek: "The cover essay on doing fewer things, properly.",
    author: "A. Bellamy",
    read: "8 MIN",
    img: "/images/hero-cover.jpg",
  },
  "The Big Read": {
    hero: "wide",
    body: "essay",
    cat: "Motoring",
    no: "041",
    title: "The Slow Car, Fast Philosophy",
    dek: "Why involvement, not acceleration, is the measure of a machine — and a life.",
    author: "C. Vance",
    read: "12 MIN",
    img: "/images/watch-gear.jpg",
  },
  "Op-Ed": {
    hero: "masthead",
    body: "essay",
    cat: "Opinion",
    no: "041",
    title: "Stop Quoting Zero to Sixty",
    dek: "An argument against the only number anyone remembers.",
    author: "C. Vance",
    read: "5 MIN",
    img: "",
  },
  "Letter from the Editor": {
    hero: "centered",
    body: "letter",
    cat: "The Debrief",
    no: "042",
    title: "A Letter from the Editor",
    dek: "On what this issue is for, and what it refuses to be.",
    author: "A. Bellamy",
    read: "3 MIN",
    img: "",
  },
  Interview: {
    hero: "portrait",
    body: "qa",
    cat: "Culture",
    no: "040",
    title: "In Conversation: The Coachbuilder",
    dek: "",
    author: "M. Laurent",
    read: "14 MIN",
    img: "/images/film-workshop.jpg",
  },
  Profile: {
    hero: "split",
    body: "profile",
    cat: "Culture",
    no: "040",
    title: "The Man Who Saves Cars",
    dek: "Four decades, one shed, and a waiting list he mostly ignores.",
    author: "M. Laurent",
    read: "9 MIN",
    img: "/images/film-tailor.jpg",
  },
  "Ask MG": {
    hero: "centered",
    body: "ask",
    cat: "Style",
    no: "039",
    title: "Ask MG",
    dek: "Your questions, answered plainly — knots, cologne, and rules worth breaking.",
    author: "The Editors",
    read: "4 MIN",
    img: "",
  },
  Review: {
    hero: "contained",
    body: "review",
    cat: "Watches",
    no: "041",
    title: "The Everyday Chronograph, Reviewed",
    dek: "We lived with it for a month before writing a word.",
    author: "C. Vance",
    read: "7 MIN",
    img: "/images/watch-gear.jpg",
  },
  "Spec Comparison": {
    hero: "masthead",
    body: "spec",
    cat: "Watches",
    no: "041",
    title: "Three Watches, One Wrist",
    dek: "A side-by-side for the decision that lasts a decade.",
    author: "C. Vance",
    read: "6 MIN",
    img: "",
  },
  "Photo Essay": {
    hero: "full",
    body: "photo",
    cat: "Film",
    no: "012",
    title: "Dawn at the Coachbuilder",
    dek: "One quiet morning, before the tools warmed.",
    author: "E. Marlowe",
    read: "4 MIN",
    img: "/images/film-workshop.jpg",
  },
  Gallery: {
    hero: "contained",
    body: "gallery",
    cat: "Style",
    no: "040",
    title: "The Objects of the Season",
    dek: "A visual index — nothing here shouts.",
    author: "E. Marlowe",
    read: "3 MIN",
    img: "/images/style-mono.jpg",
  },
  "Film Feature": {
    hero: "video",
    body: "film",
    cat: "Film",
    no: "012",
    title: "Inside a Coachbuilder’s Workshop",
    dek: "",
    author: "D. Whitfield",
    read: "12 MIN",
    img: "/images/film-workshop.jpg",
  },
  "The List": {
    hero: "masthead",
    body: "list",
    cat: "Style",
    no: "040",
    title: "Five We’d Buy Again",
    dek: "Ranked, argued, photographed on the desk that tested them.",
    author: "S. Okafor",
    read: "6 MIN",
    img: "",
  },
  "Field Guide": {
    hero: "masthead",
    body: "steps",
    cat: "Style",
    no: "039",
    title: "How to Buy Your First Proper Suit",
    dek: "Five steps, in order, and one thing to ignore entirely.",
    author: "S. Okafor",
    read: "7 MIN",
    img: "",
  },
  "The Regimen": {
    hero: "contained",
    body: "regimen",
    cat: "Grooming",
    no: "039",
    title: "The Seven-Minute Standard",
    dek: "Four products, done before the coffee’s cold.",
    author: "J. Rees",
    read: "4 MIN",
    img: "/images/grooming.jpg",
  },
  "A Brief History": {
    hero: "masthead",
    body: "timeline",
    cat: "Watches",
    no: "038",
    title: "A Brief History of the Chronograph",
    dek: "How a stopwatch on a wrist became indispensable.",
    author: "C. Vance",
    read: "6 MIN",
    img: "",
  },
  "The Rundown": {
    hero: "masthead",
    body: "rundown",
    cat: "The Debrief",
    no: "042",
    title: "The Rundown",
    dek: "Four things worth your attention this week.",
    author: "The Editors",
    read: "3 MIN",
    img: "",
  },
  Manifesto: {
    hero: "centered",
    body: "manifesto",
    cat: "Culture",
    no: "001",
    title: "What We Believe",
    dek: "",
    author: "Modern Gentlemen",
    read: "2 MIN",
    img: "",
  },
};

const TEMPLATE_NAMES = Object.keys(ARTICLE_TEMPLATES);
/** Supply a self-hosted clip here (or per-article) to make the Video hero play;
 *  the demo runs self-contained, so the Video hero falls back to its poster. */
export const DEFAULT_HERO_VIDEO = "";

/** Explicit slug → template map (prototype defaultTplFor, using the REAL slugify
 *  output — the prototype's hand-typed apostrophe slugs were wrong). */
const EXPLICIT_TEMPLATE: Record<string, string> = {
  "the-art-of-arriving-early": "Feature",
  "racing-green-is-the-new-navy": "Feature — Standard",
  "why-dial-symmetry-matters": "Review",
  "the-case-against-12-step-routines": "The Regimen",
  "the-slow-car-fast-philosophy": "The Big Read",
  "the-coachbuilder-s-floor": "Film Feature",
  "inside-the-watchmaker-s-bench": "Spec Comparison",
  "the-only-dive-watch-you-need": "Review",
};

/** Deterministic template for a slug: explicit map, else the prototype's hash. */
export function assignTemplate(slug: string): string {
  if (EXPLICIT_TEMPLATE[slug]) return EXPLICIT_TEMPLATE[slug];
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return TEMPLATE_NAMES[h % TEMPLATE_NAMES.length];
}

export interface ArticleDoc {
  slug: string;
  title: string;
  template: string;
  category: string;
  issue: string;
  author: string;
  read: string; // "N MIN" — byline appends " READ"
  dek?: string;
  heroImage?: string;
  videoUrl?: string;
}

const CATEGORY_AUTHOR: Record<string, string> = {
  Style: "S. Okafor",
  Grooming: "J. Rees",
  Watches: "C. Vance",
  Culture: "A. Bellamy",
  Film: "D. Whitfield",
};

const normalizeRead = (r: string) => r.replace(/\s*(READ|FILM)\s*$/i, "").trim();
const parseNo = (tag: string) => tag.match(/(\d+)\s*$/)?.[1] ?? "";

function buildArticles(): Record<string, ArticleDoc> {
  const out: Record<string, ArticleDoc> = {};
  // 0) The homepage cover story. Seeded first (and by hand) because the hero
  //    links straight to it — prototype `MG Article.dc.html?a=speed-considered`
  //    — and every field is already stated on the cover itself.
  out["speed-considered"] = {
    slug: "speed-considered",
    title: "Speed, Considered",
    template: "Cover Story",
    category: "Culture",
    issue: "042",
    author: "A. Bellamy",
    read: "11 MIN",
    dek: "Why the modern gentleman drives slow cars fast — on patience, stewardship, and the machines we keep.",
    heroImage: "/images/hero-cover.jpg",
  };
  // 1) Seed from the category leads + cards so every category link resolves.
  for (const cslug of categorySlugs) {
    const d = getCategory(cslug);
    if (!d) continue;
    const leadSlug = slugify(d.lead.title);
    if (!out[leadSlug]) {
      out[leadSlug] = {
        slug: leadSlug,
        title: d.lead.title,
        template: assignTemplate(leadSlug),
        category: d.name,
        issue: d.lead.no,
        author: d.lead.author,
        read: normalizeRead(d.lead.read),
        dek: d.lead.dek,
        heroImage: d.lead.image,
      };
    }
    for (const c of d.cards) {
      const s = slugify(c.title);
      if (out[s]) continue;
      out[s] = {
        slug: s,
        title: c.title,
        template: assignTemplate(s),
        category: d.name,
        issue: parseNo(c.tag),
        author: CATEGORY_AUTHOR[d.name] ?? "The Editors",
        read: normalizeRead(c.read),
        heroImage: c.image,
      };
    }
  }
  // 2) A canonical showcase per template (so all 20 are reachable).
  for (const [name, t] of Object.entries(ARTICLE_TEMPLATES)) {
    const s = slugify(t.title);
    if (out[s]) continue;
    out[s] = {
      slug: s,
      title: t.title,
      template: name,
      category: t.cat,
      issue: t.no,
      author: t.author,
      read: normalizeRead(t.read),
      dek: t.dek || undefined,
      heroImage: t.img || undefined,
      videoUrl: t.hero === "video" ? DEFAULT_HERO_VIDEO : undefined,
    };
  }
  return out;
}

export const ARTICLES = buildArticles();
export const articleSlugs = Object.keys(ARTICLES);

export interface RelatedItem {
  tag: string;
  title: string;
  image: string;
  href: string;
}

export interface ResolvedArticle extends ArticleDoc {
  hero: HeroVariant;
  body: BodyVariant;
  kicker: string;
  byline: string;
  authorInitial: string;
  related: RelatedItem[];
}

const composeByline = (a: ArticleDoc) =>
  `WORDS · ${a.author.toUpperCase()} · ${a.read} READ` +
  (a.heroImage ? " · PHOTOGRAPHY · E. MARLOWE" : "");

function relatedFor(a: ArticleDoc): RelatedItem[] {
  const all = articleSlugs.map((s) => ARTICLES[s]);
  const sameCat = all.filter((x) => x.category === a.category && x.slug !== a.slug);
  const pool = sameCat.length >= 3 ? sameCat : all.filter((x) => x.slug !== a.slug);
  return pool.slice(0, 3).map((x) => ({
    tag: `${x.category.toUpperCase()} · ${x.issue}`,
    title: x.title,
    image: x.heroImage ?? "/images/hero-cover.jpg",
    href: `/article/${x.slug}`,
  }));
}

/** Demo resolver behind the getArticle() seam: stub → fully-resolved article. */
export function getArticleBySlug(slug: string): ResolvedArticle | null {
  const a = ARTICLES[slug.toLowerCase()];
  if (!a) return null;
  const t = ARTICLE_TEMPLATES[a.template] ?? ARTICLE_TEMPLATES["Feature"];
  return {
    ...a,
    hero: t.hero,
    body: t.body,
    kicker: `${a.category} · No. ${a.issue}`.toUpperCase(),
    byline: composeByline(a),
    authorInitial: (a.author.trim()[0] || "M").toUpperCase(),
    related: relatedFor(a),
  };
}
