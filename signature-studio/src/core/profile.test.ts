import { describe, expect, it } from "vitest";
import { applyProfile, isSampleOnly, profileFromDoc, sameProfile } from "./profile";
import { newDoc, SAMPLE_DETAILS, SAMPLE_SOCIALS } from "./defaults";
import { TEMPLATES } from "./templates";

const mk = () => {
  const d = newDoc(TEMPLATES[0].id, TEMPLATES[0].design);
  d.details = { ...SAMPLE_DETAILS, custom: [] };
  d.socials = SAMPLE_SOCIALS();
  return d;
};

describe("saved profile", () => {
  it("round-trips details, socials and photo between signatures", () => {
    const a = mk();
    a.details.name = "Avery Stone";
    a.assets.p = { id: "p", name: "p.jpg", mime: "image/jpeg", width: 400, height: 400, bytes: 1, hash: "hp" };
    a.images.photo = { ...a.images.photo, assetId: "p", crop: { x: 0.2, y: 0, zoom: 1.5 } };
    const p = profileFromDoc(a);
    const b = mk();
    applyProfile(b, p);
    expect(b.details.name).toBe("Avery Stone");
    expect(b.images.photo.assetId).toBe("p");
    expect(b.assets.p).toEqual(a.assets.p);
    expect(b.images.photo.crop.zoom).toBe(1.5);
    expect(sameProfile(profileFromDoc(b), p)).toBe(true);
  });

  it("notices a change and ignores untouched sample content", () => {
    const a = mk();
    expect(isSampleOnly(profileFromDoc(a))).toBe(true);
    const before = profileFromDoc(a);
    a.details.phone = "+1 555 0100";
    expect(sameProfile(before, profileFromDoc(a))).toBe(false);
    expect(isSampleOnly(profileFromDoc(a))).toBe(false);
  });
});
