import { pageSettingsSchema } from "./pageSettings";
import type { z } from "zod";

/** A section may use presentation media, never page-level SEO or chrome settings. */
export const sectionBackgroundSchema = pageSettingsSchema
  .pick({
    backgroundColor: true,
    backgroundImage: true,
    backgroundVideo: true,
    overlayOpacity: true,
    mediaOverlay: true,
    focalX: true,
    focalY: true,
    videoOnMobile: true,
  })
  .strict();
export type SectionBackground = z.infer<typeof sectionBackgroundSchema>;
export function readSectionBackground(value: unknown): SectionBackground {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(sectionBackgroundSchema.shape).flatMap(([key, schema]) => {
      const result = schema.safeParse(record[key]);
      return result.success && result.data !== undefined ? [[key, result.data]] : [];
    })
  );
}
