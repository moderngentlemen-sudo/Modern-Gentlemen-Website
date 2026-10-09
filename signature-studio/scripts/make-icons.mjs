// Renders the app icons in public/ from one SVG design (run: node scripts/make-icons.mjs).
// The PNGs are committed; this only needs re-running if the mark changes.
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";

const preinstalled = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const mark = (size, { maskable = false, rounded = true } = {}) => {
  // Maskable icons get cropped to a circle or squircle: keep the letter inside the middle 80%.
  const k = maskable ? 0.78 : 1;
  const r = rounded && !maskable ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <clipPath id="c"><rect width="${size}" height="${size}" rx="${r}"/></clipPath>
  <g clip-path="url(#c)">
  <rect width="${size}" height="${size}" fill="#15131a"/>
  <rect x="${size * (maskable ? 0.2 : 0)}" y="${size * (maskable ? 0.74 : 0.875)}" width="${size * (maskable ? 0.6 : 1)}" height="${size * (maskable ? 0.05 : 0.125)}" fill="#ff5434"/>
  <text x="${size / 2}" y="${size * (maskable ? 0.64 : 0.72)}" font-family="'Instrument Serif','Liberation Serif',Georgia,serif" font-style="italic" font-size="${size * 0.66 * k}" fill="#ffffff" text-anchor="middle">S</text>
  </g>
</svg>`;
};

const out = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, { rounded: false }],
];

const browser = await chromium.launch(existsSync(preinstalled) ? { executablePath: preinstalled } : {});
const page = await browser.newPage();
for (const [file, size, opts] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><head><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&display=block" rel="stylesheet"></head>
     <body style="margin:0;background:transparent">${mark(size, opts)}</body></html>`,
    { waitUntil: "networkidle" },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/${file}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log("wrote public/" + file);
}
await browser.close();
