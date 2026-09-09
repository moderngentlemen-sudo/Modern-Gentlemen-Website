import { mediaOverlayStyle } from "@/lib/domain/mediaOverlay";
export function MediaOverlay({ value }: { value?: unknown }) {
  const style = mediaOverlayStyle(value);
  return style ? (
    <span
      data-media-overlay
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        borderRadius: "inherit",
        ...style,
      }}
    />
  ) : null;
}
