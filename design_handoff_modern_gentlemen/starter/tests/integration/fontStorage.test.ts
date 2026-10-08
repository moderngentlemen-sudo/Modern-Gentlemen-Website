import { readFileSync } from "node:fs";
import { afterAll, expect, it } from "vitest";
import { FONT_BUCKET, MAX_FONT_UPLOAD_BYTES, validateFontUpload } from "@/lib/domain/fontUpload";
import { Fixtures, adminClient, anonClient } from "../support/fixtures";

// Real, openly licensed font; no production theme or existing object is changed.
const file = readFileSync("tests/fixtures/fonts/ABeeZee-Regular.ttf");
const fixtures = new Fixtures(adminClient());
const paths: string[] = [];
function path() {
  const value = `custom-${crypto.randomUUID().replaceAll("-", "")}.ttf`;
  paths.push(value);
  return value;
}
afterAll(async () => {
  if (paths.length) {
    const { error } = await adminClient().storage.from(FONT_BUCKET).remove(paths);
    if (error) throw error;
  }
  await fixtures.cleanup();
});

it("configures a public font-only bucket with the same size bound as the application", async () => {
  const { data, error } = await adminClient().storage.getBucket(FONT_BUCKET);
  expect(error).toBeNull();
  expect(data).toMatchObject({ public: true, file_size_limit: MAX_FONT_UPLOAD_BYTES });
  expect(data?.allowed_mime_types).toEqual(["font/woff", "font/woff2", "font/ttf", "font/otf"]);
});

it("allows theme writers to upload a real font, serves it anonymously and preserves its bytes", async () => {
  expect(
    validateFontUpload(
      "brand.ttf",
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
    ).contentType
  ).toBe("font/ttf");
  const role = await fixtures.createRole(["theme.read", "theme.write"]);
  const user = await fixtures.createUser([role]);
  const db = await fixtures.signIn(user.email, user.password);
  const storagePath = path();
  const bucket = db.storage.from(FONT_BUCKET);
  expect(
    (await bucket.upload(storagePath, file, { contentType: "font/ttf", upsert: false })).error
  ).toBeNull();
  const response = await fetch(bucket.getPublicUrl(storagePath).data.publicUrl);
  expect(response.ok).toBe(true);
  expect(response.headers.get("content-type")).toContain("font/ttf");
  expect(Buffer.from(await response.arrayBuffer())).toEqual(file);

  // Replacement and deletion must not invalidate a published theme/revision.
  expect(
    (await bucket.upload(storagePath, file, { contentType: "font/ttf", upsert: true })).error
  ).not.toBeNull();
  await bucket.remove([storagePath]); // Storage can return success for zero visible rows.
  expect((await fetch(bucket.getPublicUrl(storagePath).data.publicUrl)).ok).toBe(true);
  expect(
    (await bucket.upload(path(), "<html>no</html>", { contentType: "text/html" })).error
  ).not.toBeNull();
});

it("refuses anonymous, ordinary signed-in and media-only uploads", async () => {
  const mediaRole = await fixtures.createRole(["media.read", "media.write"]);
  const ordinary = await fixtures.createUser([]);
  const media = await fixtures.createUser([mediaRole]);
  const clients = [
    anonClient(),
    await fixtures.signIn(ordinary.email, ordinary.password),
    await fixtures.signIn(media.email, media.password),
  ];
  for (const db of clients) {
    expect(
      (await db.storage.from(FONT_BUCKET).upload(path(), file, { contentType: "font/ttf" })).error
    ).not.toBeNull();
  }
});
