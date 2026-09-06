import type { Metadata } from "next";
import { readPageSettings } from "@/lib/domain/pageSettings";
import { pageTitle } from "@/lib/domain/seo";

export function withPageMetadata(base: Metadata, raw: unknown): Metadata {
  const s = readPageSettings(raw);
  if (
    !s.seoTitle &&
    !s.description &&
    !s.socialTitle &&
    !s.socialDescription &&
    !s.socialImage &&
    !s.noIndex
  )
    return base;
  const title = s.seoTitle ? pageTitle(s.seoTitle) : base.title;
  const description = s.description || base.description;
  const socialTitle = s.socialTitle || title;
  const socialDescription = s.socialDescription || description;
  return {
    ...base,
    title,
    description,
    ...(s.noIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      ...base.openGraph,
      title: socialTitle ?? undefined,
      description: socialDescription ?? undefined,
      ...(s.socialImage ? { images: [{ url: s.socialImage }] } : {}),
    },
    twitter: {
      ...base.twitter,
      card: s.socialImage
        ? "summary_large_image"
        : base.twitter && "card" in base.twitter
          ? base.twitter.card
          : "summary",
      title: socialTitle ?? undefined,
      description: socialDescription ?? undefined,
      ...(s.socialImage ? { images: [s.socialImage] } : {}),
    },
  };
}
