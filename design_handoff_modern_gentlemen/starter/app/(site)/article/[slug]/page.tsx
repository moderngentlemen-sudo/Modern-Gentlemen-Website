import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getPublishedArticle,
  getPublishedArticleBuilder,
  listPublishedArticleSlugs,
} from "@/lib/services/publicEditorial";
import { composePublishedDocument } from "@/lib/services/publicContent";
import { SectionRenderer } from "@/components/SectionRenderer";
import { ReadingProgress } from "@/components/article/ReadingProgress";
import { ArticleHero } from "@/components/article/ArticleHero";
import { ArticleBody } from "@/components/article/ArticleBody";
import { ArticleFeaturedMedia } from "@/components/article/ArticleFeaturedMedia";
import { RelatedGrid } from "@/components/article/RelatedGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalSiteUrl } from "@/lib/db/env";
import { articleJsonLd, canonicalUrl, metaDescription, pageTitle } from "@/lib/domain/seo";
import { publicPathForArticle } from "@/lib/domain/routes";

/**
 * Article — a template-driven page, reading the `articles` table since Phase 7c.
 *
 * The `template` column names one of the twenty templates and
 * `lib/domain/articles.ts` maps it to a hero variant × body variant; the body's
 * *content* is fixed per variant and lives in `components/article/*`, which is
 * the design prototype's own model and not something a row carries.
 *
 * `getPublishedArticle` returns the very `ResolvedArticle` shape
 * `lib/demo/articles.ts` produced, so the four components below take the props
 * they were pixel-verified against. Unknown or unpublished slug → 404.
 *
 * Statically rendered: the read is cookie-free, so Next prerenders every
 * published article at build time.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await listPublishedArticleSlugs()).map((slug) => ({ slug }));
}

/**
 * The title suffix here is now `pageTitle`'s rather than this file's own
 * template literal. It was the convention the rest of the site is being brought
 * in line with, and leaving the one hand-written copy would mean the definition
 * lives in two places — which is how a redesign of the suffix later reaches five
 * routes and misses this one.
 *
 * `openGraph.type: "article"` is the difference that matters for sharing: it is
 * what makes a link preview carry a byline and a date rather than render as a
 * generic website card.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedArticle(slug);
  if (!a) return { title: pageTitle("Article not found") };

  const url = canonicalUrl(canonicalSiteUrl(), publicPathForArticle(a.slug));
  const description = metaDescription(a.dek);

  return {
    title: pageTitle(a.title),
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: pageTitle(a.title),
      description,
      url,
      ...(a.heroImage ? { images: [canonicalUrl(canonicalSiteUrl(), a.heroImage)] } : {}),
      ...(a.author ? { authors: [a.author] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [a, builder] = await Promise.all([
    getPublishedArticle(slug),
    getPublishedArticleBuilder(slug),
  ]);
  if (!a || !builder) notFound();
  const composed = await composePublishedDocument("article", builder.id, builder.sections);

  return (
    <>
      {/*
       * Article structured data. **No `datePublished`, deliberately.**
       * `articles.published_at` exists in the database, but `ResolvedArticle` does
       * not carry it, and adding it would break the whole-object deep-compare in
       * `publicEditorial.test.ts` — which compares the service's output to
       * `lib/demo/articles.ts`, a fixture that cannot know a timestamp the publish
       * action writes. Threading the date through is a real improvement and is
       * recorded as one in PROGRESS.md; inventing one here to fill the field would
       * be a false claim about when something was written.
       */}
      <JsonLd
        data={articleJsonLd(canonicalSiteUrl(), {
          title: a.title,
          slug: a.slug,
          dek: a.dek,
          author: a.author,
          image: a.heroImage,
        })}
      />
      <ReadingProgress />
      {composed ? (
        <SectionRenderer sections={composed} />
      ) : (
        <>
          <ArticleHero
            variant={a.hero}
            kicker={a.kicker}
            title={a.title}
            dek={a.dek}
            byline={a.byline}
            image={a.heroImage}
            videoUrl={a.videoUrl}
          />
          {a.featuredMedia &&
            (a.featuredMedia.kind === "gallery" ||
              a.featuredMedia.kind === "embed" ||
              (a.featuredMedia.kind === "video" && a.hero !== "video")) && (
              <ArticleFeaturedMedia media={a.featuredMedia} />
            )}
          <ArticleBody
            variant={a.body}
            author={a.author}
            authorInitial={a.authorInitial}
            issue={a.issue}
          />
          <RelatedGrid items={a.related} />
        </>
      )}
    </>
  );
}
