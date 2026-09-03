import type { ReactNode } from "react";

import {
  VISUAL_STYLE_CLASS_ID,
  hasVisualDesign,
  visualCss,
  type VisualElementDesign,
} from "@/lib/blocks/visual";

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
  const hasLocalCss = Boolean(
    Object.values(visual?.styles ?? {}).some((style) => style && Object.keys(style).length > 0) ||
    Object.keys(visual?.effects ?? {}).length > 0
  );
  const local = hasLocalCss ? visualCss(blockKey, visual!) : null;
  const styleClass =
    visual?.styleClass && VISUAL_STYLE_CLASS_ID.test(visual.styleClass)
      ? visual.styleClass
      : undefined;
  return (
    <>
      {local && <style data-mg-visual-style={local.scope}>{local.css}</style>}
      <div data-mg-visual={local?.scope} data-mg-style={styleClass} data-mg-reveal="">
        {children}
      </div>
    </>
  );
}
