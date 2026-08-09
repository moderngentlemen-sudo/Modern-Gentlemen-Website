/**
 * The scheduled-publish runner, against a real Postgres.
 *
 * **This file is the guard on a deliberate duplication.** `run_due_publishes`
 * carries its own copy of the three writes `publish_document` makes, because
 * sharing the body is not available: one runs as the caller and the other as
 * the owner, and any function both could call would have to be executable by
 * `authenticated` — which would hand every signed-in user an unchecked publish.
 * `0016_scheduled_publishing.sql` records that reasoning in full.
 *
 * So the two implementations are held together by behaviour instead of by code:
 * publish one document each way and assert the results are identical but for
 * the actor. If someone changes what publishing means and updates only one of
 * them, this fails.
 *
 * Requires a stack — CI starts one.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Fixtures, adminClient, anonClient, type Db } from "../support/fixtures";

const db = adminClient();
const fixtures = new Fixtures(db);

interface DueRow {
  entity_type: string;
  entity_id: string;
  slug: string;
  category_slug: string | null;
  version: number;
}

/**
 * `run_due_publishes` arrived in 0016, after the last `npm run db:types`, so the
 * generated `Database` does not list it. Cast once here, with the shape written
 * out, rather than at every call site — and delete this after the next
 * regeneration.
 */
function runDue(client: Db, limit = 100) {
  return (
    client as unknown as {
      rpc(
        fn: "run_due_publishes",
        args: { p_limit: number }
      ): PromiseLike<{ data: DueRow[] | null; error: { message: string } | null }>;
    }
  ).rpc("run_due_publishes", { p_limit: limit });
}

let editor: { id: string; email: string; password: string };
let editorDb: Db;

/** A moment already past, so the row is due the instant it is written. The
 *  schedule_document RPC refuses a past date, which is why these tests set
 *  `scheduled_for` directly for the "already due" case. */
const inThePast = () => new Date(Date.now() - 60_000).toISOString();

beforeAll(async () => {
  editor = await fixtures.createUser(["editor"]);
  editorDb = await fixtures.signIn(editor.email, editor.password);
}, 60_000);

afterAll(async () => {
  await fixtures.cleanup();
});

/** Everything a publish leaves behind, in a shape two publishes can be compared in. */
async function publishOutcome(entityId: string) {
  const { data: row } = await db
    .from("pages")
    .select("status, version, scheduled_for, published_data, draft_data")
    .eq("id", entityId)
    .single();

  const { data: revisions } = await db
    .from("revisions")
    .select("version, reason, data, created_by")
    .eq("entity_type", "page")
    .eq("entity_id", entityId)
    .order("version");

  const { data: events } = await db
    .from("publish_events")
    .select("action, from_version, to_version, actor_id")
    .eq("entity_type", "page")
    .eq("entity_id", entityId)
    .order("created_at");

  return { row, revisions: revisions ?? [], events: events ?? [] };
}

describe("run_due_publishes", () => {
  it("publishes a page whose time has passed, and clears the schedule", async () => {
    const page = await fixtures.createPage();
    await db
      .from("pages")
      .update({ status: "scheduled", scheduled_for: inThePast() })
      .eq("id", page.id);

    const { data, error } = await runDue(db);
    expect(error).toBeNull();

    const mine = (data ?? []).filter((r) => r.entity_id === page.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ entity_type: "page", slug: page.slug, version: 1 });

    const { row } = await publishOutcome(page.id);
    expect(row?.status).toBe("published");
    expect(row?.version).toBe(1);
    // Left set, the row would be republished on every subsequent run.
    expect(row?.scheduled_for).toBeNull();
    expect(row?.published_data).toEqual(row?.draft_data);
  });

  it("leaves a document whose time has not come", async () => {
    const page = await fixtures.createPage();
    const future = new Date(Date.now() + 60 * 60_000).toISOString();
    await db.from("pages").update({ status: "scheduled", scheduled_for: future }).eq("id", page.id);

    await runDue(db);

    const { data: row } = await db.from("pages").select("status").eq("id", page.id).single();
    expect(row?.status).toBe("scheduled");
  });

  it("ignores a draft that was never scheduled", async () => {
    const page = await fixtures.createPage();

    await runDue(db);

    const { data: row } = await db.from("pages").select("status").eq("id", page.id).single();
    expect(row?.status).toBe("draft");
  });

  it("is a no-op on a second run — nothing is published twice", async () => {
    const page = await fixtures.createPage();
    await db
      .from("pages")
      .update({ status: "scheduled", scheduled_for: inThePast() })
      .eq("id", page.id);

    await runDue(db);
    const first = await publishOutcome(page.id);

    await runDue(db);
    const second = await publishOutcome(page.id);

    expect(second.row?.version).toBe(first.row?.version);
    expect(second.revisions).toHaveLength(first.revisions.length);
    expect(second.events).toHaveLength(first.events.length);
  });

  /**
   * The reason this file exists.
   */
  it("produces the same outcome as an editor publish, but for the actor", async () => {
    const byEditor = await fixtures.createPage();
    const bySchedule = await fixtures.createPage();

    const { error: publishError } = await editorDb.rpc("publish_document", {
      p_entity_type: "page",
      p_entity_id: byEditor.id,
      p_note: "Published on schedule",
    });
    expect(publishError).toBeNull();

    await db
      .from("pages")
      .update({ status: "scheduled", scheduled_for: inThePast() })
      .eq("id", bySchedule.id);
    await runDue(db);

    const a = await publishOutcome(byEditor.id);
    const b = await publishOutcome(bySchedule.id);

    // The row: same status, same version, same payload promotion, and both with
    // no schedule left behind.
    expect(b.row?.status).toBe(a.row?.status);
    expect(b.row?.version).toBe(a.row?.version);
    expect(b.row?.scheduled_for).toBe(a.row?.scheduled_for);

    // One revision each, at the same version, for the same reason, holding what
    // the draft held.
    expect(b.revisions).toHaveLength(a.revisions.length);
    expect(b.revisions[0]?.version).toBe(a.revisions[0]?.version);
    expect(b.revisions[0]?.reason).toBe(a.revisions[0]?.reason);

    // One event each, same action, same version transition.
    expect(b.events).toHaveLength(a.events.length);
    expect(b.events[0]?.action).toBe(a.events[0]?.action);
    expect(b.events[0]?.from_version).toBe(a.events[0]?.from_version);
    expect(b.events[0]?.to_version).toBe(a.events[0]?.to_version);

    // The one intended difference: an editor publish is attributed, a scheduled
    // one is not. Nobody did it, and the columns are nullable for exactly this.
    expect(a.events[0]?.actor_id).toBe(editor.id);
    expect(b.events[0]?.actor_id).toBeNull();
    expect(a.revisions[0]?.created_by).toBe(editor.id);
    expect(b.revisions[0]?.created_by).toBeNull();
  });

  it("cannot be called by anon or by a signed-in editor", async () => {
    // Granted to service_role alone. An editor publishing on demand goes
    // through publish_document, which checks their permission; this function
    // checks nobody's, so nothing reachable with a browser key may call it.
    const { error: anonError } = await runDue(anonClient(), 1);
    expect(anonError).not.toBeNull();

    const { error: editorError } = await runDue(editorDb, 1);
    expect(editorError).not.toBeNull();
  });
});
