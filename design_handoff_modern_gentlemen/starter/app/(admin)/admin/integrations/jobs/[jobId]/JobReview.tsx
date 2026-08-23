"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge, type BadgeTone } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Panel } from "@/components/admin/ui/Panel";
import { Table, Td, Th } from "@/components/admin/ui/Table";
import { Checkbox } from "@/components/admin/ui/Toggle";
import { useToast } from "@/components/admin/ui/Toast";
import type { FieldChange, ImportItemAction, ImportItemStatus } from "@/lib/domain/ingestion";

import { applyJobAction, decideAllAction, decideItemsAction } from "./actions";

export interface ItemView {
  id: string;
  externalId: string | null;
  action: ImportItemAction;
  status: ImportItemStatus;
  error: string | null;
  productId: string | null;
  name: string | null;
  diff: FieldChange[] | null;
  raw: string;
}

const ACTION_TONES: Record<ImportItemAction, BadgeTone> = {
  create: "accent",
  update: "neutral",
  unchanged: "muted",
  failed: "danger",
};

const STATUS_TONES: Record<ImportItemStatus, BadgeTone> = {
  pending: "neutral",
  approved: "accent",
  rejected: "muted",
  applied: "accent",
};

/** Values in a diff are arbitrary JSON; this is what a table cell can show of one. */
function show(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value === "" ? "—" : value;
  return JSON.stringify(value);
}

export function JobReview({
  jobId,
  status,
  errorSummary,
  items,
  canRun,
  canWriteProducts,
}: {
  jobId: string;
  status: string;
  errorSummary: string | null;
  items: ItemView[];
  canRun: boolean;
  canWriteProducts: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inspecting, setInspecting] = useState<ItemView | null>(null);

  const actionable = useMemo(
    () => items.filter((item) => item.action === "create" || item.action === "update"),
    [items]
  );
  const approvedCount = actionable.filter((item) => item.status === "approved").length;
  const pendingCount = actionable.filter((item) => item.status === "pending").length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function decide(decision: "approved" | "rejected") {
    const itemIds = [...selected];
    if (itemIds.length === 0) return;
    startTransition(async () => {
      const result = await decideItemsAction({ jobId, itemIds, decision });
      if (!result.ok) toast.push(result.error, "error");
      else {
        setSelected(new Set());
        toast.push(`${result.data.count} ${decision}`, "success");
        router.refresh();
      }
    });
  }

  function decideAll(decision: "approved" | "rejected") {
    startTransition(async () => {
      const result = await decideAllAction({ jobId, decision });
      if (!result.ok) toast.push(result.error, "error");
      else {
        setSelected(new Set());
        toast.push(`${result.data.count} ${decision}`, "success");
        router.refresh();
      }
    });
  }

  function apply() {
    startTransition(async () => {
      const result = await applyJobAction({ jobId });
      if (!result.ok) {
        toast.push(result.error, "error");
        return;
      }
      const { applied, failed, imagesImported, imagesSkipped } = result.data;

      // Images are named in the toast rather than left to the error list. They
      // are the slowest part of an apply and the part a merchant is watching
      // for, so "12 written" with no mention of photographs reads as though
      // none arrived.
      const images =
        imagesImported === 0 && imagesSkipped === 0
          ? ""
          : imagesSkipped === 0
            ? ` · ${imagesImported} image${imagesImported === 1 ? "" : "s"}`
            : ` · ${imagesImported} image${imagesImported === 1 ? "" : "s"}, ${imagesSkipped} left — run apply again`;

      toast.push(
        failed === 0
          ? `${applied} written to the catalogue${images}`
          : `${applied} written, ${failed} failed${images}`,
        failed === 0 ? "success" : "error"
      );
      router.refresh();
    });
  }

  if (status === "failed") {
    return (
      <Panel>
        <EmptyState eyebrow="Import run" title="This run failed">
          {errorSummary ?? "The feed could not be read."}
        </EmptyState>
      </Panel>
    );
  }

  if (items.length === 0) {
    return (
      <Panel>
        <EmptyState eyebrow="Import run" title="Nothing to review">
          Every record in the feed matched the catalogue, so there was nothing to propose.
        </EmptyState>
      </Panel>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {canRun && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => decide("approved")}
              disabled={pending || selected.size === 0}
            >
              Approve selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => decide("rejected")}
              disabled={pending || selected.size === 0}
            >
              Reject selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => decideAll("approved")}
              disabled={pending || pendingCount === 0}
            >
              Approve all {pendingCount > 0 ? `(${pendingCount})` : ""}
            </Button>
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          {approvedCount > 0 && !canWriteProducts && (
            <span className="text-[12px] text-mg-fg/50">
              Applying needs permission to write products.
            </span>
          )}
          <Button
            variant="solid"
            onClick={apply}
            loading={pending}
            disabled={!canRun || !canWriteProducts || approvedCount === 0}
          >
            Apply {approvedCount > 0 ? `${approvedCount} approved` : "approved"}
          </Button>
        </div>
      </div>

      <Panel>
        <Table caption="Staged records">
          <thead>
            <tr>
              <Th />
              <Th>Product</Th>
              <Th>External ID</Th>
              <Th>Action</Th>
              <Th>Status</Th>
              <Th>Changes</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-mg-fg/[0.02]">
                <Td>
                  {canRun && item.status === "pending" && item.action !== "failed" && (
                    <Checkbox
                      label=""
                      ariaLabel={`Select ${item.name ?? item.externalId ?? "record"}`}
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                  )}
                </Td>
                <Td>
                  {item.productId ? (
                    <Link
                      href={`/admin/products/${item.productId}`}
                      className="font-medium hover:text-mg-accent"
                    >
                      {item.name ?? "(unnamed)"}
                    </Link>
                  ) : (
                    <span className="font-medium">{item.name ?? "(unnamed)"}</span>
                  )}
                  {item.error && (
                    <p className="mt-1 text-[12px] text-mg-accentSerif">{item.error}</p>
                  )}
                </Td>
                <Td className="font-mono text-[12px] text-mg-fg/50">{item.externalId ?? "—"}</Td>
                <Td>
                  <Badge tone={ACTION_TONES[item.action]}>{item.action}</Badge>
                </Td>
                <Td>
                  <Badge tone={STATUS_TONES[item.status]}>{item.status}</Badge>
                </Td>
                <Td className="text-[12px] text-mg-fg/60">
                  {item.action === "create" ? (
                    <span className="text-mg-fg/40">new product</span>
                  ) : item.diff && item.diff.length > 0 ? (
                    <ul className="space-y-0.5">
                      {item.diff.slice(0, 3).map((change) => (
                        <li key={change.field} className="font-mono text-[11px]">
                          {change.field}:{" "}
                          <span className="text-mg-fg/40">{show(change.before)}</span> →{" "}
                          {show(change.after)}
                        </li>
                      ))}
                      {item.diff.length > 3 && (
                        <li className="text-[11px] text-mg-fg/40">+{item.diff.length - 3} more</li>
                      )}
                    </ul>
                  ) : (
                    <span className="text-mg-fg/40">—</span>
                  )}
                </Td>
                <Td className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setInspecting(item)}>
                    Payload
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Dialog
        open={inspecting !== null}
        onClose={() => setInspecting(null)}
        title={inspecting?.name ?? inspecting?.externalId ?? "Feed record"}
        description="The record exactly as the feed supplied it, before mapping."
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setInspecting(null)}>
            Close
          </Button>
        }
      >
        <pre className="max-h-[50vh] overflow-auto border border-mg-bd/20 p-3 font-mono text-[11px] leading-relaxed">
          {inspecting?.raw}
        </pre>
      </Dialog>
    </>
  );
}
