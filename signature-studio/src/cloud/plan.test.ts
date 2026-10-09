import { describe, expect, it } from "vitest";
import { docHash, planSync, stableStringify, type Base } from "./plan";
import { newDoc } from "../core/defaults";
import { TEMPLATES } from "../core/templates";

const meta = (id: string, revision: number, deleted = false) => ({ id, revision, deleted });
const plan = (local: Record<string, string>, remote: ReturnType<typeof meta>[], base: Record<string, Base> = {}) =>
  planSync(new Map(Object.entries(local)), remote, base);

describe("sync planning", () => {
  it("uploads new local signatures and downloads new cloud ones", () => {
    expect(plan({ a: "h1" }, [meta("b", 3)])).toEqual([
      { kind: "push-new", id: "a" },
      { kind: "pull", id: "b" },
    ]);
  });

  it("does nothing when neither side changed", () => {
    expect(plan({ a: "h1" }, [meta("a", 2)], { a: { revision: 2, hash: "h1" } })).toEqual([]);
  });

  it("pushes a local edit against the revision it last saw, and pulls a remote edit", () => {
    expect(plan({ a: "h2" }, [meta("a", 2)], { a: { revision: 2, hash: "h1" } })).toEqual([{ kind: "push", id: "a", expected: 2 }]);
    expect(plan({ a: "h1" }, [meta("a", 3)], { a: { revision: 2, hash: "h1" } })).toEqual([{ kind: "pull", id: "a" }]);
  });

  it("flags a conflict when both sides changed, or when both have it with no shared history", () => {
    expect(plan({ a: "h2" }, [meta("a", 3)], { a: { revision: 2, hash: "h1" } })).toEqual([{ kind: "conflict", id: "a" }]);
    expect(plan({ a: "h1" }, [meta("a", 1)])).toEqual([{ kind: "conflict", id: "a" }]);
  });

  it("propagates deletes, but an edit elsewhere beats a delete", () => {
    expect(plan({}, [meta("a", 2)], { a: { revision: 2, hash: "h1" } })).toEqual([{ kind: "delete-remote", id: "a", expected: 2 }]);
    expect(plan({}, [meta("a", 3)], { a: { revision: 2, hash: "h1" } })).toEqual([{ kind: "pull", id: "a" }]);
    expect(plan({ a: "h1" }, [meta("a", 3, true)], { a: { revision: 2, hash: "h1" } })).toEqual([{ kind: "delete-local", id: "a" }]);
    expect(plan({ a: "h9" }, [meta("a", 3, true)], { a: { revision: 2, hash: "h1" } })).toEqual([{ kind: "push", id: "a", expected: 3 }]);
  });

  it("never drops a local signature that vanished from the cloud", () => {
    expect(plan({ a: "h1" }, [], { a: { revision: 4, hash: "h1" } })).toEqual([{ kind: "push-new", id: "a" }]);
    expect(plan({}, [], { a: { revision: 4, hash: "h1" } })).toEqual([{ kind: "forget", id: "a" }]);
  });

  it("hashes content, not key order or save time", () => {
    expect(stableStringify({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(stableStringify({ a: [2, { c: 4, d: 3 }], b: 1 }));
    const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
    const later = { ...d, updatedAt: d.updatedAt + 5000 };
    expect(docHash(later)).toBe(docHash(d));
    expect(docHash({ ...d, name: "Other" })).not.toBe(docHash(d));
  });
});
