/**
 * The conformance suite — the point of the manifest system.
 *
 * A block's contract lives in three places that TypeScript cannot relate to
 * each other: the component's props, the registry entry, and the manifest.
 * These tests are what actually holds them together. If one of them fails, the
 * fix is to bring the manifest back in line with its component — not to relax
 * the test.
 */

import { describe, expect, it } from "vitest";

import { registry } from "@/components/sections/registry";
import { blockManifests, blockTypes, manifestFor } from "./manifests";
import { normalizeBlock } from "./normalize";
import { formatIssues, validateBlock } from "./validate";
import { isField, type Field, type FieldSet } from "./fields";
import { DOCUMENT_CONTENT_GAP_TYPE, DOCUMENT_CONTENT_TYPE } from "./templateContent";
import { BLOCK_CATEGORIES, type BlockManifest } from "./types";

const manifests = Object.entries(blockManifests) as [string, BlockManifest][];

describe("registry ↔ manifest parity", () => {
  it("every registered block has a manifest", () => {
    const missing = Object.keys(registry).filter((type) => !manifestFor(type));
    expect(missing, "blocks in registry.ts with no manifest").toEqual([]);
  });

  it("every manifest has a registered component", () => {
    const orphans = blockTypes.filter((type) => !(type in registry));
    expect(orphans, "manifests with no component in registry.ts").toEqual([]);
  });

  it("the manifest map is keyed by each manifest's own type", () => {
    for (const [key, manifest] of manifests) expect(manifest.type).toBe(key);
  });

  it("the two template markers are registered under the names their callers use", () => {
    // Both are constructed by code rather than chosen from the library, so
    // nothing an editor does would surface a typo: `SectionRenderer` renders
    // nothing at all for an unregistered `_type` outside development, and the
    // gap block's whole job is to stop a template's content slot being
    // invisible. A wrong string would restore exactly the bug it removes.
    expect(registry).toHaveProperty(DOCUMENT_CONTENT_TYPE);
    expect(registry).toHaveProperty(DOCUMENT_CONTENT_GAP_TYPE);
  });
});

describe.each(manifests)("%s", (type, manifest) => {
  it("declares a label, description and known category", () => {
    expect(manifest.label.trim()).not.toBe("");
    expect(manifest.description.trim()).not.toBe("");
    expect(BLOCK_CATEGORIES).toContain(manifest.category);
  });

  it("labels every field, at every depth", () => {
    for (const [path, field] of eachField(manifest.fields)) {
      expect(field.label?.trim(), `${type}.${path} has no label`).toBeTruthy();
    }
  });

  it("gives every select field usable, unique options", () => {
    for (const [path, field] of eachField(manifest.fields)) {
      if (field.kind !== "select") continue;
      const values = field.options.map((o) => o.value);
      expect(values.length, `${type}.${path} has no options`).toBeGreaterThan(0);
      expect(new Set(values).size, `${type}.${path} has duplicate option values`).toBe(
        values.length
      );
      if (field.default !== undefined) {
        expect(values, `${type}.${path} default is not one of its options`).toContain(
          field.default
        );
      }
    }
  });

  it("has insert defaults that satisfy its own schema", () => {
    // `defineBlock` throws on this at module load; asserting it here means the
    // failure reads as a named test rather than an import-time stack trace.
    const parsed = manifest.schema.safeParse(manifest.insertDefaults);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("normalizes a freshly inserted block idempotently", () => {
    const node = { _key: "k", _type: type, ...manifest.insertDefaults };
    const once = normalizeBlock(node);
    const twice = normalizeBlock({ _key: "k", _type: type, ...once });
    expect(twice).toEqual(once);
  });

  it("marks only real fields as bindable", () => {
    for (const name of manifest.bindable) expect(Object.keys(manifest.fields)).toContain(name);
  });

  it("passes publish validation with a $bind descriptor on every bindable field", () => {
    // A bound field holds `{ $bind: … }` where its literal value would sit, and
    // the literal type rejects that. Until validateBlock lifted bound fields out
    // before parsing, NO page carrying a binding could be published — latent
    // only because the seed data is entirely literals.
    for (const name of manifest.bindable) {
      const node = {
        _key: "k",
        _type: type,
        settings: {
          ...manifest.insertDefaults,
          [name]: { $bind: { source: "articles", limit: 3 } },
        },
      };
      const result = validateBlock(node);
      expect(result.ok, `${type}.${name}: ${formatIssues(result.issues)}`).toBe(true);
    }
  });

  it("reports a malformed $bind query against the bound field", () => {
    for (const name of manifest.bindable) {
      const node = {
        _key: "k",
        _type: type,
        // `source` is required and must be non-empty.
        settings: { ...manifest.insertDefaults, [name]: { $bind: { source: "" } } },
      };
      const result = validateBlock(node);
      expect(result.ok).toBe(false);
      expect(result.issues.map((i) => i.path)).toContain(`${name}.$bind.source`);
    }
  });

  it("still rejects an undeclared prop at publish", () => {
    const node = {
      _key: "k",
      _type: type,
      settings: { ...manifest.insertDefaults, notAFieldOnThisBlock: "x" },
    };
    expect(validateBlock(node).ok).toBe(false);
  });
});

/** Every field in a set, including group members and list item fields, with a dotted path. */
function* eachField(fields: FieldSet, prefix = ""): Generator<[string, Field]> {
  for (const [name, field] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${name}` : name;
    yield [path, field];

    if (field.kind === "group") {
      yield* eachField(field.fields, path);
    } else if (field.kind === "list") {
      if (isField(field.of)) yield [`${path}[]`, field.of];
      else yield* eachField(field.of, `${path}[]`);
    }
  }
}
