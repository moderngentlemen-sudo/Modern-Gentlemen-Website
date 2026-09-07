import type { ComponentProps } from "react";
import { getPublishedThemeSettings } from "@/lib/services/publicTheme";
import { listPublishedProducts } from "@/lib/services/publicCatalog";
import { BuilderV2 } from "./BuilderV2";

export async function BuilderV2WithTheme(
  props: Omit<ComponentProps<typeof BuilderV2>, "products">
) {
  const [theme, products] = await Promise.all([
    getPublishedThemeSettings(),
    listPublishedProducts(),
  ]);
  return (
    <BuilderV2
      {...props}
      products={products}
      styleClasses={theme.styleClasses}
      tokenAliases={theme.tokenAliases}
    />
  );
}
