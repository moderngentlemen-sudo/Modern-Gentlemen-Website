import { describe, expect, it } from "vitest";
import { applySuggestion, buildRequest, validateSuggestions } from "./aiSuggest";
import { newDoc, SAMPLE_DETAILS } from "./defaults";
import { TEMPLATES } from "./templates";

describe("AI design suggestions", () => {
  it("send the role and what exists, never contact details", () => {
    const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
    d.details = { ...SAMPLE_DETAILS, custom: [] };
    const req = JSON.stringify(buildRequest(d, "warmer, law firm"));
    expect(req).toContain(SAMPLE_DETAILS.title);
    for (const k of ["email", "phone", "address", "name"] as const) if (SAMPLE_DETAILS[k]) expect(req).not.toContain(SAMPLE_DETAILS[k]);
  });

  it("keep only real templates, valid colours and known fonts", () => {
    const [a, b] = TEMPLATES;
    const out = validateSuggestions({
      suggestions: [
        { templateId: a.id, title: "One", why: "x", accent: "#C8102E", headingFont: "playfair", bodyFont: "comic-sans" },
        { templateId: "made-up", title: "Nope" },
        { templateId: a.id, title: "Repeat" },
        { templateId: b.id, accent: "red" },
      ],
    });
    expect(out.map((s) => s.templateId)).toEqual([a.id, b.id]);
    expect(out[0]).toMatchObject({ accent: "#c8102e", headingFont: "playfair", bodyFont: undefined });
    expect(out[1].accent).toBeUndefined();
    expect(out[1].title).toBe(b.name);
    expect(validateSuggestions("nonsense")).toEqual([]);
  });

  it("apply the template, then the personal touches", () => {
    const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
    const t = TEMPLATES[5];
    applySuggestion(d, { templateId: t.id, title: "", why: "", accent: "#123456", headingFont: "playfair" });
    expect(d.templateId).toBe(t.id);
    expect(d.design.accent).toBe("#123456");
    expect(d.design.headingFont).toBe("playfair");
  });
});
