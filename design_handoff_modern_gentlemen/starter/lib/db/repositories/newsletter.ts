import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import type { SubscriberSource } from "@/lib/domain/newsletter";

type Db = SupabaseClient<Database>;

/**
 * The subscriber table's public writer and staff reader.
 *
 * `anon` still holds no SELECT grant on `newsletter_subscribers` (see `0024`).
 * The reader below is called only by the permission-gated admin service through
 * a staff session; the public route continues to call only `insertSubscriber`.
 */

/**
 * Record a sign-up, idempotently.
 *
 * ⚠️ **A plain INSERT, not an upsert, and getting here took three attempts —
 * each defeated by the same grant that makes this table safe.**
 *
 *   1. `.upsert(...).select("id")`, to report whether a row was written.
 *      `.select()` asks PostgREST for `return=representation`, which needs
 *      SELECT. **42501.**
 *   2. `.upsert(...)` with no select. PostgREST's upsert path needs SELECT on
 *      the table regardless of what is returned. **42501 again.**
 *   3. This. A plain insert needs only INSERT, and the duplicate surfaces as
 *      **23505**, which is treated as success.
 *
 * **The general trap is worth more than the fix:** on a table where `anon` may
 * write but not read, every convenience that reads something back is closed to
 * you — `.select()`, `.upsert()`, `.single()`, returning counts. The idiomatic
 * client call is the one that does not work.
 *
 * **Treating 23505 as success is the privacy property, not a shortcut.** The
 * caller cannot distinguish a new address from a known one, so "we do not
 * disclose whether you were already subscribed" is a fact about what this can
 * observe rather than a promise it has to keep.
 */

/** Postgres unique-violation. A repeat sign-up, which is not an error here. */
const UNIQUE_VIOLATION = "23505";

export type SubscriberRow = Database["public"]["Tables"]["newsletter_subscribers"]["Row"];

export async function listSubscribers(db: Db, limit: number): Promise<SubscriberRow[]> {
  const { data, error } = await db
    .from("newsletter_subscribers")
    .select("id, email, source, status, confirmed_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not list newsletter subscribers: ${error.message}`);
  return (data ?? []) as SubscriberRow[];
}

export async function insertSubscriber(
  db: Db,
  input: { email: string; source: SubscriberSource }
): Promise<void> {
  const { error } = await db
    .from("newsletter_subscribers")
    .insert({ email: input.email, source: input.source });

  if (!error || error.code === UNIQUE_VIOLATION) return;

  throw new Error(`Could not record the newsletter sign-up: ${error.message}`);
}
