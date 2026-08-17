/**
 * The filterable-field vocabulary, and its conformance to the rows it describes.
 *
 * Two separate claims are under test here.
 *
 * The first is coercion, which is ordinary unit-test material: a filter value
 * has to arrive at the source as the type the row actually holds, because both
 * sources match with `===` and a mistyped filter matches nothing *silently*.
 *
 * The second is the one worth the file. `FILTERABLE_FIELDS` is a hand-written
 * description of row shapes that are built in code, in two places. Nothing stops
 * the two drifting — except this, which walks the real demo rows and checks
 * every declared key against them, key and type both. Same argument
 * `conformance.test.ts` makes about manifests and the component registry: two
 * lists that must agree, kept apart on purpose, so what keeps them in step has
 * to be a test.
 */

import { describe, expect, it } from "vitest";

import { demoBindingSources } from "./sources/demo";
import {
  FILTERABLE_FIELDS,
  coerceFilterValue,
  filterValueToInput,
  filterableFieldFor,
  filterableFieldsFor,
} from "./bindingFields";

function rowsOf(source: string): Record<string, unknown>[] {
  const result = demoBindingSources[source].fetch({ source });
  return result as Record<string, unknown>[];
}

describe("the filterable vocabulary describes the rows it claims to", () => {
  it("covers every source the sources map offers", () => {
    // A source with no entry would render a filter control with nothing in it,
    // which reads as "this cannot be filtered" rather than "nobody wrote it down".
    expect(Object.keys(FILTERABLE_FIELDS).sort()).toEqual(Object.keys(demoBindingSources).sort());
  });

  for (const [source, fields] of Object.entries(FILTERABLE_FIELDS)) {
    describe(source, () => {
      const rows = rowsOf(source);

      it("has rows to check against at all", () => {
        // Guards the assertions below from passing vacuously.
        expect(rows.length).toBeGreaterThan(0);
      });

      for (const field of fields) {
        it(`${field.key} exists on every row, as a ${field.type}`, () => {
          for (const row of rows) {
            expect(row).toHaveProperty(field.key);
            expect(typeof row[field.key]).toBe(field.type);
          }
        });
      }
    });
  }
});

describe("filterableFieldsFor", () => {
  it("returns nothing for a source that does not exist, rather than throwing", () => {
    // The editor calls this before a source has been chosen.
    expect(filterableFieldsFor(undefined)).toEqual([]);
    expect(filterableFieldsFor("nonsense")).toEqual([]);
  });

  it("finds a field by key within its source only", () => {
    expect(filterableFieldFor("articles", "lead")?.type).toBe("boolean");
    // `group` is a product fact; offering it under articles would build a
    // filter that silently matches nothing.
    expect(filterableFieldFor("articles", "group")).toBeUndefined();
  });
});

describe("coerceFilterValue", () => {
  it("keeps a zero-padded issue a string, which is the trap this exists for", () => {
    // `issue` holds "040". Coerced to a number it becomes 40 and `===` never
    // matches a single row — an empty block, no error, nothing in a log.
    expect(coerceFilterValue("string", "040")).toBe("040");
  });

  it("produces real booleans, not the strings a select gives back", () => {
    expect(coerceFilterValue("boolean", "true")).toBe(true);
    expect(coerceFilterValue("boolean", "false")).toBe(false);
  });

  it("produces real numbers", () => {
    expect(coerceFilterValue("number", "145")).toBe(145);
    expect(coerceFilterValue("number", "14.5")).toBe(14.5);
  });

  it("refuses a half-finished edit rather than storing a filter that cannot match", () => {
    expect(coerceFilterValue("string", "")).toBeUndefined();
    expect(coerceFilterValue("number", "")).toBeUndefined();
    expect(coerceFilterValue("number", "  ")).toBeUndefined();
    expect(coerceFilterValue("number", "not a number")).toBeUndefined();
    expect(coerceFilterValue("boolean", "")).toBeUndefined();
  });

  it("round-trips a stored value back into a control", () => {
    expect(filterValueToInput("040")).toBe("040");
    expect(filterValueToInput(true)).toBe("true");
    expect(filterValueToInput(145)).toBe("145");
    expect(filterValueToInput(undefined)).toBe("");
  });
});
