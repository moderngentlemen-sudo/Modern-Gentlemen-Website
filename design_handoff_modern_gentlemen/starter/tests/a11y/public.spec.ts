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
 * The colour pairs AA does not yet meet, and that the brand has not yet decided
 * about. Everything else must pass `color-contrast` from now on.
 *
 * **This list replaced a blanket `disableRules(["color-contrast"])`,** which was
 * the right call when 175 nodes failed for one undecided reason — a suite that
 * fails everywhere reports nothing about anything. It stopped being the right
 * call once the decidable part was fixed: with the rule switched off entirely, a
 * **new** contrast bug anywhere on the site was invisible, which is the same
 * "green check that checks nothing" this repo has now recorded four times.
 *
 * Naming the survivors instead means contrast is **enforced everywhere except
 * these exact pairs**, and a regression that reintroduces one of the fixed ones
 * — a `/40` label back on a dark band, say — fails immediately.
 *
 * What is left, and why each is still here:
 *
 * ⚠️ **This list held eight pairs and now holds three.** The red and the dark
 * faint are gone — settled rather than silently dropped:
 *
 *   * **The brand red** was split into a fill and an ink. `--mg-accent` stays
 *     `#c8102e` because white text sits on it; `--mg-accent-ink` is `#f7142e`
 *     in dark contexts and `#c8102e` on light, and every `text-`side use moved
 *     to it. Brightening the single token instead was tried and **measured to
 *     make things worse — 34 failing nodes became 46** — because the red CTA
 *     band is the same colour and its white text fell from 5.88 to 4.12.
 *   * **The serif accent** was 14 hard-coded `text-[#ff4d5e]` literals painting
 *     the dark value onto light pages. They are the token now, so light gets
 *     `#c8102e` at 5.35.
 *   * **`--mg-faint` on the dark band** was the 0.35 alpha compositing to
 *     `#5e5e5e`. It is 0.5 and `#818181` — 4.99.
 *
 * What remains is one decision, deliberately still open:
 *
 *   * **`--mg-muted` / `--mg-faint` on light** (`#8a8a8a`, `#b0b0b0`). Both need
 *     to reach `#707070` to clear 4.5, which is the *same* value — so AA
 *     collapses the light-mode two-step grey ramp into one step. That is a real
 *     design cost rather than an arithmetic one, and it is the brand's.
 *
 * **INVERT AS EACH IS SETTLED**: delete the entry, and the rule starts guarding
 * it. When the list empties, delete it and the KNOWN GAP test with it.
 */
const ACCEPTED_CONTRAST_GAPS: ReadonlyArray<{ fg: string; bg: string; why: string }> = [
  { fg: "#8a8a8a", bg: "#f4f4f4", why: "--mg-muted on light — 3.13" },
  { fg: "#8a8a8a", bg: "#ffffff", why: "--mg-muted on a light card — 3.45" },
  { fg: "#b0b0b0", bg: "#f4f4f4", why: "--mg-faint on light — 1.97" },
];

/**
 * Drop the `color-contrast` nodes that are a documented, undecided gap, and keep
 * everything else.
 *
 * A violation whose nodes are *all* accepted disappears; one with a single
 * unaccepted node survives carrying only that node, so the failure message
 * names the new problem rather than the backlog.
 *
 * ⚠️ **Matching is on the colour pair, not the element.** That is deliberate:
 * the pair is the thing the brand has to decide about, and it does not move when
 * content does. Keying on a selector would make every editorial change look like
 * an accessibility regression — the mistake the KNOWN GAP test below already
 * records avoiding by asserting a floor rather than an exact count.
 */
function withoutAcceptedContrastGaps(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]
): Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"] {
  const accepted = (node: { any?: readonly { data?: unknown }[] }) => {
    const data = node.any?.[0]?.data as { fgColor?: string; bgColor?: string } | undefined;
    if (!data?.fgColor || !data?.bgColor) return false;
    return ACCEPTED_CONTRAST_GAPS.some(
      (gap) =>
        gap.fg.toLowerCase() === data.fgColor!.toLowerCase() &&
        gap.bg.toLowerCase() === data.bgColor!.toLowerCase()
    );
  };

  return violations
    .map((v) =>
      v.id === "color-contrast" ? { ...v, nodes: v.nodes.filter((n) => !accepted(n)) } : v
    )
    .filter((v) => v.nodes.length > 0);
}

/** Violations, formatted so a failure names the element rather than a rule id. */
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

        // `color-contrast` is **enforced here now**, minus the pairs in
        // ACCEPTED_CONTRAST_GAPS. It used to be disabled outright, which was
        // right while 175 nodes failed for one undecided reason and wrong the
        // moment the decidable 81% of them were fixed — see that list.
        const { violations } = await audit(page).analyze();
        const unaccepted = withoutAcceptedContrastGaps(violations);

        expect(unaccepted.length, `${route.path} (${theme}):\n${describe(unaccepted)}`).toBe(0);
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
 * KNOWN GAP — the palette does not meet AA at small sizes, and the design
 * baseline says it does.
 *
 * This is a characterisation test: it asserts the wrong-but-current behaviour,
 * named so nobody mistakes it for an endorsement, and carrying the instruction
 * to invert it. The technique is this repo's own — `is_system` for `0018` and
 * `draft_data` for `0020` both went through the full cycle, and both survived
 * the months between discovery and fix **because they were asserted rather than
 * written down in prose.**
 *
 * What the sweep found, across 11 routes × 2 themes: **204 contrast violations
 * and nothing else.** Every other WCAG A/AA rule passes. They collapse into
 * four token-level causes, not scattered mistakes:
 *
 *   * `#696969` on `#0d0d0d` — 156 of them, the dark-band mono labels at
 *     9–10px. Ratio **3.54**, needs 4.5.
 *   * The racing red itself — `#c8102e` on dark and `#ff4d5e` on light, at
 *     10–12px. Ratios **2.94–3.3**.
 *   * `--mg-muted` `#8a8a8a` and `--mg-faint` `#b0b0b0` on light. **1.97–3.45**.
 *   * Pale pink on red inside the CTA band, `#f4cfd5` on `#c8102e`. **4.12** —
 *     the near miss.
 *
 * ⚠️ **Fixing this is a design decision, not a repair, which is why it is
 * recorded rather than done.** Every failure is a design token or the brand
 * accent at a size the prototypes specify. Changing them moves pixels on a
 * site that is pixel-verified against `handoff/screenshots/`, so it invalidates
 * the sixteen baselines by construction — and `design_handoff_modern_gentlemen/
 * CLAUDE.md` both forbids deviating from the tokens *and* claims they already
 * meet AA. Those two statements cannot both survive this measurement. Which one
 * gives is the brand's call.
 *
 * **INVERT THIS when that decision is made**: drop the `disableRules` above,
 * delete this test, and let the per-route audits carry contrast like every
 * other rule.
 */
test("KNOWN GAP: the light grey ramp still fails AA at small sizes", async ({ page }) => {
  // ⚠️ **Renamed.** This watched "the brand red" until the ink/fill split fixed
  // it. All six survivors are `--mg-muted`/`--mg-faint` on light, and they all
  // render on the homepage, so `/` in light is still where to observe them.
  await open(page, "/", "light");

  // A fresh builder, not `audit()`: axe refuses `withTags` and `withRules`
  // together, and the rule id is the precise thing being measured here.
  const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  const nodes = violations.flatMap((v) => v.nodes);

  // Asserted as a floor rather than an exact count: the homepage's node count
  // moves whenever its content does, and pinning it would make an editorial
  // change look like an accessibility regression.
  //
  // ⚠️ **Narrower again, for the second time.** It watched 175 nodes across four
  // causes, then the brand red plus the light grey ramp, and now the light grey
  // ramp alone — **6 nodes, down from 34 at the start of this change.** Every
  // pair below is in ACCEPTED_CONTRAST_GAPS; if this reaches zero, that list and
  // the per-route filter are lying.
  expect(
    nodes.length,
    "contrast is fixed — empty ACCEPTED_CONTRAST_GAPS and delete this test"
  ).toBeGreaterThan(0);

  // And the survivors must still be the *documented* ones. A node here that is
  // not in the accepted list would already have failed the per-route audits;
  // this catches the inverse — a fixed pair silently regressing back into the
  // backlog and being mistaken for "still known".
  const unaccepted = withoutAcceptedContrastGaps(violations).flatMap((v) => v.nodes);
  expect(
    unaccepted.length,
    `contrast failures outside ACCEPTED_CONTRAST_GAPS:\n${describe(withoutAcceptedContrastGaps(violations))}`
  ).toBe(0);
});

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
