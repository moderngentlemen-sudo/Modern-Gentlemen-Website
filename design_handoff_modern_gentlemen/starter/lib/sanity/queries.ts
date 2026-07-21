import { groq } from "next-sanity";

/**
 * Every composable page returns an ordered sections[] array. The projection
 * expands each block's fields (extend per block type you add). SectionRenderer
 * maps _type -> component. See 05_SECTION_BUILDER.md.
 */
const sectionsProjection = groq`
  sections[]{
    _key,
    _type,
    ...,
    "image": image.asset->url,
    media{ kind, videoUrl, "image": image.asset->url },
    items[]{ ..., "image": image.asset->url }
  }
`;

export const homepageQuery = groq`
  *[_type == "page" && slug.current == "home"][0]{ title, ${sectionsProjection} }
`;

export const pageBySlugQuery = groq`
  *[_type == "page" && slug.current == $slug][0]{ title, ${sectionsProjection} }
`;

export const categoryQuery = groq`
  *[_type == "category" && slug.current == $slug][0]{
    title, intro, "heroImage": heroImage.asset->url, ${sectionsProjection}
  }
`;

export const articleQuery = groq`
  *[_type == "article" && slug.current == $slug][0]{
    title, slug, template, excerpt, publishedAt,
    "heroImage": heroImage.asset->url,
    category->{ title, "slug": slug.current },
    body
  }
`;

export const articleSlugsQuery = groq`*[_type == "article"]{ "slug": slug.current }`;
