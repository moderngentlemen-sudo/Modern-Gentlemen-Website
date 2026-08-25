"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { TextInput } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { Panel } from "@/components/admin/ui/Panel";
import { StatusPill } from "@/components/admin/ui/Badge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Table, Td, Th } from "@/components/admin/ui/Table";
import { useToast } from "@/components/admin/ui/Toast";
import type { DocumentStatus } from "@/lib/domain/documents";
import { PRODUCT_FULFILMENTS } from "@/lib/domain/products";

import { createProductAction, deleteProductAction } from "./actions";

export interface ProductRow {
  id: string;
  title: string;
  slug: string;
  status: DocumentStatus;
  version: number;
  updated_at: string;
}

/** Matches the slug rule the action enforces, and `ArticlesList`'s own helper. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const FULFILMENT_OPTIONS = [
  { value: PRODUCT_FULFILMENTS[0], label: "Direct — we sell and ship it" },
  { value: PRODUCT_FULFILMENTS[1], label: "Affiliate — we link out to a merchant" },
];

export function ProductsList({
  products,
  canWrite,
  canDelete,
}: {
  products: ProductRow[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fulfilment, setFulfilment] = useState<string>(PRODUCT_FULFILMENTS[0]);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<ProductRow | null>(null);

  function create() {
    setError(undefined);
    startTransition(async () => {
      const result = await createProductAction({
        name,
        slug: slug || slugify(name),
        fulfilment,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreating(false);
      setName("");
      setSlug("");
      setSlugTouched(false);
      setFulfilment(PRODUCT_FULFILMENTS[0]);
      toast.push("Product created", "success");
      router.push(`/admin/products/${result.data.id}`);
    });
  }

  function remove(product: ProductRow) {
    startTransition(async () => {
      const result = await deleteProductAction({ id: product.id });
      setConfirmDelete(null);
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push(`Deleted “${product.title}”`, "success");
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="px-8 py-8">
        {canWrite && (
          <div className="mb-4 flex justify-end">
            <Button variant="solid" onClick={() => setCreating(true)}>
              New product
            </Button>
          </div>
        )}

        <Panel>
          {products.length === 0 ? (
            <EmptyState
              eyebrow="Products"
              title="No products yet"
              action={
                canWrite ? (
                  <Button variant="solid" onClick={() => setCreating(true)}>
                    Create the first product
                  </Button>
                ) : undefined
              }
            >
              A product carries its commerce detail — price, stock, specs — as columns, and anything
              beyond that as sections in the builder.
            </EmptyState>
          ) : (
            <Table caption="All products">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Slug</Th>
                  <Th>Status</Th>
                  <Th>Version</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-mg-fg/[0.02]">
                    <Td>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="font-medium hover:text-mg-accentInk"
                      >
                        {product.title}
                      </Link>
                    </Td>
                    <Td className="font-mono text-[12px] text-mg-fg/50">/product/{product.slug}</Td>
                    <Td>
                      <StatusPill status={product.status} />
                    </Td>
                    <Td className="font-mono text-[12px] text-mg-fg/50">v{product.version}</Td>
                    <Td className="text-right">
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(product)}
                          disabled={pending}
                        >
                          Delete
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New product"
        description="The slug is the URL this product will live at, under /product/."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="solid" onClick={create} loading={pending} disabled={!name.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput
            label="Name"
            value={name}
            onChange={(next) => {
              setName(next);
              if (!slugTouched) setSlug(slugify(next));
            }}
            placeholder="Travel Watch Roll, Waxed Canvas"
            required
          />
          <TextInput
            label="Slug"
            value={slug}
            onChange={(next) => {
              setSlugTouched(true);
              setSlug(next);
            }}
            help="Lower-case words separated by hyphens."
            error={error}
            required
          />
          <Select
            label="Fulfilment"
            value={fulfilment}
            onChange={setFulfilment}
            options={FULFILMENT_OPTIONS}
            help="An affiliate product needs a merchant URL and does not track stock. Changeable later."
          />
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Delete “${confirmDelete?.title ?? ""}”?`}
        description="This cannot be undone from here. Its revision history goes with it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => confirmDelete && remove(confirmDelete)}
            >
              Delete product
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-mg-fg/60">
          Its variants and gallery links go with it. Any media it referenced stays in the library;
          only the references go.
        </p>
      </Dialog>
    </>
  );
}
