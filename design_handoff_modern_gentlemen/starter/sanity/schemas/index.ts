// Register every schema type here. Blocks added to the array below also need
// adding to page.sections / category.sections `of: [...]` to be insertable.
import { page } from "./documents/page";
import { article } from "./documents/article";
import { category } from "./documents/category";
import { product } from "./documents/product";

import { imageWithAlt } from "./objects/imageWithAlt";
import { cta } from "./objects/cta";

import { heroCoverStar } from "./blocks/heroCoverStar";
import { latestGrid } from "./blocks/latestGrid";
import { featureSplit } from "./blocks/featureSplit";
import { twoUpCategory } from "./blocks/twoUpCategory";
import { storyBand } from "./blocks/storyBand";
import { filmStills } from "./blocks/filmStills";
import { newsletter } from "./blocks/newsletter";
import { numberedIndex } from "./blocks/numberedIndex";
import { productRow } from "./blocks/productRow";
import { statsBand } from "./blocks/statsBand";
import { interview } from "./blocks/interview";
import { timeline } from "./blocks/timeline";
import { testimonials } from "./blocks/testimonials";

export const blockTypes = [
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
];

export const schemaTypes = [
  page,
  article,
  category,
  product,
  imageWithAlt,
  cta,
  ...blockTypes,
];
