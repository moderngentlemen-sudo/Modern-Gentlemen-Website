import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getDocument } from "@/lib/services/documents";
import { listInsertablePatterns } from "@/lib/services/patterns";
import { BLOCK_TREE_KEY } from "@/lib/domain/documents";
import type { BlockTree } from "@/lib/blocks/types";
import { BuilderWithTheme as Builder } from "@/components/admin/builder/BuilderWithTheme";

import { createPreviewAction, publishAction, saveDraftAction, snapshotAction } from "./actions";
import { createPatternFromSelectionAction } from "@/app/(admin)/admin/patterns/actions";

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

  // Patterns are offered in the library rail, and reading them needs
  // `pattern.read` — which a page editor is not guaranteed to hold. Checked
  // here rather than caught around the call, because `listInsertablePatterns`
  // *throws* on a missing permission and a swallowed throw would hide a real
  // failure just as effectively as a missing permission.
  const patterns = user.permissions.has("pattern.read") ? await listInsertablePatterns() : [];

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
      // Direct references to the "use server" actions. Wrapping them in arrow
      // functions here would create ordinary closures in a Server Component,
      // which Next cannot serialize to a Client Component — the builder threw
      // on every load until this was corrected. Builder binds the id client-side.
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
      canPublish={user.permissions.has("page.publish")}
      canPreview={user.permissions.has("preview.create")}
    />
  );
}
