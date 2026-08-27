import { type Block } from "@/components/SectionRenderer";
import { slugify } from "@/lib/domain/slug";
import { getCategory } from "./editorial";

/**
 * A category landing page as an ordered `Block[]` — the shape
 * `categories.published_data` holds and `<SectionRenderer/>` consumes.
 *
 * Two versions live here on purpose, and the relationship between them is the
 * whole verification argument for Phase 7c:
 *
 * - `demoCategorySections(slug)` is the composition `app/(site)/[category]`
 *   performed in code until this phase, moved here unchanged. It is the
 *   **fixture**: the known-good output, with every card written out.
 * - `categoryDocumentSections(slug)` is what `scripts/seed.ts` writes into the
 *   database. Its lead and grid are `$bind` descriptors rather than copied
 *   cards, so the page stays current as articles are published.
 *
 * `tests/integration/publicEditorial.test.ts` resolves the second against
 * Supabase and asserts the normalised props equal the first, block for block.
 * That is what makes "the category pages now read the database" a claim with
 * evidence rather than a hope — and it is only a real assertion because the
 * fixture is seed input, never runtime output.
 */

/** The eyebrow, lead kicker and grid label are all built from these. */
const upperName = (name: string) => name.toUpperCase();

/**
 * The blocks that carry no dynamic content: the hero, whose chips and section
 * number are facts about the category, and the newsletter band.
 *
 * Shared by both versions so a change to the hero cannot silently apply to one
 * and not the other.
 */
function staticBlocks(slug: string): { hero: Block; newsletter: Block } {
  const d = getCategory(slug);
  if (!d) throw new Error(`No demo category "${slug}"`);

  return {
    hero: {
      _key: "hero",
      _type: "categoryHero",
      eyebrow: `MODERN GENTLEMEN · ${d.sectionNo}`,
      title: d.name,
      blurb: d.blurb,
      image: d.heroImage,
      chips: d.subs,
    },
    newsletter: {
      _key: "newsletter",
      _type: "ctaBand",
      variant: "split",
      eyebrow: "THE DEBRIEF",
      heading: `The best of ${d.name}, every Sunday.`,
      buttonLabel: "SUBSCRIBE",
      successLabel: "THANKS ✓",
    },
  };
}

/** The composition the route performed in code before Phase 7c. The fixture. */
export function demoCategorySections(slug: string): Block[] {
  const d = getCategory(slug);
  if (!d) throw new Error(`No demo category "${slug}"`);

  const upper = upperName(d.name);
  const { hero, newsletter } = staticBlocks(slug);

  return [
    hero,
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
    newsletter,
  ];
}

/**
 * The lead and the grid read one ordering — newest issue first — and split it
 * between them. The lead takes the first story; the grid skips it and takes the
 * next six. Without `offset` the grid would start from the same row and repeat
 * the lead as its own first card, which is the reason that field was added to
 * the binding query in this phase.
 */
const listingQuery = (slug: string) => ({
  source: "articles",
  filter: { category: slug },
  sort: { field: "issue", direction: "desc" as const },
});

/** What `scripts/seed.ts` writes into `categories.published_data`. */
export function categoryDocumentSections(slug: string): Block[] {
  const d = getCategory(slug);
  if (!d) throw new Error(`No demo category "${slug}"`);

  const { hero, newsletter } = staticBlocks(slug);

  return [
    hero,
    {
      _key: "lead",
      _type: "featuredLead",
      article: {
        $bind: {
          ...listingQuery(slug),
          limit: 1,
          single: true,
          // The lead's byline prints "7 MIN READ" where a grid card prints
          // "7 MIN". The source offers both forms; naming every key is the cost
          // of renaming one, and `map` builds its output from these entries
          // alone.
          map: {
            kicker: "kicker",
            title: "title",
            dek: "dek",
            author: "author",
            read: "readLong",
            image: "image",
            href: "href",
          },
        },
      },
    },
    {
      _key: "grid",
      _type: "articleGrid",
      label: `MORE IN ${upperName(d.name)}`,
      // No `map`: the source's `tag`, `title`, `read`, `image` and `href` are
      // already the card's own field names, and `project()` drops the rest.
      items: { $bind: { ...listingQuery(slug), offset: 1, limit: 6 } },
    },
    newsletter,
  ];
}
