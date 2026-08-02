import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getDocument } from "@/lib/services/documents";
import { BLOCK_TREE_KEY } from "@/lib/domain/documents";
import type { BlockTree } from "@/lib/blocks/types";
import { Builder } from "@/components/admin/builder/Builder";

import { createPreviewAction, publishAction, saveDraftAction, snapshotAction } from "../actions";

/**
 * The article builder.
 *
 * The same `Builder` component the pages route renders, with `type: "article"`.
 * PROGRESS.md predicted this would fit as-is and it does: `BLOCK_TREE_KEY.article`
 * is `sections`, one ordered list, which is exactly what the builder was written
 * for. Templates are the type that would need an area switcher, and they remain
 * unbuilt for that reason.
 *
 * `rest` carries `hero`, `body` and `seo` through untouched — an article's
 * payload holds more than its section tree, and a save must not drop the keys
 * the builder does not edit.
 */
export default async function ArticleBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("article.write");
  const article = await getDocument("article", id);
  if (!article) notFound();

  const treeKey = BLOCK_TREE_KEY.article;
  const draft = (article.draft_data ?? {}) as Record<string, unknown>;
  const rawTree = draft[treeKey];
  const tree: BlockTree = Array.isArray(rawTree) ? (rawTree as BlockTree) : [];
  const rest = Object.fromEntries(Object.entries(draft).filter(([key]) => key !== treeKey));

  return (
    <Builder
      init={{
        doc: {
          type: "article",
          id: article.id,
          title: article.title,
          slug: article.slug,
          status: article.status,
          version: article.version,
          treeKey,
          rest,
        },
        tree,
      }}
      // Direct references to the "use server" actions. Wrapping them in arrows
      // here would create ordinary closures in a Server Component, which Next
      // cannot serialize — the failure that threw on every builder load in
      // Phase 4. Builder binds the id client-side.
      actions={{
        saveDraft: saveDraftAction,
        publish: publishAction,
        snapshot: snapshotAction,
        createPreview: createPreviewAction,
      }}
      canPublish={user.permissions.has("article.publish")}
      canPreview={user.permissions.has("preview.create")}
    />
  );
}
