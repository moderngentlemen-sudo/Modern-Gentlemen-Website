import Link from "next/link";

import { requirePermission } from "@/lib/services/auth";
import { listMenus } from "@/lib/services/navigation";
import { toMenuStatus } from "@/lib/domain/navigation";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/ui/Panel";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { StatusPill } from "@/components/admin/ui/Badge";
import { Table, Td, Th } from "@/components/admin/ui/Table";

/**
 * The menus the site mounts.
 *
 * There is no "new menu" button, deliberately. A menu's `key` is what the chrome
 * looks it up by — `header-primary` is named in `CHROME_MENU_KEYS` and read by
 * the site layout — so a menu an editor invents has nothing rendering it. The
 * rows come from `0007`'s insert and the seed; adding a mount point is a code
 * change, and pretending otherwise would produce menus that quietly do nothing.
 */
export default async function NavigationIndex() {
  await requirePermission("navigation.read");
  const menus = await listMenus();

  return (
    <>
      <AdminPageHeader eyebrow="Site" title="Navigation">
        <p className="mt-2 text-[13px] text-mg-fg/60">
          The header, drawer and footer read these. Changes go live as soon as they are saved — a
          menu has no separate draft.
        </p>
      </AdminPageHeader>

      <div className="px-8 py-8">
        <Panel>
          {menus.length === 0 ? (
            <EmptyState title="No menus yet">
              The database ships with a header and a footer menu. If this list is empty, the project
              has not been seeded: run <code>npx tsx scripts/seed.ts</code>.
            </EmptyState>
          ) : (
            <Table caption="All menus">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Key</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {menus.map((menu) => (
                  <tr key={menu.id} className="hover:bg-mg-fg/[0.02]">
                    <Td className="font-medium">{menu.name}</Td>
                    <Td className="font-mono text-[12px] text-mg-fg/60">{menu.key}</Td>
                    <Td>
                      <StatusPill status={toMenuStatus(menu.status)} />
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/admin/navigation/${menu.key}`}
                        className="text-[13px] text-mg-fg/70 underline-offset-4 hover:text-mg-fg hover:underline"
                      >
                        Edit
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}
