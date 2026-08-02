import { requirePermission } from "@/lib/services/auth";
import { listDocuments } from "@/lib/services/documents";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/admin/ui/Button";
import { ProductsList, type ProductRow } from "./ProductsList";

export default async function ProductsIndex() {
  // The route's own gate. The layout proves the visitor is staff; this proves
  // they may read products specifically.
  const user = await requirePermission("product.read");

  // The polymorphic document repository serves products unchanged — the same
  // versioning columns `0005` gave them, the same list shape. The only thing
  // that had to change was `document_table()`'s allowlist, in `0014`.
  const products = await listDocuments("product", { limit: 200 });

  return (
    <>
      <AdminPageHeader
        eyebrow="Commerce"
        title="Products"
        actions={
          <Button href="/admin/products/collections" variant="ghost" size="sm">
            Collections
          </Button>
        }
      >
        <p className="mt-2 text-[13px] text-mg-fg/50">
          The catalogue. Prices are held in pence and shown in pounds. The public store still
          renders from the demo catalogue until Phase 7 rewires it.
        </p>
      </AdminPageHeader>

      <ProductsList
        products={products as ProductRow[]}
        canWrite={user.permissions.has("product.write")}
        canDelete={user.permissions.has("product.delete")}
      />
    </>
  );
}
