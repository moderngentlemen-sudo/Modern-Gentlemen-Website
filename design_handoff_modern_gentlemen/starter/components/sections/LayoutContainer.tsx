import type { ReactNode } from "react";

import { clsx } from "../ui/clsx";

export type LayoutContainerWidth = "full" | "contained" | "narrow";
export type LayoutContainerBackground = "transparent" | "surface" | "dark" | "accent";
export type LayoutContainerPadding = "none" | "small" | "medium" | "large" | "xlarge";

const BACKGROUND: Record<LayoutContainerBackground, string> = {
  transparent: "",
  surface: "bg-mg-surface",
  dark: "bg-[#0d0d0d] text-[#f4f4f4]",
  accent: "bg-mg-accent text-white",
};

const PADDING: Record<LayoutContainerPadding, string> = {
  none: "py-0",
  small: "py-6",
  medium: "py-12",
  large: "py-20",
  xlarge: "py-[120px]",
};

interface Props {
  width?: LayoutContainerWidth;
  background?: LayoutContainerBackground;
  paddingY?: LayoutContainerPadding;
  children?: ReactNode;
}

/**
 * A neutral composition boundary for the visual builder.
 *
 * Existing editorial sections remain complete, reusable components. This
 * primitive is the lower-level counterpart: it supplies width, background and
 * vertical rhythm, then accepts any registered blocks in its slot. Keeping it
 * ordinary React means nested legacy sections render through exactly the same
 * `SectionRenderer` path they always have.
 */
export function LayoutContainer({
  width = "contained",
  background = "transparent",
  paddingY = "medium",
  children,
}: Props) {
  const darkBand = background === "dark" || background === "accent";
  const content =
    width === "narrow" ? <div className="mx-auto w-full max-w-[760px]">{children}</div> : children;

  return (
    <section
      data-darkband={darkBand ? "" : undefined}
      className={clsx(BACKGROUND[background], PADDING[paddingY])}
    >
      <div className={clsx(width !== "full" && "container-mg")}>{content}</div>
    </section>
  );
}
