import { describe, expect, it } from "vitest";
import { familyFromFile, fontKind } from "./fonts";

describe("brand font files", () => {
  it("recognises font formats by their first bytes", () => {
    expect(fontKind(new TextEncoder().encode("wOF2"))).toBe("woff2");
    expect(fontKind(new TextEncoder().encode("OTTO"))).toBe("otf");
    expect(fontKind(new Uint8Array([0, 1, 0, 0]))).toBe("ttf");
    expect(fontKind(new TextEncoder().encode("<svg"))).toBeNull();
  });

  it("names the family from the file", () => {
    expect(familyFromFile("Acme-Sans_Bold.woff2")).toBe("Acme Sans Bold");
    expect(familyFromFile("x';<b>.ttf")).toBe("xb");
  });
});
