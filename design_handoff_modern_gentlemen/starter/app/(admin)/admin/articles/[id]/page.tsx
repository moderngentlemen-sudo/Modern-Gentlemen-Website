import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getDocument } from "@/lib/services/documents";
import { getArticleMeta, getArticleTagIds } from "@/lib/services/articles";
import { getAsset } from "@/lib/services/media";
import { listTaxonomy } from "@/lib/services/taxonomy";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/admin/ui/Button";
import { StatusPill } from "@/components/admin/ui/Badge";

import { ArticleDetails } from "./ArticleDetails";

/**
 * An article's details screen.
 *
 * Unlike `/admin/pages/[id]`, this is **not** the builder. An article's primary
 * editing surface is its metadata — which of the twenty templates renders it,
 * who wrote it, what it is filed under — and the block tree is the secondary,
 * optional part. The builder is one click away at `./builder`, and it is the
 * same `Builder` component the pages route uses, unchanged.
 *
 * The layout also forced the split: `Builder` is `h-screen` and owns the whole
 * viewport, so a metadata panel could not have sat beside it.
 */
export default async function ArticleDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("article.read");

  const [document, meta] = await Promise.all([getDocument("article", id), getArticleMeta(id)]);
  if (!document || !meta) notFound();

  const [tagIds, taxonomy] = await Promise.all([getArticleTagIds(id), listTaxonomy()]);

  // Resolved here rather than joined in the repository: it is one row, only
  // when a featured image is set, and keeping `getArticleMeta` a plain column
  // read leaves it usable from anywhere.
  const featured = meta.featured_asset_id ? await getAsset(meta.featured_asset_id) : null;

  const canWrite = user.permissions.has("article.write");

  return (
    <>
      <AdminPageHeader
        eyebrow="Article"
        title={document.title}
        actions={
          <>
            <Button href={`/admin/articles/${id}/builder`} variant="outline" size="sm">
              Compose sections
            </Button>
            <Button href={`/admin/articles/${id}/history`} variant="ghost" size="sm">
              History
            </Button>
          </>
        }
      >
        <p className="mt-2 flex items-center gap-2 text-[13px] text-mg-fg/50">
          <span className="font-mono">/article/{document.slug}</span>
          <StatusPill status={document.status} />
          <span className="font-mono">v{document.version}</span>
        </p>
      </AdminPageHeader>

      <ArticleDetails
        initial={{
          id,
          title: meta.title,
          slug: meta.slug,
          subtitle: meta.subtitle,
          excerpt: meta.excerpt,
          template: meta.template,
          categoryId: meta.category_id,
          authorId: meta.author_id,
          featuredAssetId: meta.featured_asset_id,
          featuredAssetUrl: featured?.url ?? null,
          readingMinutes: meta.reading_minutes,
          issueNo: meta.issue_no,
          tagIds,
        }}
        categories={taxonomy.categories.map((c) => ({ id: c.id, label: c.name }))}
        authors={taxonomy.authors.map((a) => ({ id: a.id, label: a.name }))}
        tags={taxonomy.tags.map((t) => ({ id: t.id, label: t.label }))}
        canWrite={canWrite}
      />
    </>
  );
}
