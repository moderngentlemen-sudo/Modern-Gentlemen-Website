import { describe, expect, it } from "vitest";

import { validateVisualDesign, visualCss, visualDeclarations } from "./visual";

describe("visual element design", () => {
  it("emits bounded responsive layout and interaction CSS", () => {
    const result = visualCss("hero.one", {
      styles: {
        desktop: { display: "grid", columns: 3, gap: 24, background: "dark" },
        mobile: { display: "block", paddingX: 16 },
      },
      effects: { hover: "lift", motion: "gentle" },
    });

    expect(result.scope).toMatch(/^ve-/);
    expect(result.css).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
    expect(result.css).toContain("@media(max-width:680px)");
    expect(result.css).toContain(":hover{transform:translateY(-4px)}");
    expect(result.css).not.toContain("hero.one");
  });

  it("rejects arbitrary CSS values and unknown responsive properties", () => {
    const issues = validateVisualDesign({
      styles: {
        desktop: { display: "block;background:red", position: "fixed" },
        watch: { display: "grid" },
      },
      effects: { hover: "run-script", script: "alert(1)" },
      rawCss: "position:fixed",
    });

    expect(issues.map((issue) => issue.path)).toEqual([
      "visual.rawCss",
      "visual.styles.desktop.display",
      "visual.styles.desktop.position",
      "visual.styles.watch",
      "visual.effects.script",
      "visual.effects.hover",
    ]);
  });

  it("maps every emitted value from a closed vocabulary", () => {
    expect(
      visualDeclarations({
        width: "full",
        maxWidth: "reading",
        radius: "pill",
        opacity: 75,
      })
    ).toBe("width:100%;max-width:760px;margin-inline:auto;border-radius:999px;opacity:0.75");
  });
});
