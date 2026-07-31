import type { ComponentType } from "react";
import { HeroCoverStar } from "./HeroCoverStar";
import { LatestGrid } from "./LatestGrid";
import { FeatureSplit } from "./FeatureSplit";
import { TwoUpCategory } from "./TwoUpCategory";
import { StoryBand } from "./StoryBand";
import { FilmStills } from "./FilmStills";
import { Newsletter } from "./Newsletter";
import { NumberedIndex } from "./NumberedIndex";
import { ProductRow } from "./ProductRow";
import { StatsBand } from "./StatsBand";
import { Interview } from "./Interview";
import { Timeline } from "./Timeline";
import { Testimonials } from "./Testimonials";
import { CategoryHero } from "./CategoryHero";
import { FeaturedLead } from "./FeaturedLead";
import { ArticleGrid } from "./ArticleGrid";
import { CtaBand } from "./CtaBand";
import { EditorialHero } from "./EditorialHero";
import { Manifesto } from "./Manifesto";
import { CoverCards } from "./CoverCards";
import { PullQuote } from "./PullQuote";
import { Masthead } from "./Masthead";

/**
 * blockType -> React component. To add a section from the prototype's Section
 * Library: build the component, add it here AND to the Sanity schema
 * (sanity/schemas/index.ts blockTypes). See 05_SECTION_BUILDER.md.
 *
 * Keep a MODULE_MAP note (library number -> component + variant) as you port
 * the ~125 modules so nothing is lost.
 */
export const registry = {
  heroCoverStar: HeroCoverStar,
  latestGrid: LatestGrid,
  featureSplit: FeatureSplit,
  twoUpCategory: TwoUpCategory,
  storyBand: StoryBand,
  filmStills: FilmStills,
  newsletter: Newsletter,
  numberedIndex: NumberedIndex,
  productRow: ProductRow,
  statsBand: StatsBand,
  interview: Interview,
  timeline: Timeline,
  testimonials: Testimonials,
  categoryHero: CategoryHero,
  featuredLead: FeaturedLead,
  articleGrid: ArticleGrid,
  ctaBand: CtaBand,
  editorialHero: EditorialHero,
  manifesto: Manifesto,
  coverCards: CoverCards,
  pullQuote: PullQuote,
  masthead: Masthead,
  // Each block owns its own prop contract, so the registry is deliberately
  // heterogeneous and cannot be typed more tightly here. Phase 2 replaces this
  // with `defineBlock()` manifests, which restore per-block type safety via
  // Zod schemas. Until then this stays an explicit, documented exception.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Record<string, ComponentType<any>>;

export type BlockType = keyof typeof registry;

/** For the drag-and-drop picker gallery: label + optional thumbnail per block. */
export const blockCatalog: { type: BlockType; label: string; thumb?: string }[] = [
  { type: "heroCoverStar", label: "Hero — Cover Star" },
  { type: "latestGrid", label: "The Latest — grid" },
  { type: "featureSplit", label: "Feature — split" },
  { type: "twoUpCategory", label: "Two-up category" },
  { type: "storyBand", label: "Story band" },
  { type: "filmStills", label: "MG Film — stills" },
  { type: "newsletter", label: "Newsletter" },
  { type: "numberedIndex", label: "The Index — numbered list" },
  { type: "productRow", label: "Store — product row" },
  { type: "statsBand", label: "By the Numbers — stats" },
  { type: "interview", label: "The Interview — Q&A" },
  { type: "timeline", label: "Timeline — a brief history" },
  { type: "testimonials", label: "Member Voices" },
  { type: "categoryHero", label: "Category — hero band" },
  { type: "featuredLead", label: "Category — featured lead" },
  { type: "articleGrid", label: "Article grid" },
  { type: "ctaBand", label: "CTA band (red)" },
  { type: "editorialHero", label: "Editorial page hero" },
  { type: "manifesto", label: "Manifesto — two-column" },
  { type: "coverCards", label: "What we cover — cards" },
  { type: "pullQuote", label: "Pull quote" },
  { type: "masthead", label: "The Masthead — team" },
];
