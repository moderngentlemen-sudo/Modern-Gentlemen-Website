import Link from "next/link";
import { requireUser } from "@/lib/services/auth";
import { PERMISSIONS } from "@/lib/domain/permissions";

/**
 * Admin landing.
 *
 * Renders the signed-in identity and the resolved permission set — the visible
 * proof that the whole authorisation chain is wired: Supabase Auth → user_roles
 * → role_permissions → has_permission() in RLS → this page.
 *
 * Phase 4 replaces this with the dashboard (recent edits, pending imports,
 * failed jobs, publish queue) inside the full admin shell.
 */
export default async function AdminHome() {
  const user = await requireUser();
  const held = user.permissions;

  const byResource = PERMISSIONS.reduce<Record<string, string[]>>((acc, permission) => {
    const [resource, action] = permission.split(".");
    if (held.has(permission)) (acc[resource] ??= []).push(action);
    return acc;
  }, {});

  return (
    <main className="px-8 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-mg-bd/15 pb-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mg-accent">Admin</p>
          <h1 className="mt-1.5 font-grotesk text-[30px] font-semibold leading-none tracking-[-0.03em]">
            {user.fullName ?? user.email}
          </h1>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-mg-fg/45">
            {user.email} · {user.roles.join(", ")}
          </p>
        </div>

        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="border border-mg-bd/30 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors hover:border-mg-accent hover:text-mg-accent"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mg-fg/45">
          Permissions — {held.size} granted
        </h2>

        <div className="mt-4 grid gap-px border border-mg-bd/15 bg-mg-bd/15 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(byResource).map(([resource, actions]) => (
            <div key={resource} className="bg-mg-bg p-4">
              <p className="font-grotesk text-[15px] capitalize">{resource}</p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mg-fg/50">
                {actions.join(" · ")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 border border-mg-bd/15 p-6">
        <p className="font-serif text-lg italic text-mg-fg/50">Next</p>
        <p className="mt-1.5 max-w-[60ch] text-mg-fg/70">
          The builder, media library and commerce modules land in the phases that follow. The page
          builder canvas already exists at{" "}
          <Link href="/admin/builder" className="text-mg-accent underline-offset-4 hover:underline">
            /admin/builder
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
