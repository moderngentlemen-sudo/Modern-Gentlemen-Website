import { describe, expect, it } from "vitest";
import { FakeApi } from "./fakeApi";
import { emptySyncState, runSync, type LocalSide, type SyncState } from "./engine";
import { newDoc } from "../core/defaults";
import { TEMPLATES } from "../core/templates";
import type { SignatureDoc } from "../core/types";

/** One device: its own signatures, images, preferences and sync bookkeeping. */
function device() {
  const docs = new Map<string, SignatureDoc>();
  const assets = new Map<string, Blob>();
  let state: SyncState = emptySyncState();
  let prefs: Record<string, unknown> = {};
  const side: LocalSide = {
    listDocs: async () => [...docs.values()].map((d) => structuredClone(d)),
    putDoc: async (d) => void docs.set(d.id, structuredClone(d)),
    removeDoc: async (id) => void docs.delete(id),
    getAsset: async (id) => assets.get(id) ?? null,
    putAsset: async (id, b) => void assets.set(id, b),
    getState: async () => structuredClone(state),
    putState: async (s) => void (state = structuredClone(s)),
    getPrefs: () => prefs,
    setPrefs: (p) => void (prefs = { ...prefs, ...p }),
  };
  return { docs, assets, side, prefs: () => prefs, setPrefs: (p: Record<string, unknown>) => void (prefs = p) };
}

const sig = (name: string) => {
  const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
  d.name = name;
  return d;
};

async function signedIn() {
  const api = new FakeApi();
  await api.signInWithEmail("ada@example.com");
  return api;
}

describe("cloud sync between two devices", () => {
  it("moves a signature and its images to a new device", async () => {
    const api = await signedIn();
    const a = device();
    const b = device();
    const d = sig("Work");
    d.assets.p = { id: "p", name: "p.png", mime: "image/png", width: 1, height: 1, bytes: 3, hash: "hash-p" };
    a.docs.set(d.id, d);
    a.assets.set("p", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
    expect((await runSync(api, a.side)).pushed).toBe(1);
    const r = await runSync(api, b.side);
    expect(r.pulled).toBe(1);
    expect(b.docs.get(d.id)?.name).toBe("Work");
    expect(new Uint8Array(await b.assets.get("p")!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    // Nothing left to do on either side.
    const writes = api.writes;
    await runSync(api, a.side);
    await runSync(api, b.side);
    expect(api.writes).toBe(writes);
  });

  it("carries edits and deletes across, and an edit beats a delete", async () => {
    const api = await signedIn();
    const a = device();
    const b = device();
    const d = sig("Work");
    a.docs.set(d.id, d);
    await runSync(api, a.side);
    await runSync(api, b.side);

    b.docs.get(d.id)!.details.name = "Ada Lovelace";
    await runSync(api, b.side);
    await runSync(api, a.side);
    expect(a.docs.get(d.id)!.details.name).toBe("Ada Lovelace");

    // A deletes while B edits: B's edit wins, A gets it back.
    a.docs.delete(d.id);
    b.docs.get(d.id)!.details.title = "Countess";
    await runSync(api, b.side);
    await runSync(api, a.side);
    expect(a.docs.get(d.id)?.details.title).toBe("Countess");

    // A plain delete reaches the other device.
    a.docs.delete(d.id);
    await runSync(api, a.side);
    const r = await runSync(api, b.side);
    expect(r.removed).toEqual([d.id]);
    expect(b.docs.has(d.id)).toBe(false);
  });

  it("keeps both versions when two devices edit the same signature", async () => {
    const api = await signedIn();
    const a = device();
    const b = device();
    const d = sig("Work");
    a.docs.set(d.id, d);
    await runSync(api, a.side);
    await runSync(api, b.side);
    a.docs.get(d.id)!.details.name = "From A";
    b.docs.get(d.id)!.details.name = "From B";
    await runSync(api, a.side);
    const r = await runSync(api, b.side);
    expect(r.conflicts).toEqual(["Work (this device)"]);
    const names = [...b.docs.values()].map((x) => x.details.name).sort();
    expect(names).toEqual(["From A", "From B"]);
    await runSync(api, a.side);
    expect(a.docs.size).toBe(2);
  });

  it("syncs saved profile and brand kit, but never device settings like the image-host key", async () => {
    const api = await signedIn();
    const a = device();
    const b = device();
    a.setPrefs({ brand: { company: "Northwind" }, host: { endpoint: "https://img", token: "secret" } });
    b.setPrefs({ favorites: ["x"] });
    await runSync(api, a.side);
    await runSync(api, b.side);
    expect(b.prefs()).toMatchObject({ brand: { company: "Northwind" }, favorites: ["x"] });
    expect(b.prefs().host).toBeUndefined();
    expect(JSON.stringify(await api.getPrefs())).not.toContain("secret");
    a.setPrefs({ ...a.prefs(), brand: { company: "Northwind Studio" } });
    await runSync(api, a.side);
    await runSync(api, b.side);
    await runSync(api, a.side);
    expect(b.prefs().brand).toEqual({ company: "Northwind Studio" });
    expect(a.prefs().favorites).toEqual(["x"]);
  });
});
