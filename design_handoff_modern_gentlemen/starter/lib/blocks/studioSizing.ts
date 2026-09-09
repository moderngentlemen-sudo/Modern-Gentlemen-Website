/** Historical coordinate widths remain valid for already-saved Studio sections. */
export const STUDIO_LEGACY_WIDTHS = { desktop: 760, tablet: 680, mobile: 390 } as const;

/** Studio dimensions are CSS pixels, just like the original builder's controls. */
export function studioPixels(value: number) {
  return `${value}px`;
}
