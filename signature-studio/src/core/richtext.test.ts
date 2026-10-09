import { describe, expect, it } from "vitest";
import { colorWords, parseRich, plainRich, smartKey, toggleMark } from "./richtext";

describe("inline formatting markup", () => {
  it("parses marks, links and colours, nested", () => {
    expect(parseRich("Hi **bold *and italic*** [site](example.com) [red]{#C8102E}")).toEqual([
      { t: "text", v: "Hi " },
      {
        t: "mark",
        mark: "bold",
        kids: [
          { t: "text", v: "bold " },
          { t: "mark", mark: "italic", kids: [{ t: "text", v: "and italic" }] },
        ],
      },
      { t: "text", v: " " },
      { t: "link", href: "example.com", kids: [{ t: "text", v: "site" }], raw: "[site](example.com)" },
      { t: "text", v: " " },
      { t: "color", color: "#C8102E", kids: [{ t: "text", v: "red" }] },
    ]);
    expect(plainRich("__u__ ~~s~~ ==h== *i*")).toBe("u s h i");
  });

  it("leaves stray symbols alone", () => {
    expect(plainRich("5 * 3 = 15, a_b, 2 ** 8")).toBe("5 * 3 = 15, a_b, 2 ** 8");
  });

  it("toggles a mark on the selection, and off again", () => {
    const on = toggleMark("Call me today", 5, 7, "bold");
    expect(on.text).toBe("Call **me** today");
    expect(on.text.slice(on.start, on.end)).toBe("**me**");
    const off = toggleMark(on.text, on.start, on.end, "bold");
    expect(off.text).toBe("Call me today");
    // Markers just outside the selection also toggle off.
    expect(toggleMark("Call **me** today", 7, 9, "bold").text).toBe("Call me today");
    // Spaces stay outside the markers.
    expect(toggleMark("Call me today", 4, 8, "underline").text).toBe("Call __me__ today");
  });

  it("colours words", () => {
    expect(colorWords("Hello world", 6, 11, "#ff0000").text).toBe("Hello [world]{#ff0000}");
    expect(colorWords("Hello [world]{#ff0000}", 6, 22, "#00ff00").text).toBe("Hello [world]{#00ff00}");
  });
});

describe("smart typography", () => {
  const type = (prev: string, ch: string) => smartKey(prev, prev + ch, prev.length + 1)?.text ?? prev + ch;
  it("curls quotes and apostrophes", () => {
    expect(type("She said ", '"')).toBe("She said “");
    expect(type("She said “hi", '"')).toBe("She said “hi”");
    expect(type("It", "'")).toBe("It’");
  });
  it("makes dashes and ellipses but leaves phone numbers alone", () => {
    expect(type("Wait-", "-")).toBe("Wait—");
    expect(type("Wait..", ".")).toBe("Wait…");
    expect(type("416-555", "-")).toBe("416-555-");
    expect(type("416-555-01", "2")).toBe("416-555-012");
  });
  it("never rewrites link targets", () => {
    expect(smartKey("[site](exa", "[site](exa'", 11)).toBeNull();
  });
});
