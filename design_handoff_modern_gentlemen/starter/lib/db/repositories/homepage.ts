import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

export async function getHomepagePageId(db: Db): Promise<string | null> {
  const row = unwrap(
    "getHomepagePageId",
    await db.from("homepage_settings").select("page_id").eq("singleton", true).single()
  );
  if (!row) throw new Error("Homepage settings are missing. Apply the homepage migration.");
  return row.page_id;
}

export async function setHomepagePageId(db: Db, pageId: string): Promise<void> {
  unwrap(
    "setHomepagePageId",
    await db
      .from("homepage_settings")
      .update({ page_id: pageId })
      .eq("singleton", true)
      .select("page_id")
      .single()
  );
}
