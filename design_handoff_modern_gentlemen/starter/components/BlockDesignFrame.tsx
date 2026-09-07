import { PagePresentation } from "./PagePresentation";
import { readSectionBackground } from "@/lib/domain/sectionBackground";
import { gradientCss } from "@/lib/domain/gradient";
import { BLOCK_SPACING, type BlockDesign, type BlockSpacing } from "@/lib/blocks/types";

const SPACING: Record<BlockSpacing, string> = {
  none: "0px",
  small: "24px",
  medium: "48px",
  large: "80px",
  xlarge: "120px",
};

function spacing(value: unknown): string | undefined {
  return (BLOCK_SPACING as readonly unknown[]).includes(value)
    ? SPACING[value as BlockSpacing]
    : undefined;
}

/**
 * Applies optional, universal section presentation without changing a block's
 * manifest or component contract. With no valid setting it returns a fragment,
 * which keeps every existing page's DOM and visual baseline byte-for-byte the
 * same.
 */
export function BlockDesignFrame({
  design,
  children,
}: {
  design?: BlockDesign;
  children: React.ReactNode;
}) {
  const media = readSectionBackground(design?.background);
  const hasMedia = Boolean(media.backgroundColor || media.backgroundImage || media.backgroundVideo);
  const backgroundImage = gradientCss(design?.gradient);
  const paddingTop = spacing(design?.spaceBefore);
  const paddingBottom = spacing(design?.spaceAfter);
  const content =
    !backgroundImage && paddingTop === undefined && paddingBottom === undefined ? (
      <>{children}</>
    ) : (
      <div style={{ paddingTop, paddingBottom, backgroundImage }}>{children}</div>
    );
  return hasMedia ? <PagePresentation settings={media}>{content}</PagePresentation> : content;
}
