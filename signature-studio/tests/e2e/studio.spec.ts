import { expect, test } from "@playwright/test";
import { shot } from "./helpers";

test("create from a template, edit details, switch template without losing content", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("template-legal-counsel").click();
  await page.getByTestId("field-name").fill("Avery Stone");
  await page.getByTestId("field-email").fill("avery@stone.law");
  await expect(page.locator('[data-testid="preview"] a[href="mailto:avery@stone.law"]')).toHaveCount(1);
  await page.getByTestId("tab-templates").click();
  await page.getByRole("group", { name: "Template group" }).getByRole("button", { name: "Artistic" }).click();
  await page.getByTestId("apply-art-deco").click();
  await expect(page.locator('[data-testid="preview"]')).toContainText("Avery Stone");
  await page.getByTestId("tab-addons").click();
  await page.getByTestId("addon-cta").check();
  await expect(page.locator('[data-testid="preview"]')).toContainText("Visit our website");
  await shot(page, "04-template-editor");
  await page.getByRole("button", { name: "Back to my signatures" }).click();
  await expect(page.getByTestId("my-signature")).toHaveCount(1);
});

test("digital business card page decodes its link", async ({ page }) => {
  await page.goto("/");
  const token = await page.evaluate(async () => {
    // Loaded from the dev server inside the page, not by the test runner.
    const path = "/src/core/digitalCard.ts";
    const mod = (await import(/* @vite-ignore */ path)) as { encodeCard: (d: object) => Promise<string> };
    return mod.encodeCard({ v: 1, n: "Jordan Ellis", t: "Creative Director", e: "jordan@example.com", w: "https://example.com", ac: "#5b4cf0" });
  });
  await page.goto(`/?card=${token}`);
  await expect(page.getByRole("heading", { name: "Jordan Ellis" })).toBeVisible();
  await expect(page.getByTestId("save-contact")).toBeVisible();
  await shot(page, "05-digital-card");
});
