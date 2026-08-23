import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getDocument } from "@/lib/services/documents";
import { listInsertablePatterns } from "@/lib/services/patterns";
import { DEFAULT_AREA_NAME, areaNamesOf, areaTreeKey, readArea } from "@/lib/blocks/areas";
import { Builder } from "@/components/admin/builder/Builder";

import { createPreviewAction, publishAction, saveDraftAction, snapshotAction } from "./actions";

/**
 * The builder route for a template — the first document type whose payload
 * holds more than one block tree.
 *
 * The other four builder routes pull one array out of the draft under
 * `BLOCK_TREE_KEY[type]`. `BLOCK_TREE_KEY.template` is `null` because a template
 * keeps named areas instead, and that single fact is why templates had no
 * builder route for four phases and no nav entry pointing at one.
 *
 * What closes it is smaller than it looked. `BuilderDocument.treeKey` became a
 * *path* rather than a key, so it can name `areas.main`; the store learned to
 * write back through that path and to swap which area is open; and
 * `AreaSwitcher` chooses. The canvas, the library rail, the properties panel,
 * the drag-and-drop and publishing were untouched — a template is a page with a
 * dropdown above it.
 *
 * ⚠️ **`rest` is the whole draft, areas included**, not the draft minus the
 * tree as it is on every other route. The store holds one area as `tree` and
 * keeps the others in `rest`, so one save still carries the whole document;
 * `payload()` overwrites the open area on the way out.
 */
export default async function TemplateBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("template.write");
  const template = await getDocument("template", id);
  if (!template) notFound();

  // Patterns are offered in the library rail, and reading them needs
  // `pattern.read` — which a template editor is not guaranteed to hold.
  const patterns = user.permissions.has("pattern.read") ? await listInsertablePatterns() : [];

  const draft = (template.draft_data ?? {}) as Record<string, unknown>;

  // A template created before this route existed can legitimately hold `0003`'s
  // `{"areas":{}}` default. Opening it on a synthesised `main` is what stops
  // the builder rendering a document with no tree at all — and because the
  // store writes the open area back on every save, the first save makes the
  // area real.
  const names = areaNamesOf(draft);
  const areaNames = names.length > 0 ? names : [DEFAULT_AREA_NAME];
  const open = areaNames[0];

  return (
    <Builder
      init={{
        doc: {
          type: "template",
          id: template.id,
          title: template.title,
          slug: template.slug,
          status: template.status,
          version: template.version,
          treeKey: areaTreeKey(open),
          rest: draft,
          areaNames,
        },
        tree: readArea(draft, open),
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
      patterns={patterns}
      canPublish={user.permissions.has("template.publish")}
      // Preview is on for templates now. `/preview/[token]` reads areas rather
      // than `BLOCK_TREE_KEY[type]` (which is still `null` here), and the link
      // carries `?area=` for whichever one is open — so what an editor previews
      // is the tree in front of them, not a concatenation of every area that no
      // renderer would ever produce.
      canPreview={user.permissions.has("preview.create")}
    />
  );
}
