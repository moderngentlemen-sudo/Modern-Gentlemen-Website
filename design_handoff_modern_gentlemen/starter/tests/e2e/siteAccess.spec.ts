import { expect, test } from "@playwright/test";

/**
 * Run only against a build made with SITE_ACCESS_MODE=homepage-only.
 * Other browser suites intentionally use SITE_ACCESS_MODE=public so the
 * original full-site visual baselines remain meaningful.
 */
test.describe("homepage-only prelaunch", () => {
  test.skip(
    process.env.SITE_ACCESS_MODE !== "homepage-only",
    "Requires a homepage-only production build"
  );

  test("homepage is public with no navigation; other pages cannot be opened", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await expect(page.locator("[data-site-main]")).toBeVisible();
    await expect(page.locator('[data-site-chrome="header"]')).toHaveCount(0);
    await expect(page.locator('[data-site-chrome="footer"]')).toHaveCount(0);

    for (const path of [
      "/about",
      "/shop",
      "/articles",
      "/membership",
      "/preview/not-a-real-token",
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      // Next's middleware emits a valid *relative* Location ("/"). The
      // Response has its own URL base; new URL("/") without a base is invalid.
      // APIResponse.headers() preserves the server's header-name casing in
      // Playwright 1.56; unlike browser Response it has no headerValue().
      const location = Object.entries(response.headers()).find(
        ([name]) => name.toLowerCase() === "location"
      )?.[1];
      expect(location, `${path} must include a redirect destination`).toBeTruthy();
      expect(new URL(location!, response.url()).pathname, path).toBe("/");
      expect(response.headers()["cache-control"], path).toContain("no-store");
    }
    const api = await request.get("/api/search/articles?q=test");
    expect(api.status()).toBe(403);
    expect(await api.json()).toEqual({ error: "Forbidden" });
  });

  test("admin sign-in and homepage capture remain accessible", async ({ page, request }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator('[data-site-chrome="header"]')).toHaveCount(0);
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    // GET is deliberately 405, not a route-gate 403: forms accept POST only.
    for (const path of ["/api/newsletter", "/api/forms"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(405);
    }
  });

  test("sitemap does not disclose private URLs", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("<loc>");
    expect(sitemap).not.toContain("/shop");
    expect(sitemap).not.toContain("/articles");
    expect(sitemap).not.toContain("/about");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /");
    expect(robots).toContain("Allow: /$");
  });

  test("signed-in staff can still open protected pages and edit the homepage", async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!email || !password, "Requires the seeded E2E admin");
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("link", { name: "Edit homepage" })).toBeVisible();
    await page.goto("/about");
    await expect(page).toHaveURL(/\/about$/);
    await page.goto("/admin");
    await expect(page.getByText("Site access: Homepage only")).toBeVisible();
    await page.getByRole("link", { name: "Edit homepage" }).click();
    await expect(page).toHaveURL(/\/admin\/(?:pages|design-studio)/);
  });
});
