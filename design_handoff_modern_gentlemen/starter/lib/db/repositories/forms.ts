import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import type { FormPayload } from "@/lib/domain/forms";

export async function insertFormSubmission(
  db: SupabaseClient<Database>,
  input: { formKey: string; payload: FormPayload; pagePath: string | null }
): Promise<void> {
  const { error } = await db.from("form_submissions").insert({
    form_key: input.formKey,
    payload: input.payload,
    page_path: input.pagePath,
  });
  if (error) throw new Error(`Could not record the form submission: ${error.message}`);
}
