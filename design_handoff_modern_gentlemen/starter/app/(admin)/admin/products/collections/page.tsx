import { requirePermission } from "@/lib/services/auth";
import { listCollections } from "@/lib/services/products";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/admin/ui/Button";

import { CollectionsList, type CollectionRow } from "./CollectionsList";

export default async function CollectionsPage() {
  const user = await requirePermission("product.read");
  const collections = await listCollections();

  return (
    <>
      <AdminPageHeader
        eyebrow="Commerce"
        title="Collections"
        actions={
          <Button href="/admin/products" variant="outline" size="sm">
            Back to products
          </Button>
        }
      >
        <p className="mt-2 text-[13px] text-mg-fg/60">
          Curated groupings a product can belong to. Membership is set from each product&rsquo;s own
          panel.
        </p>
      </AdminPageHeader>

      <CollectionsList
        collections={collections as CollectionRow[]}
        canWrite={user.permissions.has("product.write")}
        canDelete={user.permissions.has("product.delete")}
      />
    </>
  );
}
