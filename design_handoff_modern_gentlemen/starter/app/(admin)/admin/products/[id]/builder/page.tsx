import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getDocument } from "@/lib/services/documents";
import { listInsertablePatterns } from "@/lib/services/patterns";
import { BLOCK_TREE_KEY } from "@/lib/domain/documents";
import type { BlockTree } from "@/lib/blocks/types";
import { BuilderWithTheme as Builder } from "@/components/admin/builder/BuilderWithTheme";

import { createPreviewAction, publishAction, saveDraftAction, snapshotAction } from "../actions";
import { createPatternFromSelectionAction } from "@/app/(admin)/admin/patterns/actions";

/**
 * The product builder.
 *
 * The same `Builder` component the pages and articles routes render, with
 * `type: "product"`. This is the third document type to fit without a builder
 * change, for the reason Phase 3 gave and Phase 5b confirmed:
 * `BLOCK_TREE_KEY.product` is `sections`, one ordered list, which is exactly
 * what the builder was written for. Templates remain the type that would need
 * an area switcher.
 *
 * `rest` carries `seo` through untouched — a product's payload holds more than
 * its section tree, and a save must not drop the keys the builder does not edit.
 */
export default async function ProductBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("product.write");
  const product = await getDocument("product", id);
  if (!product) notFound();

  const patterns = user.permissions.has("pattern.read") ? await listInsertablePatterns() : [];

  const treeKey = BLOCK_TREE_KEY.product;
  const draft = (product.draft_data ?? {}) as Record<string, unknown>;
  const rawTree = draft[treeKey];
  const tree: BlockTree = Array.isArray(rawTree) ? (rawTree as BlockTree) : [];
  const rest = Object.fromEntries(Object.entries(draft).filter(([key]) => key !== treeKey));

  return (
    <Builder
      init={{
        doc: {
          type: "product",
          id: product.id,
          title: product.title,
          slug: product.slug,
          status: product.status,
          version: product.version,
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
        ...(user.permissions.has("pattern.write")
          ? { createPatternFromSelection: createPatternFromSelectionAction }
          : {}),
      }}
      patterns={patterns}
      canPublish={user.permissions.has("product.publish")}
      canPreview={user.permissions.has("preview.create")}
    />
  );
}
