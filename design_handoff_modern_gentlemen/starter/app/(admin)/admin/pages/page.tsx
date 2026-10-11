import { requirePermission } from "@/lib/services/auth";
import { listDocuments } from "@/lib/services/documents";
import { getPublishedHomepage } from "@/lib/services/publicContent";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { PagesList, type PageRow } from "./PagesList";

export default async function PagesIndex() {
  // The route's own gate. The layout proves the visitor is staff; this proves
  // they may read pages specifically.
  const user = await requirePermission("page.read");
  const pages = await listDocuments("page", { limit: 100 });
  const homepage = await getPublishedHomepage();

  return (
    <>
      <AdminPageHeader eyebrow="Content" title="Pages">
        <p className="mt-2 text-[13px] text-mg-fg/60">
          Every page is an ordered list of sections, composed in the builder. Publish a page first,
          then choose Set as homepage to use it at the main website address.
        </p>
      </AdminPageHeader>

      <PagesList
        pages={pages as PageRow[]}
        canWrite={user.permissions.has("page.write")}
        canDelete={user.permissions.has("page.delete")}
        canSetHomepage={user.permissions.has("page.write") && user.permissions.has("page.publish")}
        homepageId={homepage?.id ?? null}
      />
    </>
  );
}
