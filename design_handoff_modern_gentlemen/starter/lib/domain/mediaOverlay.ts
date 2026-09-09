import { z } from "zod";

export const mediaOverlaySchema = z
  .object({
    mode: z.enum(["none", "solid", "linear", "radial"]),
    color: z.string().regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i),
    opacity: z.number().finite().min(0).max(100),
    endColor: z.string().regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i),
    angle: z.number().finite().min(0).max(360),
    start: z.number().finite().min(0).max(100),
    end: z.number().finite().min(0).max(100),
    x: z.number().finite().min(0).max(100),
    y: z.number().finite().min(0).max(100),
  })
  .strict()
  .refine((v) => v.start <= v.end, "The first gradient stop must precede the last.");
export type MediaOverlay = z.infer<typeof mediaOverlaySchema>;
export const DEFAULT_MEDIA_OVERLAY: MediaOverlay = {
  mode: "none",
  color: "#000000",
  opacity: 40,
  endColor: "#00000000",
  angle: 180,
  start: 0,
  end: 100,
  x: 50,
  y: 50,
};
export function mediaOverlayStyle(raw: unknown) {
  const parsed = mediaOverlaySchema.safeParse(raw);
  if (!parsed.success || parsed.data.mode === "none") return undefined;
  const o = parsed.data;
  const stops = `${o.color} ${o.start}%, ${o.endColor} ${o.end}%`;
  return {
    background:
      o.mode === "solid"
        ? o.color
        : o.mode === "linear"
          ? `linear-gradient(${o.angle}deg, ${stops})`
          : `radial-gradient(ellipse at ${o.x}% ${o.y}%, ${stops})`,
    opacity: o.opacity / 100,
  };
}
