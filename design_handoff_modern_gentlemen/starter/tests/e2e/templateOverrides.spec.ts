import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

async function createPublishedTemplate(page: Page, kind: "archive" | "product", name: string) {
  await page.goto("/admin/templates");
  await page.getByRole("button", { name: "New template" }).click();

  const dialog = page.getByRole("dialog", { name: "New template" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Kind").selectOption(kind);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page).toHaveURL(/\/admin\/templates\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const publish = page.getByRole("dialog", { name: /Publish/ });
  await publish.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText(/Published v\d+/)).toBeVisible({ timeout: 15_000 });
}

async function chooseAndRestoreTemplate(page: Page, noun: "category" | "product", name: string) {
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  let dialog = page.getByRole("dialog", {
    name: `${noun[0].toUpperCase()}${noun.slice(1)} layout`,
  });
  await dialog.getByLabel("Template override").selectOption({ label: name });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Template override saved")).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  dialog = page.getByRole("dialog", {
    name: `${noun[0].toUpperCase()}${noun.slice(1)} layout`,
  });
  await expect(dialog.getByLabel("Template override").locator("option:checked")).toHaveText(name);

  await dialog.getByLabel("Template override").selectOption("");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Template inheritance restored")).toBeVisible({ timeout: 15_000 });
}

async function deleteTemplateIfPresent(page: Page, name: string) {
  await page.goto("/admin/templates");
  const row = page.getByRole("row", { name: new RegExp(name) });
  if ((await row.count()) === 0) return;

  await row.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete template", exact: true })
    .click();
  await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
}

test.describe("record template overrides", () => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  test.describe.configure({ mode: "serial" });

  test("assigns and restores category and product layouts from their own builders", async ({
    page,
  }) => {
    await signIn(page);

    const stamp = Date.now().toString(36);
    const categoryTemplate = `E2E Category Frame ${stamp}`;
    const productTemplate = `E2E Product Frame ${stamp}`;
    let primaryError: unknown;

    try {
      await createPublishedTemplate(page, "archive", categoryTemplate);
      await createPublishedTemplate(page, "product", productTemplate);

      await page.goto("/admin/taxonomy");
      const categories = page.getByRole("table", { name: "All categories" });
      await categories
        .getByRole("row")
        .filter({ has: page.getByRole("cell", { name: "Style", exact: true }) })
        .getByRole("link", { name: "Edit layout" })
        .click();
      await chooseAndRestoreTemplate(page, "category", categoryTemplate);

      await page.goto("/admin/products");
      await page.getByRole("link", { name: "Travel Watch Roll, Waxed Canvas" }).click();
      await page.getByRole("link", { name: "Compose sections" }).click();
      await chooseAndRestoreTemplate(page, "product", productTemplate);
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      const cleanupErrors: unknown[] = [];
      for (const name of [categoryTemplate, productTemplate]) {
        try {
          await deleteTemplateIfPresent(page, name);
        } catch (error) {
          cleanupErrors.push(error);
        }
      }

      // Preserve the journey's original failure when cleanup also fails. When
      // the journey passed, a cleanup failure remains a real test failure so a
      // leaked fixture cannot silently contaminate the rest of the serial job.
      if (!primaryError && cleanupErrors.length > 0) {
        throw new AggregateError(cleanupErrors, "Could not clean up template override fixtures");
      }
    }
  });
});
