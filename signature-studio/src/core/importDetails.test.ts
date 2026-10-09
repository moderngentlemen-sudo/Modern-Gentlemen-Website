import { describe, expect, it } from "vitest";
import { parseSignatureText, parseVCard } from "./importDetails";

describe("vCard import", () => {
  it("reads an iPhone-style card, including folded lines and socials", () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Stone;Avery;;;",
      "FN:Avery Stone",
      "ORG:Stone & Partners LLP;Litigation",
      "TITLE:Senior Partner",
      "item1.EMAIL;type=INTERNET;type=pref:avery@stone.law",
      "TEL;type=CELL;type=VOICE;type=pref:+1 (416) 555-0101",
      "TEL;type=WORK;type=VOICE:+1 416 555 0100",
      "item2.ADR;type=WORK:;;120 Bay St\\, Suite 4;Toronto;ON;M5J 2T3;Canada",
      "URL:https://stone.law",
      "X-SOCIALPROFILE;type=linkedin:https://www.linkedin.com/in/averystone",
      "NOTE:Folded long line that continues",
      " right here.",
      "END:VCARD",
    ].join("\r\n");
    const r = parseVCard(vcf);
    expect(r.details).toMatchObject({
      name: "Avery Stone",
      title: "Senior Partner",
      company: "Stone & Partners LLP",
      department: "Litigation",
      email: "avery@stone.law",
      mobile: "+1 (416) 555-0101",
      phone: "+1 416 555 0100",
      website: "stone.law",
      address: "120 Bay St, Suite 4, Toronto, ON, M5J 2T3, Canada",
    });
    expect(r.socials).toEqual([{ platform: "linkedin", url: "https://www.linkedin.com/in/averystone" }]);
  });

  it("treats a lone mobile as the phone", () => {
    const r = parseVCard("BEGIN:VCARD\nFN:Sam Lee\nTEL;TYPE=CELL:+44 7700 900123\nEND:VCARD");
    expect(r.details.phone).toBe("+44 7700 900123");
    expect(r.details.mobile).toBeUndefined();
  });
});

describe("pasted signature import", () => {
  it("reads a typical signature", () => {
    const r = parseSignatureText(`Best regards,
Jordan Ellis
Creative Director at Modern Gentlemen
M: +1 647 555 0119 | T: +1 416 555 0182
jordan@moderngentlemen.co | moderngentlemen.co
88 Yorkville Ave, Toronto
linkedin.com/in/jordanellis · instagram.com/moderngentlemen`);
    expect(r.details).toMatchObject({
      name: "Jordan Ellis",
      title: "Creative Director",
      company: "Modern Gentlemen",
      email: "jordan@moderngentlemen.co",
      mobile: "+1 647 555 0119",
      phone: "+1 416 555 0182",
      website: "moderngentlemen.co",
      address: "88 Yorkville Ave, Toronto",
    });
    expect(r.socials.map((s) => s.platform)).toEqual(["linkedin", "instagram"]);
  });

  it("handles title and company on separate lines and doesn't invent missing pieces", () => {
    const r = parseSignatureText("Priya Nair\nHead of Growth\nNorthwind\npriya@northwind.io");
    expect(r.details).toMatchObject({ name: "Priya Nair", title: "Head of Growth", company: "Northwind", email: "priya@northwind.io" });
    expect(r.details.phone).toBeUndefined();
    expect(r.details.website).toBeUndefined();
  });
});
