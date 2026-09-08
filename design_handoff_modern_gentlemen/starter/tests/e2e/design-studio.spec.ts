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
            page: "#f8f7f3",
            sections: [
              { uid: "intro", height: 480, color: "#f8f7f3", stops: ["#f8f7f3", "#dfd9ce"] },
              { uid: "dark-band", height: 120, color: "#0d0d0d", stops: ["#0d0d0d", "#0d0d0d"] },
              { uid: "beige", height: 120, color: "#dfd9ce", stops: ["#dfd9ce", "#dfd9ce"] },
              { uid: "custom", height: 120, color: "#e3f1ff", stops: ["#e3f1ff", "#e3f1ff"] },
              {
                uid: "gradient",
                height: 160,
                color: "#e3f1ff",
                gradient: true,
                angle: 35,
                stops: ["#e3f1ff", "#f2d9ee"],
              },
            ],
            nodes: [
              {
                id: 9,
                kind: "text",
                name: "Custom ink",
                text: "Custom palette",
                x: 24,
                y: 750,
                w: 640,
                h: 55,
                size: 26,
                color: "#432486",
              },
              {
                id: 10,
                kind: "text",
                name: "Gradient ink",
                text: "Custom gradient",
                x: 24,
                y: 870,
                w: 640,
                h: 55,
                size: 26,
                color: "#004477",
              },
              {
                id: 7,
                kind: "text",
                name: "Template muted text",
                text: "Style. Culture. Perspective.",
                x: 24,
                y: 620,
                w: 640,
                h: 35,
                size: 24,
                color: "#645f56",
              },
              {
                id: 8,
                kind: "text",
                name: "Template accent text",
                text: "MODERN GENTLEMEN",
                x: 24,
                y: 665,
                w: 640,
                h: 30,
                size: 16,
                color: "#c8102e",
              },
              {
                id: 5,
                kind: "text",
                name: "Fixed dark band",
                text: "Always dark",
                x: 24,
                y: 510,
                w: 200,
                h: 50,
                size: 24,
                color: "#f4f4f4",
              },
              {
                id: 6,
                kind: "button",
                name: "Accent button",
                text: "Discover",
                x: 530,
                y: 5,
                w: 130,
                h: 35,
                size: 16,
                color: "#fff",
                fill: "#c8102e",
                action: { type: "url", url: "https://example.com" },
              },
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
    // Use the actual editor Add path: it assigns Date.now(), not a small fixture ID.
    await frame.getByRole("button", { name: "Add", exact: true }).click();
    await frame.getByRole("button", { name: "+ Text", exact: true }).click();
    await expect(
      frame.locator(".mg-board [data-id]").filter({ hasText: "Your text" })
    ).toHaveAttribute("data-id", /^\d{13,}$/);
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
    await expect(frame.locator(".mg-board")).toContainText("Your text");
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
      const section = page.locator('section[id^="studio-intro-"]').filter({ visible: true });
      let lightCustom = "",
        lightGradient = "",
        lightCustomInk = "";
      for (const theme of ["light", "dark"] as const) {
        if (device === "desktop" && theme === "dark") {
          await page.getByRole("button", { name: "Switch to dark theme", exact: true }).click();
        } else {
          await page
            .locator("html")
            .evaluate((root, value) => root.setAttribute("data-mgtheme", value), theme);
        }
        await expect(page.locator("html")).toHaveAttribute("data-mgtheme", theme);
        const ink = theme === "dark" ? "rgb(244, 244, 244)" : "rgb(20, 20, 20)";
        await expect(section).toHaveCSS(
          "background-color",
          theme === "dark" ? "rgb(13, 13, 13)" : "rgb(248, 247, 243)"
        );
        await expect(section.getByText("Studio publishing journey", { exact: true })).toHaveCSS(
          "color",
          ink
        );
        await expect(section.getByRole("timer").locator("span").first()).toHaveCSS("color", ink);
        await expect(section.getByLabel("Email address")).toHaveCSS("color", ink);
        await expect(
          section.getByRole("link", { name: "Instagram (opens in a new tab)" })
        ).toHaveCSS("color", ink);
        const accent = section.getByRole("link", { name: "Discover", exact: true });
        await expect(accent).toHaveCSS("background-color", "rgb(200, 16, 46)");
        await expect(accent).toHaveCSS("color", "rgb(255, 255, 255)");
        const fixed = page.locator('section[id^="studio-dark-band-"]').filter({ visible: true });
        await expect(fixed).toHaveCSS("background-color", "rgb(13, 13, 13)");
        await expect(fixed.getByText("Always dark", { exact: true })).toHaveCSS(
          "color",
          "rgb(244, 244, 244)"
        );
        const beige = page.locator('section[id^="studio-beige-"]').filter({ visible: true });
        await expect(beige).toHaveCSS(
          "background-color",
          theme === "dark" ? "rgb(19, 19, 21)" : "rgb(223, 217, 206)"
        );
        await expect(beige.getByText("Style. Culture. Perspective.", { exact: true })).toHaveCSS(
          "color",
          theme === "dark" ? "rgba(244, 244, 244, 0.5)" : "rgb(100, 95, 86)"
        );
        await expect(beige.getByText("MODERN GENTLEMEN", { exact: true })).toHaveCSS(
          "color",
          theme === "dark" ? "rgb(247, 20, 46)" : "rgb(200, 16, 46)"
        );
        const custom = page.locator('section[id^="studio-custom-"]').filter({ visible: true });
        const gradient = page.locator('section[id^="studio-gradient-"]').filter({ visible: true });
        const customColor = await custom.evaluate((node) => getComputedStyle(node).backgroundColor);
        const gradientColor = await gradient.evaluate(
          (node) => getComputedStyle(node).backgroundImage
        );
        const customInk = await custom
          .getByText("Custom palette", { exact: true })
          .evaluate((node) => getComputedStyle(node).color);
        if (theme === "light") {
          lightCustom = customColor;
          lightGradient = gradientColor;
          lightCustomInk = customInk;
        } else {
          expect(customColor).not.toBe(lightCustom);
          expect(gradientColor).not.toBe(lightGradient);
          expect(customInk).not.toBe(lightCustomInk);
          expect(gradientColor).toContain("linear-gradient(35deg");
        }
        await custom.screenshot({
          path: `test-results/studio-widgets-custom-${device}-${theme}.png`,
        });
        await gradient.screenshot({
          path: `test-results/studio-widgets-gradient-${device}-${theme}.png`,
        });
        await beige.screenshot({
          path: `test-results/studio-widgets-beige-${device}-${theme}.png`,
        });
        await section.screenshot({ path: `test-results/studio-widgets-${device}-${theme}.png` });
      }
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
