import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/services/auth";
import { listArticles } from "@/lib/services/articles";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ArticlesList, type ArticleRow } from "./ArticlesList";

const PAGE_SIZE = 25;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ArticlesIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  // The route's own gate. The layout proves the visitor is staff; this proves
  // they may read articles specifically.
  const user = await requirePermission("article.read");
  const params = await searchParams;
  const search = first(params.q).trim().slice(0, 100);
  const requestedPage = Number.parseInt(first(params.page), 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const { articles, total } = await listArticles({
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total > 0 && page > pageCount) {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (pageCount > 1) query.set("page", String(pageCount));
    redirect(`/admin/articles${query.size ? `?${query}` : ""}`);
  }

  return (
    <>
      <AdminPageHeader eyebrow="Content" title="Articles">
        <p className="mt-2 text-[13px] text-mg-fg/60">
          Editorial, on the twenty-template library. Sections beyond the template are composed in
          the builder.
        </p>
      </AdminPageHeader>

      <ArticlesList
        articles={articles as ArticleRow[]}
        search={search}
        total={total}
        page={page}
        pageCount={pageCount}
        canWrite={user.permissions.has("article.write")}
        canDelete={user.permissions.has("article.delete")}
      />
    </>
  );
}
