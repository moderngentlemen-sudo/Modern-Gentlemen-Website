/**
 * Title → URL slug — pure, no I/O.
 *
 * This lived in `lib/editorial.ts` while that module was runtime data. It is not
 * demo content: the seeder derives every article slug with it, the search
 * overlay builds hrefs with it, and the admin's create dialogs auto-fill with
 * the same rule. One definition means a slug computed at seed time and a slug
 * computed in a browser cannot disagree — and a disagreement here is a 404 on a
 * link that looks correct.
 *
 * Transcribed from the design prototype's own `slugify`. Note it collapses every
 * non-alphanumeric run, apostrophes included, so "The Coachbuilder's Floor"
 * becomes `the-coachbuilder-s-floor` — the prototype hand-typed a different slug
 * there and was wrong; this is the output the app has always used.
 */
export const slugify = (t: string): string =>
  String(t || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
