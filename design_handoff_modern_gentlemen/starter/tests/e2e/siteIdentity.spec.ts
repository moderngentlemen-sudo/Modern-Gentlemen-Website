import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const local = !!url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);

test("Appearance Studio edits favicon and identity as a draft, not a live publish", async ({ page }) => {
  test.skip(!local || !key || !email || !password, "Requires isolated CI Supabase and editor");
  const db = createClient(url!, key!, { auth: { persistSession: false } });
  const baseline = await db
    .from("theme_settings")
    .select("id,draft_data,published_data,status")
    .eq("key", "default")
    .single();
  if (baseline.error || !baseline.data) throw baseline.error ?? new Error("Theme not found");
  const original = baseline.data;

  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.goto("/admin/customizer");
    await page.getByRole("button", { name: /Favicon & Site Identity/ }).click();
    await expect(page.getByLabel("Browser tab favicon preview")).toBeVisible();
    await expect(page.getByLabel("Favicon image URL")).toHaveValue("/site-icon.svg");

    await page.getByLabel("Site name").fill("Modern Gentlemen Preview");
    await page.getByLabel("Favicon image URL").fill("/images/style-mono.jpg");
    await expect(page.getByLabel("Browser tab favicon preview")).toContainText(
      "Modern Gentlemen Preview"
    );
    await page.getByRole("button", { name: "Save theme draft", exact: true }).first().click();
    await expect(page.getByRole("region", { name: "Appearance Studio" }).getByRole("status")).toContainText(
      "Site theme draft saved"
    );

    const updated = await db
      .from("theme_settings")
      .select("draft_data,published_data")
      .eq("key", "default")
      .single();
    if (updated.error) throw updated.error;
    const savedIdentity = (updated.data?.draft_data as Record<string, unknown>)
      ?.siteIdentity as Record<string, unknown>;
    expect(savedIdentity?.siteName).toBe("Modern Gentlemen Preview");
    expect(savedIdentity?.faviconUrl).toBe("/images/style-mono.jpg");
    expect(updated.data?.published_data).toEqual(original.published_data);

    await page.reload();
    await page.getByRole("button", { name: /Favicon & Site Identity/ }).click();
    await expect(page.getByLabel("Site name")).toHaveValue("Modern Gentlemen Preview");
  } finally {
    const restored = await db
      .from("theme_settings")
      .update({ draft_data: original.draft_data, status: original.status })
      .eq("id", original.id);
    if (restored.error) throw restored.error;
  }
});
