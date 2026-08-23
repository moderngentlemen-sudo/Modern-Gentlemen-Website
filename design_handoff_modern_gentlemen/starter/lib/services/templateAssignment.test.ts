import { describe, expect, it } from "vitest";

import { parseAssignmentTarget } from "./templates";

/**
 * The one pure boundary in the assignment path, and the only place a value an
 * editor's browser posted becomes columns in a query.
 *
 * `assignTemplateTo` derives `contentType` from the template's own `kind` and
 * then asks this function whether the posted target belongs to it. That pairing
 * is what stops a `page` template being pointed at a category by anyone willing
 * to edit a form value — RLS would happily allow the write, because
 * `template.write` is a permission over the table and not over which row makes
 * sense.
 */
describe("parseAssignmentTarget", () => {
  const uuid = "b085c7d9-b83f-4453-9d15-c39cb5d4256a";

  it("accepts the whole-content-type target for its own type", () => {
    expect(parseAssignmentTarget("content_type:page", "page")).toEqual({
      contentType: "page",
      entryId: null,
    });
    expect(parseAssignmentTarget("content_type:category", "category")).toEqual({
      contentType: "category",
      entryId: null,
    });
  });

  it("refuses a content type that is not the one this template frames", () => {
    // The assertion that matters. A `page` template pointed at
    // `content_type:category` would put a page layout on every category page —
    // a write RLS permits, because the permission is over the table.
    expect(parseAssignmentTarget("content_type:category", "page")).toBeNull();
    expect(parseAssignmentTarget("content_type:page", "category")).toBeNull();
  });

  it("accepts an entry target and carries the template's own content type", () => {
    // The entry's type is taken from the template, never from the posted value:
    // `0003`'s CHECK does not require `content_type` on an entry row, so the
    // value would be unvalidatable if it came from the client.
    expect(parseAssignmentTarget(`entry:${uuid}`, "page")).toEqual({
      contentType: "page",
      entryId: uuid,
    });
    expect(parseAssignmentTarget(`entry:${uuid}`, "category")).toEqual({
      contentType: "category",
      entryId: uuid,
    });
  });

  it("refuses an entry id that is not a uuid", () => {
    // It reaches `.eq("entry_id", …)` on a uuid column; a non-uuid is a 22P02
    // from Postgres rather than a refusal an editor can read.
    for (const bad of ["entry:", "entry:not-a-uuid", `entry:${uuid} or 1=1`, "entry:../../etc"]) {
      expect(parseAssignmentTarget(bad, "page"), bad).toBeNull();
    }
  });

  it("refuses the scopes the public site does not read", () => {
    // `taxonomy` is a real column with a real unique index, and
    // `publishedTemplateArea` does not resolve it. Accepting one here would
    // store a choice that changes nothing on the site — the trap
    // `visibility.devices` documents.
    expect(parseAssignmentTarget("taxonomy:style", "category")).toBeNull();
    expect(parseAssignmentTarget("taxonomy:page", "page")).toBeNull();
  });

  it("refuses malformed and near-miss values", () => {
    for (const bad of [
      "",
      "page",
      "content_type:",
      "content_type:pages",
      "CONTENT_TYPE:page",
      "content_type:page ",
      `ENTRY:${uuid}`,
    ]) {
      expect(parseAssignmentTarget(bad, "page"), bad).toBeNull();
    }
  });
});
