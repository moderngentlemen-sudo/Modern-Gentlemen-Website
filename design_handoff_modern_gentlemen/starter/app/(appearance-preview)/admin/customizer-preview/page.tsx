import { requirePermission } from "@/lib/services/auth";
import { listPublishedProducts } from "@/lib/services/publicCatalog";
import { getChromeNavigation } from "@/lib/services/publicNavigation";
import { CHROME_MENU_KEYS } from "@/lib/domain/navigation";
import { getPublishedGlobalTemplate } from "@/lib/services/publicContent";
import { AppearancePreview } from "@/components/admin/AppearancePreview";
export const dynamic = "force-dynamic";
export const metadata = { title: "Appearance preview", robots: { index: false, follow: false } };
export default async function AppearancePreviewPage() {
  await requirePermission("page.read");
  const [products, nav, headerTemplate, footerTemplate] = await Promise.all([
    listPublishedProducts(),
    getChromeNavigation(CHROME_MENU_KEYS),
    getPublishedGlobalTemplate("header"),
    getPublishedGlobalTemplate("footer"),
  ]);
  return (
    <AppearancePreview
      products={products}
      nav={nav}
      headerTemplate={headerTemplate}
      footerTemplate={footerTemplate}
    />
  );
}
