/**
 * Public launch gate. Fail closed: only an explicit `public` value opens
 * the complete website. This variable is server-only (never NEXT_PUBLIC_).
 *
 * Both build and runtime must use the same value. Next.js can prerender
 * public layouts at build time, so changing this flag requires a rebuild.
 */
export function isHomepageOnlyMode(): boolean {
  return process.env.SITE_ACCESS_MODE !== "public";
}

export function normalizedPath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isAdminPath(pathname: string): boolean {
  const path = normalizedPath(pathname);
  return path === "/admin" || path.startsWith("/admin/");
}

/**
 * Only the homepage, private-editor sign-in/recovery, crawler metadata and
 * explicit homepage form submissions are public during prelaunch.
 *
 * Cron endpoints remain reachable by the scheduler: the endpoints themselves
 * require JOBS_SECRET. They do not render content for visitors.
 */
export function isAllowedWithoutStaff(pathname: string): boolean {
  const path = normalizedPath(pathname);
  return (
    path === "/" ||
    path === "/sign-in" ||
    path === "/forgot-password" ||
    path === "/auth/callback" ||
    path === "/auth/sign-out" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/api/newsletter" ||
    path === "/api/forms" ||
    path === "/api/jobs/publish-scheduled" ||
    path === "/api/jobs/run-imports"
  );
}

export function isApiPath(pathname: string): boolean {
  const path = normalizedPath(pathname);
  return path === "/api" || path.startsWith("/api/");
}
