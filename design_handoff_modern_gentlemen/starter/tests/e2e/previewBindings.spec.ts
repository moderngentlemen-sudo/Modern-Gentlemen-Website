import { expect, test } from "@playwright/test";
import { getCategory, slugify } from "../../lib/demo/editorial";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test("a category preview resolves its published story links", async ({ page }) => {
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin/);

  await page.goto("/admin/taxonomy");
  await page
    .getByRole("table", { name: "All categories" })
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "Style", exact: true }) })
    .getByRole("link", { name: "Edit layout" })
    .click();
  await expect(page).toHaveURL(/\/admin\/categories\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const link = page.getByRole("dialog", { name: "Preview link" }).getByRole("link");
  await expect(link).toBeVisible({ timeout: 15_000 });
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/preview\/[A-Za-z0-9_-]+/);

  const response = await page.goto(href!);
  expect(response?.status()).toBe(200);
  const title = getCategory("style")!.lead.title;
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.locator(`a[href="/article/${slugify(title)}"]`).first()).toBeVisible();
  expect(errors).toEqual([]);
});
