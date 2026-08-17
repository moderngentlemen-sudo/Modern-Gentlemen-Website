import { requirePermission } from "@/lib/services/auth";
import { listTaxonomy } from "@/lib/services/taxonomy";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { TaxonomyManager, type TaxonomyRow } from "./TaxonomyManager";

/**
 * Categories, tags and authors on one screen.
 *
 * Gated on `article.read` rather than a taxonomy read permission, because 0001
 * seeds `taxonomy.write` and no matching read — the three tables are
 * public-read at the RLS level, so there was never a read permission to grant.
 * `lib/services/taxonomy.ts` records the same reasoning at the layer that
 * enforces it.
 */
export default async function TaxonomyIndex() {
  const user = await requirePermission("article.read");
  const { categories, tags, authors } = await listTaxonomy();

  // Normalised here so `TaxonomyManager` renders one row shape. The columns
  // really are named differently — a tag has `label` where the other two have
  // `name` — and the actions still send the right key for each.
  const categoryRows: TaxonomyRow[] = categories.map((c) => ({
    id: c.id,
    title: c.name,
    slug: c.slug,
    detail: c.intro,
  }));

  const tagRows: TaxonomyRow[] = tags.map((t) => ({
    id: t.id,
    title: t.label,
    slug: t.slug,
    detail: null,
  }));

  const authorRows: TaxonomyRow[] = authors.map((a) => ({
    id: a.id,
    title: a.name,
    slug: a.slug,
    detail: a.role,
  }));

  return (
    <>
      <AdminPageHeader eyebrow="Content" title="Taxonomy">
        <p className="mt-2 text-[13px] text-mg-fg/50">
          The lists articles are filed against. Deleting one never deletes the articles that used it
          — they simply become unfiled. A category also has a page layout of its own, composed in
          the builder.
        </p>
      </AdminPageHeader>

      <TaxonomyManager
        categories={categoryRows}
        tags={tagRows}
        authors={authorRows}
        canWrite={user.permissions.has("taxonomy.write")}
        // A category is a document since `0021`, so composing its page is a
        // separate grant from managing the taxonomy row.
        canEditLayout={user.permissions.has("category.write")}
      />
    </>
  );
}
