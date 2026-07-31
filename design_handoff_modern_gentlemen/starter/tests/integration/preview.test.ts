/**
 * Preview tokens against a real Postgres.
 *
 * `resolve_preview` is the only SECURITY DEFINER function in `0010`, which
 * makes it the one place where a mistake would hand an anonymous caller more
 * than intended. These tests are the check on that: they assert both that the
 * capability works without staff rights, and that it grants nothing beyond the
 * one document it names.
 *
 * Requires a stack — CI starts one.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Fixtures, adminClient, anonClient, prefixed, type Db } from "../support/fixtures";

const db = adminClient();
const fixtures = new Fixtures(db);
let anon: Db;

beforeAll(async () => {
  anon = anonClient();
}, 60_000);

afterAll(async () => {
  await fixtures.cleanup();
});

describe("resolve_preview", () => {
  it("hands an anonymous caller the draft a valid token names", async () => {
    const page = await fixtures.createPage();
    const token = prefixed("valid-token");
    await fixtures.createPreviewSession({ token, entityId: page.id });

    const { data, error } = await anon.rpc("resolve_preview", { p_token: token });

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].entity_type).toBe("page");
    expect(data?.[0].entity_id).toBe(page.id);

    const payload = data?.[0].data as { sections: { quote: string }[] };
    expect(payload.sections[0].quote).toBe("A fixture quote.");
  });

  it("returns nothing for an expired token", async () => {
    const page = await fixtures.createPage();
    const token = prefixed("expired-token");
    await fixtures.createPreviewSession({
      token,
      entityId: page.id,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const { data, error } = await anon.rpc("resolve_preview", { p_token: token });

    // An empty set, not an error: the route shows "expired" either way, and
    // distinguishing the two would confirm to a guesser that a token was real.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("returns nothing for a token that never existed", async () => {
    const { data, error } = await anon.rpc("resolve_preview", { p_token: "not-a-real-token" });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("grants access to that document only, not to drafts in general", async () => {
    const named = await fixtures.createPage();
    const other = await fixtures.createPage();
    const token = prefixed("scoped-token");
    await fixtures.createPreviewSession({ token, entityId: named.id });

    // Holding a token does not turn the caller into staff.
    const { data: rows } = await anon.from("pages").select("id").in("id", [named.id, other.id]);
    expect(rows).toEqual([]);

    const { data } = await anon.rpc("resolve_preview", { p_token: token });
    expect(data?.[0].entity_id).toBe(named.id);
  });
});

describe("preview_sessions table", () => {
  it("is not readable by an anonymous caller, so tokens cannot be enumerated", async () => {
    const page = await fixtures.createPage();
    const token = prefixed("hidden-token");
    await fixtures.createPreviewSession({ token, entityId: page.id });

    const { data } = await anon.from("preview_sessions").select("token");

    // This is the reason resolve_preview has to be SECURITY DEFINER: the
    // capability cannot be expressed as a SELECT policy without also making
    // every live token listable.
    expect(data ?? []).toEqual([]);
  });

  it("refuses an anonymous insert", async () => {
    const { error } = await anon.from("preview_sessions").insert({
      token: prefixed("forged"),
      entity_type: "page",
      entity_id: "00000000-0000-0000-0000-000000000000",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    });

    expect(error).not.toBeNull();
  });
});

describe("draft visibility", () => {
  it("keeps an unpublished page invisible to anonymous readers", async () => {
    const page = await fixtures.createPage();

    const { data } = await anon.from("pages").select("id").eq("id", page.id).maybeSingle();
    expect(data).toBeNull();
  });
});
