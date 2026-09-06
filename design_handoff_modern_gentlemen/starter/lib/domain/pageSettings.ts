import { z } from "zod";

function isMediaUrl(value: string): boolean {
  if (!value) return true;
  // Browsers normalize backslashes and strip controls before resolving URLs.
  // Reject them before deciding that a destination is a same-origin path.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  if (!/^https:\/\/[^/\s]/i.test(value) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

const mediaUrl = z
  .string()
  .max(2048)
  .refine(isMediaUrl, "Use an HTTPS URL or a site-relative path.");
const header = z.enum(["inherit", "hidden", "overlay"]);
const footer = z.enum(["inherit", "hidden"]);
export const pageSettingsSchema = z
  .object({
    seoTitle: z.string().max(200).optional(),
    description: z.string().max(1000).optional(),
    socialTitle: z.string().max(200).optional(),
    socialDescription: z.string().max(1000).optional(),
    socialImage: mediaUrl.optional(),
    noIndex: z.boolean().optional(),
    backgroundColor: z
      .string()
      .regex(/^$|^#[0-9a-f]{6}$/i, "Use a six-digit hex color.")
      .optional(),
    backgroundImage: mediaUrl.optional(),
    backgroundVideo: mediaUrl.optional(),
    overlayOpacity: z.number().min(0).max(1).optional(),
    focalX: z.number().min(0).max(100).optional(),
    focalY: z.number().min(0).max(100).optional(),
    videoOnMobile: z.boolean().optional(),
    fullHeight: z.boolean().optional(),
    header: header.optional(),
    mobileHeader: header.optional(),
    footer: footer.optional(),
    mobileFooter: footer.optional(),
  })
  .passthrough();
export type PageSettings = z.infer<typeof pageSettingsSchema>;

/** Forgiving field-by-field reads retain valid legacy settings; publish is strict. */
export function readPageSettings(value: unknown): PageSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(pageSettingsSchema.shape).flatMap(([key, schema]) => {
      const parsed = schema.safeParse(record[key]);
      return parsed.success && parsed.data !== undefined ? [[key, parsed.data]] : [];
    })
  );
}

export function pageSettingsMedia(value: unknown) {
  const settings = readPageSettings(value);
  return (["backgroundImage", "backgroundVideo", "socialImage"] as const).flatMap((key) =>
    settings[key] ? [{ url: settings[key], fieldPath: `pageSettings.${key}` }] : []
  );
}
