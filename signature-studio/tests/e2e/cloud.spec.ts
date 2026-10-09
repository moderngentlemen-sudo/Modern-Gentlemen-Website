import { expect, test, type Page } from "@playwright/test";
import { shot } from "./helpers";

// The test build swaps in an in-memory cloud (stored in localStorage) when this flag is set.
const useFakeCloud = (page: Page) => page.addInitScript(() => localStorage.setItem("signet.fakeCloud", "1"));
const cloudDb = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("signet.fakeCloud.db") ?? "{}"));

test("sign in, sync a signature, and find it on a new device", async ({ page }) => {
  await useFakeCloud(page);
  await page.goto("/app");
  await page.getByTestId("sign-in").click();
  await page.getByTestId("sign-in-email").fill("ada@example.com");
  await page.getByTestId("sign-in-send").click();
  await expect(page.getByTestId("account-menu")).toContainText("ada@example.com");
  await shot(page, "80-signed-in");

  await page.getByTestId("template-corporate-classic").click();
  await page.getByRole("textbox", { name: "Signature name" }).fill("Cloud test");
  await expect.poll(async () => JSON.stringify((await cloudDb(page)).docs ?? {}), { timeout: 15000 }).toContain("Cloud test");

  // A "new device": same account, empty browser storage.
  await page.goto("/sw.js");
  await page.evaluate(async () => {
    for (const name of ["ss3-docs", "ss3-prefs", "ss3-assets", "ss3-versions"])
      await new Promise((resolve) => {
        const r = indexedDB.deleteDatabase(name);
        r.onsuccess = r.onerror = r.onblocked = () => resolve(null);
      });
  });
  await page.goto("/app");
  await expect(page.getByText("Cloud test")).toBeVisible({ timeout: 15000 });

  await page.getByTestId("account-menu").click();
  await page.getByTestId("sign-out").click();
  await expect(page.getByTestId("sign-in")).toBeVisible();
  await expect(page.getByText("Cloud test")).toBeVisible();
});

test("delete account removes the cloud copy but keeps this device's signatures", async ({ page }) => {
  await useFakeCloud(page);
  await page.goto("/app");
  await page.getByTestId("sign-in").click();
  await page.getByTestId("sign-in-email").fill("bo@example.com");
  await page.getByTestId("sign-in-send").click();
  await page.getByTestId("template-corporate-classic").click();
  await expect.poll(async () => Object.keys((await cloudDb(page)).docs?.["user-bo@example.com"] ?? {}).length, { timeout: 15000 }).toBe(1);
  await page.getByRole("button", { name: "Back to my signatures" }).click();
  await page.getByTestId("account-menu").click();
  await page.getByTestId("delete-account").click();
  await expect(page.getByTestId("delete-account-confirm")).toBeDisabled();
  await page.getByTestId("delete-account-email").fill("bo@example.com");
  await page.getByTestId("delete-account-confirm").click();
  await expect(page.getByTestId("sign-in")).toBeVisible();
  expect((await cloudDb(page)).docs?.["user-bo@example.com"]).toBeUndefined();
  await expect(page.getByText("Corporate Classic signature")).toBeVisible();
});

test("a short card link shows the card stored in the account", async ({ page }) => {
  await useFakeCloud(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "signet.fakeCloud.db",
      JSON.stringify({
        session: null,
        docs: {},
        prefs: {},
        files: {},
        cards: { "jordan-ellis-k3f9": { owner: "u", signatureId: "s", data: { v: 1, n: "Jordan Ellis", t: "Creative Director", e: "jordan@example.com" } } },
      }),
    ),
  );
  await page.goto("/c/jordan-ellis-k3f9");
  await expect(page.getByRole("heading", { name: "Jordan Ellis" })).toBeVisible();
  await expect(page.getByTestId("save-contact")).toBeVisible();
  await page.goto("/c/nobody-here-zzzz");
  await expect(page.getByText("This card link is incomplete")).toBeVisible();
});

test("without accounts configured, nothing about sign-in appears", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /signature/i }).first()).toBeVisible();
  await expect(page.getByTestId("sign-in")).toHaveCount(0);
});
