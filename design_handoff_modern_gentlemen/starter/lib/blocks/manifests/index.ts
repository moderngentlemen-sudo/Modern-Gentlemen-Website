/**
 * The manifest set — one entry per block in `components/sections/registry.ts`.
 *
 * This is the single answer to "what fields does this block have, and what is a
 * valid value?", asked by the insert menu, the properties panel, publish
 * validation, media-usage extraction and the renderer alike.
 *
 * Adding a block: write its component, register it in
 * `components/sections/registry.ts`, add a manifest here. `conformance.test.ts`
 * fails if you do one without the other.
 */

import type { BlockManifest } from "../types";

import { articleGrid } from "./articleGrid";
import { categoryHero } from "./categoryHero";
import { column } from "./column";
import { columns } from "./columns";
import { coverCards } from "./coverCards";
import { ctaBand } from "./ctaBand";
import { editorialHero } from "./editorialHero";
import { editorialFeed } from "./editorialFeed";
import { featureSplit } from "./featureSplit";
import { featuredLead } from "./featuredLead";
import { filmStills } from "./filmStills";
import { heroCoverStar } from "./heroCoverStar";
import { heroStudio } from "./heroStudio";
import { interview } from "./interview";
import { latestGrid } from "./latestGrid";
import { layoutContainer } from "./layoutContainer";
import { manifesto } from "./manifesto";
import { masthead } from "./masthead";
import { newsletter } from "./newsletter";
import {
  nativeButton,
  nativeDivider,
  nativeHeading,
  nativeIcon,
  nativeImage,
  nativeForm,
  nativeProduct,
  nativeEmbed,
  nativeSpacer,
  nativeText,
  nativeVideo,
} from "./nativeElements";
import { numberedIndex } from "./numberedIndex";
import { patternRef } from "./patternRef";
import { documentContent } from "./documentContent";
import { documentContentGap } from "./documentContentGap";
import { productRow } from "./productRow";
import { pullQuote } from "./pullQuote";
import { statsBand } from "./statsBand";
import { storyBand } from "./storyBand";
import { stack } from "./stack";
import { testimonials } from "./testimonials";
import { timeline } from "./timeline";
import { twoUpCategory } from "./twoUpCategory";

export const blockManifests = {
  heroStudio,
  heroCoverStar,
  latestGrid,
  featureSplit,
  twoUpCategory,
  storyBand,
  filmStills,
  newsletter,
  numberedIndex,
  productRow,
  statsBand,
  interview,
  timeline,
  testimonials,
  categoryHero,
  featuredLead,
  articleGrid,
  ctaBand,
  editorialHero,
  editorialFeed,
  manifesto,
  coverCards,
  pullQuote,
  masthead,
  columns,
  column,
  layoutContainer,
  stack,
  nativeHeading,
  nativeText,
  nativeImage,
  nativeVideo,
  nativeEmbed,
  nativeIcon,
  nativeForm,
  nativeProduct,
  nativeButton,
  nativeDivider,
  nativeSpacer,
  patternRef,
  documentContent,
  documentContentGap,
} as const satisfies Record<string, BlockManifest>;

export type ManifestBlockType = keyof typeof blockManifests;

/** Returns `undefined` for an unknown type — callers decide whether that is fatal. */
export function manifestFor(type: string): BlockManifest | undefined {
  return (blockManifests as Record<string, BlockManifest>)[type];
}

export const blockTypes = Object.keys(blockManifests) as ManifestBlockType[];
