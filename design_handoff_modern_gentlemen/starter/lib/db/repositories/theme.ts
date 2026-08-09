/**
 * The theme settings row.
 *
 * A theme **is** a document, unlike a menu: `0007` gave `theme_settings` the
 * full draft_data / published_data / version / status column set, and `0017` put
 * it on `document_table()`'s allowlist — so publish, unpublish, snapshot and
 * rollback all work through the existing RPCs and this file does not invent a
 * second publishing path. What it does not have is a TypeScript `DocumentType`;
 * see the header of `lib/domain/theme.ts` for why that union stays at five.
 *
 * There is exactly one row, keyed `default` by `0007`'s seed. No create, no
 * delete: `theme.delete` is not a permission, and a second theme would need a
 * switcher that nothing asks for. The same stance `/admin/navigation` takes
 * toward creating menus.
 *
 * Client-first like every other repository, so the caller decides whether RLS
 * applies: the admin passes the editor's own session, the public read passes the
 * anonymous client, and the seeder passes the service-role one.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

export interface ThemeRow {
  id: string;
  key: string;
  name: string;
  status: string;
  draft_data: unknown;
  published_data: unknown;
  version: number;
  published_at: string | null;
  updated_at: string;
}

const THEME_COLUMNS =
  "id, key, name, status, draft_data, published_data, version, published_at, updated_at";

/**
 * `null` rather than a throw.
 *
 * Through the anonymous client this is also the answer for a theme that exists
 * but is still a draft — `0017`'s policy hides it — and the caller wants the same
 * behaviour for both: serve the built-in defaults.
 */
export async function getThemeByKey(db: Db, key: string): Promise<ThemeRow | null> {
  return unwrap(
    "getThemeByKey",
    await db.from("theme_settings").select(THEME_COLUMNS).eq("key", key).maybeSingle()
  ) as ThemeRow | null;
}

/**
 * Write the draft only.
 *
 * `published_data` is never touched here — promoting a draft is
 * `publish_document`'s job, and it advances `version` and writes the revision
 * and the audit event in the same transaction. Writing both columns from
 * application code is the thing `CLAUDE.md` forbids.
 */
export async function saveThemeDraft(db: Db, id: string, draftData: unknown): Promise<void> {
  unwrap(
    "saveThemeDraft",
    await db
      .from("theme_settings")
      .update({ draft_data: draftData as never, updated_at: new Date().toISOString() })
      .eq("id", id)
  );
}
