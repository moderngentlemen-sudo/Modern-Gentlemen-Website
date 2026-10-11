import { describe, expect, it } from "vitest";
import { syncPhone, samePhone } from "./phoneLayout";
import { block, col, rowOf } from "./blocks";
import type { Block, Column } from "./types";

const ids = (c: Column) => c.blocks.map((b) => b.id);
const find = (c: Column, id: string) => c.blocks.find((b) => b.id === id) as Block;

function setup() {
  const desktop = col([block("name"), block("text", { text: "Hello" }), block("contacts")]);
  const phone = structuredClone(desktop);
  return { desktop, phone };
}

describe("the phone layout follows desktop where it hasn't been changed on the phone", () => {
  it("a desktop edit flows through when the phone copy still had the old value", () => {
    const { desktop, phone } = setup();
    const after = structuredClone(desktop);
    (after.blocks[1] as Extract<Block, { type: "text" }>).text = "Hi there";
    const next = syncPhone(desktop, after, phone);
    expect((find(next, desktop.blocks[1].id) as Extract<Block, { type: "text" }>).text).toBe("Hi there");
  });

  it("a field changed on the phone keeps its phone value", () => {
    const { desktop, phone } = setup();
    phone.blocks[1].style = { fontSize: 11 };
    const after = structuredClone(desktop);
    after.blocks[1].style = { fontSize: 18, align: "center" };
    const next = syncPhone(desktop, after, phone);
    // Font size was the phone's own; alignment is new from desktop.
    expect(find(next, desktop.blocks[1].id).style).toEqual({ fontSize: 11, align: "center" });
  });

  it("blocks added on desktop appear next to the same neighbour; deleted ones go", () => {
    const { desktop, phone } = setup();
    // On the phone, the text moved to the end.
    phone.blocks.push(phone.blocks.splice(1, 1)[0]);
    const after = structuredClone(desktop);
    const added = block("tag", { text: "New" });
    after.blocks.splice(1, 0, added);
    after.blocks.splice(3, 1); // remove contacts
    const next = syncPhone(desktop, after, phone);
    expect(ids(next)).toEqual([desktop.blocks[0].id, added.id, desktop.blocks[1].id]);
  });

  it("phone-only blocks and the phone's order are left alone; rows and columns merge too", () => {
    const r = rowOf([col([block("photo")]), col([block("title")])], { gap: 12 });
    const desktop = col([r]);
    const phone = structuredClone(desktop);
    const extra = block("text", { text: "Phone only" });
    phone.blocks.push(extra);
    const after = structuredClone(desktop);
    const row = after.blocks[0] as Extract<Block, { type: "row" }>;
    row.gap = 30;
    row.columns[1].width = 200;
    const next = syncPhone(desktop, after, phone);
    const nr = next.blocks[0] as Extract<Block, { type: "row" }>;
    expect(nr.gap).toBe(30);
    expect(nr.columns[1].width).toBe(200);
    expect(ids(next)).toContain(extra.id);
  });

  it("knows when the phone copy is no different", () => {
    const { desktop, phone } = setup();
    expect(samePhone(desktop, phone)).toBe(true);
    phone.blocks.pop();
    expect(samePhone(desktop, phone)).toBe(false);
  });
});
