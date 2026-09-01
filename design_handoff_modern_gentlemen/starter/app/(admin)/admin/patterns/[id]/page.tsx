import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getDocument } from "@/lib/services/documents";
import { BLOCK_TREE_KEY } from "@/lib/domain/documents";
import type { BlockTree } from "@/lib/blocks/types";
import { BuilderWithTheme as Builder } from "@/components/admin/builder/BuilderWithTheme";

import { createPreviewAction, publishAction, saveDraftAction, snapshotAction } from "./actions";

/**
 * The builder route for a pattern.
 *
 * Deliberately the page route with three values changed — `"pattern"`,
 * `BLOCK_TREE_KEY.pattern` (`blocks`, not `sections`) and the permissions. The
 * builder needed no changes to accept it, which is what
 * `lib/db/repositories/documents.ts` buys by aliasing `name`→`title` and
 * `key`→`slug`: a pattern arrives here in exactly a page's shape.
 */
export default async function PatternBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("pattern.write");
  const pattern = await getDocument("pattern", id);
  if (!pattern) notFound();

  const treeKey = BLOCK_TREE_KEY.pattern;
  const draft = (pattern.draft_data ?? {}) as Record<string, unknown>;
  const rawTree = draft[treeKey];
  const tree: BlockTree = Array.isArray(rawTree) ? (rawTree as BlockTree) : [];

  // Everything in the payload that is not the tree is carried through untouched,
  // so a save never drops a key the builder does not edit.
  const rest = Object.fromEntries(Object.entries(draft).filter(([key]) => key !== treeKey));

  return (
    <Builder
      init={{
        doc: {
          type: "pattern",
          id: pattern.id,
          title: pattern.title,
          slug: pattern.slug,
          status: pattern.status,
          version: pattern.version,
          treeKey,
          rest,
        },
        tree,
      }}
      // Direct references to the "use server" actions — wrapping them in arrow
      // functions here would create closures Next cannot serialize across the
      // boundary. Builder binds the id client-side.
      actions={{
        saveDraft: saveDraftAction,
        publish: publishAction,
        snapshot: snapshotAction,
        createPreview: createPreviewAction,
      }}
      canPublish={user.permissions.has("pattern.publish")}
      canPreview={user.permissions.has("preview.create")}
    />
  );
}
