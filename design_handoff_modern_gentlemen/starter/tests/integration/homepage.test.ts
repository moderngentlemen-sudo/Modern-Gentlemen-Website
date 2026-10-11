import { afterEach, beforeEach, expect, it } from "vitest";
import { Fixtures, adminClient, anonClient } from "../support/fixtures";
import { getPublishedHomepage } from "@/lib/services/publicContent";
import { testEnv } from "../setup/integration.setup";

// Selection changes a singleton, so this suite must never run on the shared site.
const test = it.skipIf(
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(testEnv.url).hostname)
);

const db = adminClient();
let fixtures: Fixtures;
let original: string | null;
beforeEach(async () => {
  fixtures = new Fixtures(db);
  const { data, error } = await db
    .from("homepage_settings")
    .select("page_id")
    .eq("singleton", true)
    .single();
  if (error || !data) throw error ?? new Error("Missing homepage settings");
  original = data.page_id;
});
afterEach(async () => {
  const { error } = await db
    .from("homepage_settings")
    .update({ page_id: original })
    .eq("singleton", true);
  if (error) throw error;
  await fixtures.cleanup();
});
async function actor(permissions = ["page.read", "page.write", "page.publish", "page.delete"]) {
  const role = await fixtures.createRole(permissions);
  const user = await fixtures.createUser([role]);
  return fixtures.signIn(user.email, user.password);
}
async function publishedPage(client: Awaited<ReturnType<typeof actor>>) {
  const page = await fixtures.createPage();
  const { error } = await client.rpc("publish_document", {
    p_entity_type: "page",
    p_entity_id: page.id,
  });
  if (error) throw error;
  return page;
}
test("defaults to the seeded homepage and exposes only its published data", async () => {
  const homepage = await getPublishedHomepage();
  expect(homepage?.slug).toBe("home");
  expect(homepage?.sections.length).toBeGreaterThan(0);
});
test("lets a page publisher choose a published page without renaming it or exposing its draft", async () => {
  const client = await actor();
  const page = await publishedPage(client);
  await db
    .from("pages")
    .update({ draft_data: { sections: [] } })
    .eq("id", page.id);
  const { error } = await client
    .from("homepage_settings")
    .update({ page_id: page.id })
    .eq("singleton", true)
    .select()
    .single();
  expect(error).toBeNull();
  const homepage = await getPublishedHomepage();
  expect(homepage?.id).toBe(page.id);
  expect(homepage?.slug).toBe(page.slug);
  expect(homepage?.sections.length).toBe(1);
  await client
    .from("pages")
    .update({ slug: `${page.slug}-renamed` })
    .eq("id", page.id);
  expect((await getPublishedHomepage())?.id).toBe(page.id);
});
test("refuses anonymous callers, members and editors without publication permission", async () => {
  const publisher = await actor();
  const page = await publishedPage(publisher);
  const member = await fixtures.createUser([]);
  const callers = [
    anonClient(),
    await fixtures.signIn(member.email, member.password),
    await actor(["page.read", "page.write"]),
  ];
  for (const client of callers) {
    const { data, error } = await client
      .from("homepage_settings")
      .update({ page_id: page.id })
      .eq("singleton", true)
      .select()
      .single();
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  }
  expect((await db.from("homepage_settings").select("page_id").single()).data?.page_id).toBe(
    original
  );
});
test("refuses drafts and cannot delete or unpublish the active homepage", async () => {
  const client = await actor();
  const draft = await fixtures.createPage();
  const refused = await client
    .from("homepage_settings")
    .update({ page_id: draft.id })
    .eq("singleton", true);
  expect(refused.error?.message).toContain("Publish this page");
  const page = await publishedPage(client);
  expect(
    (await client.from("homepage_settings").update({ page_id: page.id }).eq("singleton", true))
      .error
  ).toBeNull();
  const deletion = await client.from("pages").delete().eq("id", page.id);
  expect(deletion.error?.message).toContain("Set another published page");
  const unpublish = await client.rpc("unpublish_document", {
    p_entity_type: "page",
    p_entity_id: page.id,
  });
  expect(unpublish.error?.message).toContain("Set another published page");
  const status = await client.from("pages").update({ status: "archived" }).eq("id", page.id);
  expect(status.error?.message).toContain("Set another published page");
  expect((await getPublishedHomepage())?.id).toBe(page.id);
  const replacement = await publishedPage(client);
  expect(
    (
      await client
        .from("homepage_settings")
        .update({ page_id: replacement.id })
        .eq("singleton", true)
    ).error
  ).toBeNull();
  expect(
    (await client.rpc("unpublish_document", { p_entity_type: "page", p_entity_id: page.id })).error
  ).toBeNull();
});
test("serializes choosing a page against a concurrent unpublish", async () => {
  const client = await actor();
  const page = await publishedPage(client);
  const [selection, unpublish] = await Promise.all([
    client.from("homepage_settings").update({ page_id: page.id }).eq("singleton", true),
    client.rpc("unpublish_document", { p_entity_type: "page", p_entity_id: page.id }),
  ]);
  expect(Boolean(selection.error) || Boolean(unpublish.error)).toBe(true);
  const homepage = await getPublishedHomepage();
  expect(homepage).not.toBeNull();
  if (!selection.error) expect(homepage?.id).toBe(page.id);
});
