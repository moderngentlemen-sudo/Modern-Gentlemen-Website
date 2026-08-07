import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedArticle, listPublishedArticleSlugs } from "@/lib/services/publicEditorial";
import { ReadingProgress } from "@/components/article/ReadingProgress";
import { ArticleHero } from "@/components/article/ArticleHero";
import { ArticleBody } from "@/components/article/ArticleBody";
import { RelatedGrid } from "@/components/article/RelatedGrid";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedArticle(slug);
  if (!a) return { title: "Article not found — Modern Gentlemen" };
  return { title: `${a.title} — Modern Gentlemen`, description: a.dek };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getPublishedArticle(slug);
  if (!a) notFound();

  return (
    <>
      <ReadingProgress />
      <ArticleHero
        variant={a.hero}
        kicker={a.kicker}
        title={a.title}
        dek={a.dek}
        byline={a.byline}
        image={a.heroImage}
        videoUrl={a.videoUrl}
      />
      <ArticleBody
        variant={a.body}
        author={a.author}
        authorInitial={a.authorInitial}
        issue={a.issue}
      />
      <RelatedGrid items={a.related} />
    </>
  );
}
