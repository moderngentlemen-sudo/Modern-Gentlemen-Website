import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

// Exercise the production Header in a real browser without publishing the singleton
// theme used by other tests. Only unrelated routing, cart and overlay providers are stubbed.
let js = "",
  css = "";
test.beforeAll(async () => {
  const stubs: Record<string, string> = {
    "next/link":
      'import React from "react"; export default function Link(p){return React.createElement("a",p)}',
    "next/navigation": 'export const usePathname=()=>"/";',
    "@/lib/theme": 'export const useTheme=()=>({theme:"light",toggle:()=>{}});',
    "@/lib/cart/CartProvider": "export const useCart=()=>({count:0});",
    "@/lib/useVisibleNavigation": "export const useVisibleNavigation=n=>n;",
    "./Drawer": "export const Drawer=()=>null;",
    "./SearchOverlay": "export const SearchOverlay=()=>null;",
    "./BagDrawer": "export const BagDrawer=()=>null;",
    "./MegaMenu": "export const MegaMenu=()=>null;",
  };
  const result = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {Header} from './components/chrome/Header';import {DEFAULT_THEME_HEADER} from './lib/domain/theme';const root=createRoot(document.getElementById('header-test'));window.renderHeader=(settings)=>root.render(<Header settings={{...DEFAULT_THEME_HEADER,...settings}} nav={[{id:'style',label:'Style',href:'/style',children:[]}]}/>);`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    outfile: "header-test.js",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    alias: { "@": resolve(process.cwd()) },
    plugins: [
      {
        name: "header-providers",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) =>
            stubs[args.path]
              ? { path: args.path, namespace: "fixture" }
              : stubs[args.path.replace(process.cwd(), "@")]
                ? { path: args.path.replace(process.cwd(), "@"), namespace: "fixture" }
                : undefined
          );
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents: stubs[args.path],
            loader: "js",
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  js = result.outputFiles.find((f) => f.path.endsWith(".js"))!.text;
  css = result.outputFiles.find((f) => f.path.endsWith(".css"))!.text;
});

test("solid fills, readable transparent headers, entry effects and reduced motion", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    document.querySelector('[data-site-chrome="header"]')?.remove();
    document.querySelector("[data-site-main]")?.remove();
    const backdrop = document.createElement("div");
    backdrop.id = "header-ground";
    backdrop.style.cssText =
      "position:fixed;inset:0;background:color-mix(in srgb,#ffffff 90%,#dddddd);z-index:0";
    const mount = document.createElement("div");
    mount.id = "header-test";
    document.body.append(backdrop, mount);
  });
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  const render = async (settings: Record<string, unknown>) =>
    page.evaluate(
      (s) => (window as unknown as { renderHeader: (s: unknown) => void }).renderHeader(s),
      settings
    );
  await render({ background: "transparent", autoContrast: true });
  const header = page.locator("#header-test header");
  await expect(header).toHaveAttribute("data-contrast", "dark");
  await expect(header.locator('button[aria-label="Open menu"] > span').first()).toHaveCSS(
    "background-color",
    "rgb(20, 20, 20)"
  );
  await expect(header.getByRole("link", { name: "Style", exact: true })).toHaveCSS(
    "color",
    "rgb(20, 20, 20)"
  );
  await page.locator("#header-ground").evaluate((el) => {
    el.style.background = "linear-gradient(90deg,#101010,#202020)";
  });
  await expect(header).toHaveAttribute("data-contrast", "light");
  await render({
    background: "filled",
    fillColor: "#ffffff",
    fillOpacity: 100,
    frostBlur: 0,
    autoContrast: true,
  });
  await expect(header).toHaveAttribute("data-contrast", "dark");
  await expect(header).toHaveCSS("backdrop-filter", "blur(0px)");
  await render({
    background: "filled",
    fillColor: "#101010",
    fillOpacity: 70,
    frostBlur: 12,
    entryAnimation: "slide-down",
    entryDuration: 1800,
    autoContrast: true,
  });
  await expect(header).toHaveCSS("backdrop-filter", "blur(12px)");
  await expect
    .poll(() =>
      page
        .locator("#header-test")
        .evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter(
                (a) =>
                  a.effect instanceof KeyframeEffect &&
                  a.effect.getKeyframes().some((k) => !!k.translate)
              ).length
        )
    )
    .toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await render({ background: "transparent", entryAnimation: "tilt", entryDuration: 1000 });
  await expect
    .poll(() =>
      page
        .locator("#header-test")
        .evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter(
                (a) =>
                  a.effect instanceof KeyframeEffect &&
                  a.effect.getKeyframes().some((k) => !!k.rotate)
              ).length
        )
    )
    .toBe(0);
  await page.setViewportSize({ width: 390, height: 850 });
  await page.locator("#header-ground").evaluate((el) => {
    el.style.background = "#f4f4f4";
  });
  await render({ background: "transparent", autoContrast: true });
  await expect(header).toHaveAttribute("data-contrast", "dark");
  await header.screenshot({ path: "test-results/studio-widgets-header-mobile.png" });
});
