import { requirePermission } from "@/lib/services/auth";
import { EditorialCollectionGallery } from "@/components/admin/EditorialCollectionGallery";
import { createCollectionDraftAction } from "./actions";

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ concept?: string }>;
}) {
  const user = await requirePermission("page.read");
  const params = await searchParams;
  return (
    <EditorialCollectionGallery
      initialConcept={params.concept}
      canCreatePage={user.permissions.has("page.write")}
      canCreateArticle={user.permissions.has("article.write")}
      createDraft={createCollectionDraftAction}
    />
  );
}
