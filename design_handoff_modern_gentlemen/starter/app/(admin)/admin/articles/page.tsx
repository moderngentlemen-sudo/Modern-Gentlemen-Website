import { requirePermission } from "@/lib/services/auth";
import { listDocuments } from "@/lib/services/documents";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ArticlesList, type ArticleRow } from "./ArticlesList";

export default async function ArticlesIndex() {
  // The route's own gate. The layout proves the visitor is staff; this proves
  // they may read articles specifically.
  const user = await requirePermission("article.read");

  // The polymorphic document repository serves articles unchanged — the same
  // versioning columns, the same list shape. Nothing here is article-specific.
  const articles = await listDocuments("article", { limit: 100 });

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
        canWrite={user.permissions.has("article.write")}
        canDelete={user.permissions.has("article.delete")}
      />
    </>
  );
}
