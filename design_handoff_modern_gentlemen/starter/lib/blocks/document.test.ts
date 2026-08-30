import { describe, expect, it } from "vitest";

import {
  BUILDER_META_KEY,
  CURRENT_BUILDER_SCHEMA_VERSION,
  builderSchemaVersion,
  stampBuilderPayload,
} from "./document";

describe("builder document versions", () => {
  it("treats an unversioned existing payload as legacy version zero", () => {
    expect(builderSchemaVersion({ sections: [] })).toBe(0);
  });

  it("stamps a payload without changing its content tree", () => {
    const sections = [{ _key: "hero", _type: "masthead" }];
    const stamped = stampBuilderPayload({ sections, seo: { title: "Home" } });

    expect(stamped.sections).toBe(sections);
    expect(stamped.seo).toEqual({ title: "Home" });
    expect(stamped[BUILDER_META_KEY]).toEqual({
      schemaVersion: CURRENT_BUILDER_SCHEMA_VERSION,
    });
  });

  it("preserves future-compatible metadata fields while updating the version", () => {
    const stamped = stampBuilderPayload({
      [BUILDER_META_KEY]: { schemaVersion: 0, source: "legacy-import" },
    });

    expect(stamped._builder).toEqual({
      schemaVersion: CURRENT_BUILDER_SCHEMA_VERSION,
      source: "legacy-import",
    });
  });
});
