import { listArticleDesignPreviews } from "@/lib/services/articleDesignPreview";
import { requirePermission } from "@/lib/services/auth";
import {
  loadAppearancePage,
  loadAppearanceTheme,
  listAppearancePages,
} from "@/lib/services/appearanceCustomizer";
import { getPublishedThemeSettings } from "@/lib/services/publicTheme";
import { getPublishedHomepage } from "@/lib/services/publicContent";
import { AppearanceStudio } from "@/components/admin/AppearanceStudio";
export default async function CustomizerPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await requirePermission("page.read");
  const [query, pages, theme, homepage] = await Promise.all([
    searchParams,
    listAppearancePages(),
    user.permissions.has("theme.read")
      ? loadAppearanceTheme()
      : getPublishedThemeSettings().then((settings) => ({ settings, updatedAt: "" })),
    getPublishedHomepage(),
  ]);
  const id = query.id || homepage?.id || pages[0]?.id;
  const [page, articleChoices] = await Promise.all([
    id ? loadAppearancePage(id) : null,
    listArticleDesignPreviews(),
  ]);
  return (
    <AppearanceStudio
      articleChoices={articleChoices}
      initialPage={page}
      initialTheme={theme}
      pages={pages}
      permissions={{
        pageWrite: user.permissions.has("page.write"),
        pagePublish: user.permissions.has("page.publish"),
        themeWrite: user.permissions.has("theme.write") && user.permissions.has("theme.read"),
        themePublish: user.permissions.has("theme.publish") && user.permissions.has("theme.read"),
        mediaWrite: user.permissions.has("media.write"),
        mediaRead: user.permissions.has("media.read"),
      }}
    />
  );
}
