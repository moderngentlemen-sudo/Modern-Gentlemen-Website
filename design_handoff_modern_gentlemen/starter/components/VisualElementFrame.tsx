import type { ReactNode } from "react";

import { hasVisualDesign, visualCss, type VisualElementDesign } from "@/lib/blocks/visual";

/**
 * The compatibility bridge between existing components and the new visual
 * engine. Unstyled legacy blocks return their child directly, preserving the
 * verified DOM. A customized block gains one scoped wrapper and bounded CSS.
 */
export function VisualElementFrame({
  blockKey,
  visual,
  children,
}: {
  blockKey: string;
  visual?: VisualElementDesign;
  children: ReactNode;
}) {
  if (!hasVisualDesign(visual)) return children;
  const { scope, css } = visualCss(blockKey, visual!);
  return (
    <>
      <style data-mg-visual-style={scope}>{css}</style>
      <div data-mg-visual={scope}>{children}</div>
    </>
  );
}
