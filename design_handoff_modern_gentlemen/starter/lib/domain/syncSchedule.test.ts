import { describe, expect, it } from "vitest";

import {
  isSyncDue,
  isSyncSchedule,
  SYNC_DUE_GRACE_MS,
  SYNC_INTERVAL_MS,
  SYNC_SCHEDULE_LABEL,
  SYNC_SCHEDULES,
} from "./ingestion";

/**
 * When a source is due to re-fetch.
 *
 * The runner itself cannot be tested here — it is a service-role caller with no
 * session, and the ingestion E2E deliberately never runs an import. So this
 * decision was pulled out whole, and it is where every edge case lives.
 */

const now = new Date("2026-08-23T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("SYNC_SCHEDULES", () => {
  it("is a coarse vocabulary and deliberately not cron", () => {
    // The runner is GitHub Actions, measured drifting over ninety minutes on a
    // quiet repository. A cron field would let an operator write a precision
    // the platform cannot deliver.
    expect([...SYNC_SCHEDULES]).toEqual(["hourly", "daily", "weekly"]);
  });

  it("labels every option, because the selector is the only place it is explained", () => {
    for (const schedule of SYNC_SCHEDULES) {
      expect(SYNC_SCHEDULE_LABEL[schedule]?.trim(), schedule).toBeTruthy();
    }
  });

  it("recognises its own members and nothing else", () => {
    for (const schedule of SYNC_SCHEDULES) expect(isSyncSchedule(schedule)).toBe(true);
    // The column is free text and predates the vocabulary, so these are real
    // values a row could hold.
    for (const bad of ["off", "", "*/15 * * * *", "HOURLY", "monthly", null, undefined, 3600]) {
      expect(isSyncSchedule(bad), String(bad)).toBe(false);
    }
  });

  it("orders the intervals as their names promise", () => {
    expect(SYNC_INTERVAL_MS.hourly).toBeLessThan(SYNC_INTERVAL_MS.daily);
    expect(SYNC_INTERVAL_MS.daily).toBeLessThan(SYNC_INTERVAL_MS.weekly);
  });

  it("keeps the grace well under the shortest interval", () => {
    // The property that stops the grace ever letting a schedule run twice in
    // one period. If someone adds a schedule shorter than the grace, this fails
    // here rather than in production at double the intended rate.
    for (const schedule of SYNC_SCHEDULES) {
      expect(SYNC_DUE_GRACE_MS * 2, schedule).toBeLessThan(SYNC_INTERVAL_MS[schedule]);
    }
  });
});

describe("isSyncDue", () => {
  it("is never due without a schedule", () => {
    // `null` is "off", and it is the value every row held for three phases.
    for (const schedule of [null, undefined, "", "off", "nonsense"]) {
      expect(isSyncDue(schedule, ago(SYNC_INTERVAL_MS.weekly), now), String(schedule)).toBe(false);
    }
  });

  it("is due immediately when it has never synced", () => {
    // The first run is the one an operator is waiting for after setting a
    // schedule; making them wait a full period reads as the setting not working.
    expect(isSyncDue("hourly", null, now)).toBe(true);
    expect(isSyncDue("weekly", undefined, now)).toBe(true);
  });

  it("is not due while the interval is still running", () => {
    expect(isSyncDue("hourly", ago(10 * 60 * 1000), now)).toBe(false);
    expect(isSyncDue("daily", ago(SYNC_INTERVAL_MS.hourly), now)).toBe(false);
    expect(isSyncDue("weekly", ago(SYNC_INTERVAL_MS.daily), now)).toBe(false);
  });

  it("is due once the interval has passed", () => {
    for (const schedule of SYNC_SCHEDULES) {
      expect(isSyncDue(schedule, ago(SYNC_INTERVAL_MS[schedule] + 1000), now), schedule).toBe(true);
    }
  });

  it("is due inside the grace window, which is what stops an hourly schedule becoming two-hourly", () => {
    // The bug this exists to prevent: a poller asking "has a full hour passed?"
    // answers no when a tick lands seconds early, and the source then waits
    // another whole period. It looks exactly like the feature running at half
    // the configured rate.
    const justShort = SYNC_INTERVAL_MS.hourly - 60 * 1000;
    expect(isSyncDue("hourly", ago(justShort), now)).toBe(true);
  });

  it("is not due well outside the grace window", () => {
    const wellShort = SYNC_INTERVAL_MS.hourly - SYNC_DUE_GRACE_MS - 60 * 1000;
    expect(isSyncDue("hourly", ago(wellShort), now)).toBe(false);
  });

  it("treats a future timestamp as not due rather than as due", () => {
    // A clock that has gone backwards, or a row written by a machine ahead of
    // this one. Running early is a choice, and one made by a wrong clock is not
    // a choice anybody made.
    const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    expect(isSyncDue("hourly", future, now)).toBe(false);
  });

  it("treats an unparseable timestamp as never synced", () => {
    // The column is timestamptz, so this should be impossible — but "due" is
    // the recoverable answer and "never due again" is not.
    expect(isSyncDue("hourly", "not a date", now)).toBe(true);
  });

  it("accepts a Date as readily as a string", () => {
    expect(isSyncDue("hourly", new Date(now.getTime() - SYNC_INTERVAL_MS.hourly), now)).toBe(true);
  });
});
