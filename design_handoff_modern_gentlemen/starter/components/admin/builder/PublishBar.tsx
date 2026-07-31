"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { clsx } from "@/components/ui/clsx";
import { Button, IconButton } from "@/components/admin/ui/Button";
import { Dialog, DetailRow } from "@/components/admin/ui/Dialog";
import { StatusPill } from "@/components/admin/ui/Badge";
import { useToast } from "@/components/admin/ui/Toast";
import { FOCUS_RING, HAIRLINE, LABEL_SM } from "@/components/admin/ui/styles";
import { isSchedulable } from "@/lib/domain/documents";

import { useBuilder } from "./StoreContext";
import type { BuilderCallbacks } from "./Builder";

function SaveStatusLabel() {
  const save = useBuilder((s) => s.save);
  const dirty = useBuilder((s) => s.dirty);

  if (save.kind === "saving") return <span className="text-mg-fg/50">Saving…</span>;
  if (save.kind === "error") return <span className="text-mg-accentSerif">{save.message}</span>;
  if (dirty) return <span className="text-mg-fg/50">Unsaved changes</span>;
  if (save.kind === "saved") {
    return (
      <span className="text-mg-fg/40" suppressHydrationWarning>
        Saved {new Date(save.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }
  return <span className="text-mg-fg/40">All changes saved</span>;
}

export function PublishBar({
  callbacks,
  canPublish,
  canPreview,
}: {
  callbacks: BuilderCallbacks;
  canPublish: boolean;
  canPreview: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const doc = useBuilder((s) => s.doc);
  const issues = useBuilder((s) => s.issues.length);
  const device = useBuilder((s) => s.device);
  const setDevice = useBuilder((s) => s.setDevice);
  const undo = useBuilder((s) => s.undo);
  const redo = useBuilder((s) => s.redo);
  const canUndo = useBuilder((s) => s.past.length > 0);
  const canRedo = useBuilder((s) => s.future.length > 0);
  const setServerIssues = useBuilder((s) => s.setServerIssues);
  const select = useBuilder((s) => s.select);

  const [confirmPublish, setConfirmPublish] = useState(false);
  const [preview, setPreview] = useState<{ path: string; expiresAt: string } | null>(null);

  function publish() {
    startTransition(async () => {
      const result = await callbacks.publish();
      if (result.ok) {
        setConfirmPublish(false);
        setServerIssues([]);
        toast.push(`Published v${result.data.version}`, "success");
        router.refresh();
        return;
      }

      // The issues come back attached to the blocks that caused them, so put
      // the editor on the first offender rather than on a wall of text.
      if (result.issues?.length) {
        setServerIssues(result.issues);
        setConfirmPublish(false);
        select(result.issues[0].key);
        document
          .querySelector(`[data-block-key="${result.issues[0].key}"]`)
          ?.scrollIntoView({ block: "center" });
      }
      toast.push(result.error, "error");
    });
  }

  function run(
    label: string,
    action: () => Promise<{ ok: true; data: { version: number } } | { ok: false; error: string }>
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.push(`${label} — now v${result.data.version}`, "success");
        router.refresh();
      } else {
        toast.push(result.error, "error");
      }
    });
  }

  function makePreview() {
    startTransition(async () => {
      const result = await callbacks.createPreview(device);
      if (result.ok) setPreview(result.data);
      else toast.push(result.error, "error");
    });
  }

  return (
    <>
      <header
        className={clsx(
          "sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-mg-bg px-4 py-2.5",
          HAIRLINE
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-grotesk text-[14px] font-semibold tracking-[-0.02em]">
              {doc.title}
            </h1>
            <StatusPill status={doc.status} />
            <span className={LABEL_SM}>v{doc.version}</span>
          </div>
          <p className="mt-0.5 font-mono text-[10px]">
            <SaveStatusLabel />
          </p>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Preview width">
          {(["desktop", "tablet", "mobile"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={device === option}
              onClick={() => setDevice(option)}
              className={clsx(
                "px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors",
                device === option ? "bg-mg-fg text-mg-bg" : "text-mg-fg/50 hover:text-mg-fg",
                FOCUS_RING
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <IconButton label="Undo" disabled={!canUndo} onClick={undo}>
            ↶
          </IconButton>
          <IconButton label="Redo" disabled={!canRedo} onClick={redo}>
            ↷
          </IconButton>
        </div>

        <div className="flex items-center gap-2">
          {canPreview && (
            <Button size="sm" variant="outline" onClick={makePreview} loading={pending}>
              Preview
            </Button>
          )}
          <Button size="sm" variant="ghost" href={`/admin/pages/${doc.id}/history`}>
            History
          </Button>
          {canPublish && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => run("Snapshot taken", () => callbacks.snapshot())}
                loading={pending}
              >
                Snapshot
              </Button>
              <Button
                size="sm"
                variant="solid"
                onClick={() => setConfirmPublish(true)}
                disabled={pending}
              >
                Publish
              </Button>
            </>
          )}
        </div>
      </header>

      <Dialog
        open={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        title={`Publish “${doc.title}”?`}
        description="This makes the current draft the live version of the page."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmPublish(false)}>
              Cancel
            </Button>
            <Button variant="solid" onClick={publish} loading={pending} disabled={issues > 0}>
              Publish
            </Button>
          </>
        }
      >
        <DetailRow label="Slug">/{doc.slug}</DetailRow>
        <DetailRow label="Current version">v{doc.version}</DetailRow>
        <DetailRow label="Validation">
          {issues === 0 ? (
            "No issues"
          ) : (
            <span className="text-mg-accentSerif">
              {issues} {issues === 1 ? "issue" : "issues"}
            </span>
          )}
        </DetailRow>

        {issues > 0 && (
          <p className="mt-3 text-[12px] text-mg-fg/60">
            Publishing validates every block against its manifest and will be refused while these
            stand. They are listed under the canvas.
          </p>
        )}

        {doc.status !== "published" && isSchedulable(doc.type) && (
          <p className="mt-3 text-[12px] text-mg-fg/40">
            Scheduling exists in the database but nothing fires it yet — the runner is Phase 6.
          </p>
        )}
      </Dialog>

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="Preview link"
        description="Anyone holding this link can see the current draft until it expires."
        footer={
          <Button variant="ghost" onClick={() => setPreview(null)}>
            Done
          </Button>
        }
      >
        <DetailRow label="Link">
          <a
            href={preview?.path ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="break-all font-mono text-[11px] text-mg-accent hover:underline"
          >
            {preview?.path}
          </a>
        </DetailRow>
        <DetailRow label="Expires">
          {preview ? new Date(preview.expiresAt).toLocaleString() : ""}
        </DetailRow>
      </Dialog>
    </>
  );
}
