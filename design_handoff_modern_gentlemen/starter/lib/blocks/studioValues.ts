export function studioColor(value: unknown): string | undefined {
  return typeof value === "string" &&
    (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value) || value === "transparent")
    ? value
    : undefined;
}

export function studioGradient(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^linear-gradient\(-?\d+(?:\.\d+)?deg,#[\da-f]{3,8}(?: \d+(?:\.\d+)?%)?(?:,#[\da-f]{3,8}(?: \d+(?:\.\d+)?%)?){1,11}\)$/i.test(
      value
    )
    ? value
    : undefined;
}

export function studioDestination(value: unknown, media = false): string | undefined {
  if (typeof value !== "string" || !value || /[\s\\<>\u0000-\u001f\u007f]/.test(value)) return;
  // Only these bundled editorial images have a public equivalent.
  if (
    media &&
    /^\/api\/admin\/design-studio\?asset=(editorial-tailoring|mega-menu-architecture)\.png$/.test(
      value
    )
  )
    return `/images/studio/${value.split("asset=")[1]}`;
  if (!media && /^#[a-z0-9-]+$/i.test(value)) return value;
  try {
    const url = new URL(value, "https://studio.invalid");
    if (value.startsWith("/")) {
      if (
        value.startsWith("//") ||
        /^\/(?:api|admin)(?:\/|$)/i.test(decodeURIComponent(url.pathname))
      )
        return;
      return value;
    }
    if (url.username || url.password) return;
    if (url.protocol === "https:" && url.hostname && /^https:\/\//i.test(value)) return value;
    if (
      url.protocol === "http:" &&
      url.hostname &&
      /^http:\/\//i.test(value) &&
      (!media || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
      return value;
    if (!media && /^(mailto|tel):[^?#]+/i.test(value)) return value;
  } catch {
    return;
  }
}
