"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "@/components/ui/clsx";
import type { ActionResult } from "@/app/(admin)/admin/_lib/action-result";
import { formatByteSize } from "@/lib/domain/media";
import type { AssetUsageView, AssetView } from "@/lib/services/media";
import { Button } from "../ui/Button";
import { TextArea, TextInput } from "../ui/Input";
import { NumberInput } from "../ui/NumberInput";
import { Panel, PanelSection } from "../ui/Panel";
import { HAIRLINE, LABEL_SM } from "../ui/styles";
import { AssetThumb } from "./AssetThumb";

export interface AssetDetailActions {
  update: (input: unknown) => Promise<ActionResult<AssetView>>;
  remove: (input: unknown) => Promise<ActionResult>;
  usages: (input: unknown) => Promise<ActionResult<AssetUsageView[]>>;
}

/**
 * The details panel: what this asset is, how it is described, and what is
 * using it.
 *
 * The usage list is loaded when an asset is selected rather than shipped with
 * the grid. A library of four hundred assets would otherwise carry four hundred
 * usage queries' worth of data to render one screen, and the list only matters
 * for the asset the editor is actually looking at.
 */
export function AssetDetails({
  asset,
  actions,
  canWrite,
  canDelete,
  onUpdated,
  onDeleted,
  onMessage,
}: {
  asset: AssetView;
  actions: AssetDetailActions;
  canWrite: boolean;
  canDelete: boolean;
  onUpdated: (asset: AssetView) => void;
  onDeleted: (id: string) => void;
  onMessage: (message: string, tone?: "info" | "success" | "error") => void;
}) {
  const [form, setForm] = useState(() => toForm(asset));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [usages, setUsages] = useState<AssetUsageView[] | null>(null);

  // Re-seed when the selection changes. Without the guard on `asset.id` this
  // would also clobber the editor's in-flight edits every time the parent
  // re-rendered with the same asset.
  useEffect(() => {
    setForm(toForm(asset));
    setUsages(null);

    let cancelled = false;
    void actions.usages({ id: asset.id }).then((result) => {
      if (cancelled) return;
      setUsages(result.ok ? result.data : []);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on identity, not on the object
  }, [asset.id]);

  async function save() {
    setSaving(true);
    const result = await actions.update({
      id: asset.id,
      title: form.title,
      altText: form.altText,
      caption: form.caption,
      credit: form.credit,
      focalPoint: { x: form.focalX, y: form.focalY },
    });
    setSaving(false);

    if (result.ok) {
      onUpdated(result.data);
      onMessage("Saved", "success");
    } else {
      onMessage(result.error, "error");
    }
  }

  async function remove() {
    setDeleting(true);
    const result = await actions.remove({ id: asset.id });
    setDeleting(false);

    if (result.ok) {
      onDeleted(asset.id);
      onMessage(`Deleted "${asset.fileName}"`, "success");
    } else {
      // The refusal carries the count of places the asset is used; showing it
      // verbatim is the whole point of tracking usage in the first place.
      onMessage(result.error, "error");
    }
  }

  const inUse = usages !== null && usages.length > 0;

  return (
    <Panel className="sticky top-6">
      <AssetThumb asset={asset} className="aspect-[4/3] w-full" />

      <PanelSection title="File">
        <dl className="space-y-1.5 text-[12px]">
          <Row label="Name" value={asset.fileName} />
          <Row label="Kind" value={`${asset.kind} · ${asset.mimeType}`} />
          <Row label="Size" value={formatByteSize(asset.byteSize)} />
          {asset.width && asset.height && (
            <Row label="Dimensions" value={`${asset.width} × ${asset.height}`} />
          )}
          <div>
            <dt className={LABEL_SM}>URL</dt>
            <dd className="mt-0.5 break-all font-mono text-[10px] text-mg-fg/50">{asset.url}</dd>
          </div>
        </dl>
      </PanelSection>

      <PanelSection title="Description">
        <TextInput
          label="Title"
          value={form.title}
          onChange={(title) => setForm((f) => ({ ...f, title }))}
          disabled={!canWrite}
        />
        <TextInput
          label="Alt text"
          value={form.altText}
          onChange={(altText) => setForm((f) => ({ ...f, altText }))}
          disabled={!canWrite}
          help="What the image conveys, for anyone who cannot see it. Leave empty only if it is purely decorative."
        />
        <TextArea
          label="Caption"
          rows={2}
          value={form.caption}
          onChange={(caption) => setForm((f) => ({ ...f, caption }))}
          disabled={!canWrite}
        />
        <TextInput
          label="Credit"
          value={form.credit}
          onChange={(credit) => setForm((f) => ({ ...f, credit }))}
          disabled={!canWrite}
          placeholder="PHOTOGRAPHY · E. MARLOWE"
        />

        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Focal X"
            value={form.focalX}
            onChange={(x) => setForm((f) => ({ ...f, focalX: x ?? 0.5 }))}
            min={0}
            max={1}
            disabled={!canWrite}
            help="0 = left, 1 = right"
          />
          <NumberInput
            label="Focal Y"
            value={form.focalY}
            onChange={(y) => setForm((f) => ({ ...f, focalY: y ?? 0.5 }))}
            min={0}
            max={1}
            disabled={!canWrite}
            help="0 = top, 1 = bottom"
          />
        </div>

        {canWrite && (
          <Button variant="solid" size="sm" onClick={save} loading={saving}>
            Save
          </Button>
        )}
      </PanelSection>

      <PanelSection title={`Used in${usages ? ` (${usages.length})` : ""}`}>
        {usages === null && <p className="text-[12px] text-mg-fg/40">Checking…</p>}

        {usages !== null && usages.length === 0 && (
          <p className="text-[12px] text-mg-fg/45">
            Nothing references this asset. It is safe to delete.
          </p>
        )}

        {usages !== null && usages.length > 0 && (
          <ul className={clsx("divide-y", HAIRLINE)}>
            {usages.map((usage) => (
              <li key={usage.id} className="py-1.5">
                <p className="text-[12px] text-mg-fg/80">
                  {usage.href ? (
                    <Link href={usage.href} className="hover:text-mg-accentInk">
                      {usage.title ?? `${usage.entityType} ${usage.entityId.slice(0, 8)}`}
                    </Link>
                  ) : (
                    (usage.title ?? `${usage.entityType} ${usage.entityId.slice(0, 8)}`)
                  )}
                </p>
                <p className="font-mono text-[10px] text-mg-fg/40">{usage.fieldPath ?? "—"}</p>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      {canDelete && (
        <PanelSection title="Danger" defaultOpen={false}>
          <p className="text-[12px] text-mg-fg/50">
            {inUse
              ? "This asset is in use. Remove it from the pages above before deleting it."
              : "Deleting removes the catalogue entry and the stored file. This cannot be undone."}
          </p>
          <Button variant="danger" size="sm" onClick={remove} loading={deleting} disabled={inUse}>
            Delete asset
          </Button>
        </PanelSection>
      )}
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={LABEL_SM}>{label}</dt>
      <dd className="min-w-0 truncate text-right text-mg-fg/70">{value}</dd>
    </div>
  );
}

function toForm(asset: AssetView) {
  return {
    title: asset.title ?? "",
    altText: asset.altText ?? "",
    caption: asset.caption ?? "",
    credit: asset.credit ?? "",
    focalX: asset.focalPoint.x,
    focalY: asset.focalPoint.y,
  };
}
