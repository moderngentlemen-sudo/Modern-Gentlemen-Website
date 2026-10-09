/** Short card links: /c/<slug>. Same rule as the database's check constraint. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,38}[a-z0-9]$/;

/** "Jordan Ellis" → "jordan-ellis-k3f9". The random end keeps links unguessable enough and avoids clashes. */
export function makeSlug(name: string, rand: () => number = Math.random): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30)
      .replace(/-+$/, "") || "card";
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  const tail = Array.from({ length: 4 }, () => chars[Math.floor(rand() * chars.length)]).join("");
  return `${base}-${tail}`;
}

export function cardShortUrl(origin: string, slug: string): string {
  return `${origin}/c/${slug}`;
}

/** The slug in a /c/<slug> path, if it is one. */
export function slugFromPath(path: string): string | null {
  const m = /^\/c\/([a-z0-9-]+)\/?$/.exec(path);
  return m && SLUG_RE.test(m[1]) ? m[1] : null;
}
