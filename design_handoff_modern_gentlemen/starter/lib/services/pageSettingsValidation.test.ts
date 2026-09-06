import { describe, expect, it } from "vitest";
import { validateDocumentPayload } from "./documents";

describe("page settings publish validation", () => {
  it("accepts existing payloads and optional page presentation", () => {
    expect(validateDocumentPayload("page", { sections: [], seo: { title: "Existing" } }).ok).toBe(
      true
    );
    expect(
      validateDocumentPayload("page", {
        sections: [],
        pageSettings: {
          header: "hidden",
          mobileHeader: "inherit",
          backgroundVideo: "https://example.com/a.mp4",
        },
      }).ok
    ).toBe(true);
  });
  it("reports invalid page-level fields at publish", () => {
    const result = validateDocumentPayload("page", {
      sections: [],
      pageSettings: { backgroundVideo: "javascript:alert(1)", focalX: 101 },
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      "pageSettings.backgroundVideo",
      "pageSettings.focalX",
    ]);
  });
});
