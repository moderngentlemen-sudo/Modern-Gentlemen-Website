import type { Page } from "@playwright/test";

/** A Canva-style PNG export: a design on a white page with empty margins. */
export async function canvaPng(page: Page, opts: { width: number; height: number; margin: number }): Promise<Buffer> {
  const dataUrl = await page.evaluate(({ width, height, margin }) => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, width, height);
    const w = width - margin * 2;
    const h = height - margin * 2;
    const grad = g.createLinearGradient(margin, 0, margin + w, 0);
    grad.addColorStop(0, "#1d1b2c");
    grad.addColorStop(1, "#5b4cf0");
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(margin, margin, w, h, 24);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = `bold ${Math.round(h / 6)}px sans-serif`;
    g.fillText("Jordan Ellis", margin + w * 0.06, margin + h * 0.32);
    g.font = `${Math.round(h / 12)}px sans-serif`;
    g.fillText("jordan@example.com", margin + w * 0.55, margin + h * 0.62);
    g.fillText("example.com", margin + w * 0.55, margin + h * 0.8);
    return c.toDataURL("image/png");
  }, opts);
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

export async function shot(page: Page, name: string) {
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
}

/** Point the app at the local test image host and accept hosting. */
export async function configureTestHost(page: Page) {
  await page.getByTestId("host-endpoint").fill("http://localhost:8787");
  await page.getByTestId("host-token").fill("dev-key");
}
