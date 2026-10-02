import { collectionFromType, editorialConcept } from "@/lib/domain/editorialCollection";
import { editorialCollectionManifests } from "@/lib/blocks/manifests/editorialCollection";
import { collectionType } from "@/lib/domain/editorialCollection";
import type { CollectionProps } from "@/components/sections/EditorialCollection";

const imagery: Record<string, string[]> = {
  Editorial: ["/images/hero-cover.jpg", "/images/style-mono.jpg", "/images/film-tailor.jpg"],
  People: ["/images/style-mono.jpg", "/images/film-watchmaker.jpg", "/images/film-tailor.jpg"],
  Style: [
    "/images/studio/editorial-tailoring.png",
    "/images/style-mono.jpg",
    "/images/grooming.jpg",
  ],
  Motoring: ["/images/hero-cover.jpg", "/images/film-workshop.jpg"],
  Travel: ["/images/studio/mega-menu-architecture.png", "/images/hero-cover.jpg"],
  Design: ["/images/studio/mega-menu-architecture.png", "/images/film-workshop.jpg"],
  Collecting: ["/images/watch-gear.jpg", "/images/film-watchmaker.jpg"],
  Craft: ["/images/film-workshop.jpg", "/images/film-tailor.jpg"],
  Lifestyle: ["/images/grooming.jpg", "/images/style-mono.jpg"],
};
/** Authenticated illustration only; creation always uses clean manifest defaults. */
export function collectionPreview(type: string): CollectionProps {
  const c = collectionFromType(type);
  if (!c) return {};
  return collectionPreviewById(c.id);
}
export function collectionPreviewById(id: string): CollectionProps {
  const c = editorialConcept(id);
  if (!c) return {};
  const photos = imagery[c.group] || [
    "/images/studio/mega-menu-architecture.png",
    "/images/style-mono.jpg",
  ];
  const base = editorialCollectionManifests[collectionType(c.id)].insertDefaults;
  return {
    ...base,
    title: c.name,
    intro:
      "A considered perspective on the people, places and details that give life its character. Take the time to look a little closer.",
    image: photos[0],
    imageAlt: "Illustrative layout photography",
    caption: "Illustrative preview photography",
    items: c.chapters.map((title, i) => ({
      title,
      meta: c.kind === "article" ? undefined : [c.group, "Perspectives", "Details"][i % 3],
      text: "There is a story in the small details: the choice of a material, the rhythm of a place, the care that goes into making something well. This space brings those observations together, with room for a personal point of view.",
      image: photos[(i + 1) % photos.length],
      alt: "Illustrative layout photography",
      caption: "A closer look. Illustrative preview.",
    })),
    quote: "A good story changes the way we see the familiar.",
    attribution: "Illustrative editorial preview",
    facts: [
      { label: "Perspective", value: "Design", alternative: "Craft" },
      { label: "Focus", value: "The details", alternative: "The process" },
    ],
  } as CollectionProps;
}
