/**
 * Templates — layouts, and the rule that decides which record gets which one.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/templates";
import { DEFAULT_AREA_NAME } from "@/lib/blocks/areas";
import type { BlockNode, BlockTree } from "@/lib/blocks/types";
import { DOCUMENT_CONTENT_TYPE } from "@/lib/blocks/templateContent";
import type { Json } from "@/lib/db/database.types";
import {
  publicPathForArticle,
  publicPathForCategory,
  publicPathForPage,
  publicPathForProduct,
} from "@/lib/domain/routes";
import {
  framedContentTypeFor,
  framedContentTypesFor,
  type FramedContentType,
} from "@/lib/domain/templates";
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
 * ⚠️ **Only `page` and `archive` templates return anything**, because `/` and
 * `/[category]` are the only public routes that render a document through a
 * template. A published `article` or `product` template genuinely changes no
 * path — those routes are fixed components, not block trees — and returning an
 * empty list is the honest answer rather than a missing case.
 *
 * ⚠️ **The `taxonomy` scope is still skipped, and `archive` landing does not
 * change that.** It exists for a template scoped to *one* category by slug, and
 * `resolveTemplateId` implements it on the admin side; the public reader
 * (`publishedTemplateArea`) does not, so honouring it here would invalidate
 * paths that nothing renders differently. When the reader grows that rung this
 * function grows the matching one — together, or the two disagree about which
 * pages a template touches.
 */
export async function publicPathsForTemplate(id: string): Promise<string[]> {
  const db = await createClient();
  const template = await repo.getTemplate(db, id);
  if (!template) return [];

  const { data: assignments, error } = await db
    .from("template_assignments")
    .select("scope, content_type, entry_id")
    .eq("template_id", id);

  if (error) throw new Error(`Could not read this template's assignments: ${error.message}`);
  if (!assignments?.length) return [];

  const paths: string[] = [];
  const primary = framedContentTypeFor(template.kind);

  for (const contentType of framedContentTypesFor(template.kind)) {
    const wholeType = assignments.some(
      (row) => row.scope === "content_type" && row.content_type === contentType
    );
    const entryIds = assignments
      .filter(
        (row) =>
          row.scope === "entry" &&
          row.entry_id &&
          (row.content_type === contentType || (!row.content_type && contentType === primary))
      )
      .map((row) => row.entry_id as string);

    if (contentType === "shop" && wholeType) paths.push("/shop");
    if ((contentType === "header" || contentType === "footer") && wholeType) paths.push("/");
    if (!wholeType && entryIds.length === 0) continue;

    if (contentType === "page") {
      let query = db.from("pages").select("slug").eq("status", "published");
      if (!wholeType) query = query.in("id", entryIds);
      const { data, error: readError } = await query;
      if (readError) throw new Error(`Could not read framed pages: ${readError.message}`);
      paths.push(...(data ?? []).map((row) => publicPathForPage(row.slug)));
    } else if (contentType === "category") {
      let query = db.from("categories").select("slug").eq("status", "published");
      if (!wholeType) query = query.in("id", entryIds);
      const { data, error: readError } = await query;
      if (readError) throw new Error(`Could not read framed categories: ${readError.message}`);
      paths.push(...(data ?? []).map((row) => publicPathForCategory(row.slug)));
    } else if (contentType === "article") {
      let query = db.from("articles").select("slug").eq("status", "published");
      if (!wholeType) query = query.in("id", entryIds);
      const { data, error: readError } = await query;
      if (readError) throw new Error(`Could not read framed articles: ${readError.message}`);
      paths.push(...(data ?? []).map((row) => publicPathForArticle(row.slug)));
    } else if (contentType === "product") {
      let query = db.from("products").select("slug").eq("status", "published");
      if (!wholeType) query = query.in("id", entryIds);
      const { data, error: readError } = await query;
      if (readError) throw new Error(`Could not read framed products: ${readError.message}`);
      paths.push(...(data ?? []).map((row) => publicPathForProduct(row.slug)));
    }
  }

  return [...new Set(paths)];
}

// ---------------------------------------------------------------------------
// Assignments — what a template is a layout *for*.
//
// Until this landed, `template_assignments` had a reader and no writer anywhere
// in the app: an editor could build a template, publish it, and never point it
// at anything without opening SQL. Three slices were built on top of that gap
// because every end-to-end check inserted the row by hand.
// ---------------------------------------------------------------------------

/** One assignable target, and the template holding it if any. */
export interface AssignmentTarget {
  /** `content_type:page`, or `entry:<uuid>` — stable, and safe in a form value. */
  value: string;
  label: string;
  /** The template currently claiming it, so a picker can say who it would displace. */
  heldBy: { id: string; name: string } | null;
}

/**
 * Targets and current assignments for a whole list of templates, in one pass.
 *
 * ⚠️ **This exists because the obvious shape is an N+1.** Calling
 * `listAssignmentTargets` and `currentAssignments` per row — which is exactly
 * how the templates screen first did it — costs four round trips *per template*
 * to read the same three tables over and over. Templates are few, so it was
 * never going to be slow enough to notice, which is precisely why it would have
 * stayed. There are only two frameable content types, so the entry lists are
 * fetched once each and shared.
 */
export async function assignmentBoard(
  templates: { id: string; kind: repo.TemplateKind }[]
): Promise<{ id: string; targets: AssignmentTarget[]; current: string[] }[]> {
  await requirePermission("template.read");
  const db = await createClient();

  const [assignments, allTemplates] = await Promise.all([
    repo.listAssignments(db),
    repo.listTemplates(db),
  ]);

  const nameOf = new Map(allTemplates.map((row) => [row.id, row.name] as const));
  const holder = (predicate: (row: repo.AssignmentRow) => boolean) => {
    const row = assignments.find(predicate);
    if (!row) return null;
    return { id: row.template_id, name: nameOf.get(row.template_id) ?? "another template" };
  };

  // Only the content types this list actually needs — a project with no archive
  // templates never reads `categories`.
  const needed = new Set(templates.flatMap((template) => framedContentTypesFor(template.kind)));

  const entriesByType = new Map<string, { id: string; label: string }[]>();
  for (const contentType of needed) {
    if (
      contentType === "page" ||
      contentType === "category" ||
      contentType === "article" ||
      contentType === "product"
    ) {
      entriesByType.set(contentType, await readAssignableEntries(db, contentType));
    }
  }

  const labels: Record<FramedContentType, { all: string; entry: string }> = {
    page: { all: "Every page", entry: "Page" },
    category: { all: "Every category", entry: "Category" },
    article: { all: "Every article", entry: "Article" },
    product: { all: "Every product", entry: "Product" },
    shop: { all: "The shop archive", entry: "Shop" },
    header: { all: "The site header", entry: "Header" },
    footer: { all: "The site footer", entry: "Footer" },
  };
  const targetsFor = (contentType: FramedContentType): AssignmentTarget[] => [
    {
      value: `content_type:${contentType}`,
      label: labels[contentType].all,
      heldBy: holder((row) => row.scope === "content_type" && row.content_type === contentType),
    },
    ...(entriesByType.get(contentType) ?? []).map((entry) => ({
      value: `entry:${entry.id}`,
      label: `${labels[contentType].entry}: ${entry.label}`,
      heldBy: holder((row) => row.scope === "entry" && row.entry_id === entry.id),
    })),
  ];

  return templates.map((template) => {
    const contentTypes = framedContentTypesFor(template.kind);
    return {
      id: template.id,
      targets: contentTypes.flatMap(targetsFor),
      current: assignments
        .filter((row) => row.template_id === template.id)
        .map((row) =>
          row.scope === "entry" ? `entry:${row.entry_id}` : `content_type:${row.content_type}`
        ),
    };
  });
}

/**
 * The records of one content type a template may be pointed at.
 *
 * Published only. Assigning a template to an unpublished record would be a
 * choice with no visible effect until somebody else published it — the same
 * "stored and unrendered" shape the taxonomy note refuses.
 */
async function readAssignableEntries(
  db: Awaited<ReturnType<typeof createClient>>,
  contentType: "page" | "category" | "article" | "product"
): Promise<{ id: string; label: string }[]> {
  if (contentType === "page") {
    const { data, error } = await db
      .from("pages")
      .select("id, title")
      .eq("status", "published")
      .order("title");
    if (error) throw new Error(`Could not read the pages a template can frame: ${error.message}`);
    return (data ?? []).map((row) => ({ id: row.id, label: row.title }));
  }

  if (contentType === "category") {
    const { data, error } = await db
      .from("categories")
      .select("id, name")
      .eq("status", "published")
      .order("name");
    if (error) throw new Error(`Could not read assignable categories: ${error.message}`);
    return (data ?? []).map((row) => ({ id: row.id, label: row.name }));
  }

  if (contentType === "article") {
    const { data, error } = await db
      .from("articles")
      .select("id, title")
      .eq("status", "published")
      .order("title");
    if (error) throw new Error(`Could not read assignable articles: ${error.message}`);
    return (data ?? []).map((row) => ({ id: row.id, label: row.title }));
  }

  const { data, error } = await db
    .from("products")
    .select("id, name")
    .eq("status", "published")
    .order("name");
  if (error) throw new Error(`Could not read assignable products: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, label: row.name }));
}

/**
 * Points a template at one target, or at nothing.
 *
 * **The revalidation is the half that is easy to forget and impossible to
 * notice.** An assignment changes what a *published* page renders without
 * touching that page's row, so nothing else in the system would invalidate it —
 * the page would keep serving its prerendered HTML until the hourly backstop
 * expired. Both the old and the new path sets are collected, because reassigning
 * "every page" from template A to template B changes what A's pages render just
 * as much as B's.
 */
export async function assignTemplateTo(
  templateId: string,
  target: string | null
): Promise<{ paths: string[]; revalidateLayout: boolean }> {
  await requirePermission("template.write");
  const db = await createClient();

  const before = await publicPathsForTemplate(templateId);
  const template = await repo.getTemplate(db, templateId);
  if (!template) throw new Error("That template no longer exists.");
  const revalidateLayout = template.kind === "header" || template.kind === "footer";

  if (target === null) {
    await repo.unassignTemplate(db, templateId);
    return { paths: before, revalidateLayout };
  }

  const contentTypes = framedContentTypesFor(template.kind);
  if (contentTypes.length === 0) {
    throw new Error(`Nothing renders a ${template.kind} template yet, so it cannot be assigned.`);
  }

  const parsed = contentTypes
    .map((contentType) => parseAssignmentTarget(target, contentType))
    .find((value) => value !== null);
  if (!parsed) throw new Error("That is not a target this template can be assigned to.");

  // Whoever held the target loses it, so their paths change too — collected
  // before the write, while the old rows still exist to be read.
  const displaced = await pathsHoldingTarget(db, parsed);

  await repo.assignTemplate(db, {
    templateId,
    contentType: parsed.contentType,
    entryId: parsed.entryId,
  });

  const after = await publicPathsForTemplate(templateId);
  return { paths: [...new Set([...before, ...displaced, ...after])], revalidateLayout };
}

interface ParsedTarget {
  contentType: string;
  entryId: string | null;
}

/**
 * `content_type:page` / `entry:<uuid>` → the columns to write.
 *
 * The value crosses a form boundary, so it is parsed rather than trusted: the
 * content type must be the one this template's kind frames (an editor cannot
 * post `content_type:category` at a `page` template), and an entry id must be a
 * uuid before it reaches a query.
 */
export function parseAssignmentTarget(value: string, contentType: string): ParsedTarget | null {
  if (value === `content_type:${contentType}`) return { contentType, entryId: null };

  const entry = value.startsWith("entry:") ? value.slice("entry:".length) : null;
  if (entry && UUID.test(entry)) return { contentType, entryId: entry };

  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The public paths of whichever template currently claims a target. */
async function pathsHoldingTarget(
  db: Awaited<ReturnType<typeof createClient>>,
  target: ParsedTarget
): Promise<string[]> {
  const rows = await repo.listAssignments(db);
  const held = rows.find((row) =>
    target.entryId
      ? row.scope === "entry" && row.entry_id === target.entryId
      : row.scope === "content_type" && row.content_type === target.contentType
  );

  return held ? publicPathsForTemplate(held.template_id) : [];
}
