import Link from "next/link";
import { requireUser } from "@/lib/services/auth";
import { listDocuments } from "@/lib/services/documents";
import { getPublishedHomepage } from "@/lib/services/publicContent";
import { getAdminSiteAccess } from "@/lib/services/siteAccess";
import { SITE_ACCESS_LABELS } from "@/lib/domain/siteAccessState";
import { PERMISSIONS } from "@/lib/domain/permissions";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/ui/Panel";
import { StatusPill } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Table, Td, Th } from "@/components/admin/ui/Table";
import { LABEL_SM } from "@/components/admin/ui/styles";

/**
 * The admin overview.
 *
 * Keeps the "Permissions — N granted" summary the previous placeholder showed.
 * `tests/e2e/auth.spec.ts` asserts on it as proof that the whole authorisation
 * chain resolved — Supabase Auth → user_roles → role_permissions → this page —
 * which is still exactly what it demonstrates.
 */
export default async function AdminHome() {
  const user = await requireUser();

  const canReadPages = user.permissions.has("page.read");
  const recent = canReadPages ? await listDocuments("page", { limit: 8 }) : [];
  const homepage = user.permissions.has("page.write") ? await getPublishedHomepage() : null;
  const access = user.permissions.has("settings.read") ? await getAdminSiteAccess() : null;

  const byResource = new Map<string, string[]>();
  for (const permission of PERMISSIONS) {
    if (!user.permissions.has(permission)) continue;
    const [resource, action] = permission.split(".");
    byResource.set(resource, [...(byResource.get(resource) ?? []), action]);
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Overview"
        title={user.fullName ?? user.email}
        actions={
          homepage ? (
            <Button href={`/admin/pages/${homepage.id}`} size="sm">
              Edit homepage
            </Button>
          ) : undefined
        }
      >
        <p className="mt-2 text-[13px] text-mg-fg/60">
          Signed in as {user.email} · {user.roles.join(", ") || "no role"}
        </p>
      </AdminPageHeader>

      <div className="space-y-8 px-8 py-8">
        {access && (
          <section aria-label="Site access">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-grotesk text-[16px] font-semibold tracking-[-0.02em]">
                  Site access: {SITE_ACCESS_LABELS[access.effectiveMode]}
                </h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-mg-fg/60">
                  {access.effectiveMode === "public"
                    ? "All published pages are currently open to visitors."
                    : access.effectiveMode === "private-preview"
                      ? "Visitors see the homepage. Authorized staff can browse the full website."
                      : "Visitors see only the homepage. Staff may edit the rest in admin."}
                  {access.scheduledPublicAt &&
                    ` A public launch is scheduled for ${new Date(access.scheduledPublicAt).toLocaleString()}.`}
                </p>
              </div>
              {user.permissions.has("page.read") && (
                <Button href="/admin/customizer?area=access" size="sm" variant="outline">
                  Manage site access
                </Button>
              )}
            </div>
          </section>
        )}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-grotesk text-[16px] font-semibold tracking-[-0.02em]">
              Recently edited
            </h2>
            {canReadPages && (
              <Button href="/admin/pages" size="sm" variant="ghost">
                All pages
              </Button>
            )}
          </div>

          <Panel>
            {recent.length === 0 ? (
              <EmptyState title="Nothing edited yet">
                Pages you create will appear here, newest first.
              </EmptyState>
            ) : (
              <Table caption="Recently edited pages">
                <thead>
                  <tr>
                    <Th>Title</Th>
                    <Th>Slug</Th>
                    <Th>Status</Th>
                    <Th>Version</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((page) => (
                    <tr key={page.id}>
                      <Td>
                        <Link href={`/admin/pages/${page.id}`} className="hover:text-mg-accentInk">
                          {page.title}
                        </Link>
                      </Td>
                      <Td className="font-mono text-[12px] text-mg-fg/60">/{page.slug}</Td>
                      <Td>
                        <StatusPill status={page.status} />
                      </Td>
                      <Td className="font-mono text-[12px] text-mg-fg/60">v{page.version}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </section>

        <section>
          <h2 className="mb-3 font-grotesk text-[16px] font-semibold tracking-[-0.02em]">
            Permissions — {user.permissions.size} granted
          </h2>

          <div className="grid gap-px border border-mg-bd/15 bg-mg-bd/15 sm:grid-cols-2 lg:grid-cols-3">
            {[...byResource.entries()].map(([resource, actions]) => (
              <div key={resource} className="bg-mg-surface px-4 py-3">
                <p className={LABEL_SM}>{resource}</p>
                <p className="mt-1 text-[13px] text-mg-fg/70">{actions.join(" · ")}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
