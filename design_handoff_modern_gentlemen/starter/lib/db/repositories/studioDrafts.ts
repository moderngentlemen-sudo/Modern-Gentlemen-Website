import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";
import { unwrap } from "./errors";

/** Compare-and-swap: a second editor must reload instead of overwriting newer work. */
export async function saveStudioDraft(
  db: SupabaseClient<Database>,
  input: {
    id: string;
    expectedUpdatedAt: string;
    payload: Json;
    updatedBy: string;
  }
) {
  const row = unwrap(
    "saveStudioDraft",
    await db
      .from("pages")
      .update({
        draft_data: input.payload,
        updated_by: input.updatedBy,
      })
      .eq("id", input.id)
      .eq("updated_at", input.expectedUpdatedAt)
      .select("updated_at")
      .maybeSingle()
  );
  if (!row)
    throw new Error(
      "This page changed in another session. Reopen it before saving; your browser draft is still available."
    );
  return row.updated_at;
}
