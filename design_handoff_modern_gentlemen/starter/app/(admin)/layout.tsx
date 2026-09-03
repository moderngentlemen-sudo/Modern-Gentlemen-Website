import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/services/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { MediaPickerProvider } from "@/components/admin/media/MediaPickerContext";
import { listAssetsAction, listMediaTagsAction } from "./admin/media/actions";

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
 * The chrome itself is `components/admin/AdminShell` — a left rail and a top
 * bar, which is why /admin no longer renders inside the public header and
 * footer. This file stays a server component so the gate runs before any of it.
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

  return (
    <AdminShell
      email={user.email}
      fullName={user.fullName}
      roles={user.roles}
      // PermissionSet is a class instance and does not survive the
      // server→client boundary; the nav only needs membership.
      permissions={user.permissions.toArray()}
    >
      {/*
        Mounted here so every `image`/`video` control under /admin can open the
        library — the builder's properties panel today, an article editor later
        — without four component signatures growing an action they otherwise
        have no interest in. The action reference is passed straight through,
        not wrapped: a closure created in a Server Component is not a
        `"use server"` reference and Next refuses it at render.
      */}
      <MediaPickerProvider search={listAssetsAction} listTags={listMediaTagsAction}>
        {children}
      </MediaPickerProvider>
    </AdminShell>
  );
}
