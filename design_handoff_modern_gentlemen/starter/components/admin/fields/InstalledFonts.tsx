"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ThemeWebfont } from "@/lib/domain/theme";

/**
 * The fonts installed on the site (Theme → Typography → Webfonts), made
 * available to every font picker in the builder. Only the id and label travel:
 * a block stores `webfont:<id>`, and the page resolves it through the
 * `--mg-webfont-<id>` variable the root layout publishes.
 */
export type InstalledFont = Pick<ThemeWebfont, "id" | "label" | "family">;

const InstalledFontsContext = createContext<readonly InstalledFont[]>([]);

export function InstalledFontsProvider({
  fonts,
  children,
}: {
  fonts: readonly InstalledFont[];
  children: ReactNode;
}) {
  return <InstalledFontsContext.Provider value={fonts}>{children}</InstalledFontsContext.Provider>;
}

export const useInstalledFonts = () => useContext(InstalledFontsContext);
