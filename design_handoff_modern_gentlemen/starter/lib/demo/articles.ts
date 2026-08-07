import { getCategory, categorySlugs, type CategoryData } from "./editorial";
import { slugify } from "@/lib/domain/slug";
import {
  authorInitial,
  composeByline,
  composeCardTag,
  composeKicker,
  layoutFor,
  FALLBACK_RELATED_IMAGE,
  type ArticleDoc,
  type BodyVariant,
  type HeroVariant,
  type RelatedItem,
  type ResolvedArticle,
} from "@/lib/domain/articles";

/**
 * Article template system (demo data). Each of the 20 named templates is a
 * hero-variant × body-variant combo, transcribed from design_files/MG
 * Article.dc.html `config()`. Article stubs are seeded from the category demo
 * data (`./editorial.ts`) so every /article/{slugify(title)} link the category
 * pages emit resolves, plus a canonical showcase per template so all 20 are
 * reachable. Body *content* is fixed per body-variant and lives in the body
 * components (the prototype's own model).
 *
 * **Seed source and test fixture — not what the site renders.** Since Phase 7c
 * `/article/[slug]` reads the `articles` table through
 * `lib/services/publicEditorial.ts`. The seam this file's header used to promise
 * is now taken: that service produces the very `ResolvedArticle` this module
 * produces, and `tests/integration/publicEditorial.test.ts` asserts the two
 * agree article for article.
 *
 * The *layout* half of a template — which hero, which body — moved to
 * `lib/domain/articles.ts`, because the public route needs it and must not
 * import a demo module. What stays here is the placeholder copy.
 */

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

const CATEGORY_AUTHOR: Record<string, string> = {
  Style: "S. Okafor",
  Grooming: "J. Rees",
  Watches: "C. Vance",
  Culture: "A. Bellamy",
  Film: "D. Whitfield",
};

const normalizeRead = (r: string) => r.replace(/\s*(READ|FILM)\s*$/i, "").trim();
const parseNo = (tag: string) => tag.match(/(\d+)\s*$/)?.[1] ?? "";

/**
 * Which category each article is *listed under*, by slug — the filing, as
 * distinct from `ArticleDoc.category`, which is the label the design prints.
 *
 * Only the thirty-five stories the category pages show are filed. The twenty
 * template showcases and the homepage cover story are not, and that is
 * load-bearing rather than incidental: several of them carry labels like
 * "Culture" at issue "042" — the same issue as the Culture lead — so filing them
 * would tie in the `issue desc` ordering a category page reads and silently
 * displace the lead. The demo pages never list them either, so an unfiled
 * showcase is the faithful reading as well as the safe one.
 *
 * `scripts/seed.ts` writes `articles.category_id` from this map.
 */
export const FILED_UNDER: Record<string, string> = {};

/**
 * An article's subcategory, as its card prints it: "TAILORING · 040" is tag
 * "Tailoring", not category "Style". Seeded into `tags` + `article_tags`, which
 * is what lets the database reproduce a card tag the category name alone cannot.
 *
 * A lead has no entry — its card prints the category, which is the fallback
 * `lib/services/bindingSources.ts` applies when an article carries no tag.
 */
export const CARD_TAG_LABEL: Record<string, string> = {};

/**
 * The card tag's label half, matched back to the category's own chip list so it
 * keeps the chips' capitalisation ("The Uniform", not "THE UNIFORM"). The last
 * card in every category is tagged with the category itself and matches nothing,
 * which is why the fallback is the category name rather than an error.
 */
function tagLabelOf(tag: string, category: CategoryData): string {
  const label = tag.replace(/\s*·\s*\d+\s*$/, "").trim();
  return category.subs.find((sub) => sub.toUpperCase() === label.toUpperCase()) ?? category.name;
}

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
      FILED_UNDER[leadSlug] = cslug;
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
      FILED_UNDER[s] = cslug;
      CARD_TAG_LABEL[s] = tagLabelOf(c.tag, d);
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
      // `|| undefined` rather than the empty string: an absent video and a video
      // whose URL is "" render identically, but only one of them survives a
      // round trip through the database, and the two representations have to
      // agree for `publicEditorial.test.ts` to compare them.
      videoUrl: t.hero === "video" ? DEFAULT_HERO_VIDEO || undefined : undefined,
    };
  }
  return out;
}

export const ARTICLES = buildArticles();
export const articleSlugs = Object.keys(ARTICLES);

export function relatedFor(a: ArticleDoc): RelatedItem[] {
  const all = articleSlugs.map((s) => ARTICLES[s]);
  const sameCat = all.filter((x) => x.category === a.category && x.slug !== a.slug);
  const pool = sameCat.length >= 3 ? sameCat : all.filter((x) => x.slug !== a.slug);
  return pool.slice(0, 3).map((x) => ({
    tag: composeCardTag(x.category, x.issue),
    title: x.title,
    image: x.heroImage ?? FALLBACK_RELATED_IMAGE,
    href: `/article/${x.slug}`,
  }));
}

/** Demo resolver: stub → fully-resolved article, the same shape the service returns. */
export function getArticleBySlug(slug: string): ResolvedArticle | null {
  const a = ARTICLES[slug.toLowerCase()];
  if (!a) return null;
  return {
    ...a,
    ...layoutFor(a.template),
    kicker: composeKicker(a),
    byline: composeByline(a),
    authorInitial: authorInitial(a.author),
    related: relatedFor(a),
  };
}
