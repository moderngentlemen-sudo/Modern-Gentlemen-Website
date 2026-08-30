/**
 * The theme, for editors.
 *
 * Reads and writes the one `theme_settings` row through the caller's own
 * session (`lib/db/server.ts`), so RLS applies to an editor exactly as it does
 * to anyone else — never the service-role client, which ESLint enforces.
 *
 * **Publishing goes through `publish_document`, not through
 * `lib/services/publishing.ts`.** `0017` put `theme` on the SQL allowlist, so
 * the RPC works unchanged; but that module's functions are typed `DocumentType`
 * and `theme` deliberately is not one (see `lib/domain/theme.ts`), and its
 * `assertPublishable` runs block-manifest validation that a theme has no blocks
 * to satisfy. So this file calls the RPC directly and reuses that module's
 * `rpcError` mapping rather than copying it.
 *
 * No create and no delete. There is one row, keyed `default` by `0007`, and
 * `theme.delete` is not a permission. Same stance `/admin/navigation` takes
 * toward creating menus.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/theme";
import {
  DEFAULT_THEME_COLORS,
  DEFAULT_THEME_SETTINGS,
  THEME_KEY,
  THEME_PAYLOAD_VERSION,
  parseThemeSettings,
  themeSettingsSchema,
  toThemeStatus,
  type ThemeSettings,
  type ThemeStatus,
} from "@/lib/domain/theme";
import * as revisionsRepo from "@/lib/db/repositories/revisions";
import { requirePermission } from "./auth";
import { rpcError } from "./publishing";

export interface ThemeView {
  id: string;
  name: string;
  status: ThemeStatus;
  version: number;
  publishedAt: string | null;
  /** The draft an editor is working on — the defaults when the row is empty. */
  draft: ThemeSettings;
  /** What the public site is serving, or `null` when nothing is published yet. */
  published: ThemeSettings | null;
}

/**
 * `0007` guarantees the row exists, so an absent one is a broken database
 * rather than a state to design around — but it is still worth a message that
 * names the cause instead of a null-dereference three frames away.
 */
async function requireThemeRow(db: Awaited<ReturnType<typeof createClient>>) {
  const row = await repo.getThemeByKey(db, THEME_KEY);
  if (!row) {
    throw new Error(
      `No theme_settings row with key "${THEME_KEY}". Migration 0007 seeds it; ` +
        `re-run the migrations or the seed script.`
    );
  }
  return row;
}

export async function getTheme(): Promise<ThemeView> {
  await requirePermission("theme.read");

  const db = await createClient();
  const row = await requireThemeRow(db);

  return {
    id: row.id,
    name: row.name,
    status: toThemeStatus(row.status),
    version: row.version,
    publishedAt: row.published_at,
    // `{}` is what 0007 seeds, and it parses to the defaults — so an editor
    // opens the form populated with what the site is actually rendering rather
    // than with nine empty fields.
    draft: parseThemeSettings(row.draft_data ?? {}),
    published: row.published_data ? parseThemeSettings(row.published_data) : null,
  };
}

/**
 * Save the draft. Does not publish — the site keeps serving `published_data`.
 *
 * Validates with the **strict** schema, unlike the read path: this is where an
 * editor finds out that `accent` must be a hex, so rejecting the submission and
 * naming the field is the useful behaviour. `parseThemeColors` does the opposite
 * for exactly the same reason, on the other side.
 */
export async function saveThemeDraft(settings: unknown): Promise<ThemeSettings> {
  await requirePermission("theme.write");

  const parsed = themeSettingsSchema.safeParse(settings);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".");
    throw new Error(path ? `${path}: ${issue?.message}` : (issue?.message ?? "Invalid theme"));
  }

  const db = await createClient();
  const row = await requireThemeRow(db);

  await repo.saveThemeDraft(db, row.id, {
    version: THEME_PAYLOAD_VERSION,
    ...parsed.data,
  });

  return parseThemeSettings({ version: THEME_PAYLOAD_VERSION, ...parsed.data });
}

/** Promote the draft. Returns the new version. */
export async function publishTheme(note?: string): Promise<number> {
  await requirePermission("theme.publish");

  const db = await createClient();
  const row = await requireThemeRow(db);

  const { data, error } = await db.rpc("publish_document", {
    p_entity_type: "theme",
    p_entity_id: row.id,
    p_note: note,
  });

  // The RPC asserts `theme.publish` itself, so this is defence in depth rather
  // than the only gate — a bug in the check above cannot publish what the
  // database refuses.
  if (error) throw rpcError("publish_document", "theme.publish", error);
  return data as number;
}

/**
 * Take the theme off the site.
 *
 * `published_data` is kept — `0010` leaves it deliberately — so the row still
 * holds the last published palette. What changes is `status`, which `0017`'s
 * policy reads: the anonymous client stops seeing the row, and
 * `getPublishedThemeColors` falls back to the built-in tokens. Which is to say
 * unpublishing a theme returns the site to the design it shipped with, rather
 * than to no colours at all.
 */
export async function unpublishTheme(note?: string): Promise<number> {
  await requirePermission("theme.publish");

  const db = await createClient();
  const row = await requireThemeRow(db);

  const { data, error } = await db.rpc("unpublish_document", {
    p_entity_type: "theme",
    p_entity_id: row.id,
    p_note: note,
  });

  if (error) throw rpcError("unpublish_document", "theme.publish", error);
  return data as number;
}

/** Re-exported so the admin can offer "reset to the design baseline". */
export { DEFAULT_THEME_COLORS, DEFAULT_THEME_SETTINGS };

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/**
 * The theme's revision history, and the rollback that goes with it.
 *
 * **The data has existed since `0017` and nothing has ever read it.** That
 * migration put `theme` on `document_table()`'s allowlist so the theme could be
 * published through `publish_document`, and that function writes a `revisions`
 * row and a `publish_events` row in the same transaction as every publish. So
 * every theme publish since has been recorded, and `/admin/theme` was the one
 * document-shaped editor with no way to look at it — or to undo.
 *
 * These go direct to the repository for the same reason `publishTheme` goes
 * direct to the RPC: `lib/services/revisions.ts` is typed `DocumentType` and
 * `theme` deliberately is not one. The repository takes the wider
 * `RevisionEntityType`, which is honest about what the columns hold.
 */
export async function listThemeHistory(limit = 50) {
  await requirePermission("revision.read");
  const db = await createClient();
  const row = await requireThemeRow(db);
  return revisionsRepo.listRevisions(db, "theme", row.id, limit);
}

export async function listThemePublishEvents(limit = 50) {
  await requirePermission("revision.read");
  const db = await createClient();
  const row = await requireThemeRow(db);
  return revisionsRepo.listPublishEvents(db, "theme", row.id, limit);
}

/**
 * Restores an earlier theme **into the draft**, exactly as a document rollback
 * does.
 *
 * Nothing reaches the site until the editor publishes — which matters more here
 * than anywhere else in the admin, because a theme change is site-wide and
 * instant: an undo that shipped on click would repaint every page before anyone
 * had looked at it.
 */
export async function rollbackTheme(version: number, note?: string): Promise<number> {
  await requirePermission("revision.restore");

  const db = await createClient();
  const row = await requireThemeRow(db);

  const { data, error } = await db.rpc("rollback_document", {
    p_entity_type: "theme",
    p_entity_id: row.id,
    p_version: version,
    p_note: note,
  });

  if (error) throw rpcError("rollback_document", "revision.restore", error);
  return data as number;
}
