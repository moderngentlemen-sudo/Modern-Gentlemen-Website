import { describe, expect, it } from "vitest";

import { fromLocalInputValue, quickPicks, scheduleProblem, toLocalInputValue } from "./schedule";

describe("schedule helpers", () => {
  it("round-trips a datetime-local value in local time", () => {
    const date = new Date(2026, 9, 14, 9, 5);
    expect(toLocalInputValue(date)).toBe("2026-10-14T09:05");
    expect(fromLocalInputValue("2026-10-14T09:05")?.getTime()).toBe(date.getTime());
    expect(fromLocalInputValue("")).toBeNull();
    expect(fromLocalInputValue("14/10/2026")).toBeNull();
  });

  it("offers an hour from now on a quarter hour, tomorrow morning and next Monday", () => {
    const thursday = new Date(2026, 9, 8, 14, 7); // Thu 8 Oct 2026, 14:07
    const picks = quickPicks(thursday);
    expect(picks.map((pick) => toLocalInputValue(pick.date))).toEqual([
      "2026-10-08T15:15",
      "2026-10-09T09:00",
      "2026-10-12T09:00",
    ]);
  });

  it("skips Monday when it would read as tomorrow or a week away", () => {
    expect(quickPicks(new Date(2026, 9, 11, 10, 0)).map((p) => p.label)).not.toContain(
      "Monday, 9:00"
    ); // Sunday
    expect(quickPicks(new Date(2026, 9, 12, 10, 0)).map((p) => p.label)).not.toContain(
      "Monday, 9:00"
    ); // Monday
  });

  it("refuses an empty or imminent time, like the server", () => {
    const now = new Date(2026, 9, 8, 12, 0);
    expect(scheduleProblem(null, now)).toMatch(/Choose/);
    expect(scheduleProblem(new Date(2026, 9, 8, 12, 0, 30), now)).toMatch(/minute/);
    expect(scheduleProblem(new Date(2026, 9, 8, 13, 0), now)).toBeNull();
  });
});
