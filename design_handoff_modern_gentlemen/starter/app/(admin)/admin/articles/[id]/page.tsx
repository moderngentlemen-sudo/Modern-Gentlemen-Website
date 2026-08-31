import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getDocument, listDocuments } from "@/lib/services/documents";
import { getArticleMeta, getArticleRelatedIds, getArticleTagIds } from "@/lib/services/articles";
import { getAsset } from "@/lib/services/media";
import { listTaxonomy } from "@/lib/services/taxonomy";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/admin/ui/Button";
import { StatusPill } from "@/components/admin/ui/Badge";

import { ArticleDetails } from "./ArticleDetails";
import { articleFeaturedMediaOf, type ArticleFeaturedMedia } from "@/lib/domain/articles";

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

  const [tagIds, relatedIds, taxonomy, allArticles] = await Promise.all([
    getArticleTagIds(id),
    getArticleRelatedIds(id),
    listTaxonomy(),
    // The KEEP READING picker's candidates. `limit` is generous rather than
    // paginated: the list is a `<select>`, and 53 articles is the size this
    // site is. If the archive outgrows a dropdown, the control needs a search
    // box, which is a different change from raising a number.
    listDocuments("article", { limit: 200 }),
  ]);

  // Resolved here rather than joined in the repository: it is one row, only
  // when a featured image is set, and keeping `getArticleMeta` a plain column
  // read leaves it usable from anywhere.
  const featured = meta.featured_asset_id ? await getAsset(meta.featured_asset_id) : null;
  const storedMedia = articleFeaturedMediaOf(document.draft_data, true);
  const cover = featured
    ? {
        assetId: featured.id,
        url: featured.url,
        kind: (featured.kind === "gif" ? "gif" : "image") as "gif" | "image",
        ...(featured.altText ? { alt: featured.altText } : {}),
      }
    : storedMedia?.cover;
  const featuredMedia: ArticleFeaturedMedia = {
    ...(storedMedia ?? { kind: cover?.kind ?? "image" }),
    ...(cover ? { cover } : {}),
  };

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
        <p className="mt-2 flex items-center gap-2 text-[13px] text-mg-fg/60">
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
          featuredAssetId: meta.featured_asset_id ?? cover?.assetId ?? null,
          featuredAssetUrl: featured?.url ?? cover?.url ?? null,
          featuredMedia,
          readingMinutes: meta.reading_minutes,
          issueNo: meta.issue_no,
          tagIds,
          relatedIds,
        }}
        categories={taxonomy.categories.map((c) => ({ id: c.id, label: c.name }))}
        authors={taxonomy.authors.map((a) => ({ id: a.id, label: a.name }))}
        tags={taxonomy.tags.map((t) => ({ id: t.id, label: t.label }))}
        // Itself excluded: `article_relation_not_self` forbids the row, so
        // offering it would be offering a save that cannot succeed.
        relatedCandidates={allArticles
          .filter((article) => article.id !== id)
          .map((article) => ({
            id: article.id,
            title: article.title,
            status: article.status,
          }))}
        canWrite={canWrite}
      />
    </>
  );
}
