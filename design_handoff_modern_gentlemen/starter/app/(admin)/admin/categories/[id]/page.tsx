import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getDocument } from "@/lib/services/documents";
import { listInsertablePatterns } from "@/lib/services/patterns";
import { BLOCK_TREE_KEY } from "@/lib/domain/documents";
import type { BlockTree } from "@/lib/blocks/types";
import { Builder } from "@/components/admin/builder/Builder";

import { createPreviewAction, publishAction, saveDraftAction, snapshotAction } from "./actions";

/**
 * The builder route for a category page.
 *
 * `/[category]` has rendered `categories.published_data` since Phase 7c — the
 * page has been live and uneditable that whole time, because
 * `lib/services/taxonomy.ts` deliberately never touched `draft_data` and
 * `document_table()` did not list categories. `0021` moved that line; this is
 * the screen it was waiting for.
 *
 * ⚠️ **A category's payload is not only its own sections.** `featuredLead` and
 * `articleGrid` hold `$bind` descriptors resolved against the `articles` table
 * at render time, so an editor is arranging a layout whose *content* still
 * comes from published articles. That is also why publishing an article
 * revalidates two paths — see `revalidatePublicArticle`.
 */
export default async function CategoryBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("category.write");
  const category = await getDocument("category", id);
  if (!category) notFound();

  const patterns = user.permissions.has("pattern.read") ? await listInsertablePatterns() : [];

  const treeKey = BLOCK_TREE_KEY.category;
  const draft = (category.draft_data ?? {}) as Record<string, unknown>;
  const rawTree = draft[treeKey];
  const tree: BlockTree = Array.isArray(rawTree) ? (rawTree as BlockTree) : [];

  // Everything in the payload that is not the tree — `seo` and so on — is
  // carried through untouched so a save never drops a key the builder does not
  // edit.
  const rest = Object.fromEntries(Object.entries(draft).filter(([key]) => key !== treeKey));

  return (
    <Builder
      init={{
        doc: {
          type: "category",
          id: category.id,
          title: category.title,
          slug: category.slug,
          status: category.status,
          version: category.version,
          treeKey,
          rest,
        },
        tree,
      }}
      actions={{
        saveDraft: saveDraftAction,
        publish: publishAction,
        snapshot: snapshotAction,
        createPreview: createPreviewAction,
      }}
      patterns={patterns}
      canPublish={user.permissions.has("category.publish")}
      canPreview={user.permissions.has("preview.create")}
    />
  );
}
