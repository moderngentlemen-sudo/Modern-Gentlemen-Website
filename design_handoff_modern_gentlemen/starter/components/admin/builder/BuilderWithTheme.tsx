import type { ComponentProps } from "react";

import { getPublishedThemeSettings } from "@/lib/services/publicTheme";

import { Builder } from "./Builder";

/**
 * Server bridge that gives every document builder the same published global
 * style-class library. Keeping the lookup here prevents six routes from
 * drifting, while the client builder remains easy to unit-test with a plain
 * optional prop.
 */
export async function BuilderWithTheme(props: ComponentProps<typeof Builder>) {
  const theme = await getPublishedThemeSettings();
  return <Builder {...props} styleClasses={theme.styleClasses} />;
}
