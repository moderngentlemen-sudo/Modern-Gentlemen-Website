import imageUrlBuilder from "@sanity/image-url";
import { sanityClient } from "./client";

const builder = imageUrlBuilder(sanityClient);

/** Pass a Sanity image reference; chain .width()/.height()/.url() as needed. */
export function urlFor(source: any) {
  return builder.image(source);
}
