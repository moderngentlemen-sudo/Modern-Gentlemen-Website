import { describe, expect, it } from "vitest";

import { validateDocumentPayload } from "./documents";
import { DOCUMENT_CONTENT_TYPE } from "@/lib/blocks/templateContent";
import type { Json } from "@/lib/db/database.types";
import type { DocumentType } from "@/lib/domain/documents";

/**
 * The publish rules for a template's `documentContent` marker.
 *
 * Every case here is silent at authoring time and destructive at render time,
 * which is exactly what publish validation exists to catch — the editor is still
 * looking at the thing when it is refused, rather than discovering it from a
 * live page that lost its content.
 */

const marker = (key = "m") => ({ _key: key, _type: DOCUMENT_CONTENT_TYPE, settings: {} });
const masthead = (key: string) => ({
  _key: key,
  _type: "masthead",
  settings: { eyebrow: "Eyebrow", headline: "Headline" },
});

function areas(map: Record<string, unknown[]>): Json {
  return { areas: map } as unknown as Json;
}

/** Only the marker rules, so a content issue in a fixture cannot pass as one. */
function markerIssues(payload: Json, type: DocumentType = "template") {
  return validateDocumentPayload(type, payload).issues.filter(
    (issue) => issue.type === DOCUMENT_CONTENT_TYPE
  );
}

describe("template publish validation — the content marker", () => {
  it("accepts exactly one marker in main", () => {
    expect(markerIssues(areas({ main: [masthead("a"), marker()] }))).toEqual([]);
  });

  it("accepts a marker nested inside a container", () => {
    // Nesting is the point of the marker over bookend areas — a template that
    // puts the page inside a column must validate.
    const payload = areas({
      main: [
        {
          _key: "row",
          _type: "columns",
          settings: {},
          children: [{ _key: "col", _type: "column", settings: {}, children: [marker()] }],
        },
      ],
    });

    expect(markerIssues(payload)).toEqual([]);
  });

  it("refuses a template with no marker at all", () => {
    // Without one the template frames nothing and every page assigned to it
    // would lose its own sections.
    const issues = markerIssues(areas({ main: [masthead("a")] }));

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/needs a Page content block/);
    expect(issues[0].path).toBe("areas.main");
  });

  it("refuses two markers, which would render the page's sections twice", () => {
    const issues = markerIssues(areas({ main: [marker("one"), marker("two")] }));

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/exactly one/);
    // Points at the second one — the one to delete.
    expect(issues[0].key).toBe("two");
  });

  it("accepts a marker in an area that is not called main", () => {
    // ⚠️ The rule that used to live here required `main`, and the templates E2E
    // found the flaw in one run: it renames the only area to `body`, which is
    // an ordinary edit, and a name-based rule turned it into an unpublishable
    // document. `findContentArea` keys the renderer on the marker instead, so
    // this must publish cleanly.
    expect(markerIssues(areas({ body: [masthead("a"), marker()] }))).toEqual([]);
  });

  it("counts markers across every area, not just one", () => {
    // Two areas each holding one is still two: which area renders would be
    // arbitrary, so it is refused rather than resolved.
    const issues = markerIssues(areas({ main: [marker("one")], footer: [marker("two")] }));

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/exactly one/);
  });

  it("leaves every other document type alone", () => {
    // A page has no marker and must never be asked for one — a page *is* the
    // content. Asserted as a contrast rather than against `ok`, because `ok`
    // also folds in every manifest's own field rules and would make this pass
    // or fail for reasons that have nothing to do with the marker.
    const sameShape = areas({ main: [masthead("a")] });

    expect(markerIssues(sameShape, "template")).toHaveLength(1);
    expect(markerIssues(sameShape, "page")).toEqual([]);
    expect(markerIssues(sameShape, "article")).toEqual([]);
    expect(markerIssues(sameShape, "pattern")).toEqual([]);
  });
});
