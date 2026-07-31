/**
 * Publishing against a real Postgres.
 *
 * These assertions cannot be made in a unit test: the thing under test is a
 * transaction spanning three tables plus the RLS and GRANT layers around it.
 * Mocking the database here would prove only that the mock behaves as written.
 *
 * Requires a stack — CI starts one (`.github/workflows/ci.yml`).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Fixtures, adminClient, anonClient, type Db } from "../support/fixtures";

const db = adminClient();
const fixtures = new Fixtures(db);

/** Holds page.write but NOT page.publish, to prove the gate is real. */
let author: { id: string; email: string; password: string };
let authorDb: Db;
/** Holds the full editor set. */
let editor: { id: string; email: string; password: string };
let editorDb: Db;

beforeAll(async () => {
  author = await fixtures.createUser(["author"]);
  authorDb = await fixtures.signIn(author.email, author.password);

  editor = await fixtures.createUser(["editor"]);
  editorDb = await fixtures.signIn(editor.email, editor.password);
}, 60_000);

afterAll(async () => {
  await fixtures.cleanup();
});

describe("publish_document", () => {
  it("moves the draft live, bumps the version, and writes exactly one revision and one event", async () => {
    const page = await fixtures.createPage();

    const { data: version, error } = await editorDb.rpc("publish_document", {
      p_entity_type: "page",
      p_entity_id: page.id,
      p_note: "first publish",
    });

    expect(error).toBeNull();
    expect(version).toBe(1);

    const { data: row } = await db
      .from("pages")
      .select("status, version, published_at, published_data, draft_data")
      .eq("id", page.id)
      .single();

    expect(row?.status).toBe("published");
    expect(row?.version).toBe(1);
    expect(row?.published_at).not.toBeNull();
    // The whole point: what is live is exactly what was drafted.
    expect(row?.published_data).toEqual(row?.draft_data);

    const { data: revisions } = await db
      .from("revisions")
      .select("version, reason, note")
      .eq("entity_type", "page")
      .eq("entity_id", page.id);

    expect(revisions).toHaveLength(1);
    expect(revisions?.[0]).toMatchObject({ version: 1, reason: "publish", note: "first publish" });

    const { data: events } = await db
      .from("publish_events")
      .select("action, from_version, to_version")
      .eq("entity_type", "page")
      .eq("entity_id", page.id);

    expect(events).toHaveLength(1);
    expect(events?.[0]).toMatchObject({ action: "publish", from_version: 0, to_version: 1 });
  });

  it("refuses an actor holding write but not publish", async () => {
    const page = await fixtures.createPage();

    const { error } = await authorDb.rpc("publish_document", {
      p_entity_type: "page",
      p_entity_id: page.id,
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");

    // And nothing was written on the way to being refused.
    const { data: row } = await db.from("pages").select("status").eq("id", page.id).single();
    expect(row?.status).toBe("draft");

    const { count } = await db
      .from("revisions")
      .select("*", { count: "exact", head: true })
      .eq("entity_id", page.id);
    expect(count).toBe(0);
  });

  it("refuses an entity type that is not on the allowlist", async () => {
    const page = await fixtures.createPage();

    const { error } = await editorDb.rpc("publish_document", {
      p_entity_type: "category",
      p_entity_id: page.id,
    });

    expect(error?.code).toBe("22023");
  });

  it("reports a missing row rather than silently succeeding", async () => {
    const { error } = await editorDb.rpc("publish_document", {
      p_entity_type: "page",
      p_entity_id: "00000000-0000-0000-0000-000000000000",
    });

    expect(error?.code).toBe("P0002");
  });

  it("advances the version on each successive publish", async () => {
    const page = await fixtures.createPage();

    await editorDb.rpc("publish_document", { p_entity_type: "page", p_entity_id: page.id });
    const { data: second } = await editorDb.rpc("publish_document", {
      p_entity_type: "page",
      p_entity_id: page.id,
    });

    expect(second).toBe(2);

    const { data: revisions } = await db
      .from("revisions")
      .select("version")
      .eq("entity_id", page.id)
      .order("version");
    expect(revisions?.map((r) => r.version)).toEqual([1, 2]);
  });
});

describe("unpublish_document", () => {
  it("takes the page off the site but keeps the payload and the history", async () => {
    const page = await fixtures.createPage();
    await editorDb.rpc("publish_document", { p_entity_type: "page", p_entity_id: page.id });

    const { error } = await editorDb.rpc("unpublish_document", {
      p_entity_type: "page",
      p_entity_id: page.id,
    });
    expect(error).toBeNull();

    const { data: row } = await db
      .from("pages")
      .select("status, published_at, published_data")
      .eq("id", page.id)
      .single();

    expect(row?.status).toBe("draft");
    expect(row?.published_at).toBeNull();
    // Kept, so re-publishing is one step rather than a restore.
    expect(row?.published_data).not.toBeNull();

    // No payload changed, so no revision should have been written.
    const { count } = await db
      .from("revisions")
      .select("*", { count: "exact", head: true })
      .eq("entity_id", page.id);
    expect(count).toBe(1);
  });

  it("hides the unpublished page from an anonymous reader", async () => {
    const page = await fixtures.createPage();
    await editorDb.rpc("publish_document", { p_entity_type: "page", p_entity_id: page.id });

    const anon = anonClient();
    const { data: visible } = await anon.from("pages").select("id").eq("id", page.id).maybeSingle();
    expect(visible).not.toBeNull();

    await editorDb.rpc("unpublish_document", { p_entity_type: "page", p_entity_id: page.id });

    const { data: hidden } = await anon.from("pages").select("id").eq("id", page.id).maybeSingle();
    expect(hidden).toBeNull();
  });
});

describe("rollback_document", () => {
  it("copies an old payload forward into the draft without destroying history", async () => {
    const page = await fixtures.createPage();

    // v1: the fixture's original content.
    await editorDb.rpc("publish_document", { p_entity_type: "page", p_entity_id: page.id });

    const replacement = {
      sections: [{ _key: "quote", _type: "pullQuote", quote: "Replaced.", attribution: "TESTS" }],
      seo: {},
    };
    await db
      .from("pages")
      .update({ draft_data: replacement as never })
      .eq("id", page.id);

    // v2: the replacement.
    await editorDb.rpc("publish_document", { p_entity_type: "page", p_entity_id: page.id });

    const { data: newVersion, error } = await editorDb.rpc("rollback_document", {
      p_entity_type: "page",
      p_entity_id: page.id,
      p_version: 1,
      p_note: "undo",
    });

    expect(error).toBeNull();
    expect(newVersion).toBe(3);

    const { data: row } = await db
      .from("pages")
      .select("status, version, draft_data, published_data")
      .eq("id", page.id)
      .single();

    // The draft is back to v1's content...
    expect((row?.draft_data as { sections: { quote: string }[] }).sections[0].quote).toBe(
      "A fixture quote."
    );
    // ...but nothing went live. An undo that silently shipped would be worse
    // than the mistake it was undoing.
    expect((row?.published_data as { sections: { quote: string }[] }).sections[0].quote).toBe(
      "Replaced."
    );
    expect(row?.status).toBe("published");

    // History is intact and gained a restore entry.
    const { data: revisions } = await db
      .from("revisions")
      .select("version, reason")
      .eq("entity_id", page.id)
      .order("version");

    expect(revisions).toEqual([
      { version: 1, reason: "publish" },
      { version: 2, reason: "publish" },
      { version: 3, reason: "restore" },
    ]);

    const { data: events } = await db
      .from("publish_events")
      .select("action, from_version, to_version")
      .eq("entity_id", page.id)
      .eq("action", "rollback");

    expect(events?.[0]).toMatchObject({ action: "rollback", from_version: 1, to_version: 3 });
  });

  it("refuses a revision that does not exist", async () => {
    const page = await fixtures.createPage();
    const { error } = await editorDb.rpc("rollback_document", {
      p_entity_type: "page",
      p_entity_id: page.id,
      p_version: 99,
    });

    expect(error?.code).toBe("P0002");
  });
});

describe("snapshot_document", () => {
  it("checkpoints the draft without publishing it", async () => {
    const page = await fixtures.createPage();

    const { data: version, error } = await editorDb.rpc("snapshot_document", {
      p_entity_type: "page",
      p_entity_id: page.id,
      p_label: "before the redesign",
    });

    expect(error).toBeNull();
    expect(version).toBe(1);

    const { data: row } = await db
      .from("pages")
      .select("status, version, published_data")
      .eq("id", page.id)
      .single();

    expect(row?.status).toBe("draft");
    expect(row?.version).toBe(1);
    expect(row?.published_data).toBeNull();

    const { data: revisions } = await db
      .from("revisions")
      .select("reason, label")
      .eq("entity_id", page.id);

    expect(revisions?.[0]).toMatchObject({ reason: "snapshot", label: "before the redesign" });
  });
});

describe("schedule_document", () => {
  it("parks a page in scheduled with its date", async () => {
    const page = await fixtures.createPage();
    const when = new Date(Date.now() + 86_400_000);

    const { error } = await editorDb.rpc("schedule_document", {
      p_entity_type: "page",
      p_entity_id: page.id,
      p_when: when.toISOString(),
    });

    expect(error).toBeNull();

    const { data: row } = await db
      .from("pages")
      .select("status, scheduled_for")
      .eq("id", page.id)
      .single();

    expect(row?.status).toBe("scheduled");
    expect(row?.scheduled_for).not.toBeNull();
  });

  it("refuses a time in the past", async () => {
    const page = await fixtures.createPage();
    const { error } = await editorDb.rpc("schedule_document", {
      p_entity_type: "page",
      p_entity_id: page.id,
      p_when: new Date(Date.now() - 1000).toISOString(),
    });

    expect(error?.code).toBe("22023");
  });

  it("refuses an entity type with nowhere to store a schedule", async () => {
    // patterns has no scheduled_for column and no 'scheduled' status.
    const { error } = await editorDb.rpc("schedule_document", {
      p_entity_type: "pattern",
      p_entity_id: "00000000-0000-0000-0000-000000000000",
      p_when: new Date(Date.now() + 86_400_000).toISOString(),
    });

    expect(error?.code).toBe("22023");
  });
});

describe("anonymous callers", () => {
  it("cannot reach the mutating functions at all", async () => {
    const page = await fixtures.createPage();
    const anon = anonClient();

    const { error } = await anon.rpc("publish_document", {
      p_entity_type: "page",
      p_entity_id: page.id,
    });

    // Refused by the GRANT, before any permission check inside the function.
    expect(error).not.toBeNull();
  });
});
