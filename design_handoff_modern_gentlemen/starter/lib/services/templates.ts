/**
 * Templates — layouts, and the rule that decides which record gets which one.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/templates";
import { DEFAULT_AREA_NAME } from "@/lib/blocks/areas";
import type { BlockNode, BlockTree } from "@/lib/blocks/types";
import { DOCUMENT_CONTENT_TYPE } from "@/lib/blocks/templateContent";
import type { Json } from "@/lib/db/database.types";
import { publicPathForPage } from "@/lib/domain/routes";
import { requirePermission } from "./auth";

export type { TemplateRow } from "@/lib/db/repositories/templates";
export type { TemplateKind } from "@/lib/domain/templates";

export async function listTemplates(options: { kind?: repo.TemplateKind } = {}) {
  await requirePermission("template.read");
  const db = await createClient();
  return repo.listTemplates(db, options);
}

export async function getTemplate(id: string) {
  await requirePermission("template.read");
  const db = await createClient();
  return repo.getTemplate(db, id);
}

export async function getTemplateByKey(key: string) {
  await requirePermission("template.read");
  const db = await createClient();
  return repo.getTemplateByKey(db, key);
}

/**
 * The `documentContent` marker a new template is born with.
 *
 * Built as a literal rather than through `newBlockNode`, which lives in
 * `components/admin/builder/` — a service may not import the builder, and the
 * layering rule that says so is the same one `lib/domain` is kept pure by. The
 * only thing `newBlockNode` would add here is a random key, and a template
 * created with exactly one block has nothing for it to collide with.
 *
 * ⚠️ **A template arrives able to publish.** The area default used to be an
 * empty list, and with `validateTemplateAreas` in place that would mean every
 * newly created template failed its own publish check — a first-run experience
 * where the tool refuses the thing it just made. Same reasoning as the area
 * itself arriving as `main` rather than `{}`, and as a `columns` row arriving
 * holding two columns.
 */
function newContentMarker(): BlockNode {
  return { _key: "pagecontent", _type: DOCUMENT_CONTENT_TYPE, settings: {} };
}

export async function createTemplate(input: {
  key: string;
  kind: repo.TemplateKind;
  name: string;
  description?: string;
  isGlobal?: boolean;
  areas?: Record<string, BlockTree>;
}) {
  const user = await requirePermission("template.write");
  const db = await createClient();

  return repo.createTemplate(db, {
    key: input.key,
    kind: input.kind,
    name: input.name,
    description: input.description,
    isGlobal: input.isGlobal,
    // Templates hold named areas rather than one ordered list — see
    // BLOCK_TREE_KEY in lib/domain/documents.ts.
    //
    // ⚠️ **One area, not none.** `0003` defaults the column to `{"areas":{}}`
    // and this used to pass that through, which produced a template the builder
    // could open and then had no tree to show — the area switcher's own "add an
    // area" being the only way out of a state nothing announced. A template
    // arrives with `main`, exactly as a `columns` row arrives holding two
    // columns rather than empty.
    draftData: {
      areas: input.areas ?? { [DEFAULT_AREA_NAME]: [newContentMarker()] },
    } as unknown as Json,
    createdBy: user.id,
  });
}

/**
 * The template that applies to one record.
 *
 * Resolution is most-specific-first — entry > taxonomy > content_type — which
 * is the order `0003_content_spine.sql` documents and whose unique indexes make
 * "most specific" unambiguous.
 */
export async function resolveTemplateFor(target: {
  contentType: string;
  taxonomySlug?: string | null;
  entryId?: string | null;
}) {
  const db = await createClient();
  const id = await repo.resolveTemplateId(db, target);
  return id ? repo.getTemplate(db, id) : null;
}

/**
 * The public paths a template's publish invalidates.
 *
 * **This is the shape `revalidatePublicPage` does not have**, and the templates
 * phase predicted it would not: a page maps to one path, a template maps to
 * every record assigned to it. The two assignment scopes that reach a page:
 *
 *   * `entry` — one page, by id.
 *   * `content_type` — every published page of that type.
 *
 * `taxonomy` is skipped rather than unimplemented: a page carries no taxonomy,
 * and the scope exists for the `article`/`archive` kinds that will resolve
 * against a category. When a renderer for those lands this function grows a
 * branch; until then, inventing one would be dead code that looks tested.
 *
 * ⚠️ **Only `page` templates return anything today**, because `/` is the only
 * public route that renders a document through a template. A published
 * `article` or `product` template genuinely changes no path, and returning an
 * empty list is the honest answer rather than a missing case.
 */
export async function publicPathsForTemplate(id: string): Promise<string[]> {
  const db = await createClient();
  const template = await repo.getTemplate(db, id);
  if (!template || template.kind !== "page") return [];

  const { data: assignments, error } = await db
    .from("template_assignments")
    .select("scope, entry_id")
    .eq("template_id", id);

  if (error) throw new Error(`Could not read this template's assignments: ${error.message}`);
  if (!assignments?.length) return [];

  const wholeType = assignments.some((row) => row.scope === "content_type");
  const entryIds = assignments
    .filter((row) => row.scope === "entry" && row.entry_id)
    .map((row) => row.entry_id as string);

  let query = db.from("pages").select("slug").eq("status", "published");
  if (!wholeType) {
    if (entryIds.length === 0) return [];
    query = query.in("id", entryIds);
  }

  const { data: pages, error: pageError } = await query;
  if (pageError)
    throw new Error(`Could not read the pages this template frames: ${pageError.message}`);

  return (pages ?? []).map((page) => publicPathForPage(page.slug));
}
