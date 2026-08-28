import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getMenu, listLinkTargets } from "@/lib/services/navigation";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { MenuEditor, type EditorItem } from "../MenuEditor";
import type { MenuItemNode } from "@/lib/domain/navigation";

/**
 * One menu's tree.
 *
 * Flattened to two levels for the editor because that is what the chrome
 * renders: a nav entry and its mega-menu links. `menu_items` nests without a
 * depth limit and `buildMenuTree` returns whatever depth exists, so anything
 * deeper is preserved in the database and simply not shown here — this screen
 * declines to edit it rather than silently discarding it.
 */
function toEditorItem(node: MenuItemNode): EditorItem {
  return {
    id: node.id,
    label: node.label,
    linkType: node.linkType,
    targetId: node.targetId,
    url: node.url,
    group: node.options.group ?? null,
    feature: node.options.feature ?? null,
    children: node.children.map(toEditorItem),
  };
}

export default async function MenuPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const user = await requirePermission("navigation.read");

  const menu = await getMenu(key);
  if (!menu) notFound();

  const targets = await listLinkTargets();

  return (
    <>
      <AdminPageHeader eyebrow="Navigation" title={menu.name}>
        <p className="mt-2 text-[13px] text-mg-fg/60">
          <span className="font-mono text-[12px]">{menu.key}</span> — saved changes appear on the
          site immediately.
        </p>
      </AdminPageHeader>

      <MenuEditor
        menuId={menu.id}
        items={menu.items.map(toEditorItem)}
        targets={targets}
        canWrite={user.permissions.has("navigation.write")}
      />
    </>
  );
}
