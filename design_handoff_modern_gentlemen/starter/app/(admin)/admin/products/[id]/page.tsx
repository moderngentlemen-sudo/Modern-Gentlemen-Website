import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getDocument } from "@/lib/services/documents";
import {
  getProductCollectionIds,
  getProductMeta,
  listCollections,
  listProductMedia,
  listVariants,
} from "@/lib/services/products";
import { getAsset } from "@/lib/services/media";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/admin/ui/Button";
import { StatusPill } from "@/components/admin/ui/Badge";
import type { ProductAvailability, ProductBadge, ProductFulfilment } from "@/lib/domain/products";

import { ProductDetails, type ProductMetaForm } from "./ProductDetails";
import { ProductCatalogue, type GalleryItem, type VariantRow } from "./ProductCatalogue";

/**
 * A product's details screen.
 *
 * Like `/admin/articles/[id]` and unlike `/admin/pages/[id]`, this is **not**
 * the builder. A product's primary editing surface genuinely is its metadata —
 * what it costs, whether there is any, who fulfils it — and the block tree is
 * the secondary part. The builder is one click away at `./builder`, and it is
 * the same `Builder` component the pages route uses, unchanged.
 */
export default async function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("product.read");

  const [document, meta] = await Promise.all([getDocument("product", id), getProductMeta(id)]);
  if (!document || !meta) notFound();

  const [collectionIds, collections, variants, media] = await Promise.all([
    getProductCollectionIds(id),
    listCollections(),
    listVariants(id),
    listProductMedia(id),
  ]);

  // Resolved here rather than joined in the repository: it is a handful of rows
  // and only when a gallery exists, and keeping `listProductMedia` a plain join
  // read leaves it usable from anywhere. An asset that has been deleted resolves
  // to null and is dropped — `product_media.asset_id` cascades, so this should
  // not happen, but rendering a broken tile would be a poor way to find out.
  const gallery: GalleryItem[] = (
    await Promise.all(
      media.map(async (row) => {
        const asset = await getAsset(row.asset_id);
        return asset
          ? { assetId: row.asset_id, url: asset.url, role: row.role, position: row.position }
          : null;
      })
    )
  ).filter((item): item is GalleryItem => item !== null);

  const canWrite = user.permissions.has("product.write");

  return (
    <>
      <AdminPageHeader
        eyebrow="Product"
        title={document.title}
        actions={
          <>
            <Button href={`/admin/products/${id}/builder`} variant="outline" size="sm">
              Compose sections
            </Button>
            <Button href={`/admin/products/${id}/history`} variant="ghost" size="sm">
              History
            </Button>
          </>
        }
      >
        <p className="mt-2 flex items-center gap-2 text-[13px] text-mg-fg/50">
          <span className="font-mono">/product/{document.slug}</span>
          <StatusPill status={document.status} />
          <span className="font-mono">v{document.version}</span>
        </p>
      </AdminPageHeader>

      <ProductDetails
        initial={{
          id,
          name: meta.name,
          slug: meta.slug,
          cat: meta.cat,
          catLabel: meta.cat_label,
          sku: meta.sku,
          blurb: meta.blurb,
          story: meta.story,
          material: meta.material,
          fulfilment: meta.fulfilment as ProductFulfilment,
          pricePence: meta.price_pence,
          compareAtPence: meta.compare_at_pence,
          stock: meta.stock,
          trackInventory: meta.track_inventory,
          availability: meta.availability as ProductAvailability,
          badges: (meta.badges ?? []) as ProductBadge[],
          // Both columns are `jsonb`, so the generated type is `Json` and the
          // shape has to be asserted somewhere. `productMetaSchema` is what
          // actually checks it on the way back out; these guards only stop a
          // malformed row taking the whole screen down before an editor can
          // fix it — the same forgiveness `normalizeBlock` shows on render.
          specs: Array.isArray(meta.specs) ? (meta.specs as unknown as [string, string][]) : [],
          affiliate:
            meta.affiliate && typeof meta.affiliate === "object" && !Array.isArray(meta.affiliate)
              ? (meta.affiliate as ProductMetaForm["affiliate"])
              : {},
          collectionIds,
        }}
        collections={collections.map((c) => ({ id: c.id, label: c.name }))}
        canWrite={canWrite}
      />

      <ProductCatalogue
        productId={id}
        variants={variants as VariantRow[]}
        gallery={gallery}
        canWrite={canWrite}
      />
    </>
  );
}
