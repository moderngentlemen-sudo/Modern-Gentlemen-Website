/**
 * Templates — layouts, and the rule that decides which record gets which one.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/templates";
import type { BlockTree } from "@/lib/blocks/types";
import type { Json } from "@/lib/db/database.types";
import { requirePermission } from "./auth";

export type { TemplateRow, TemplateKind } from "@/lib/db/repositories/templates";

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
    draftData: { areas: input.areas ?? {} } as unknown as Json,
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
