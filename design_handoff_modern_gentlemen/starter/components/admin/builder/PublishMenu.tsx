"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { clsx } from "@/components/ui/clsx";
import { Button } from "@/components/admin/ui/Button";
import { Dialog, DetailRow } from "@/components/admin/ui/Dialog";
import { useToast } from "@/components/admin/ui/Toast";
import { FOCUS_RING, HAIRLINE } from "@/components/admin/ui/styles";
import { isSchedulable } from "@/lib/domain/documents";
import { DOCUMENT_NOUN } from "@/lib/domain/routes";

import type { BuilderCallbacks } from "./Builder";
import {
  describeWhen,
  fromLocalInputValue,
  quickPicks,
  scheduleProblem,
  toLocalInputValue,
} from "./schedule";
import { useBuilder } from "./StoreContext";

/**
 * The Publish button, split: the main half publishes now (through the bar's
 * existing confirm dialog, which owns issue handling), and the caret opens
 * the rest of the lifecycle — schedule, change or cancel a schedule, and
 * unpublish.
 *
 * Scheduling is the database's `schedule_document` (pages and articles only);
 * cancelling is `unpublish_document`, because the runner fires only rows whose
 * status is still `scheduled`, so returning to draft is a cancel by
 * construction. Nothing here publishes on a timer of its own.
 */
export function PublishMenu({
  callbacks,
  issues,
  onPublishNow,
}: {
  callbacks: BuilderCallbacks;
  /** Every area's blocking issues; scheduling is refused while any stand, like publishing. */
  issues: number;
  onPublishNow: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const doc = useBuilder((s) => s.doc);
  const setDoc = useBuilder((s) => s.setDoc);
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"schedule" | "cancel" | "unpublish" | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);

  const canSchedule = !!callbacks.schedule && isSchedulable(doc.type) && doc.status !== "published";
  const scheduled = doc.status === "scheduled";
  const canUnpublish = !!callbacks.unpublish && doc.status === "published";
  const hasMenu = canSchedule || (scheduled && !!callbacks.unpublish) || canUnpublish;
  const noun = DOCUMENT_NOUN[doc.type];

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !list.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: typeof dialog) {
    setOpen(false);
    setDialog(next);
  }

  function backToDraft(message: string) {
    if (!callbacks.unpublish) return;
    startTransition(async () => {
      const result = await callbacks.unpublish!();
      if (!result.ok) return toast.push(result.error, "error");
      setDoc({ status: "draft", scheduledFor: null, version: result.data.version });
      setDialog(null);
      toast.push(message, "success");
      router.refresh();
    });
  }

  const item = (label: string, onClick: () => void, hint?: string) => (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        const i = items.indexOf(event.currentTarget);
        items[(i + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      }}
      className={clsx(
        "block w-full px-3 py-2 text-left text-[12px] hover:bg-mg-fg/5 focus:bg-mg-fg/5",
        FOCUS_RING
      )}
    >
      {label}
      {hint && <span className="block text-[11px] text-mg-fg/60">{hint}</span>}
    </button>
  );

  return (
    <>
      <div ref={menu} className="relative flex">
        <Button size="sm" variant="solid" onClick={onPublishNow} disabled={pending}>
          Publish
        </Button>
        {hasMenu && (
          <button
            type="button"
            aria-label="More publishing options"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => {
              const rect = menu.current?.getBoundingClientRect();
              if (rect) setAt({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
              setOpen((v) => !v);
            }}
            className={clsx(
              "border-l border-white/30 bg-mg-accent px-2 text-[11px] text-white hover:brightness-110",
              FOCUS_RING
            )}
          >
            ▾
          </button>
        )}
        {open &&
          overlay(
            <div
              ref={list}
              role="menu"
              aria-label="Publishing options"
              className={clsx("fixed z-[60] w-64 border bg-mg-surface py-1 shadow-xl", HAIRLINE)}
              style={{ top: at?.top ?? 64, right: at?.right ?? 16 }}
            >
              {item("Publish now…", () => {
                setOpen(false);
                onPublishNow();
              })}
              {canSchedule &&
                item(
                  scheduled ? "Change schedule…" : "Schedule…",
                  () => choose("schedule"),
                  scheduled && doc.scheduledFor
                    ? `Now: ${describeWhen(doc.scheduledFor)}`
                    : "Publish the draft automatically later"
                )}
              {scheduled && callbacks.unpublish && item("Cancel schedule", () => choose("cancel"))}
              {canUnpublish &&
                item(
                  `Unpublish ${noun}`,
                  () => choose("unpublish"),
                  "Take it offline; keep the draft"
                )}
            </div>
          )}
      </div>

      {overlay(
        <>
          {dialog === "schedule" && callbacks.schedule && (
            <ScheduleDialog
              noun={noun}
              title={doc.title}
              issues={issues}
              current={scheduled ? (doc.scheduledFor ?? null) : null}
              pending={pending}
              onClose={() => setDialog(null)}
              onSchedule={(when, note) =>
                startTransition(async () => {
                  const result = await callbacks.schedule!(when.toISOString(), note || undefined);
                  if (!result.ok) return toast.push(result.error, "error");
                  setDoc({
                    status: "scheduled",
                    scheduledFor: when.toISOString(),
                    version: result.data.version,
                  });
                  setDialog(null);
                  toast.push(`Scheduled for ${describeWhen(when)}`, "success");
                  router.refresh();
                })
              }
            />
          )}

          <Dialog
            open={dialog === "cancel"}
            onClose={() => setDialog(null)}
            title="Cancel the scheduled publish?"
            description={`The ${noun} stays a draft and nothing will publish automatically. You can schedule it again at any time.`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialog(null)}>
                  Keep schedule
                </Button>
                <Button
                  variant="solid"
                  loading={pending}
                  onClick={() => backToDraft("Schedule cancelled")}
                >
                  Cancel schedule
                </Button>
              </>
            }
          >
            {doc.scheduledFor && (
              <DetailRow label="Was due">{describeWhen(doc.scheduledFor)}</DetailRow>
            )}
          </Dialog>

          <Dialog
            open={dialog === "unpublish"}
            onClose={() => setDialog(null)}
            title={`Unpublish “${doc.title}”?`}
            description={`Visitors will no longer see this ${noun}; its address stops working until you publish again. The draft and its history are kept.`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialog(null)}>
                  Keep it live
                </Button>
                <Button
                  variant="solid"
                  loading={pending}
                  onClick={() => backToDraft("Unpublished")}
                >
                  Unpublish
                </Button>
              </>
            }
          >
            <DetailRow label="Current version">v{doc.version}</DetailRow>
          </Dialog>
        </>
      )}
    </>
  );
}

/**
 * The bar is a sticky header with its own stacking context, under the canvas
 * toolbar's; a menu or dialog rendered inside it is painted beneath that
 * toolbar however high its own z-index. A portal to the body escapes it.
 */
function overlay(node: ReactNode) {
  return typeof document === "undefined" ? null : createPortal(node, document.body);
}

function ScheduleDialog({
  noun,
  title,
  issues,
  current,
  pending,
  onClose,
  onSchedule,
}: {
  noun: string;
  title: string;
  issues: number;
  current: string | null;
  pending: boolean;
  onClose: () => void;
  onSchedule: (when: Date, note: string) => void;
}) {
  const [now] = useState(() => new Date());
  const picks = quickPicks(now);
  const [value, setValue] = useState(() =>
    toLocalInputValue(current ? new Date(current) : picks[1].date)
  );
  const [note, setNote] = useState("");
  const when = fromLocalInputValue(value);
  const problem = scheduleProblem(when, new Date());
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Dialog
      open
      onClose={onClose}
      title={current ? "Change the schedule" : `Schedule “${title}”`}
      description={`The draft publishes itself at this time, exactly as it stands then — edits you make before it are included.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="solid"
            loading={pending}
            disabled={!!problem || issues > 0}
            onClick={() => when && onSchedule(when, note.trim())}
          >
            {current ? "Update schedule" : "Schedule"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick times">
          {picks.map((pick) => (
            <button
              key={pick.label}
              type="button"
              aria-pressed={value === toLocalInputValue(pick.date)}
              onClick={() => setValue(toLocalInputValue(pick.date))}
              className={clsx(
                "border px-2 py-1 text-[11px]",
                HAIRLINE,
                value === toLocalInputValue(pick.date) && "bg-mg-fg text-mg-bg",
                FOCUS_RING
              )}
            >
              {pick.label}
            </button>
          ))}
        </div>
        <label className="block text-[12px]">
          <span className="mb-1 block">Publish at ({zone})</span>
          <input
            type="datetime-local"
            value={value}
            min={toLocalInputValue(now)}
            onChange={(event) => setValue(event.target.value)}
            className={clsx("w-full border bg-transparent px-2 py-1.5 text-[13px]", HAIRLINE)}
          />
        </label>
        <p className="text-[12px]" aria-live="polite">
          {problem ? (
            <span className="text-mg-accentInk">{problem}</span>
          ) : (
            <>Publishes {describeWhen(when!)}.</>
          )}
        </p>
        <label className="block text-[12px]">
          <span className="mb-1 block">Note for the history (optional)</span>
          <input
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Autumn campaign launch"
            className={clsx("w-full border bg-transparent px-2 py-1.5 text-[13px]", HAIRLINE)}
          />
        </label>
        {issues > 0 && (
          <p className="text-[12px] text-mg-accentInk">
            Fix the {issues} {issues === 1 ? "issue" : "issues"} in Health first: a {noun} that
            would fail to publish cannot be scheduled.
          </p>
        )}
        <p className="text-[11px] text-mg-fg/60">
          The scheduler checks for due publishes regularly, but a run can be late, occasionally by
          an hour or more. For a launch that must be on the minute, publish by hand.
        </p>
      </div>
    </Dialog>
  );
}
