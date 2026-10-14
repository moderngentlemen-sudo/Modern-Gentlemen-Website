import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const local = !!url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);

test("private staff preview, public launch and scheduled access use one live policy", async ({
  page,
  request,
}) => {
  test.skip(!local || !key || !email || !password, "Requires isolated CI database and admin");
  test.setTimeout(120_000);
  const db = createClient(url!, key!, { auth: { persistSession: false } });
  const saved = await db
    .from("site_settings")
    .select("value, updated_by")
    .eq("key", "site-access-control")
    .single();
  if (saved.error || !saved.data) throw saved.error ?? new Error("Site access not seeded");
  const original = saved.data;

  async function applyMode(mode: "homepage-only" | "private-preview" | "public") {
    await page.goto("/admin/customizer?area=access");
    await page.getByRole("radio", { name: new RegExp(mode === "public" ? "Public Launch" : mode === "private-preview" ? "Private Preview" : "Homepage Only") }).check();
    await page.getByRole("button", { name: "Review access change" }).click();
    const confirmation = page.getByRole("dialog", { name: "Confirm site access change" });
    await expect(confirmation).toBeVisible();
    await confirmation.getByLabel("Access change confirmation").fill(mode === "public" ? "LAUNCH" : "CONFIRM");
    await confirmation.getByRole("button", { name: "Apply access mode" }).click();
    await expect(confirmation).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Access mode updated" })).toBeVisible();
  }

  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email", { exact: true }).fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await applyMode("private-preview");
    // Another API request context has no staff cookie, even while the browser is signed in.
    const denied = await request.get("/shop", { maxRedirects: 0 });
    expect(denied.status()).toBe(307);
    expect(new URL(denied.headers().location, denied.url()).pathname).toBe("/");
    const publicHome = await request.get("/");
    expect(await publicHome.text()).not.toContain('data-site-chrome="header"');

    await page.goto("/shop");
    await expect(page.locator('[data-site-chrome="header"]')).toHaveCount(1);
    await expect(page.locator('[data-site-chrome="footer"]')).toHaveCount(1);

    await applyMode("homepage-only");
    await page.goto("/shop");
    await expect(page.locator('[data-site-chrome="header"]')).toHaveCount(0);

    // Merely opening and then cancelling a confirmation cannot publish the site.
    await page.goto("/admin/customizer?area=access");
    await page.getByRole("radio", { name: /Public Launch/ }).check();
    await page.getByRole("button", { name: "Review access change" }).click();
    await page.getByRole("dialog", { name: "Confirm site access change" }).getByRole("button", { name: "Cancel" }).click();
    expect((await request.get("/shop", { maxRedirects: 0 })).status()).toBe(307);

    await applyMode("public");
    expect((await request.get("/shop")).status()).toBe(200);
    const openHome = await request.get("/");
    expect(await openHome.text()).toContain('data-site-chrome="header"');

    // Scheduling is evaluated against wall-clock time on every request.
    await applyMode("private-preview");
    await page.goto("/admin/customizer?area=access");
    await page.getByLabel("Schedule automatic public launch").check();
    const date = new Date(Date.now() + 3_600_000);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    await page.getByLabel("Scheduled launch local date and time").fill(localDate);
    await page.getByRole("button", { name: "Review launch schedule" }).click();
    const scheduleDialog = page.getByRole("dialog", { name: "Confirm scheduled launch" });
    await scheduleDialog.getByLabel("Access change confirmation").fill("SCHEDULE");
    await scheduleDialog.getByRole("button", { name: "Schedule launch" }).click();
    await expect(scheduleDialog).toBeHidden();
    expect((await request.get("/shop", { maxRedirects: 0 })).status()).toBe(307);

    const { error: updateError } = await db
      .from("site_settings")
      .update({
        value: {
          mode: "private-preview",
          scheduledPublicAt: "2026-01-01T00:00:00.000Z",
          version: 100,
        },
      })
      .eq("key", "site-access-control");
    if (updateError) throw updateError;
    expect((await request.get("/shop")).status()).toBe(200);
  } finally {
    const { error } = await db
      .from("site_settings")
      .update({ value: original.value, updated_by: original.updated_by })
      .eq("key", "site-access-control");
    if (error) throw error;
  }
});
