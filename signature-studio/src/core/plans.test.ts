import { describe, expect, it } from "vitest";
import { EARLY_ACCESS, entitlements } from "./plans";

describe("plans", () => {
  it("paid plans can always remove the badge; free only during early access", () => {
    expect(entitlements("pro").removeBadge).toBe(true);
    expect(entitlements("teams").removeBadge).toBe(true);
    expect(entitlements("free").removeBadge).toBe(EARLY_ACCESS);
  });
});
