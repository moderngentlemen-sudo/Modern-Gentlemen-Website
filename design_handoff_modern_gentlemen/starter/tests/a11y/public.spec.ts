import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * WCAG 2.2 AA, asserted rather than assumed.
 *
 * The design baseline has committed to AA since Track A — "focus traps in
 * drawer/search/bag overlays; `aria-expanded` on menu triggers; Esc closes;
 * visible focus rings; alt text on all images; reduced-motion gating" — and
 * until now nothing checked any of it. `PROGRESS.md` carried the audit as
 * `[ ] not started` for eight phases while most of it had quietly been built,
 * which is the specific failure this file fixes: **an unasserted requirement is
 * indistinguishable from an unmet one.**
 *
 * Two halves, and both are needed:
 *
 *   1. **axe-core over every public route, in both themes.** Catches the
 *      mechanical majority — contrast, names, roles, landmarks, labels — and
 *      catches it on the *rendered* page, so a regression introduced by content
 *      rather than by code fails too.
 *   2. **Keyboard behaviour of the three overlays**, which axe cannot see. A
 *      focus trap is a behaviour over time; axe inspects one static tree.
 *
 * ⚠️ **This project needs no credentials**, unlike `e2e`. That is deliberate and
 * is what makes it the one Playwright suite a session container can actually
 * run — the E2E specs skip themselves without `E2E_ADMIN_EMAIL`, so a green run
 * there proves nothing on its own. It does need a built, seeded site, exactly
 * like the visual suite.
 *
 * ⚠️ **`color-contrast` is included, not disabled.** The tokens are documented
 * as meeting AA and this is the first thing that has ever checked that claim
 * against rendered pixels rather than against the table in the design doc.
 */

/** Every public route that renders without a session. */
const ROUTES = [
  { name: "home", path: "/" },
  { name: "shop", path: "/shop" },
  { name: "about", path: "/about" },
  { name: "membership", path: "/membership" },
  { name: "bag", path: "/bag" },
  { name: "checkout", path: "/checkout" },
  { name: "category", path: "/style" },
  { name: "article", path: "/article/racing-green-is-the-new-navy" },
  { name: "product", path: "/product/field-chronometer" },
  { name: "sign-in", path: "/sign-in" },
  { name: "forgot-password", path: "/forgot-password" },
] as const;

const THEMES = ["light", "dark"] as const;

/**
 * Open a page in a chosen theme, settled enough to audit.
 *
 * ⚠️ **Not `networkidle`** — the hero and film sections stream video, so the
 * network never goes idle and the wait times out. The visual suite records this
 * trap and this file walked straight into it anyway on its first run; what
 * actually has to settle is webfont loading, because an unloaded face reflows
 * every text run and would move the contrast checks onto the wrong pixels.
 *
 * The theme goes in through `localStorage` before navigation, like the visual
 * suite: the boot script applies `html[data-mgtheme]` before paint, so setting
 * the attribute afterwards would race it.
 */
async function open(page: Page, path: string, theme: (typeof THEMES)[number]): Promise<void> {
  await page.addInitScript((t) => window.localStorage.setItem("mg-theme", t), theme);
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  // A playing video keeps repainting; axe's contrast pass samples the canvas.
  await page.evaluate(() => {
    for (const v of document.querySelectorAll("video")) {
      v.pause();
      v.currentTime = 0;
    }
  });
}

/** WCAG 2.0/2.1/2.2 at A and AA — the level the design baseline commits to. */
function audit(page: Page) {
  return new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22aa",
  ]);
}

/**
 * ✅ **`ACCEPTED_CONTRAST_GAPS` is gone, and so is the `KNOWN GAP` test that
 * watched it. `color-contrast` is now enforced everywhere, unconditionally.**
 *
 * The list held eight colour pairs, then three, then none. What closed it, in
 * the order the causes were settled:
 *
 *   * **The dark-band labels and the CTA band's whites** — opacity steps, an
 *     earlier slice. 175 nodes to 34.
 *   * **The accent**, split into a fill (`--mg-accent`, still `#c8102e`, because
 *     white text sits on it) and an ink (`--mg-accent-ink`, `#f7142e` on dark).
 *     Brightening the single token instead was tried and **measured to make
 *     things worse — 34 nodes became 46.**
 *   * **14 hard-coded `text-[#ff4d5e]` literals** painting the dark serif accent
 *     onto light pages, against the design baseline's own token table.
 *   * **`--mg-faint`'s dark alpha**, 0.35 to 0.5.
 *   * **The alpha-utility repair**, which is the one that mattered most and
 *     briefly made everything worse: ~413 `text-mg-fg/NN` classes had been
 *     compiling to nothing, so muted text had always painted at FULL strength.
 *     Fixing that took the count **6 → 110**, because the bug had been hiding
 *     every one of those failures. The floor is arithmetic: `--mg-fg` needs
 *     **alpha 0.59** to clear 4.5 on `#f4f4f4`, so 177 call sites below `/60`
 *     were raised to it.
 *   * **The light grey ramp**, `#8a8a8a`/`#b0b0b0` to `#5a5a5a`/`#707070` — and
 *     the ramp did **not** have to collapse into one step, which this repo's
 *     notes asserted three times. Anything at or below `#707070` passes both
 *     light grounds, so keeping muted darker than faint preserves two steps.
 *
 * ⚠️ **If a pair ever has to be excepted again, do not reach for
 * `disableRules`.** Reinstate a named list like the one deleted here: a blanket
 * exclusion makes a *new* contrast bug invisible, which this file recorded
 * learning once already.
 */

function describe(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]): string {
  return violations
    .map((v) => {
      const where = v.nodes
        .slice(0, 4)
        .map((n) => `      ${n.target.join(" ")}`)
        .join("\n");
      return `  [${v.impact}] ${v.id} — ${v.help}\n${where}`;
    })
    .join("\n");
}

for (const theme of THEMES) {
  test.describe(`public site — ${theme}`, () => {
    for (const route of ROUTES) {
      test(`${route.name} has no WCAG A/AA violations`, async ({ page }) => {
        await open(page, route.path, theme);

        // `color-contrast` is enforced with no exceptions — see the note above.
        const { violations } = await audit(page).analyze();

        expect(violations.length, `${route.path} (${theme}):\n${describe(violations)}`).toBe(0);
      });
    }
  });
}

/**
 * The overlays, which are the half axe cannot judge.
 *
 * Each one is a modal dialog by role, and each has to do four things: trap Tab,
 * close on Escape, return focus to the control that opened it, and say it is
 * expanded while it is open. The design baseline names all four.
 */
test.describe("overlays — keyboard behaviour", () => {
  const OVERLAYS = [
    { name: "search", trigger: /search/i, at: "/" },
    { name: "menu", trigger: /menu/i, at: "/" },
    // ⚠️ The bag trigger is gated on `showBag = isStoreRoute(pathname)` and does
    // not exist on the homepage at all — that is the design, not a defect, and
    // testing it at `/` reported a missing dialog rather than a missing button.
    { name: "bag", trigger: /bag/i, at: "/shop" },
  ] as const;

  for (const overlay of OVERLAYS) {
    test(`${overlay.name} traps focus, closes on Escape and restores focus`, async ({ page }) => {
      await open(page, overlay.at, "light");

      const trigger = page.getByRole("button", { name: overlay.trigger }).first();
      await expect(trigger).toBeVisible();

      // `aria-expanded` before opening. Absent is a failure as much as "true"
      // is: a control that opens something must say so.
      await expect(trigger).toHaveAttribute("aria-expanded", "false");

      await trigger.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");

      // Focus must be inside the panel, not left on the page behind it.
      await expect
        .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
        .toBe(true);

      // Tab a generous number of times: focus must never escape the dialog.
      // The count is deliberately larger than any panel's control count, so
      // this fails if the trap does not wrap.
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press("Tab");
        const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
        expect(inside, `focus escaped the ${overlay.name} overlay after ${i + 1} tabs`).toBe(true);
      }

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();

      // Focus returns to the trigger — without this a keyboard user is dropped
      // at the top of the document and has to start again.
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  }
});

/**
 * An image that is the *only* content of a link must describe itself.
 *
 * ⚠️ **This assertion started stricter and was wrong.** The first version
 * demanded a non-empty `alt` on every image, and it failed on the homepage's
 * full-bleed feature — an editorial photograph with the headline overlaid on
 * top of it. That `alt=""` is **correct**: the adjacent heading already names
 * the thing, and repeating it would make a screen reader announce the same
 * words twice. "Every image needs alt text" is a rule of thumb, not WCAG.
 *
 * What genuinely fails is narrower and mechanical: a link whose entire content
 * is an undescribed image has no accessible name at all, so it is announced as
 * "link" and nothing else. That is the defect worth guarding, and unlike the
 * broad version it cannot produce a false positive on a captioned hero.
 */
test("no link is left nameless by an undescribed image", async ({ page }) => {
  await open(page, "/", "light");

  const nameless = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a"))
      .filter((a) => {
        if (a.getAttribute("aria-label") || a.getAttribute("title")) return false;
        if ((a.textContent ?? "").trim() !== "") return false;
        const imgs = Array.from(a.querySelectorAll("img"));
        if (imgs.length === 0) return false;
        return imgs.every((img) => (img.getAttribute("alt") ?? "").trim() === "");
      })
      .map((a) => a.getAttribute("href") ?? "(no href)")
  );

  expect(
    nameless,
    `links announced as "link" and nothing else:\n  ${nameless.join("\n  ")}`
  ).toEqual([]);
});

/**
 * ✅ **The `KNOWN GAP` contrast test that stood here has been deleted, which was
 * its own stated retirement condition.**
 *
 * It asserted the wrong-but-current behaviour — "the palette does not meet AA at
 * small sizes, and the design baseline says it does" — as a floor rather than a
 * count, so editorial changes could not make it flap. It went 204 nodes → 175 →
 * 34 → 6 → **0**, and its instruction was explicit: *"INVERT THIS when that
 * decision is made: drop the `disableRules` above, delete this test, and let the
 * per-route audits carry contrast like every other rule."* Both halves done.
 *
 * **This is the fifth characterisation test in this repo to complete the full
 * cycle** — asserted as a gap, cited to justify a change, inverted or deleted in
 * the same commit as the fix — after `is_system` (`0018`), `draft_data`
 * (`0020`), `taxonomy.write` on categories (`0023`) and the alpha-utility ramp.
 * The technique is the reusable part: a gap recorded only in prose is a gap
 * nobody notices closing.
 */

/**
 * Reduced motion is gated, not merely declared.
 *
 * The whole suite runs with `reducedMotion: "reduce"` (see the Playwright
 * config), so this asserts the state the config puts every other test in is
 * real — if the media query stopped being honoured, every screenshot would
 * silently start racing an animation.
 */
test("honours prefers-reduced-motion", async ({ page }) => {
  await open(page, "/", "light");

  const animated = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("*"))
      .filter((el) => {
        const style = getComputedStyle(el);
        const duration = parseFloat(style.animationDuration) || 0;
        return style.animationName !== "none" && duration > 0.5;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 80));
  });

  expect(animated, `still animating under reduced motion:\n  ${animated.join("\n  ")}`).toEqual([]);
});
