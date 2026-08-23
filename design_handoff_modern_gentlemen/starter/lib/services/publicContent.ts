/**
 * Public content reads — the published site's data layer.
 *
 * **This is the one service with no `requirePermission` call, and that is the
 * point rather than an omission.** Everything else in `lib/services` guards a
 * staff action; this reads what has deliberately been made public. The guard is
 * still there, one layer down: `createPublicClient()` is anonymous, and the RLS
 * policies from `0003`–`0005` read `using (status = 'published' or is_staff())`.
 * An anonymous caller is not staff, so a draft cannot come back through here
 * even if a query asked for one. The database is the enforcement; these
 * functions are the shape.
 *
 * Note what is NOT here: a fallback to the demo modules. A silent fallback
 * would mean a broken database read renders a plausible page and nobody finds
 * out for a week. Static rendering already gives the safety a fallback was
 * reaching for — the page is built once, and if a later revalidation fails Next
 * keeps serving the last good output. A blip cannot blank the site; only a
 * failed build can, and a failed build is meant to be loud.
 */

import { createPublicClient } from "@/lib/db/public";
import { collectPatternRefs, expandPatterns } from "@/lib/blocks/expand";
import { applyTemplate, findContentArea } from "@/lib/blocks/templateContent";
import { readAreas } from "@/lib/blocks/areas";
import type { BlockTree } from "@/lib/blocks/types";
import type { Json } from "@/lib/db/database.types";

/** The published payload of a page, as the renderer wants it. */
export interface PublishedPage {
  /** Needed by `composePublishedPage`: an entry-scoped assignment keys on it. */
  id: string;
  slug: string;
  title: string;
  sections: BlockTree;
}

/**
 * `published_data`, never `draft_data`.
 *
 * The two columns exist precisely so that an editor mid-edit does not ship
 * their half-finished work, and reading the wrong one here would quietly undo
 * the whole of Phase 3. RLS would not catch it: a published row's draft is
 * readable by anyone who can read the row.
 */
function sectionsOf(payload: Json | null): BlockTree {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const sections = (payload as Record<string, unknown>).sections;
  return Array.isArray(sections) ? (sections as BlockTree) : [];
}

export async function getPublishedPage(slug: string): Promise<PublishedPage | null> {
  const db = createPublicClient();

  const { data, error } = await db
    .from("pages")
    .select("id, slug, title, published_data, status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  // Thrown, not swallowed. During a static build this fails the build, which is
  // the correct outcome — shipping a site whose content did not load is worse
  // than not shipping. During revalidation Next keeps the previous output.
  if (error) {
    throw new Error(`Could not read the published page "${slug}": ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    sections: sectionsOf(data.published_data),
  };
}

/**
 * Substitutes every synced pattern in a tree for the blocks it points at.
 *
 * This is what makes `sync_mode: 'synced'` mean anything. A synced pattern is
 * stored in the page as a `patternRef` node carrying `_ref`, and until this
 * existed **no public route expanded one** — `expandPatternRefs` had exactly one
 * caller, the preview route. A synced pattern therefore rendered correctly in
 * preview and vanished from the live site: the worst failure shape available,
 * because the person checking their work is shown it working.
 *
 * Three things about it are deliberate.
 *
 * **It reads through `createPublicClient()`, like everything else here.** The
 * admin-side `expandPatternRefs` in `lib/services/patterns.ts` uses
 * `lib/db/server.ts`, which calls `cookies()` — and any route that awaits
 * `cookies()` is opted out of static rendering by Next. Calling that one from a
 * public route would have turned the homepage into a per-request render with
 * nothing failing to say so.
 *
 * ⚠️ **It selects `published_data` only, and it does not reuse
 * `repo.getPatternsByIds`.** That function selects `draft_data` too, and `0020`
 * revoked that column from `anon` — so the shared read fails as
 * `42501 permission denied for table patterns`, an error that names the table
 * and not the column. Measured against the live project rather than reasoned
 * about. The column list here is the fix, and the *absence* of the repository's
 * `published_data ?? draft_data` fallback is the second half of it: falling back
 * to a draft is precisely the "editor mid-edit ships half-finished work" hazard
 * that `sectionsOf` above exists to prevent, and it would be worse here, since
 * one unpublished pattern would leak into every page using it.
 *
 * **An unpublished or deleted pattern leaves its node in place**, and
 * `PatternRef` renders nothing — see `expandPatternsDetailed`. A gap is the
 * right outcome for a visitor; the loud half belongs to the editor.
 */
export async function expandPublicPatterns(tree: BlockTree): Promise<BlockTree> {
  const refs = collectPatternRefs(tree);
  if (refs.length === 0) return tree;

  const db = createPublicClient();
  const ids = [...new Set(refs.map((ref) => ref.patternId))];

  const { data, error } = await db
    .from("patterns")
    .select("id, published_data")
    .in("id", ids)
    .eq("status", "published");

  // Thrown rather than swallowed, for the reason `getPublishedPage` gives: at
  // build time this should fail the build, and during revalidation Next keeps
  // the previous output. Silently returning the unexpanded tree would render
  // every synced pattern as a gap and look like an editor's mistake.
  if (error) {
    throw new Error(`Could not read the patterns this page references: ${error.message}`);
  }

  const payloads = new Map<string, Json>();
  for (const row of data ?? []) payloads.set(row.id, row.published_data);

  return expandPatterns(tree, payloads as ReadonlyMap<string, unknown>);
}

/**
 * The published `main` area of the template assigned to a page, or `null`.
 *
 * This is the caller `resolveTemplateFor` never had. It deliberately does **not**
 * reuse it: that function reads through `lib/db/server.ts`, which calls
 * `cookies()`, and any route that awaits `cookies()` is opted out of static
 * rendering by Next. Calling it from `/` would have turned the homepage into a
 * per-request render with nothing failing to say so — the exact hazard
 * `expandPublicPatterns` documents one function above, met a second time.
 *
 * Resolution order is `0003`'s and `resolveTemplateId`'s: entry beats
 * content_type. There is no taxonomy scope for pages — a page has no taxonomy —
 * so the middle rung is skipped rather than reimplemented.
 *
 * ⚠️ **`published_data` only, and no `draft_data` fallback**, for both reasons
 * the pattern reader gives: `0020` revoked the draft column from `anon`, so
 * selecting it fails as `42501` naming the table and not the column; and falling
 * back to a draft would ship an editor's half-finished layout to every page
 * assigned to the template at once.
 */
async function publishedTemplateArea(
  contentType: string,
  entryId: string
): Promise<BlockTree | null> {
  const db = createPublicClient();

  // Two queries rather than one `.or(...)`, deliberately. PostgREST's `or`
  // takes a filter *string*, and building one by interpolating a value is the
  // shape of every injection bug ever written — `entryId` is a uuid from our own
  // row today, which is exactly the reasoning that stops being true the day
  // somebody passes a slug. Two indexed lookups on a table with single-digit
  // rows cost nothing worth protecting.
  const [entryScoped, typeScoped] = await Promise.all([
    db
      .from("template_assignments")
      .select("template_id")
      .eq("scope", "entry")
      .eq("entry_id", entryId)
      .maybeSingle(),
    db
      .from("template_assignments")
      .select("template_id")
      .eq("scope", "content_type")
      .eq("content_type", contentType)
      .maybeSingle(),
  ]);

  const assignmentError = entryScoped.error ?? typeScoped.error;
  if (assignmentError) {
    throw new Error(`Could not read template assignments: ${assignmentError.message}`);
  }

  // Most specific first, which is `0003`'s documented order and the one
  // `resolveTemplateId` implements on the admin side.
  const templateId = entryScoped.data?.template_id ?? typeScoped.data?.template_id;
  if (!templateId) return null;

  const { data: template, error: templateError } = await db
    .from("templates")
    .select("published_data")
    .eq("id", templateId)
    .eq("status", "published")
    .maybeSingle();

  if (templateError) {
    throw new Error(`Could not read the assigned template: ${templateError.message}`);
  }
  // An assigned-but-unpublished template is not an error and not a fallback to
  // its draft: the page renders on its own, exactly as it did before anybody
  // assigned a template to it. The loud half of this belongs in the admin.
  if (!template) return null;

  // The area holding the marker, whatever it is called. Keyed on the marker
  // rather than on a name so that renaming an area cannot unhook the template
  // — see `findContentArea`.
  return findContentArea(readAreas(template.published_data));
}

/**
 * The single published page a template frames, or `null` when that is not one
 * page.
 *
 * This is `publishedTemplateArea` run backwards, and it exists for the preview
 * route: a template previewed on its own is a header band sitting on a footer
 * band, and what an editor is actually deciding about is how it looks *around a
 * page*. So the preview frames a real one where the answer is unambiguous.
 *
 * ⚠️ **"Exactly one, or none" is the whole rule, and the refusal is the point.**
 * A `content_type` assignment frames every published page there is; picking one
 * of several to stand for the rest would put a page an editor did not choose in
 * front of them and call it a preview. That is the same arbitrariness
 * `findContentArea` refuses when two areas hold a marker, and the same one
 * `validateTemplateAreas` refuses when a template holds two markers. When the
 * answer is not one page, the marker draws itself instead — see
 * `DocumentContentGap`.
 *
 * Reads through the public client, and `published_data` only: a preview shows
 * an unpublished *template*, framing the site as it actually stands. Pulling a
 * page's draft in here would put two different unpublished things on one screen
 * with nothing to tell them apart.
 */
export interface FramedPage {
  slug: string;
  title: string;
  sections: BlockTree;
}

export async function soleFramedPage(templateId: string): Promise<FramedPage | null> {
  const db = createPublicClient();

  const { data: assignments, error } = await db
    .from("template_assignments")
    .select("scope, entry_id")
    .eq("template_id", templateId);

  if (error) throw new Error(`Could not read this template's assignments: ${error.message}`);
  if (!assignments?.length) return null;

  const wholeType = assignments.some((row) => row.scope === "content_type");
  const entryIds = assignments
    .filter((row) => row.scope === "entry" && row.entry_id)
    .map((row) => row.entry_id as string);

  let query = db.from("pages").select("slug, title, published_data").eq("status", "published");
  if (!wholeType) {
    if (entryIds.length === 0) return null;
    query = query.in("id", entryIds);
  }

  // Two rows are fetched where one is wanted, so that "exactly one" is measured
  // rather than assumed from a `.limit(1)` that would have made three pages
  // look like one.
  const { data: pages, error: pageError } = await query.limit(2);
  if (pageError)
    throw new Error(`Could not read the pages this template frames: ${pageError.message}`);
  if (pages?.length !== 1) return null;

  const page = pages[0];
  return { slug: page.slug, title: page.title, sections: sectionsOf(page.published_data) };
}

/**
 * A page's sections, framed by its template when one is assigned and published.
 *
 * The composition order matters and is the reverse of what reads naturally:
 * patterns are expanded **inside the page's own sections first**, then the
 * result is spliced into the template. Expanding afterwards would also expand
 * refs the *template* contains, which sounds like a feature until you notice it
 * makes one read of `patterns` serve two different trees and lose track of which
 * unresolved ref belonged to which. The template's own refs are expanded by its
 * own call below, on the composed tree, which is where they belong.
 *
 * Returns the page's sections untouched when nothing is assigned — so a site
 * with no templates renders byte-identically to one that has never heard of
 * them. That is what makes this change provable against the sixteen baselines.
 */
export async function composePublishedPage(page: PublishedPage): Promise<BlockTree> {
  const expanded = await expandPublicPatterns(page.sections);
  const area = await publishedTemplateArea("page", page.id);
  if (!area) return expanded;

  return expandPublicPatterns(applyTemplate(area, expanded));
}
