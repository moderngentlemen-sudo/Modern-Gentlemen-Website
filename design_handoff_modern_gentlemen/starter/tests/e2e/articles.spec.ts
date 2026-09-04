import { expect, test, type Page } from "@playwright/test";

/**
 * Articles and taxonomy, end to end.
 *
 * The claim this proves is the one PROGRESS.md has carried since Phase 4 as a
 * prediction rather than a fact: that the builder fits `article` as-is, and
 * that the polymorphic document repository, the publishing SQL functions and
 * the revision counter all serve a second document type without changes. Until
 * this runs, no article has ever existed in the database.
 *
 * Credentials come from the environment; scripts/create-admin.ts provisions the
 * account and CI exports both variables.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

/** Minted by the first test — a retry re-runs a serial group from the top. */
let articleTitle = "";
let articleSlug = "";
let tagLabel = "";
let authorName = "";
const featuredVideoUrl = "https://cdn.example.com/modern-gentlemen-e2e.mp4";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe("articles", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  test.describe.configure({ mode: "serial" });

  test("creates a tag and an author", async ({ page }) => {
    await signIn(page);

    const stamp = Date.now().toString(36);
    articleTitle = `E2E Article ${stamp}`;
    articleSlug = `e2e-article-${stamp}`;
    tagLabel = `E2E Tag ${stamp}`;
    authorName = `E2E Author ${stamp}`;

    await page.goto("/admin/taxonomy");

    // Scoped to the section, because all three carry a "New …" button and the
    // dialogs share their field labels.
    const tags = page.locator("section").filter({ hasText: "Tags" }).first();
    await tags.getByRole("button", { name: "New tag" }).click();
    await page.getByRole("dialog").getByLabel("Label").fill(tagLabel);
    await page.getByRole("dialog").getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByText(`Created “${tagLabel}”`)).toBeVisible();

    const authors = page.locator("section").filter({ hasText: "Authors" }).first();
    await authors.getByRole("button", { name: "New author" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(authorName);
    await dialog.getByLabel("Role").fill("Editor-at-large");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByText(`Created “${authorName}”`)).toBeVisible();
  });

  test("creates an article and files it", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/articles");

    await page.getByRole("button", { name: "New article" }).click();
    const dialog = page.getByRole("dialog", { name: "New article" });
    await dialog.getByLabel("Title").fill(articleTitle);
    await dialog.getByLabel("Slug").fill(articleSlug);
    await dialog.getByLabel("Template").selectOption("Cover Story");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();

    // Lands on the details screen, not the builder — an article's metadata is
    // its primary editing surface.
    await expect(page).toHaveURL(/\/admin\/articles\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel("Template")).toHaveValue("Cover Story");

    const preview = page.getByLabel("Article presentation preview");
    await expect(preview).toHaveAttribute("data-preview-template", "Cover Story");
    await expect(preview).toHaveAttribute("data-preview-hero", "cover");
    await expect(preview).toHaveAttribute("data-preview-body", "prose");

    // These are unsaved choices: the preview must follow all three presentation
    // axes immediately, while the public article stays unchanged until Save.
    await page.getByLabel("Template").selectOption("The Big Read");
    await expect(preview).toHaveAttribute("data-preview-hero", "wide");
    await expect(preview).toHaveAttribute("data-preview-body", "essay");
    await page.getByLabel("Article header").selectOption("standard");
    await page.getByLabel("Article appearance").selectOption("compact");
    await expect(preview).toHaveAttribute("data-preview-header", "standard");
    await expect(preview).toHaveAttribute("data-preview-appearance", "compact");

    // Restore the article this serial journey expects before persisting it.
    await page.getByLabel("Template").selectOption("Cover Story");
    await page.getByLabel("Article header").selectOption("template");
    await page.getByLabel("Article appearance").selectOption("template");

    await page.getByLabel("Author").selectOption({ label: authorName });
    await page.getByRole("button", { name: tagLabel }).click();
    await page.getByLabel("Reading minutes").fill("7");
    await page.getByLabel("Media type").selectOption("video");
    await page.getByLabel("Video URL").fill(featuredVideoUrl);
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    // The reload proves it persisted rather than only living in React state.
    await page.reload();
    await expect(page.getByLabel("Reading minutes")).toHaveValue("7");
    await expect(page.getByLabel("Media type")).toHaveValue("video");
    await expect(page.getByLabel("Video URL")).toHaveValue(featuredVideoUrl);
    await expect(page.getByRole("button", { name: tagLabel })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("composes and publishes it through the shared builder", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/articles");
    await page.getByRole("link", { name: articleTitle }).click();
    await page.getByRole("link", { name: "Compose sections" }).click();

    await expect(page).toHaveURL(/\/admin\/articles\/[0-9a-f-]{36}\/builder$/);
    await expect(page.getByText("Add your first section")).toBeVisible();

    await page
      .getByRole("button", { name: /^Pull quote/i })
      .first()
      .click();
    await expect(page.locator("[data-block-key]")).toHaveCount(1);

    await page.locator("[data-block-key]").first().click();
    await page.getByRole("textbox", { name: "Quote" }).fill("Patience is the last luxury.");

    await page.keyboard.press("Control+s");
    await expect(page.getByText(/Saved/)).toBeVisible();

    // publish_document is the same SQL transaction pages use; it asserts
    // article.publish inside the function rather than trusting the action.
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/Published v\d+/)).toBeVisible();
  });

  test("curates KEEP READING, and it reaches the live page without a republish", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/articles");
    await page.getByRole("link", { name: articleTitle, exact: true }).click();

    // Two of the seeded articles, chosen by title so the assertions can read
    // the same strings back off the public page.
    const first = "Speed, Considered";
    const second = "Building a Wardrobe of Ten Things";

    const picker = page.getByLabel("Add an article");
    await picker.selectOption({ label: first });
    await picker.selectOption({ label: second });

    // Ordered, not a set: `article_relations.position` is the column under this
    // control, and swapping is the behaviour a set could not express.
    await page.getByLabel(`Move ${second} up`).click();

    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    // Persisted, not just held in React state — and in the order just set.
    await page.reload();
    const chosen = page.getByRole("listitem").filter({ hasText: first });
    await expect(chosen).toBeVisible();
    await expect(page.getByLabel(`Move ${second} up`)).toBeDisabled(); // it is first now

    // The payoff, and the property worth asserting: `article_relations` is a
    // live table rather than part of `draft_data`, so curating one does NOT
    // need a publish. The article was published by the previous test and this
    // save alone is what changes the page.
    await page.goto(`/article/${articleSlug}`);
    const featuredVideo = page.getByRole("region", { name: "Featured video" }).locator("video");
    await expect(featuredVideo).toHaveAttribute("src", featuredVideoUrl);
    const keepReading = page.getByRole("link", { name: new RegExp(second) });
    await expect(keepReading.first()).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(first) }).first()).toBeVisible();
  });

  test("records the publish in the shared history view", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/articles");
    await page.getByRole("link", { name: articleTitle }).click();
    // `exact` is load-bearing, and Phase 7c is what proved it. Playwright matches
    // an accessible name as a *substring* by default, and the seeded content
    // includes "A Brief History of the Aperitivo" and "…of the Chronograph" — so
    // on the list page this locator resolved to two article titles and threw a
    // strict-mode violation before the click had even navigated. Exact matching
    // also fixes the race for free: it matches nothing on the list, so the
    // auto-wait carries it through to the detail page instead of failing.
    await page.getByRole("link", { name: "History", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/articles\/[0-9a-f-]{36}\/history$/);
    // One polymorphic `revisions` table, one `publish_events` table, one
    // component — the only page-specific thing about it was the import it used
    // to make, which is now a prop.
    await expect(page.getByRole("cell", { name: "publish" }).first()).toBeVisible();
  });

  test("cleans up", async ({ page }) => {
    await signIn(page);

    await page.goto("/admin/articles");
    await page
      .getByRole("row", { name: new RegExp(articleTitle) })
      .getByRole("button", { name: "Delete" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete article", exact: true })
      .click();

    // By link role, not by text: the success toast repeats the title and
    // lingers for DISMISS_MS, so a text locator would match the confirmation of
    // the deletion rather than the row. Phase 4 learned this the hard way.
    await expect(page.getByRole("link", { name: articleTitle })).toHaveCount(0);

    await page.goto("/admin/taxonomy");
    for (const [name, button] of [
      [tagLabel, "Delete tag"],
      [authorName, "Delete author"],
    ] as const) {
      await page
        .getByRole("row", { name: new RegExp(name) })
        .getByRole("button", { name: "Delete" })
        .click();
      await page.getByRole("dialog").getByRole("button", { name: button, exact: true }).click();
      await expect(page.getByRole("cell", { name })).toHaveCount(0);
    }
  });
});
