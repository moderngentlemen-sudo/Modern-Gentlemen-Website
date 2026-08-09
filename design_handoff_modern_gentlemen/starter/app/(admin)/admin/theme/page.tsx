import { requirePermission } from "@/lib/services/auth";
import { getTheme } from "@/lib/services/theme";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { StatusPill } from "@/components/admin/ui/Badge";
import { ThemeEditor } from "./ThemeEditor";

/**
 * The theme editor.
 *
 * One document and no list screen: `0007` seeds a single `theme_settings` row,
 * `theme.delete` is not a permission, and a second theme would need a switcher
 * nothing asks for. The same stance `/admin/navigation` takes toward creating
 * menus.
 */
export default async function ThemePage() {
  const user = await requirePermission("theme.read");
  const theme = await getTheme();

  return (
    <>
      <AdminPageHeader
        eyebrow="Design"
        title="Theme"
        actions={<StatusPill status={theme.status} />}
      >
        <p className="mt-2 text-[13px] text-mg-fg/50">
          The colour tokens every page renders with. Edits are saved as a draft; the site keeps
          showing the published palette until you publish.
        </p>
      </AdminPageHeader>

      <div className="px-8 py-8">
        <ThemeEditor
          initial={theme}
          canWrite={user.permissions.has("theme.write")}
          canPublish={user.permissions.has("theme.publish")}
        />
      </div>
    </>
  );
}
