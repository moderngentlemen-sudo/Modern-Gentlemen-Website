"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/components/ui/clsx";
import { useTheme } from "@/lib/theme";
import type { Permission } from "@/lib/domain/permissions";
import { ToastProvider } from "./ui/Toast";
import { FOCUS_RING, HAIRLINE, LABEL_SM } from "./ui/styles";
import { AdminCommandPalette } from "./AdminCommandPalette";

/**
 * The admin chrome: a fixed left rail and a top bar, replacing the public
 * header and footer /admin used to inherit from the root layout.
 *
 * `permissions` arrives as a plain array, not a `PermissionSet`. That class does
 * not survive the server→client boundary, so the layout calls `.toArray()` and
 * this rebuilds nothing — membership is all the nav needs.
 *
 * The gate here is cosmetic. `requirePermission` in the services is the real
 * boundary and RLS is the one under that; hiding a link the editor cannot use
 * is the third layer, not the only one.
 */
interface NavItem {
  href: string;
  label: string;
  needs?: Permission;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/pages", label: "Pages", needs: "page.read" },
  { href: "/admin/articles", label: "Articles", needs: "article.read" },
  { href: "/admin/taxonomy", label: "Taxonomy", needs: "article.read" },
  { href: "/admin/products", label: "Products", needs: "product.read" },
  { href: "/admin/integrations", label: "Integrations", needs: "integration.read" },
  { href: "/admin/newsletter", label: "Subscribers", needs: "integration.read" },
  { href: "/admin/media", label: "Media", needs: "media.read" },
  { href: "/admin/navigation", label: "Navigation", needs: "navigation.read" },
  { href: "/admin/theme", label: "Theme", needs: "theme.read" },
  { href: "/admin/patterns", label: "Patterns", needs: "pattern.read" },
  { href: "/admin/templates", label: "Templates", needs: "template.read" },
];

const COMMAND_KEYWORDS: Record<string, string[]> = {
  "/admin": ["dashboard", "home"],
  "/admin/pages": ["website", "builder", "content"],
  "/admin/articles": ["blog", "editorial", "posts"],
  "/admin/taxonomy": ["categories", "tags", "authors"],
  "/admin/products": ["store", "commerce", "catalog"],
  "/admin/integrations": ["shopify", "feeds", "connections"],
  "/admin/newsletter": ["email", "subscribers", "mailing list", "export"],
  "/admin/media": ["images", "video", "files", "assets"],
  "/admin/navigation": ["menus", "header", "footer"],
  "/admin/theme": ["design", "fonts", "styles", "colors"],
  "/admin/patterns": ["sections", "reusable", "blocks"],
  "/admin/templates": ["layouts", "builder", "structure"],
};

// **Templates is back, and it took a route to earn the link.** Both `Templates`
// and `Patterns` sat in this array from Phase 4 with neither route built, so
// anyone holding `template.read`/`pattern.read` — which every seeded admin does
// — got a 404 straight from the sidebar. Both were removed; each has returned
// only on the commit that built its screen. Patterns first, then templates once
// the builder learned to open a document whose payload holds named areas rather
// than one ordered list.
//
// The rule that produced two removals and two returns is the part worth
// keeping: **a nav entry is a promise that a screen exists**, and a permission
// check is not a substitute for the screen. Anything added here needs a route
// in the same commit.

export function AdminShell({
  email,
  fullName,
  roles,
  permissions,
  children,
}: {
  email: string;
  fullName: string | null;
  roles: string[];
  permissions: Permission[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const granted = new Set(permissions);
  const visibleNav = NAV.filter((item) => !item.needs || granted.has(item.needs));

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-mg-bg text-mg-fg">
        <aside
          className={clsx(
            "sticky top-0 flex h-screen w-[200px] shrink-0 flex-col border-r",
            HAIRLINE
          )}
        >
          <div className={clsx("border-b px-4 py-4", HAIRLINE)}>
            <Link href="/admin" className={clsx("block", FOCUS_RING)}>
              <span className="font-grotesk text-[15px] font-semibold tracking-[-0.02em]">
                Modern Gentlemen
              </span>
              <span className={clsx(LABEL_SM, "mt-0.5 block")}>Admin</span>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto py-2">
            {visibleNav.map((item) => {
              const active =
                item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "block border-l-2 px-4 py-2 text-[13px] transition-colors",
                    active
                      ? "border-mg-accent bg-mg-fg/5 text-mg-fg"
                      : "border-transparent text-mg-fg/60 hover:text-mg-fg",
                    FOCUS_RING
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <AdminCommandPalette
            commands={visibleNav.map((item) => ({
              href: item.href,
              label: item.label,
              keywords: COMMAND_KEYWORDS[item.href],
            }))}
          />

          <div className={clsx("border-t px-4 py-3", HAIRLINE)}>
            <p className="truncate text-[12px] text-mg-fg/70">{fullName ?? email}</p>
            <p className={clsx(LABEL_SM, "mt-0.5 truncate")}>{roles.join(" · ") || "no role"}</p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={toggle}
                className={clsx(
                  "border border-mg-bd/25 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-mg-fg/70 hover:border-mg-fg hover:text-mg-fg",
                  FOCUS_RING
                )}
              >
                {theme === "dark" ? "Light" : "Dark"}
              </button>
              {/* Beside the account details rather than in the nav rail: it is
                  not a section of the site, and it needs no permission. */}
              <Link
                href="/admin/password"
                className={clsx(
                  "border border-mg-bd/25 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-mg-fg/70 hover:border-mg-fg hover:text-mg-fg",
                  FOCUS_RING
                )}
              >
                Password
              </Link>
              <form action="/auth/sign-out" method="post">
                <button
                  type="submit"
                  className={clsx(
                    "border border-mg-bd/25 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-mg-fg/70 hover:border-mg-fg hover:text-mg-fg",
                    FOCUS_RING
                  )}
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ToastProvider>
  );
}

/** Standard page header for an admin screen. `.container-mg` is site-only. */
export function AdminPageHeader({
  eyebrow,
  title,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className={clsx("border-b px-8 py-6", HAIRLINE)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mg-accentInk">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 font-grotesk text-[30px] font-semibold tracking-[-0.03em]">
            {title}
          </h1>
          {children}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
