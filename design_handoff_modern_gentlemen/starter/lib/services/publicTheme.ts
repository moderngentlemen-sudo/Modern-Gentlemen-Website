/**
 * Public theme read — the design tokens the site renders with.
 *
 * The fifth public read service, and it takes the others' stance on two points
 * and deliberately breaks with them on the third.
 *
 * **No `requirePermission`.** `createPublicClient()` is anonymous and `0017`'s
 * policy is `status = 'published' or is_staff()`, so a draft theme cannot come
 * back through here even if a query asked for one. The database is the
 * enforcement; this file is the shape.
 *
 * **No cookies.** This is why it goes through `lib/db/public.ts`, and it matters
 * more here than anywhere else: the caller is the **root** layout, above both
 * route groups. A `cookies()` call here would opt the entire site — all 65
 * static pages — out of static rendering, with no error, no failing test and no
 * visual diff.
 *
 * **It falls back instead of throwing, which `publicContent.ts` and
 * `publicNavigation.ts` both refuse to do.** Three reasons, none of which apply
 * to them:
 *
 *   1. *The fallback is not invented.* A missing page or an empty header menu
 *      has no correct substitute, so serving one would ship a plausible artefact
 *      from a broken read. A missing theme has an exactly correct substitute:
 *      the declarations still compiled into `app/globals.css`, which are what
 *      the site rendered before this feature existed. Nothing is guessed.
 *   2. *Blast radius.* This read is in the root layout. A throw takes down
 *      `/admin` too — including `/admin/theme`, the screen an editor would use
 *      to repair the bad theme. A feature that can lock you out of its own
 *      repair tool must not throw.
 *   3. *It is already the live state.* `0007` seeds the row with
 *      `published_data` NULL, so the fallback path is the normal one until the
 *      theme is first seeded, not an error branch.
 *
 * Not silent, though: the failure branch logs. A theme that fails to load is a
 * real problem — it just is not one worth blanking the site over.
 */

import { createPublicClient } from "@/lib/db/public";
import * as repo from "@/lib/db/repositories/theme";
import {
  DEFAULT_THEME_COLORS,
  THEME_KEY,
  parseThemeColors,
  type ThemeColors,
} from "@/lib/domain/theme";

export async function getPublishedThemeColors(): Promise<ThemeColors> {
  try {
    const db = createPublicClient();
    // `getPublishedThemeByKey`, not `getThemeByKey`: `0020` revoked
    // `draft_data` from `anon`, and the catch below would turn a refused column
    // into a silent fallback to the built-in palette.
    const row = await repo.getPublishedThemeByKey(db, THEME_KEY);

    // Absent, still a draft, or published with nothing in it — all the same
    // answer from out here, and `parseThemeColors` gives it for the third case.
    if (!row?.published_data) return DEFAULT_THEME_COLORS;

    return parseThemeColors(row.published_data);
  } catch (error) {
    console.error("[publicTheme] falling back to the built-in tokens:", error);
    return DEFAULT_THEME_COLORS;
  }
}
