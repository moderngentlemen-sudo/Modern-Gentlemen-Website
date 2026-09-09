"use client";
import { useEffect, useState, type ComponentProps } from "react";
import { PreviewThemeProvider } from "@/lib/theme";
import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { CartProvider } from "@/lib/cart/CartProvider";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { PagePresentation } from "@/components/PagePresentation";
import { SectionRenderer } from "@/components/SectionRenderer";
import {
  themeSettingsSchema,
  parseThemeSettings,
  themeDesignCssText,
  themeWebfontStylesheets,
  type ThemeSettings,
} from "@/lib/domain/theme";
import type { BlockTree } from "@/lib/blocks/types";
import type { getChromeNavigation } from "@/lib/services/publicNavigation";
export interface AppearancePreviewState {
  theme: ThemeSettings;
  sections: BlockTree;
  pageSettings?: unknown;
  mode: "light" | "dark";
  replay: number;
}
export function AppearancePreview({
  products,
  nav,
  headerTemplate,
  footerTemplate,
}: {
  products: ComponentProps<typeof CatalogProvider>["products"];
  nav: Awaited<ReturnType<typeof getChromeNavigation>>;
  headerTemplate: BlockTree | null;
  footerTemplate: BlockTree | null;
}) {
  const [state, setState] = useState<AppearancePreviewState | null>(null);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== window.parent ||
        event.data?.type !== "mg:appearance"
      )
        return;
      const data = event.data.state as AppearancePreviewState;
      const theme = themeSettingsSchema.safeParse(data?.theme);
      if (!theme.success || !Array.isArray(data.sections) || !["light", "dark"].includes(data.mode))
        return;
      document.documentElement.setAttribute("data-mgtheme", data.mode);
      setState({ ...data, theme: parseThemeSettings(theme.data) });
    };
    const stayInPreview = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[href]"))
        event.preventDefault();
    };
    document.addEventListener("click", stayInPreview, true);
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "mg:appearance-ready" }, location.origin);
    return () => {
      window.removeEventListener("message", receive);
      document.removeEventListener("click", stayInPreview, true);
    };
  }, []);
  if (!state) return <p className="p-8 text-sm">Loading page preview…</p>;
  const header = (
    <Header
      key={state.replay}
      nav={nav.header}
      drawerSecondary={nav.drawerSecondary}
      settings={state.theme.header}
    />
  );
  const footer = <Footer nav={nav.footer} legal={nav.footerLegal} settings={state.theme.footer} />;
  return (
    <PreviewThemeProvider
      theme={state.mode}
      onToggle={() => {
        const mode = state.mode === "light" ? "dark" : "light";
        window.parent.postMessage({ type: "mg:appearance-mode", mode }, location.origin);
      }}
    >
      <CatalogProvider products={products}>
        <CartProvider>
          <style>{themeDesignCssText(state.theme)}</style>
          {themeWebfontStylesheets(state.theme.typography).map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          <>
            <div
              data-site-chrome="header"
              data-default-header={headerTemplate ? undefined : "true"}
              style={{ display: "contents" }}
            >
              {headerTemplate ? (
                <SectionRenderer sections={headerTemplate} documentContent={header} />
              ) : (
                header
              )}
            </div>
            <main
              data-site-main
              style={{ paddingTop: `calc(${state.theme.header.height}px + var(--mg-safe-top))` }}
            >
              <PagePresentation settings={state.pageSettings}>
                <SectionRenderer sections={state.sections} />
              </PagePresentation>
            </main>
            <div
              data-site-chrome="footer"
              data-default-footer={footerTemplate ? undefined : "true"}
              style={{ display: "contents" }}
            >
              {footerTemplate ? (
                <SectionRenderer sections={footerTemplate} documentContent={footer} />
              ) : (
                footer
              )}
            </div>
          </>
        </CartProvider>
      </CatalogProvider>
    </PreviewThemeProvider>
  );
}
