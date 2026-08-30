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
  const paddingTop = spacing(design?.spaceBefore);
  const paddingBottom = spacing(design?.spaceAfter);
  if (paddingTop === undefined && paddingBottom === undefined) return <>{children}</>;

  return <div style={{ paddingTop, paddingBottom }}>{children}</div>;
}
