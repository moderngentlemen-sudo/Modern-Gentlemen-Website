import { expect, test } from "@playwright/test";

for (const font of ["systemSerif", "google:Lora"]) {
  test(`text typography (${font}) survives saving and renders on the published page`, async ({
    page,
  }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!email || !password, "Requires the seeded admin environment");
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/admin/pages");
    await page.getByRole("button", { name: "New page" }).click();
    const slug = `e2e-typography-${Date.now().toString(36)}`;
    const create = page.getByRole("dialog", { name: "New page" });
    await create.getByLabel("Title").fill("Typography regression");
    await create.getByLabel("Slug").fill(slug);
    await create.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/pages\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: /^Text A free text element/ }).click();
    await page
      .getByRole("textbox", { name: "Content", exact: true })
      .fill("Typography verification text");
    if (font === "google:Lora") await page.getByLabel("Search fonts", { exact: true }).fill("Lora");
    await page.getByLabel("Font family", { exact: true }).selectOption(font);
    await page.getByLabel("Font weight", { exact: true }).selectOption("500");
    await page.getByLabel("Font style", { exact: true }).selectOption("italic");
    await page.getByLabel("Font size (px)", { exact: true }).fill("27");
    await page.getByLabel("Text colour hex", { exact: true }).fill("#123456");
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 15000 });
    await page.reload();
    await page.locator("[data-block-key]").first().click();
    await expect(page.getByLabel("Font family", { exact: true })).toHaveValue(font);
    await expect(page.getByLabel("Font weight", { exact: true })).toHaveValue("500");
    await expect(page.getByLabel("Font style", { exact: true })).toHaveValue("italic");
    await expect(page.getByLabel("Font size (px)", { exact: true })).toHaveValue("27");
    await expect(page.getByLabel("Text colour", { exact: true })).toHaveValue("#123456");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const publish = page.getByRole("dialog", { name: /Publish/ });
    await expect(publish.getByText("No issues")).toBeVisible();
    await publish.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/Published v\d+/)).toBeVisible({ timeout: 15000 });
    await page.goto(`/${slug}`);
    const text = page.getByText("Typography verification text", { exact: true });
    await expect(text).toHaveCSS("font-size", "27px");
    await expect(text).toHaveCSS("color", "rgb(18, 52, 86)");
    await expect(text).toHaveCSS("font-family", font === "google:Lora" ? /Lora/ : /ui-serif/);
    await expect(text).toHaveCSS("font-weight", "500");
    await expect(text).toHaveCSS("font-style", "italic");
    if (font === "google:Lora") {
      await expect(
        page.locator('link[rel="stylesheet"][href*="fonts.googleapis.com/css2?family=Lora"]')
      ).toHaveCount(1);
    }
  });
}
