import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getDocument } from "@/lib/services/documents";
import { BLOCK_TREE_KEY } from "@/lib/domain/documents";
import type { BlockTree } from "@/lib/blocks/types";
import { Builder } from "@/components/admin/builder/Builder";

import { createPreviewAction, publishAction, saveDraftAction, snapshotAction } from "./actions";

/**
 * The builder route.
 *
 * A server component that loads the document and hands the client builder its
 * initial state plus the server actions it may call. Nothing else: every write
 * goes through those actions, which go through the services, which check
 * permissions and run against RLS as the editor.
 */
export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("page.write");
  const page = await getDocument("page", id);
  if (!page) notFound();

  const treeKey = BLOCK_TREE_KEY.page;
  const draft = (page.draft_data ?? {}) as Record<string, unknown>;
  const rawTree = draft[treeKey];
  const tree: BlockTree = Array.isArray(rawTree) ? (rawTree as BlockTree) : [];

  // Everything in the payload that is not the tree — seo and so on — is carried
  // through untouched so a save never drops a key the builder does not edit.
  const rest = Object.fromEntries(Object.entries(draft).filter(([key]) => key !== treeKey));

  return (
    <Builder
      init={{
        doc: {
          type: "page",
          id: page.id,
          title: page.title,
          slug: page.slug,
          status: page.status,
          version: page.version,
          treeKey,
          rest,
        },
        tree,
      }}
      callbacks={{
        saveDraft: async (payload) => saveDraftAction({ id, payload }),
        publish: async () => publishAction({ id }),
        snapshot: async () => snapshotAction({ id }),
        createPreview: async (device) => createPreviewAction({ id, device }),
      }}
      canPublish={user.permissions.has("page.publish")}
      canPreview={user.permissions.has("preview.create")}
    />
  );
}
