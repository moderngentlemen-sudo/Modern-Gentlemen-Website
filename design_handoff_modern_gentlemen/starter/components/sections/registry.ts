import type { ComponentType } from "react";
import { blockManifests, blockTypes, type ManifestBlockType } from "@/lib/blocks/manifests";
import type { BlockCategory } from "@/lib/blocks/types";
import { HeroCoverStar } from "./HeroCoverStar";
import { HeroStudio } from "./HeroStudio";
import { SectionStudio } from "./SectionStudio";
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
import { EditorialFeed } from "./EditorialFeed";
import { Manifesto } from "./Manifesto";
import { CoverCards } from "./CoverCards";
import { PullQuote } from "./PullQuote";
import { Masthead } from "./Masthead";
import { Column } from "./Column";
import { PatternRef } from "./PatternRef";
import { DocumentContent } from "./DocumentContent";
import { DocumentContentGap } from "./DocumentContentGap";
import { Columns } from "./Columns";
import { LayoutContainer } from "./LayoutContainer";
import { Stack } from "./Stack";
import {
  NativeButton,
  NativeDivider,
  NativeHeading,
  NativeIcon,
  NativeImage,
  NativeEmbed,
  NativeSpacer,
  NativeText,
} from "../elements/NativeElements";
import { NativeVideo } from "../elements/NativeVideo";
import { NativeProduct } from "../elements/NativeProduct";
import { NativeForm } from "../elements/NativeForm";

/**
 * blockType -> React component. To add a section from the prototype's Section
 * Library: build the component, add it here AND write a manifest in
 * `lib/blocks/manifests/`. `lib/blocks/conformance.test.ts` fails if you do one
 * without the other. See 05_SECTION_BUILDER.md.
 *
 * The manifest cannot live beside the component: `lib/blocks` is a leaf in the
 * layering and may not import from `components/`. This map is therefore the
 * only place the two halves meet, and the conformance suite is what keeps them
 * in step.
 *
 * Keep a MODULE_MAP note (library number -> component + variant) as you port
 * the ~125 modules so nothing is lost.
 */
export const registry = {
  heroStudio: HeroStudio,
  sectionStudio: SectionStudio,
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
  editorialFeed: EditorialFeed,
  manifesto: Manifesto,
  coverCards: CoverCards,
  pullQuote: PullQuote,
  masthead: Masthead,
  columns: Columns,
  column: Column,
  layoutContainer: LayoutContainer,
  stack: Stack,
  nativeHeading: NativeHeading,
  nativeText: NativeText,
  nativeImage: NativeImage,
  nativeVideo: NativeVideo,
  nativeEmbed: NativeEmbed,
  nativeIcon: NativeIcon,
  nativeForm: NativeForm,
  nativeProduct: NativeProduct,
  nativeButton: NativeButton,
  nativeDivider: NativeDivider,
  nativeSpacer: NativeSpacer,
  patternRef: PatternRef,
  documentContent: DocumentContent,
  documentContentGap: DocumentContentGap,
  // Each block owns its own prop contract, so the map is heterogeneous by
  // nature: a lookup by string cannot narrow to one component's props. The
  // manifests restore the guarantee where it counts — content is validated
  // against a per-block Zod schema before it is stored, published or rendered —
  // rather than pretending a dynamic lookup can be statically typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Record<string, ComponentType<any>>;

export type BlockType = keyof typeof registry;

export interface BlockCatalogEntry {
  type: BlockType;
  label: string;
  category: BlockCategory;
  description: string;
  thumb?: string;
}

/**
 * For the drag-and-drop picker gallery. Derived from the manifests rather than
 * hand-written, so a block's human name has exactly one home; the previous
 * hand-kept copy of these labels could — and would eventually — disagree with
 * the block it named.
 */
/**
 * The insert menu's list.
 *
 * `hidden` manifests are filtered out — `column` alone today. It is a real,
 * registered, validated block; it just means nothing outside a `columns` row,
 * which seeds its own. Filtering here rather than in the menu keeps "what an
 * editor may choose" in one place, and leaves `blockTypes` the honest list of
 * everything that exists (which is what the conformance suite walks).
 */
function catalogEntry(type: ManifestBlockType): BlockCatalogEntry {
  const manifest = blockManifests[type];
  return {
    type,
    label: manifest.label,
    category: manifest.category,
    description: manifest.description,
  };
}

export const blockCatalog: BlockCatalogEntry[] = blockTypes
  .filter((type) => !blockManifests[type].hidden && !blockManifests[type].onlyIn)
  .map(catalogEntry);

/**
 * The insert menu's list for one document type.
 *
 * `blockCatalog` above is the unscoped list and stays the default, so nothing
 * that does not care about document types has to learn about them. This adds
 * back the blocks a manifest restricted with `onlyIn` — `documentContent` in a
 * template, and nothing else today.
 *
 * ⚠️ The scoped entries are **appended**, not merged in manifest order, and the
 * grouping in `InsertMenu` re-sorts by category anyway. What matters is that an
 * editor building a template can reach the marker at all: a template whose
 * marker has been deleted is unpublishable, and without a library entry it
 * would also be unrepairable.
 */
export function blockCatalogFor(documentType: string): BlockCatalogEntry[] {
  const scoped = blockTypes
    .filter((type) => {
      const manifest = blockManifests[type];
      return !manifest.hidden && manifest.onlyIn?.includes(documentType);
    })
    .map(catalogEntry);

  return scoped.length ? [...blockCatalog, ...scoped] : blockCatalog;
}
