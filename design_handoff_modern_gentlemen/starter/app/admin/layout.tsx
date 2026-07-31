import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/services/auth";

export const metadata: Metadata = {
  title: "Admin — Modern Gentlemen",
  robots: { index: false, follow: false },
};

// Admin screens are per-user and must never be cached or statically rendered.
export const dynamic = "force-dynamic";

/**
 * Server-side gate inherited by every /admin route.
 *
 * Middleware already redirects signed-out visitors, but that is a convenience:
 * middleware can be bypassed by rewrites and does not run on every rendering
 * path. This check is the one that actually guards the render, and RLS guards
 * the data underneath it.
 *
 * Phase 4 replaces this shell with the full admin chrome (left nav, top bar,
 * command palette) built on components/admin/ui.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect("/sign-in?next=/admin");

  // Signed in but holding no role: authenticated, not staff.
  if (user.roles.length === 0) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-6">
        <div className="max-w-[440px] text-center">
          <p className="font-serif text-lg italic text-mg-accentSerif">Not permitted</p>
          <h1 className="mt-2 font-grotesk text-[28px] font-semibold tracking-[-0.03em]">
            No admin access
          </h1>
          <p className="mt-3 text-mg-fg/60">
            Your account is signed in but has not been granted a role. Ask an administrator to
            assign one.
          </p>
          <form action="/auth/sign-out" method="post" className="mt-7">
            <button
              type="submit"
              className="border border-mg-bd px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors hover:bg-mg-fg hover:text-mg-bg"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  return <div className="min-h-screen bg-mg-bg text-mg-fg">{children}</div>;
}
