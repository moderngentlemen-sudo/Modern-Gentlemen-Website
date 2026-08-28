"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { TextInput } from "@/components/admin/ui/Input";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { Panel, PanelSection } from "@/components/admin/ui/Panel";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Table, Td, Th } from "@/components/admin/ui/Table";
import { useToast } from "@/components/admin/ui/Toast";
import { MediaPickerDialog } from "@/components/admin/media/MediaPickerDialog";
import { formatPence, poundsToPence } from "@/lib/domain/money";
import type { AssetView } from "@/lib/services/media";
import type { ProductMediaRole } from "@/lib/domain/products";

import {
  attachProductMediaAction,
  createVariantAction,
  deleteVariantAction,
  detachProductMediaAction,
} from "./catalog-actions";

export interface VariantRow {
  id: string;
  title: string;
  sku: string | null;
  price_pence: number | null;
  stock: number;
  position: number;
}

export interface GalleryItem {
  assetId: string;
  url: string;
  role: ProductMediaRole;
  position: number;
}

/**
 * Variants and the gallery — the two product tables that are lists rather than
 * columns, so they cannot live in the metadata form's single save.
 *
 * The gallery stores asset **ids**, not URLs. That is the `featured_asset_id`
 * stance from Phase 5b rather than the block-field one, and for the same
 * reason: `product_media.asset_id` carries a real foreign key with `on delete
 * cascade`, so a deleted asset takes its gallery rows with it. A block's
 * `image` field still holds a URL because a block has to keep working when it
 * points at a CDN the library does not own.
 */
export function ProductCatalogue({
  productId,
  variants,
  gallery,
  canWrite,
}: {
  productId: string;
  variants: VariantRow[];
  gallery: GalleryItem[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [sku, setSku] = useState("");
  const [pricePounds, setPricePounds] = useState<number | undefined>(undefined);
  const [stock, setStock] = useState<number | undefined>(0);
  const [error, setError] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<VariantRow | null>(null);

  function addVariant() {
    setError(undefined);
    startTransition(async () => {
      const result = await createVariantAction({
        productId,
        title,
        sku: sku.trim() || null,
        // undefined means "inherit the product's price", which the column
        // stores as null. Zero would be a genuine free variant, so the two
        // cannot be collapsed.
        pricePence: pricePounds === undefined ? null : poundsToPence(pricePounds),
        stock: stock ?? 0,
        position: variants.length,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setAdding(false);
      setTitle("");
      setSku("");
      setPricePounds(undefined);
      setStock(0);
      toast.push("Variant added", "success");
      router.refresh();
    });
  }

  function removeVariant(variant: VariantRow) {
    startTransition(async () => {
      const result = await deleteVariantAction({ id: variant.id, productId });
      setConfirmDelete(null);
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push(`Removed “${variant.title}”`, "success");
        router.refresh();
      }
    });
  }

  function attach(asset: AssetView) {
    startTransition(async () => {
      const result = await attachProductMediaAction({
        productId,
        assetId: asset.id,
        // The first image attached becomes the primary; everything after it is
        // gallery. An editor can still have only one primary because the
        // upsert keys on (product_id, asset_id) and this only ever runs once
        // per asset.
        role: gallery.length === 0 ? "primary" : "gallery",
        position: gallery.length,
      });

      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push("Image attached", "success");
        router.refresh();
      }
    });
  }

  function detach(assetId: string) {
    startTransition(async () => {
      const result = await detachProductMediaAction({ productId, assetId });
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push("Image removed", "success");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 px-8 pb-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel>
        <PanelSection title="Variants">
          {variants.length === 0 ? (
            <EmptyState
              eyebrow="Variants"
              title="No variants"
              action={
                canWrite ? (
                  <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                    Add a variant
                  </Button>
                ) : undefined
              }
            >
              A product with no variants sells as one thing at one price. Add them for sizes,
              lengths or colourways.
            </EmptyState>
          ) : (
            <>
              <Table caption="Variants">
                <thead>
                  <tr>
                    <Th>Title</Th>
                    <Th>SKU</Th>
                    <Th>Price</Th>
                    <Th>Stock</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant) => (
                    <tr key={variant.id} className="hover:bg-mg-fg/[0.02]">
                      <Td className="font-medium">{variant.title}</Td>
                      <Td className="font-mono text-[12px] text-mg-fg/60">{variant.sku ?? "—"}</Td>
                      <Td className="font-mono text-[12px]">
                        {variant.price_pence === null ? (
                          <span className="text-mg-fg/60">inherits</span>
                        ) : (
                          formatPence(variant.price_pence)
                        )}
                      </Td>
                      <Td className="font-mono text-[12px]">{variant.stock}</Td>
                      <Td className="text-right">
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDelete(variant)}
                            disabled={pending}
                          >
                            Remove
                          </Button>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {canWrite && (
                <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                  Add a variant
                </Button>
              )}
            </>
          )}
        </PanelSection>
      </Panel>

      <Panel className="h-fit">
        <PanelSection title="Gallery">
          {gallery.length === 0 ? (
            <p className="text-[12px] text-mg-fg/60">
              No images attached. The PDP falls back to whatever the block tree holds.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {gallery.map((item) => (
                <li key={item.assetId} className="border border-mg-bd/15 bg-mg-bg/40 p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- external_url assets are not on an allowed remote host */}
                  <img src={item.url} alt="" className="h-20 w-full object-cover" />
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mg-fg/60">
                    {item.role}
                  </p>
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => detach(item.assetId)}
                      disabled={pending}
                    >
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setPicking(true)}>
              Attach an image
            </Button>
          )}
        </PanelSection>
      </Panel>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a variant"
        description="Leave the price empty to inherit the product's."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="solid" onClick={addVariant} loading={pending} disabled={!title.trim()}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput
            label="Title"
            value={title}
            onChange={setTitle}
            placeholder="20mm · Taupe"
            error={error}
            required
          />
          <TextInput label="SKU" value={sku} onChange={setSku} />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Price (£)"
              value={pricePounds}
              onChange={setPricePounds}
              min={0}
              help="Empty inherits."
            />
            <NumberInput label="Stock" value={stock} onChange={setStock} min={0} integer />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Remove “${confirmDelete?.title ?? ""}”?`}
        description="The variant goes; the product stays."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => confirmDelete && removeVariant(confirmDelete)}
            >
              Remove variant
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-mg-fg/60">This cannot be undone from here.</p>
      </Dialog>

      <MediaPickerDialog
        open={picking}
        onClose={() => setPicking(false)}
        kind="image"
        onPick={attach}
      />
    </div>
  );
}
