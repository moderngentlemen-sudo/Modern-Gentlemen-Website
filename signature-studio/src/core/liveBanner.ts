/**
 * Live banners: one banner slot in the signature whose picture and link change
 * on a schedule, or rotate daily, after the signature has been installed. The
 * email points at a tiny public endpoint that redirects to whichever banner is
 * current; the same choice is made for the picture and for the click, so they
 * always match.
 *
 * Pure and dependency-free: the edge function ships a byte-identical copy of
 * this file (`supabase/functions/banner/pick.ts`; a unit test keeps them equal).
 */

export interface LiveItem {
  /** Public URL of the published picture. */
  image: string;
  /** Where a click goes (http/https). */
  link?: string;
  alt?: string;
  /** Inclusive dates, YYYY-MM-DD, in UTC. */
  from?: string;
  to?: string;
}

export interface LiveRow {
  mode: "schedule" | "rotate";
  items: LiveItem[];
  fallback: LiveItem;
}

const DAY = 86_400_000;

function day(s: string | undefined, end: boolean): number | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isNaN(t) ? null : end ? t + DAY - 1 : t;
}

/** Is the item showing at `now`? Items without dates are always on. */
export function isActive(item: LiveItem, now: number): boolean {
  const a = day(item.from, false);
  const b = day(item.to, true);
  return (a === null || now >= a) && (b === null || now <= b);
}

/**
 * The banner to show at `now`. Schedule: the most recently started active item
 * (so a dated campaign beats an always-on one), else the fallback. Rotate: the
 * active items take turns, one per day. `index` is -1 for the fallback.
 */
export function pickBanner(row: LiveRow, now: number): { index: number; item: LiveItem } {
  const active = row.items.map((item, index) => ({ item, index })).filter((x) => isActive(x.item, now));
  if (!active.length) return { index: -1, item: row.fallback };
  if (row.mode === "rotate") return active[Math.floor(now / DAY) % active.length];
  return active.reduce((best, x) => ((day(x.item.from, false) ?? -Infinity) >= (day(best.item.from, false) ?? -Infinity) ? x : best));
}

/** Only web links leave the redirect endpoint. */
export function safeTarget(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
