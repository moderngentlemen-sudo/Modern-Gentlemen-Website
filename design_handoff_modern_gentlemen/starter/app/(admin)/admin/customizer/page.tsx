import { requirePermission } from "@/lib/services/auth";
import {
  loadAppearancePage,
  loadAppearanceTheme,
  listAppearancePages,
} from "@/lib/services/appearanceCustomizer";
import { getPublishedThemeSettings } from "@/lib/services/publicTheme";
import { AppearanceStudio } from "@/components/admin/AppearanceStudio";
export default async function CustomizerPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await requirePermission("page.read");
  const [query, pages, theme] = await Promise.all([
    searchParams,
    listAppearancePages(),
    user.permissions.has("theme.read")
      ? loadAppearanceTheme()
      : getPublishedThemeSettings().then((settings) => ({ settings, updatedAt: "" })),
  ]);
  const id = query.id || pages.find((p) => p.slug === "home")?.id || pages[0]?.id;
  const page = id ? await loadAppearancePage(id) : null;
  return (
    <AppearanceStudio
      initialPage={page}
      initialTheme={theme}
      pages={pages}
      permissions={{
        pageWrite: user.permissions.has("page.write"),
        pagePublish: user.permissions.has("page.publish"),
        themeWrite: user.permissions.has("theme.write") && user.permissions.has("theme.read"),
        themePublish: user.permissions.has("theme.publish") && user.permissions.has("theme.read"),
      }}
    />
  );
}
