import { expect, test } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
test.describe("Design Studio publishing", () => {
  test.skip(!email || !password, "Requires the seeded E2E editor; a skip is not verification.");
  test("saves, reopens, previews and publishes a native Studio page", async ({ page }) => {
    test.setTimeout(60000);
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
              {
                id: 2,
                kind: "countdown",
                name: "Launch countdown",
                text: "LAUNCH",
                x: 24,
                y: 150,
                w: 640,
                h: 110,
                size: 42,
                font: "IBM Plex Mono",
                color: "#141414",
                borderColor: "#14141455",
                widget: {
                  target: "2030-01-01T00:00:00Z",
                  variant: "Divided",
                  showSeconds: true,
                  numberStyle: { font: "Instrument Serif", size: 42 },
                  labelStyle: { font: "IBM Plex Mono", size: 11 },
                },
              },
              {
                id: 3,
                kind: "signup",
                name: "Email signup",
                text: "Join the list",
                x: 24,
                y: 280,
                w: 640,
                h: 80,
                size: 16,
                font: "IBM Plex Mono",
                color: "#141414",
                borderColor: "#14141455",
                widget: {
                  variant: "Underline",
                  placeholder: "Your email address",
                  buttonMode: "Arrow",
                  successText: "Thank you for your interest.",
                },
              },
              {
                id: 4,
                kind: "social",
                name: "Social links",
                text: "FOLLOW MODERN GENTLEMEN",
                x: 24,
                y: 375,
                w: 640,
                h: 80,
                size: 16,
                font: "IBM Plex Mono",
                color: "#141414",
                widget: {
                  variant: "Icons",
                  links: [
                    {
                      label: "Instagram",
                      platform: "Instagram",
                      url: "https://instagram.com/modern.gentlemen",
                    },
                    { label: "LinkedIn", platform: "LinkedIn", url: "https://linkedin.com" },
                    { label: "YouTube", platform: "YouTube", url: "https://youtube.com" },
                  ],
                },
              },
            ],
          },
        },
        location.origin
      );
    });
    await expect(frame.locator(".mg-board")).toContainText("Studio publishing journey");
    await page.getByLabel("Page title", { exact: true }).fill("Studio journey");
    // Match a capitalized mobile-keyboard entry; the saved URL stays canonical.
    await page.getByLabel("URL /", { exact: true }).fill(slug.toUpperCase());
    await expect(page.getByLabel("URL /", { exact: true })).toHaveValue(slug);
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
    for (const [device, width] of [
      ["desktop", 1280],
      ["tablet", 800],
      ["mobile", 390],
    ] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(
        page.locator('[data-studio-widget="countdown"]').filter({ visible: true })
      ).toContainText("LAUNCH");
      await expect(page.getByRole("timer").filter({ visible: true })).toContainText("days");
      await expect(
        page.getByRole("form", { name: "Email signup" }).filter({ visible: true })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Instagram (opens in a new tab)" }).filter({ visible: true })
      ).toHaveAttribute("href", "https://instagram.com/modern.gentlemen");
      await page.evaluate(() => document.fonts.ready);
      await page
        .locator('section[id^="studio-intro-"]')
        .filter({ visible: true })
        .screenshot({ path: `test-results/studio-widgets-${device}.png` });
    }
    const signup = page.getByRole("form", { name: "Email signup" }).filter({ visible: true });
    await signup.getByLabel("Email address").fill(`${slug}@example.test`);
    const signupResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/newsletter") && response.request().method() === "POST"
    );
    await signup.getByRole("button", { name: "Join the list" }).click();
    expect((await signupResponse).status()).toBe(201);
    await expect(
      page.getByRole("status").filter({ hasText: "Thank you for your interest.", visible: true })
    ).toBeVisible();
  });
});
