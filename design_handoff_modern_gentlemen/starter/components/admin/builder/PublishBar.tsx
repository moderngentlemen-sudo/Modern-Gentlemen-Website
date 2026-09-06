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
import { areaNameOf } from "@/lib/blocks/areas";
import { DOCUMENT_NOUN, adminPathForDocument, publicPathForDocument } from "@/lib/domain/routes";
import { TemplateOverrideControl } from "@/components/admin/TemplateOverrideControl";
import type { TemplateOverrideState } from "@/lib/services/templates";
import type { TemplateOverrideAction } from "@/components/admin/TemplateOverrideControl";

import { useBuilder } from "./StoreContext";
import type { BuilderCallbacks, PreviewContextOption } from "./Builder";

function SaveStatusLabel() {
  const save = useBuilder((s) => s.save);
  const dirty = useBuilder((s) => s.dirty);

  if (save.kind === "saving") return <span className="text-mg-fg/60">Saving…</span>;
  if (save.kind === "error") return <span className="text-mg-accentSerif">{save.message}</span>;
  if (dirty) return <span className="text-mg-fg/60">Unsaved changes</span>;
  if (save.kind === "saved") {
    return (
      <span className="text-mg-fg/60" suppressHydrationWarning>
        Saved {new Date(save.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }
  return <span className="text-mg-fg/60">All changes saved</span>;
}

export function PublishBar({
  callbacks,
  canPublish,
  canPreview,
  templateOverride,
  previewContexts = [],
}: {
  callbacks: BuilderCallbacks;
  canPublish: boolean;
  canPreview: boolean;
  templateOverride?: { state: TemplateOverrideState; action: TemplateOverrideAction };
  previewContexts?: PreviewContextOption[];
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
  const setDoc = useBuilder((s) => s.setDoc);
  const select = useBuilder((s) => s.select);
  const setArea = useBuilder((s) => s.setArea);
  /**
   * Every area's issues, not just the open one's.
   *
   * Publish validates the whole document, so a bar that counted only the tree
   * on screen would offer an enabled Publish button and then be refused —
   * telling the editor "no issues" in the same dialog that fails. `areaIssues`
   * is `{}` for a one-tree document, so this is exactly `issues` there.
   */
  const areaIssues = useBuilder((s) => s.areaIssues);

  const areaTotals = Object.values(areaIssues);
  const totalIssues = areaTotals.length === 0 ? issues : areaTotals.reduce((a, b) => a + b, 0);

  const [confirmPublish, setConfirmPublish] = useState(false);
  const publicPath = publicPathForDocument(doc.type, doc.slug);
  const [preview, setPreview] = useState<{ path: string; expiresAt: string } | null>(null);
  const [previewContextId, setPreviewContextId] = useState("");

  function publish() {
    startTransition(async () => {
      const result = await callbacks.publish();
      if (result.ok) {
        setConfirmPublish(false);
        setServerIssues([]);
        // The store is seeded once and router.refresh() does not re-seed it, so
        // the status and version have to be applied here or the bar keeps
        // claiming the page is a draft.
        setDoc({ status: "published", version: result.data.version });
        toast.push(`Published v${result.data.version}`, "success");
        router.refresh();
        return;
      }

      // The issues come back attached to the blocks that caused them, so put
      // the editor on the first offender rather than on a wall of text.
      if (result.issues?.length) {
        const first = result.issues[0];
        setConfirmPublish(false);

        // Publish validates *every* area, so the block it names may not be in
        // the one that is open — and selecting a key the canvas is not showing
        // puts the editor nowhere at all. The issue's own path says which area
        // it came from (`blockTreesOf` prefixes it), so open that first.
        //
        // ⚠️ Before `setServerIssues`, not after: `setArea` clears the server
        // issues, on the reasoning that they described a different tree. Seeding
        // them first would have them wiped by the switch.
        const area = areaNameOf(first.path ?? "");
        if (area !== null && area !== areaNameOf(doc.treeKey)) setArea(area);

        setServerIssues(result.issues);
        select(first.key);
        // Deferred a frame: after an area switch the canvas has not rendered
        // the new tree yet, so the element to scroll to does not exist.
        requestAnimationFrame(() => {
          document
            .querySelector(`[data-block-key="${first.key}"]`)
            ?.scrollIntoView({ block: "center" });
        });
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
        setDoc({ version: result.data.version });
        toast.push(`${label} — now v${result.data.version}`, "success");
        router.refresh();
      } else {
        toast.push(result.error, "error");
      }
    });
  }

  function makePreview() {
    startTransition(async () => {
      const context = previewContexts.find((candidate) => candidate.entityId === previewContextId);
      const result = await callbacks.createPreview(device, context);
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
                device === option ? "bg-mg-fg text-mg-bg" : "text-mg-fg/60 hover:text-mg-fg",
                FOCUS_RING
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            label="Undo"
            aria-keyshortcuts="Control+Z Meta+Z"
            disabled={!canUndo}
            onClick={undo}
          >
            ↶
          </IconButton>
          <IconButton
            label="Redo"
            aria-keyshortcuts="Control+Y Meta+Shift+Z"
            disabled={!canRedo}
            onClick={redo}
          >
            ↷
          </IconButton>
        </div>

        <div className="flex items-center gap-2">
          {(doc.type === "page" || doc.type === "category" || doc.type === "product") &&
            templateOverride && (
              <TemplateOverrideControl
                id={doc.id}
                noun={doc.type}
                state={templateOverride.state}
                action={templateOverride.action}
              />
            )}
          {doc.type === "template" && previewContexts.length > 0 && (
            <select
              aria-label="Preview record"
              value={previewContextId}
              disabled={pending}
              onChange={(event) => setPreviewContextId(event.target.value)}
              className={clsx(
                "h-8 max-w-52 border bg-mg-bg px-2 font-mono text-[10px] text-mg-fg",
                HAIRLINE,
                FOCUS_RING
              )}
            >
              <option value="">Automatic preview record</option>
              {previewContexts.map((context) => (
                <option key={context.entityId} value={context.entityId}>
                  {context.title}
                </option>
              ))}
            </select>
          )}
          {canPreview && (
            <Button size="sm" variant="outline" onClick={makePreview} loading={pending}>
              Preview
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            href={`${adminPathForDocument(doc.type, doc.id)}/history`}
          >
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
        // ⚠️ This said "the live version of the page" for every document type
        // the shared builder has ever opened. True while `page` was the only
        // one with a builder route; wrong for the five that followed it.
        description={`This makes the current draft the live version of the ${DOCUMENT_NOUN[doc.type]}.`}
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
        {/*
          A template and a pattern have a `slug` and no URL, and this row used
          to print `/{slug}` for both — advertising a page at `/editorial-trio`
          that has never existed. `publicPathForDocument` returns null for
          exactly those two, and the row says what the value actually is.
        */}
        {publicPath === null ? (
          <DetailRow label="Key">{doc.slug}</DetailRow>
        ) : (
          <DetailRow label="URL">{publicPath}</DetailRow>
        )}
        <DetailRow label="Current version">v{doc.version}</DetailRow>
        <DetailRow label="Validation">
          {totalIssues === 0 ? (
            "No issues"
          ) : (
            <span className="text-mg-accentSerif">
              {totalIssues} {totalIssues === 1 ? "issue" : "issues"}
              {areaTotals.length > 0 && issues !== totalIssues && " across all areas"}
            </span>
          )}
        </DetailRow>

        {publicPath === null && (
          <p className="mt-3 text-[12px] text-mg-fg/60">
            {doc.type === "template"
              ? "A template has no page of its own. Publishing it changes every document assigned to it."
              : "A pattern has no page of its own. Publishing it changes the pages that link to it; pages that inserted a copy are unaffected."}
          </p>
        )}

        {totalIssues > 0 && (
          <p className="mt-3 text-[12px] text-mg-fg/60">
            Publishing validates every block against its manifest and will be refused while these
            stand. They are listed under the canvas.
          </p>
        )}

        {doc.status !== "published" && isSchedulable(doc.type) && (
          <p className="mt-3 text-[12px] text-mg-fg/60">
            A scheduled document publishes itself at the time you set, give or take the few minutes
            between runs. It publishes the draft as it stands then, not as it stands now.
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
            className="break-all font-mono text-[11px] text-mg-accentInk hover:underline"
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
