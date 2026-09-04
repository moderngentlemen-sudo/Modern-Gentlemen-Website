import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ArticleGrid } from "@/components/sections/ArticleGrid";
import { canonicalSiteUrl } from "@/lib/db/env";
import { canonicalUrl, pageTitle } from "@/lib/domain/seo";
import { listPublishedArticleCards } from "@/lib/services/publicEditorial";

const PAGE_SIZE = 12;

export const revalidate = 3600;

export const metadata: Metadata = {
  title: pageTitle("Articles"),
  description:
    "Every published Modern Gentlemen story, from style and watches to culture and film.",
  alternates: { canonical: canonicalUrl(canonicalSiteUrl(), "/articles") },
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Math.max(parsedPage, 1);
  const { items, total } = await listPublishedArticleCards({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  if (page > pages) redirect(pages === 1 ? "/articles" : `/articles?page=${pages}`);

  return (
    <main className="pb-20">
      <header className="container-mg border-b border-mg-bd/10 pb-10 pt-10 md:pb-14 md:pt-16">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-mg-accentInk">
          The complete archive
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-grotesk text-5xl font-semibold tracking-[-0.04em] text-balance md:text-7xl">
              Every story.
            </h1>
            <p className="mt-5 max-w-2xl font-serif text-xl italic text-mg-fg/60 md:text-2xl">
              The full Modern Gentlemen field guide, including standalone features beyond our
              regular sections.
            </p>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mg-fg/60">
            {total} {total === 1 ? "article" : "articles"}
          </p>
        </div>
      </header>

      {items.length > 0 ? (
        <ArticleGrid
          label={`All stories · Page ${page} of ${pages}`}
          items={items}
          loadMoreHref={null}
        />
      ) : (
        <div className="container-mg py-20 text-center font-serif text-2xl italic text-mg-fg/60">
          No published stories yet.
        </div>
      )}

      {pages > 1 && (
        <nav
          aria-label="Article archive pages"
          className="container-mg mt-12 flex items-center justify-between border-t border-mg-bd/10 pt-6"
        >
          {page > 1 ? (
            <Link
              href={page === 2 ? "/articles" : `/articles?page=${page - 1}`}
              rel="prev"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-mg-fg/70 hover:text-mg-accentInk"
            >
              ← Newer stories
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mg-fg/60">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link
              href={`/articles?page=${page + 1}`}
              rel="next"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-mg-fg/70 hover:text-mg-accentInk"
            >
              Older stories →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
