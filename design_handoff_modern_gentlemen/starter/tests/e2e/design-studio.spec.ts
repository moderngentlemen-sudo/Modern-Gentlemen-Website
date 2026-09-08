import { expect, test } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
test.describe("Design Studio publishing", () => {
  test.skip(!email || !password, "Requires the seeded E2E editor; a skip is not verification.");
  test("saves, reopens, previews and publishes a native Studio page", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/admin/design-studio");
    const frame = page.frameLocator('iframe[title="Modern Gentlemen Design Studio"]');
    await expect(frame.locator(".mg-board")).toBeVisible();
    const slug = `e2e-studio-${Date.now().toString(36)}`;
    // Exercise the same validated load bridge used to reopen a server document.
    await page.evaluate(() => {
      const frame = document.querySelector("iframe")!;
      frame.contentWindow!.postMessage(
        {
          type: "mg-studio-load",
          source: {
            title: "Studio journey",
            layoutDevice: "desktop",
            page: "#ffffff",
            sections: [
              { uid: "intro", height: 480, color: "#ffffff", stops: ["#ffffff", "#ffffff"] },
            ],
            nodes: [
              {
                id: 1,
                kind: "text",
                name: "Heading",
                text: "Studio publishing journey",
                x: 24,
                y: 40,
                w: 640,
                h: 100,
                size: 40,
                font: "Instrument Serif",
                color: "#141414",
                weight: 400,
                align: "left",
              },
            ],
          },
        },
        location.origin
      );
    });
    await expect(frame.locator(".mg-board")).toContainText("Studio publishing journey");
    await page.getByLabel("Page title", { exact: true }).fill("Studio journey");
    await page.getByLabel("URL /", { exact: true }).fill(slug);
    await page.getByRole("button", { name: "Save to site", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Create site preview", exact: true })
    ).toBeEnabled();
    await expect(page).toHaveURL(/\/admin\/design-studio\?id=/);
    expect((await page.request.get(`/${slug}`)).status()).toBe(404);
    await page.reload();
    await expect(frame.locator(".mg-board")).toContainText("Studio publishing journey");
    await page.getByRole("button", { name: "Create site preview", exact: true }).click();
    const preview = page.getByRole("link", { name: "Open site preview", exact: true });
    await expect(preview).toBeVisible();
    const response = await page.request.get((await preview.getAttribute("href"))!);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain("Studio publishing journey");
    await page.getByRole("checkbox", { name: "I reviewed this saved page" }).check();
    await page.getByRole("button", { name: "Publish page", exact: true }).click();
    await expect(page.getByText(/Published version \d+\./)).toBeVisible();
    await page.goto(`/${slug}`);
    await expect(
      page.getByText("Studio publishing journey", { exact: true }).filter({ visible: true })
    ).toBeVisible();
  });
});
