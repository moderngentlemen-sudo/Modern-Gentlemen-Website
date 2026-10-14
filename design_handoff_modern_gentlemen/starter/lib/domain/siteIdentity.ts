import { z } from "zod";

/**
 * Stored inside the existing theme_settings draft/published payload.
 * Restrict icon URLs to same-origin paths or HTTPS media. Never permit data:,
 * javascript:, credentialed URLs or protocol-relative destinations in <head>.
 */
export function safeIdentityImageUrl(value: string): boolean {
  if (!value) return true;
  if (/[\\\u0000-\u001f\u007f]/.test(value) || /\s/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  if (!value.startsWith("https://")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const siteIdentitySchema = z.object({
  siteName: z.string().trim().min(1).max(90),
  description: z.string().trim().max(500),
  faviconUrl: z
    .string()
    .trim()
    .max(2048)
    .refine(safeIdentityImageUrl, "Use an HTTPS image URL or a site-relative path."),
  appleTouchIconUrl: z
    .string()
    .trim()
    .max(2048)
    .refine(safeIdentityImageUrl, "Use an HTTPS image URL or a site-relative path."),
});

export type SiteIdentity = z.infer<typeof siteIdentitySchema>;

export const DEFAULT_SITE_IDENTITY: SiteIdentity = {
  siteName: "Modern Gentlemen",
  description: "Style, grooming, watches, culture and film — for the considered man.",
  faviconUrl: "/site-icon.svg",
  appleTouchIconUrl: "",
};

/** Read legacy and partially damaged theme payloads without breaking a site. */
export function readSiteIdentity(value: unknown): SiteIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_SITE_IDENTITY };
  }
  const record = value as Record<string, unknown>;
  const result: SiteIdentity = { ...DEFAULT_SITE_IDENTITY };
  for (const key of ["siteName", "description", "faviconUrl", "appleTouchIconUrl"] as const) {
    const candidate = record[key];
    const parsed = siteIdentitySchema.shape[key].safeParse(candidate);
    if (parsed.success) result[key] = parsed.data;
  }
  return result;
}

export function siteIdentityMetadata(identity: SiteIdentity) {
  return {
    title: identity.siteName,
    applicationName: identity.siteName,
    description: identity.description,
    icons: {
      icon: [{ url: identity.faviconUrl || DEFAULT_SITE_IDENTITY.faviconUrl }],
      ...(identity.appleTouchIconUrl ? { apple: [{ url: identity.appleTouchIconUrl }] } : {}),
    },
  };
}
