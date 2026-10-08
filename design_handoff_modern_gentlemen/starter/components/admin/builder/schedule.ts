/**
 * Date helpers for the publish menu's scheduling dialog. Pure: `now` is passed
 * in, so the quick picks are testable and never depend on the test machine's
 * clock.
 *
 * Everything is in the editor's own time zone, because that is what a
 * `datetime-local` input shows and what "tomorrow at nine" means to the person
 * choosing it. The value sent to the server is an ISO instant, so the zone
 * stops mattering the moment it is chosen.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** A Date as the `YYYY-MM-DDTHH:mm` string a `datetime-local` input holds, in local time. */
export function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** The reverse, or `null` for an empty or malformed value. */
export function fromLocalInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function at(base: Date, days: number, hours: number): Date {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  date.setHours(hours, 0, 0, 0);
  return date;
}

export interface QuickPick {
  label: string;
  date: Date;
}

/**
 * The times editors reach for: an hour from now (on the next quarter hour),
 * tomorrow morning, and the coming Monday morning. Monday is skipped when today
 * is Sunday or Monday, where "next Monday" would read as tomorrow or a week away.
 */
export function quickPicks(now: Date): QuickPick[] {
  const inAnHour = new Date(now);
  inAnHour.setMinutes(Math.ceil((now.getMinutes() + 60) / 15) * 15, 0, 0);
  const picks: QuickPick[] = [
    { label: "In an hour", date: inAnHour },
    { label: "Tomorrow, 9:00", date: at(now, 1, 9) },
  ];
  const day = now.getDay();
  if (day !== 0 && day !== 1)
    picks.push({ label: "Monday, 9:00", date: at(now, (8 - day) % 7, 9) });
  return picks;
}

/** Why `when` cannot be scheduled, or `null`. Mirrors the server's own check. */
export function scheduleProblem(when: Date | null, now: Date): string | null {
  if (!when) return "Choose a date and time.";
  if (when.getTime() <= now.getTime() + 60_000) return "Choose a time at least a minute from now.";
  return null;
}

/** "Tuesday 14 October 2026 at 09:00", in the editor's locale and zone. */
export function describeWhen(when: Date | string): string {
  const date = typeof when === "string" ? new Date(when) : when;
  return date.toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The short form for the publish bar: "Tue 14 Oct, 09:00". */
export function describeWhenShort(when: Date | string): string {
  const date = typeof when === "string" ? new Date(when) : when;
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
