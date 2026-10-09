import { describe, expect, it } from "vitest";
import { contrast, emailProblem, estimateEmailSize, linkProblem, phoneProblem, runChecks } from "./checks";
import { applyTemplate } from "./apply";
import { block, blocksFromDoc } from "./blocks";
import { newDoc, SAMPLE_DETAILS, SAMPLE_SOCIALS } from "./defaults";
import { TEMPLATES } from "./templates";

const mk = () => {
  const d = newDoc("corporate-classic", TEMPLATES[0].design);
  applyTemplate(d, "corporate-classic");
  d.details = { ...SAMPLE_DETAILS, phone: "+1 416 555 0182", custom: [] };
  d.socials = SAMPLE_SOCIALS();
  return d;
};

describe("field checks", () => {
  it("catches email typos and bad addresses", () => {
    expect(emailProblem("jordan@gmial.com")).toMatch(/gmail\.com/);
    expect(emailProblem("jordan@company.con")).toMatch(/\.com/);
    expect(emailProblem("jordan.company.com")).toMatch(/doesn't look/);
    expect(emailProblem("jordan@company.co.uk")).toBeNull();
  });
  it("judges phone numbers by whether a phone can dial them", () => {
    expect(phoneProblem("555-12")?.level).toBe("error");
    expect(phoneProblem("CALL-NOW-1")?.level).toBe("warning");
    expect(phoneProblem("416 555 0182")?.level).toBe("tip");
    expect(phoneProblem("+1 416 555 0182 ext. 12")).toBeNull();
  });
  it("needs a real domain for links", () => {
    expect(linkProblem("moderngentlemen")).toMatch(/domain/);
    expect(linkProblem("my site.com")).toMatch(/spaces/);
    expect(linkProblem("moderngentlemen.co/about")).toBeNull();
  });
  it("measures contrast like WCAG", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("runChecks", () => {
  it("is quiet for a healthy signature", () => {
    expect(runChecks(mk()).filter((i) => i.level !== "tip")).toEqual([]);
  });

  it("flags problems with a way to fix each, errors first", () => {
    const d = mk();
    d.details.email = "jordan@gmial.com";
    d.design.muted = "#eeeeee";
    d.socials[0].url = "";
    const issues = runChecks(d, { size: 10_400 });
    expect(issues[0].level).toBe("error");
    expect(issues.map((i) => i.id)).toEqual(expect.arrayContaining(["email", "contrast-muted", "social-0", "size"]));
    expect(issues.find((i) => i.id === "email")!.fix!.tab).toBe("details");
  });

  it("checks builder blocks: links, empty images, unreadable panels", () => {
    const d = mk();
    d.mode = "builder";
    d.blocks = blocksFromDoc(d);
    const btn = block("button", { text: "Book", url: "calendly" });
    const img = block("image");
    const pale = block("text", { text: "Hi", style: { color: "#ffffff" } });
    d.blocks.blocks.push(btn, img, pale);
    const ids = runChecks(d).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining([`link-${btn.id}-“Book”`, `img-${img.id}`, `contrast-${pale.id}`]));
    expect(runChecks(d).find((i) => i.id === `img-${img.id}`)!.fix!.blockId).toBe(img.id);
  });

  it("estimates the copied size with realistic image addresses", () => {
    const d = mk();
    const short = estimateEmailSize(d, "https://a.co");
    const long = estimateEmailSize(d, "https://signature-studio-images.example-account.workers.dev");
    expect(long).toBeGreaterThan(short);
  });
});

describe("checks for this batch", () => {
  it("suggests right-to-left for Arabic or Hebrew details, and stops once it's set", () => {
    const d = mk();
    d.details.name = "דנה כהן";
    expect(runChecks(d).some((i) => i.id === "rtl")).toBe(true);
    d.design.direction = "rtl";
    expect(runChecks(d).some((i) => i.id === "rtl")).toBe(false);
  });

  it("flags broken links on text, but accepts emails and phone numbers", () => {
    const d = mk();
    d.mode = "builder";
    d.blocks = blocksFromDoc(d);
    d.blocks.blocks.push(block("text", { text: "Call [me](+1 416 555 0100) or [write](hi@example.com) or [see](not a link)" }));
    const issues = runChecks(d).filter((i) => i.id.startsWith("link-"));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("“see”");
  });
});
