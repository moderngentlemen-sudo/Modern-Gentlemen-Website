import { expect, test, type Page } from "@playwright/test";

/**
 * The performance budget — the last third of Track A's Phase 7.
 *
 * **What this exists to stop.** Before this suite, every public route shipped
 * every image at its full source resolution: the homepage sent **3,936 KB** of
 * images to a 375px phone, a 1440×1800 JPEG was being painted into a 208×255
 * card, and a 3840×2160 hero poster went out in full on every visit. None of it
 * failed a test, moved a baseline or showed up in a review — page weight is
 * invisible to every other gate in this repo.
 *
 * **Why bytes and not Core Web Vitals.** LCP measured here reads 90–350 ms,
 * because the server is on loopback with no network and no contention; the same
 * page on a phone on 4G is a different number entirely. A timing budget would
 * be measuring this container, and would flake on a busy CI runner while
 * catching nothing. Bytes are the part of the picture the code actually
 * controls, and they reproduce exactly.
 *
 * **Why image bytes specifically.** Script and document responses are served
 * compressed, and what a browser reports for them depends on whether
 * `content-length` survives the transfer — mixing those into one total gives a
 * number that drifts for reasons unrelated to the change under test. Images are
 * already compressed and are sent with an exact `content-length`, so this is the
 * one figure that is both stable and the one that matters: images were 83% of
 * page weight when this was written.
 *
 * Like `tests/a11y/`, this needs a built and seeded site and **no credentials**,
 * so it runs anywhere the repo does — including a session container.
 */

/**
 * Image bytes per route, at a mobile viewport, in KB.
 *
 * Set roughly 50% above what each route measured when the budget was written,
 * which is wide enough to absorb a new photograph or a re-crop and narrow
 * enough that losing a `sizes` attribute — the failure this is really guarding
 * — blows straight through it. Losing one on the homepage would put it back
 * near 3,936.
 *
 * ⚠️ **Raise a number here only with the measurement that justifies it.** A
 * budget quietly raised to make a red suite green is worse than no budget, and
 * this file is the only place the byte cost of a change is visible at all.
 */
const IMAGE_BUDGET_KB: Record<string, number> = {
  "/": 450, // measured 300 — hero poster dominates at ~147
  "/shop": 150, // measured 67
  "/style": 300, // measured 159
  "/about": 60, // measured 13 — the two SVG logos, and nothing else
  "/membership": 60, // measured 13
  "/article/speed-considered": 250, // measured 100
  "/product/travel-watch-roll": 200, // measured 79
};

/**
 * How much larger than its painted box an image's source may be.
 *
 * Checked at desktop and `deviceScaleFactor: 1`, so the honest ratio for a
 * correctly-sized image is 1.0 — but `next/image` picks from a fixed ladder of
 * widths (…, 384, 640, 750, 828, 1080, 1200, 1920, …), so a 208px slot legitimately
 * rounds up to 384 and a 1425px band to 1920. 2.5 clears that rounding with room
 * to spare while still catching the real defect: the cards this suite was
 * written for were downloading 1440px files into 208px slots, a ratio of 6.9.
 */
const MAX_OVERSIZE_FACTOR = 2.5;

/** Bytes of every image response the page made, keyed by URL. */
function trackImageBytes(page: Page) {
  const byUrl = new Map<string, number>();

  page.on("response", async (res) => {
    if (res.request().resourceType() !== "image") return;

    // `content-length` is present and exact for images; the body fallback is for
    // the rare response that omits it, and must not throw the listener.
    let length = Number(res.headers()["content-length"] ?? 0);
    if (!length) {
      try {
        length = (await res.body()).length;
      } catch {
        length = 0;
      }
    }
    // Keyed by URL rather than summed: a page that requests the same asset
    // twice pays for it once, because the browser cache would too.
    byUrl.set(res.url(), length);
  });

  return () => [...byUrl.values()].reduce((a, b) => a + b, 0);
}

/**
 * Bring every lazily-loaded image in.
 *
 * Most images below the fold are `loading="lazy"` now, so a page measured
 * without scrolling reports a flatteringly small number and the budget stops
 * meaning anything.
 *
 * ⚠️ **Jumping to the bottom and back does not do it, and hangs.** Native lazy
 * loading commits as the viewport passes an image, so a single
 * `scrollTo(bottom)` skips straight over most of a long grid — on `/shop`, with
 * sixteen product cards, some `<img>`s were left never-loading, never-erroring
 * and permanently `complete === false`, and the wait below sat there until the
 * test timed out. Stepping down a viewport at a time is what actually triggers
 * them.
 *
 * The wait is bounded for the same reason: an image that genuinely never
 * resolves should fail on the budget it blew, not on a 30s timeout that says
 * nothing about why.
 */
async function settleImages(page: Page) {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);

    const everyImageSettled = Promise.all(
      [...document.images].map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            })
      )
    );
    const giveUp = new Promise((r) => setTimeout(r, 5_000));
    await Promise.race([everyImageSettled, giveUp]);
  });

  // Posters and background layers are not in `document.images`, so give the
  // network a beat to finish them before the byte total is read.
  await page.waitForTimeout(750);
}

test.describe("image weight stays inside budget", () => {
  // The constrained case, and the one the old code served identical bytes to.
  test.use({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });

  for (const [route, budgetKb] of Object.entries(IMAGE_BUDGET_KB)) {
    test(`${route} ships under ${budgetKb} KB of images on mobile`, async ({ page }) => {
      const total = trackImageBytes(page);

      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await settleImages(page);

      const kb = Math.round(total() / 1024);
      expect(kb, `${route} shipped ${kb} KB of images (budget ${budgetKb} KB)`).toBeLessThanOrEqual(
        budgetKb
      );
    });
  }
});

test.describe("no image is served far larger than it is painted", () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  for (const route of Object.keys(IMAGE_BUDGET_KB)) {
    test(`${route} requests appropriately sized sources`, async ({ page }) => {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await settleImages(page);

      const oversized = await page.evaluate((factor) => {
        return [...document.images]
          .filter((img) => {
            // Vector: one file serves every size, so the ratio is meaningless.
            if ((img.currentSrc || img.src).split(/[?#]/, 1)[0]!.toLowerCase().endsWith(".svg")) {
              return false;
            }
            const shown = img.getBoundingClientRect().width;
            // Never painted (a hidden overlay's contents) — nothing to compare.
            if (shown < 1 || img.naturalWidth < 1) return false;
            return img.naturalWidth > shown * factor;
          })
          .map((img) => ({
            src: (img.currentSrc || img.src).replace(/^https?:\/\/[^/]+/, ""),
            natural: img.naturalWidth,
            shown: Math.round(img.getBoundingClientRect().width),
          }));
      }, MAX_OVERSIZE_FACTOR);

      expect(
        oversized,
        `Sources more than ${MAX_OVERSIZE_FACTOR}× their painted width — check the ` +
          `\`slot\`/\`sizes\` on each:\n${JSON.stringify(oversized, null, 2)}`
      ).toEqual([]);
    });
  }
});
