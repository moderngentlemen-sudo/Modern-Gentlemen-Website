import { describe, expect, it } from "vitest";

import { SOCIAL_NETWORKS, SOCIAL_NETWORK_OPTIONS, socialNetwork } from "./socialNetworks";

describe("social networks", () => {
  it("keeps the original five first, so existing pages keep their choices", () => {
    expect(SOCIAL_NETWORKS.slice(0, 5).map((n) => n.id)).toEqual([
      "instagram",
      "linkedin",
      "x",
      "youtube",
      "tiktok",
    ]);
    expect(SOCIAL_NETWORK_OPTIONS.length).toBe(SOCIAL_NETWORKS.length);
    expect(new Set(SOCIAL_NETWORKS.map((n) => n.id)).size).toBe(SOCIAL_NETWORKS.length);
  });

  it("gives every brand network a mark, and only usable brand colours", () => {
    for (const n of SOCIAL_NETWORKS) {
      if (!["linkedin", "email", "website"].includes(n.id)) expect(n.path, n.id).toBeTruthy();
      if (n.brand) expect(n.brand, n.id).toMatch(/^#[0-9a-f]{6}$/);
    }
    // Black brand colours would vanish on a dark stage, so they fall back.
    expect(socialNetwork("x")?.brand).toBeNull();
    expect(socialNetwork("threads")?.brand).toBeNull();
    expect(socialNetwork("spotify")?.brand).toBe("#1ed760");
  });

  it("knows nothing about unknown or inherited names", () => {
    expect(socialNetwork("myspace")).toBeUndefined();
    expect(socialNetwork("toString")).toBeUndefined();
    expect(socialNetwork(undefined)).toBeUndefined();
  });
});
