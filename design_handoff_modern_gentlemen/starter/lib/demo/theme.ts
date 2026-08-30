/**
 * The site's design tokens, as Track A wrote them into `app/globals.css` — now
 * the seed source.
 *
 * Like every other module in `lib/demo/`, this is **seed input and a test
 * fixture, not runtime data**: `scripts/seed.ts` writes it into
 * `theme_settings`, and `tests/integration/publicTheme.test.ts` compares what
 * the database gives back against it. Editing this file changes what a fresh
 * database is seeded with; it does not change what the live site renders.
 *
 * Thinner than its siblings, and deliberately so. The values live in
 * `DEFAULT_THEME_COLORS` (`lib/domain/theme.ts`) rather than being restated
 * here, because that constant is *also* the runtime fallback served when no
 * theme is published — and `lib/domain/theme.test.ts` checks it against
 * `app/globals.css` declaration by declaration. Copying the twenty-five values
 * into this file would create a third place for them to disagree, and the fixture
 * would then be asserting that the seeder matches the copy rather than that the
 * database matches the design.
 *
 * What this module adds is the envelope: the `version` field and the `colors`
 * key that `theme_settings.draft_data` actually stores.
 */

import {
  DEFAULT_THEME_COLORS,
  DEFAULT_THEME_HEADER,
  DEFAULT_THEME_TYPOGRAPHY,
  THEME_PAYLOAD_VERSION,
  type ThemePayload,
} from "@/lib/domain/theme";

export const DEMO_THEME: ThemePayload = {
  version: THEME_PAYLOAD_VERSION,
  colors: DEFAULT_THEME_COLORS,
  typography: DEFAULT_THEME_TYPOGRAPHY,
  header: DEFAULT_THEME_HEADER,
};

