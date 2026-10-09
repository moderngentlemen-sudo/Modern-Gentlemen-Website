import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { addVersion, restoreInto, type Version } from "./versions";
import { newDoc } from "./defaults";
import { TEMPLATES } from "./templates";

const v = (id: string, auto = false): Version => ({ id, name: id, at: 0, auto, doc: newDoc(TEMPLATES[0].id, TEMPLATES[0].design) });

describe("version history", () => {
  it("keeps newest first and prunes automatic snapshots before named ones", () => {
    let list: Version[] = [];
    list = addVersion(list, v("named-1"), 3);
    list = addVersion(list, v("auto-1", true), 3);
    list = addVersion(list, v("named-2"), 3);
    list = addVersion(list, v("named-3"), 3);
    expect(list.map((x) => x.id)).toEqual(["named-3", "named-2", "named-1"]);
    list = addVersion(list, v("named-4"), 3);
    expect(list.map((x) => x.id)).toEqual(["named-4", "named-3", "named-2"]);
  });

  it("restores content but keeps the signature's identity and published images", () => {
    const current = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
    current.details.name = "Now";
    current.published = { k: { url: "https://x/y.png", hash: "h", verifiedAt: 1 } } as unknown as typeof current.published;
    current.madeWith = false;
    const snap = structuredClone(current);
    snap.id = "other";
    snap.details.name = "Then";
    delete snap.madeWith;
    snap.published = {};
    const out = produce(current, (d) => restoreInto(d, snap));
    expect(out.details.name).toBe("Then");
    expect(out.id).toBe(current.id);
    expect(out.published).toEqual(current.published);
    expect("madeWith" in out).toBe(false);
  });
});
