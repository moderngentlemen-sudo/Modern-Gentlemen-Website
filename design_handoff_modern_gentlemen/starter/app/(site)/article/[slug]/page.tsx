import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArticleBySlug, articleSlugs } from "@/lib/articles";
import { ReadingProgress } from "@/components/article/ReadingProgress";
import { ArticleHero } from "@/components/article/ArticleHero";
import { ArticleBody } from "@/components/article/ArticleBody";
import { RelatedGrid } from "@/components/article/RelatedGrid";

/** Pre-render every seeded article slug (category links + template showcases). */
export function generateStaticParams() {
  return articleSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticleBySlug(slug);
  if (!a) return { title: "Article not found — Modern Gentlemen" };
  return { title: `${a.title} — Modern Gentlemen`, description: a.dek };
}

/**
 * Article — a template-driven page. The article's `template` selects a hero
 * variant × body variant (lib/articles.ts, transcribed from MG Article.dc.html).
 * Runs on demo data; a Supabase `getArticle(slug)` returning the same resolved
 * shape slots in behind getArticleBySlug. Unknown slug → 404.
 */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getArticleBySlug(slug);
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
