"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/admin/ui/Button";
import { TextArea, TextInput } from "@/components/admin/ui/Input";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { Select } from "@/components/admin/ui/Select";
import { Toggle } from "@/components/admin/ui/Toggle";
import { Panel, PanelSection } from "@/components/admin/ui/Panel";
import { useToast } from "@/components/admin/ui/Toast";
import { penceToPounds, poundsToPence } from "@/lib/domain/money";
import {
  PRODUCT_AVAILABILITIES,
  PRODUCT_BADGES,
  PRODUCT_FULFILMENTS,
  tracksStock,
  type ProductAvailability,
  type ProductBadge,
  type ProductFulfilment,
} from "@/lib/domain/products";

import { updateProductMetaAction } from "../actions";

export interface CollectionOption {
  id: string;
  label: string;
}

export interface ProductMetaForm {
  id: string;
  name: string;
  slug: string;
  cat: string | null;
  catLabel: string | null;
  sku: string | null;
  blurb: string | null;
  story: string | null;
  material: string | null;
  fulfilment: ProductFulfilment;
  pricePence: number;
  compareAtPence: number | null;
  stock: number;
  trackInventory: boolean;
  availability: ProductAvailability;
  badges: ProductBadge[];
  specs: [string, string][];
  affiliate: {
    merchant_name?: string;
    merchant_url?: string;
    disclosure?: string;
    external_price_pence?: number;
  };
  collectionIds: string[];
}

/**
 * Labels are keyed off the vocabularies rather than listed beside them, so a
 * value added to `lib/domain/products.ts` is a compile error here until it has
 * something to read as. The same reason `SelectOption` is `{value,label}` at
 * all: `ctaBand.variant` offers "Split — heading left, email right" for the
 * value `"split"`, and a control that showed the raw value would be useless.
 */
const FULFILMENT_LABELS: Record<ProductFulfilment, string> = {
  direct: "Direct — we sell and ship it",
  affiliate: "Affiliate — we link out to a merchant",
};

const AVAILABILITY_LABELS: Record<ProductAvailability, string> = {
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  preorder: "Pre-order",
  discontinued: "Discontinued",
};

const FULFILMENT_OPTIONS = PRODUCT_FULFILMENTS.map((value) => ({
  value,
  label: FULFILMENT_LABELS[value],
}));

const AVAILABILITY_OPTIONS = PRODUCT_AVAILABILITIES.map((value) => ({
  value,
  label: AVAILABILITY_LABELS[value],
}));

/**
 * The part of a product that is not a block tree.
 *
 * **Money crosses one boundary, in this file, in both directions.** The columns
 * are integer pence and the action's schema insists on integers; an editor
 * thinks in pounds. `poundsToPence` and `penceToPounds` are the only conversion
 * — nothing here does arithmetic on a pounds value, which is the mistake that
 * once discounted a £145 subtotal by £22.00 instead of £21.75.
 */
export function ProductDetails({
  initial,
  collections,
  canWrite,
}: {
  initial: ProductMetaForm;
  collections: CollectionOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string>();

  function set<K extends keyof ProductMetaForm>(key: K, value: ProductMetaForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const isAffiliate = form.fulfilment === "affiliate";
  const showsStock = tracksStock({
    fulfilment: form.fulfilment,
    track_inventory: form.trackInventory,
  });

  function save() {
    setError(undefined);
    startTransition(async () => {
      const result = await updateProductMetaAction({
        id: form.id,
        name: form.name,
        slug: form.slug,
        // An empty box means "no value", not an empty string — the same rule
        // the properties panel follows when an optional field is cleared.
        cat: form.cat?.trim() || null,
        catLabel: form.catLabel?.trim() || null,
        sku: form.sku?.trim() || null,
        blurb: form.blurb?.trim() || null,
        story: form.story?.trim() || null,
        material: form.material?.trim() || null,
        fulfilment: form.fulfilment,
        pricePence: form.pricePence,
        compareAtPence: form.compareAtPence,
        stock: form.stock,
        trackInventory: form.trackInventory,
        availability: form.availability,
        badges: form.badges,
        // A spec row with no label is a row an editor started and abandoned;
        // persisting it would put an empty cell on the PDP's spec table.
        specs: form.specs.filter(([label]) => label.trim() !== ""),
        affiliate: form.affiliate,
        collectionIds: form.collectionIds,
      });

      if (!result.ok) {
        // The inline alert only — deliberately no toast. Both were shown at
        // first, and CI caught it as a strict-mode violation: one message, two
        // elements, inches apart. The alert sits beside the button the editor
        // just pressed and persists while they fix the field, which is what a
        // validation failure needs; a toast that says the same thing and then
        // vanishes is noise. Success still toasts, because there is nothing
        // left on screen to say it.
        setError(result.error);
        return;
      }

      toast.push("Saved", "success");
      router.refresh();
    });
  }

  function toggleBadge(badge: ProductBadge) {
    set(
      "badges",
      form.badges.includes(badge) ? form.badges.filter((b) => b !== badge) : [...form.badges, badge]
    );
  }

  function toggleCollection(collectionId: string) {
    set(
      "collectionIds",
      form.collectionIds.includes(collectionId)
        ? form.collectionIds.filter((id) => id !== collectionId)
        : [...form.collectionIds, collectionId]
    );
  }

  function setSpec(index: number, position: 0 | 1, value: string) {
    setForm((current) => {
      const specs = current.specs.map((row, i) =>
        i === index
          ? ((position === 0 ? [value, row[1]] : [row[0], value]) as [string, string])
          : row
      );
      return { ...current, specs };
    });
  }

  return (
    <div className="grid gap-6 px-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel>
        <PanelSection title="Identity">
          <TextInput
            label="Name"
            value={form.name}
            onChange={(v) => set("name", v)}
            disabled={!canWrite}
            required
          />
          <TextInput
            label="Slug"
            value={form.slug}
            onChange={(v) => set("slug", v)}
            disabled={!canWrite}
            help="Lives at /product/<slug>. Changing it breaks existing links."
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Category"
              value={form.cat ?? ""}
              onChange={(v) => set("cat", v)}
              disabled={!canWrite}
              placeholder="Watches"
              help="The store's own filter chip."
            />
            <TextInput
              label="Category label"
              value={form.catLabel ?? ""}
              onChange={(v) => set("catLabel", v)}
              disabled={!canWrite}
              placeholder="WATCHES"
              help="How it reads on a card."
            />
          </div>
          <TextInput
            label="SKU"
            value={form.sku ?? ""}
            onChange={(v) => set("sku", v)}
            disabled={!canWrite}
          />
        </PanelSection>

        <PanelSection title="Copy">
          <TextInput
            label="Material"
            value={form.material ?? ""}
            onChange={(v) => set("material", v)}
            disabled={!canWrite}
            placeholder="Waxed cotton canvas · full-grain leather"
          />
          <TextArea
            label="Blurb"
            rows={2}
            value={form.blurb ?? ""}
            onChange={(v) => set("blurb", v)}
            disabled={!canWrite}
            help="One line, used on cards and as the default meta description."
          />
          <TextArea
            label="Story"
            rows={6}
            value={form.story ?? ""}
            onChange={(v) => set("story", v)}
            disabled={!canWrite}
            help="Blank lines separate paragraphs, as the PDP renders them."
          />
        </PanelSection>

        <PanelSection title="Pricing">
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Price (£)"
              value={penceToPounds(form.pricePence)}
              onChange={(v) => set("pricePence", poundsToPence(v ?? 0))}
              min={0}
              disabled={!canWrite}
              help="Stored as pence."
            />
            <NumberInput
              label="Compare at (£)"
              value={form.compareAtPence === null ? undefined : penceToPounds(form.compareAtPence)}
              onChange={(v) => set("compareAtPence", v === undefined ? null : poundsToPence(v))}
              min={0}
              disabled={!canWrite}
              help="The struck-through was-price. Must be higher than the price."
            />
          </div>
        </PanelSection>

        <PanelSection title="Fulfilment">
          <Select
            label="Fulfilment"
            value={form.fulfilment}
            onChange={(v) => set("fulfilment", v as ProductFulfilment)}
            options={FULFILMENT_OPTIONS}
            disabled={!canWrite}
          />

          {isAffiliate ? (
            <>
              <TextInput
                label="Merchant name"
                value={form.affiliate.merchant_name ?? ""}
                onChange={(v) =>
                  set("affiliate", { ...form.affiliate, merchant_name: v || undefined })
                }
                disabled={!canWrite}
              />
              <TextInput
                label="Merchant URL"
                value={form.affiliate.merchant_url ?? ""}
                onChange={(v) =>
                  set("affiliate", { ...form.affiliate, merchant_url: v || undefined })
                }
                disabled={!canWrite}
                help="Required. The database refuses an affiliate product without one."
                required
              />
              <TextInput
                label="Disclosure"
                value={form.affiliate.disclosure ?? ""}
                onChange={(v) =>
                  set("affiliate", { ...form.affiliate, disclosure: v || undefined })
                }
                disabled={!canWrite}
                placeholder="We may earn a commission on this link."
              />
              <NumberInput
                label="Merchant price (£)"
                value={
                  form.affiliate.external_price_pence === undefined
                    ? undefined
                    : penceToPounds(form.affiliate.external_price_pence)
                }
                onChange={(v) =>
                  set("affiliate", {
                    ...form.affiliate,
                    external_price_pence: v === undefined ? undefined : poundsToPence(v),
                  })
                }
                min={0}
                disabled={!canWrite}
                help="What they charge. We neither set it nor honour it, so it goes stale."
              />
            </>
          ) : (
            <>
              <Toggle
                label="Track inventory"
                checked={form.trackInventory}
                onChange={(v) => set("trackInventory", v)}
                disabled={!canWrite}
                help="Off for made-to-order, where a stock count would mean nothing."
              />
              {showsStock && (
                <NumberInput
                  label="Stock"
                  value={form.stock}
                  onChange={(v) => set("stock", v ?? 0)}
                  min={0}
                  integer
                  disabled={!canWrite}
                />
              )}
            </>
          )}

          <Select
            label="Availability"
            value={form.availability}
            onChange={(v) => set("availability", v as ProductAvailability)}
            options={AVAILABILITY_OPTIONS}
            disabled={!canWrite}
            help={
              isAffiliate
                ? "The merchant holds the inventory; this is what the card says."
                : undefined
            }
          />
        </PanelSection>

        <PanelSection title="Specifications">
          {form.specs.length === 0 && (
            <p className="text-[12px] text-mg-fg/45">
              No rows yet. These render as the PDP&rsquo;s spec table, in this order.
            </p>
          )}
          <ul className="space-y-2">
            {form.specs.map((row, index) => (
              <li key={index} className="flex items-end gap-2">
                <div className="w-[38%] shrink-0">
                  <TextInput
                    label={index === 0 ? "Label" : ""}
                    value={row[0]}
                    onChange={(v) => setSpec(index, 0, v)}
                    disabled={!canWrite}
                    placeholder="Capacity"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <TextInput
                    label={index === 0 ? "Value" : ""}
                    value={row[1]}
                    onChange={(v) => setSpec(index, 1, v)}
                    disabled={!canWrite}
                    placeholder="3 watches, up to 44mm"
                  />
                </div>
                {canWrite && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      set(
                        "specs",
                        form.specs.filter((_, i) => i !== index)
                      )
                    }
                    aria-label={`Remove spec row ${index + 1}`}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => set("specs", [...form.specs, ["", ""]])}
            >
              Add row
            </Button>
          )}
        </PanelSection>

        {canWrite && (
          <PanelSection title="Save">
            {/*
              The save error belongs here, not on the Slug field.
              `ArticleDetails` hangs it on the slug input because an article's
              only translated failure IS a slug collision. A product has
              cross-field rules too — an affiliate product missing its merchant
              URL, a compare-at price that is not a reduction — and those
              rendered under "Slug" would point an editor at the wrong control.
            */}
            {error && (
              <p role="alert" className="text-[13px] text-mg-accentInk">
                {error}
              </p>
            )}
            <Button variant="solid" onClick={save} loading={pending}>
              Save details
            </Button>
          </PanelSection>
        )}
      </Panel>

      <Panel className="h-fit">
        <PanelSection title="Badges">
          <ul className="flex flex-wrap gap-1.5">
            {PRODUCT_BADGES.map((badge) => {
              const on = form.badges.includes(badge);
              return (
                <li key={badge}>
                  <button
                    type="button"
                    onClick={() => toggleBadge(badge)}
                    disabled={!canWrite}
                    aria-pressed={on}
                    className={
                      on
                        ? "border border-mg-accent bg-mg-accent/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mg-accentInk"
                        : "border border-mg-bd/25 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mg-fg/60 hover:border-mg-fg"
                    }
                  >
                    {badge}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-[12px] text-mg-fg/45">
            The store card shows the first. The column is a list because NEW and LIMITED are not
            mutually exclusive.
          </p>
        </PanelSection>

        <PanelSection title="Collections">
          {collections.length === 0 ? (
            <p className="text-[12px] text-mg-fg/45">
              None exist yet. Create them under Collections.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {collections.map((collection) => {
                const on = form.collectionIds.includes(collection.id);
                return (
                  <li key={collection.id}>
                    <button
                      type="button"
                      onClick={() => toggleCollection(collection.id)}
                      disabled={!canWrite}
                      aria-pressed={on}
                      className={
                        on
                          ? "border border-mg-accent bg-mg-accent/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mg-accentInk"
                          : "border border-mg-bd/25 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mg-fg/60 hover:border-mg-fg"
                      }
                    >
                      {collection.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelSection>
      </Panel>
    </div>
  );
}
