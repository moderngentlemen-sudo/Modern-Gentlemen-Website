import { describe, expect, it } from "vitest";

import { reelConfigWithLaunchDate } from "./comingSoonReel";

describe("reelConfigWithLaunchDate", () => {
  const afterHours = "2027-01-15T18:00:00-05:00";

  it("uses the After Hours launch date when the reel has none", () => {
    const config = reelConfigWithLaunchDate(
      { countdown: { target: "", days: "Days" } },
      afterHours
    );
    expect(config.countdown).toEqual({ target: afterHours, days: "Days" });
  });

  it("keeps the reel's own valid date", () => {
    const own = "2026-12-01T09:00:00Z";
    expect(
      reelConfigWithLaunchDate({ countdown: { target: own } }, afterHours).countdown?.target
    ).toBe(own);
  });

  it("never invents a date: an invalid fallback leaves the reel unchanged", () => {
    const reel = { countdown: { target: "" } };
    expect(reelConfigWithLaunchDate(reel, "next January")).toBe(reel);
    expect(reelConfigWithLaunchDate(reel, undefined)).toBe(reel);
    expect(reelConfigWithLaunchDate(undefined, undefined)).toEqual({});
  });
});
