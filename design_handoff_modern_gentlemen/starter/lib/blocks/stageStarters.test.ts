import { describe, expect, it } from "vitest";

import { REEL_DESIGNS } from "./comingSoonReel";
import { stageFromComingSoon, stageStarter } from "./stageStarters";
import { flattenBlocks } from "./traverse";
import { validateTree } from "./validate";

describe("Stage starters (CS22–CS35)", () => {
  it.each(REEL_DESIGNS.map(([id, label]) => [id, label]))(
    "CS%s %s is a valid stage of placed elements",
    (id) => {
      const tree = stageStarter(id);
      expect(validateTree(tree).issues).toEqual([]);
      expect(tree).toHaveLength(1);
      expect(tree[0]._type).toBe("stageLayout");
      const children = tree[0].children ?? [];
      expect(children.length).toBeGreaterThanOrEqual(5);
      for (const child of children) expect(child.visual?.stage?.desktop).toBeDefined();
      const keys = flattenBlocks(tree).map((n) => n._key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  );

  it("carries the editor's own copy, links and launch date", () => {
    const tree = stageStarter("22", {
      title: "Arriving January",
      target: "2027-01-15T18:00:00-05:00",
      socialLinks: [{ network: "x", label: "X", href: "https://x.com/mg" }],
    });
    const all = flattenBlocks(tree);
    expect(JSON.stringify(all)).toContain("Arriving January");
    expect(all.find((n) => n._type === "nativeCountdown")?.settings?.target).toBe(
      "2027-01-15T18:00:00-05:00"
    );
    expect(all.find((n) => n._type === "nativeSocial")?.settings?.links).toEqual([
      { network: "x", label: "X", href: "https://x.com/mg" },
    ]);
  });

  it("invents no launch date", () => {
    for (const [id] of REEL_DESIGNS)
      for (const n of flattenBlocks(stageStarter(id)))
        if (n._type === "nativeCountdown") expect(n.settings?.target).toBe("");
  });

  it("hides purely decorative pieces on phones rather than stacking them", () => {
    const band = flattenBlocks(stageStarter("29")).find((n) => n.visual?.name === "Red band");
    expect(band?.visibility?.devices).toEqual(["desktop", "tablet"]);
  });
});

describe("Converting an existing Coming Soon block", () => {
  const block = {
    variant: "22",
    title: "Coming soon",
    brand: "Modern Gentlemen",
    showSignup: false,
    buttonLabel: "Notify me",
    reel: { video: "/media/coming-soon-reel.mp4", countdown: { target: "" } },
    afterHours: { countdown: { target: "2027-01-15T18:00:00-05:00" } },
    socialLinks: [{ network: "instagram", label: "Instagram", href: "https://instagram.com/mg" }],
  };

  it("keeps the editor's copy, links and launch date, and adds no copy they never wrote", () => {
    const tree = stageFromComingSoon(block)!;
    expect(validateTree(tree).issues).toEqual([]);
    const all = flattenBlocks(tree);
    expect(all.find((n) => n._type === "nativeCountdown")?.settings?.target).toBe(
      "2027-01-15T18:00:00-05:00"
    );
    expect(all.some((n) => n._type === "nativeSignup")).toBe(false);
    expect(all.some((n) => n.visual?.name === "Supporting copy")).toBe(false);
    expect(JSON.stringify(all)).toContain("instagram.com/mg");
  });

  it("carries the page's font choices onto the elements that used those roles", () => {
    const tree = stageFromComingSoon({
      ...block,
      fonts: { heading: "webfont:brand-serif", label: "google:Lora" },
    })!;
    expect(validateTree(tree).issues).toEqual([]);
    const fonts = flattenBlocks(tree).flatMap((n) =>
      ["fontFamily", "font", "labelFont"].map((k) => n.settings?.[k]).filter(Boolean)
    );
    expect(fonts).toContain("webfont:brand-serif");
    expect(fonts).toContain("google:Lora");
    expect(fonts).not.toContain("theme:heading");
    expect(fonts).not.toContain("theme:label");
  });

  it("refuses designs that are not sizzle-reel designs", () => {
    expect(stageFromComingSoon({ variant: "05" })).toBeNull();
  });
});
