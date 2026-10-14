"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  SITE_ACCESS_LABELS,
  SITE_ACCESS_MODES,
  type SiteAccessMode,
  type SiteAccessState,
} from "@/lib/domain/siteAccessState";
import { changeSiteAccessAction } from "@/app/(admin)/admin/customizer/access-actions";
import { Dialog } from "./ui/Dialog";

/** The HTML datetime-local control uses the editor's clock, not UTC. */
function toLocalInput(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const MODE_DESCRIPTIONS: Record<SiteAccessMode, string> = {
  "homepage-only": "Public visitors see only the homepage. Staff can edit other pages in admin.",
  "private-preview":
    "Visitors stay on the homepage. Signed-in staff browse the full published site with its normal navigation.",
  public: "Every visitor can open the published website. Admin routes still require sign-in.",
};

export function SiteAccessControls({
  initial,
  canWrite,
}: {
  initial: SiteAccessState;
  canWrite: boolean;
}) {
  const [current, setCurrent] = useState(initial);
  const [mode, setMode] = useState<SiteAccessMode>(initial.mode);
  const [wantsSchedule, setWantsSchedule] = useState(!!initial.scheduledPublicAt);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (initial.scheduledPublicAt) setScheduleLocal(toLocalInput(initial.scheduledPublicAt));
  }, [initial.scheduledPublicAt]);

  const scheduled = wantsSchedule && mode !== "public";
  const expectedPhrase = mode === "public" ? "LAUNCH" : scheduled ? "SCHEDULE" : "CONFIRM";
  const pendingChange =
    mode !== current.mode ||
    scheduled !== !!current.scheduledPublicAt ||
    (scheduled &&
      Number.isFinite(Date.parse(scheduleLocal)) &&
      new Date(scheduleLocal).toISOString() !== current.scheduledPublicAt);

  function chooseMode(next: SiteAccessMode) {
    setMode(next);
    if (next === "public") setWantsSchedule(false);
    setMessage("");
    setError("");
  }

  function prepare() {
    setError("");
    setMessage("");
    if (scheduled) {
      const at = Date.parse(scheduleLocal);
      if (!Number.isFinite(at) || at < Date.now() + 60_000) {
        setError("Choose a launch time at least one minute in the future.");
        return;
      }
      if (at > Date.now() + 366 * 86_400_000) {
        setError("Choose a launch time within the next year.");
        return;
      }
    }
    setConfirmPhrase("");
    setConfirmOpen(true);
  }

  async function apply() {
    if (!canWrite || !current.updatedAt || confirmPhrase !== expectedPhrase) return;
    setBusy(true);
    setError("");
    try {
      const result = await changeSiteAccessAction({
        mode,
        scheduledPublicAt: scheduled ? new Date(scheduleLocal).toISOString() : null,
        expectedUpdatedAt: current.updatedAt,
        confirmation: expectedPhrase,
      });
      if (!result.ok) throw new Error(result.error);
      setCurrent(result.data);
      setMode(result.data.mode);
      setWantsSchedule(!!result.data.scheduledPublicAt);
      setMessage(
        result.data.scheduledPublicAt
          ? "Launch schedule saved. The site will open automatically at the selected time."
          : `Access mode updated: ${SITE_ACCESS_LABELS[result.data.effectiveMode]}.`
      );
      setConfirmOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update site access.");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5" aria-label="Site Access and Launch Controls">
      <div className="rounded-md border border-mg-bd/20 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Currently active</p>
        <p className="mt-1 text-base font-semibold">{SITE_ACCESS_LABELS[current.effectiveMode]}</p>
        <p className="mt-2 text-[11px] leading-relaxed">{MODE_DESCRIPTIONS[current.effectiveMode]}</p>
        {current.scheduledPublicAt && (
          <p className="mt-2 text-[11px]">
            Scheduled public launch:{" "}
            <time dateTime={current.scheduledPublicAt}>
              {current.scheduledPublicAt.replace("T", " ").slice(0, 16)} UTC
            </time>
          </p>
        )}
        {current.source === "fail-closed" && (
          <p className="mt-2 text-[11px] text-red-700">
            The access setting could not be verified. Site access is locked until the database
            is available.
          </p>
        )}
      </div>

      <fieldset className="space-y-2" disabled={!canWrite || busy || !current.updatedAt}>
        <legend className="mb-2 text-xs font-semibold">Choose an access mode</legend>
        {SITE_ACCESS_MODES.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-mg-bd/20 p-3"
          >
            <input
              type="radio"
              name="siteAccessMode"
              value={option}
              checked={mode === option}
              onChange={() => chooseMode(option)}
              className="mt-0.5"
            />
            <span>
              <strong className="block text-[12px]">{SITE_ACCESS_LABELS[option]}</strong>
              <span className="mt-1 block text-[11px] leading-relaxed">
                {MODE_DESCRIPTIONS[option]}
              </span>
            </span>
          </label>
        ))}

        <div className="space-y-2 border-t border-mg-bd/15 pt-4">
          <label className="flex cursor-pointer items-start gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={wantsSchedule && mode !== "public"}
              disabled={mode === "public"}
              onChange={(event) => setWantsSchedule(event.target.checked)}
            />
            Schedule automatic public launch
          </label>
          {scheduled && (
            <label className="block text-[11px]">
              Launch date and time (your local timezone)
              <input
                aria-label="Scheduled launch local date and time"
                type="datetime-local"
                value={scheduleLocal}
                onChange={(event) => setScheduleLocal(event.target.value)}
                className="mt-1 block w-full rounded border border-mg-bd/30 p-2"
              />
            </label>
          )}
          <p className="text-[11px] leading-relaxed">
            Scheduling opens the published website at the specified time. This is checked on
            each request; it does not require a deployment or background task.
          </p>
        </div>

        <button type="button" disabled={!pendingChange} onClick={prepare}>
          {scheduled ? "Review launch schedule" : "Review access change"}
        </button>
      </fieldset>

      {canWrite && current.effectiveMode === "private-preview" && (
        <Link
          href="/shop"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[11px] underline underline-offset-4"
        >
          Open staff preview ↗
        </Link>
      )}
      {!canWrite && (
        <p className="text-[11px]">
          Your account may view the active mode, but changing it requires the Settings write
          permission.
        </p>
      )}
      <p className="text-[11px] leading-relaxed">
        Changing access is an immediate operational action, separate from saving or
        publishing a site theme. Public-mode confirmation is required to prevent accidental
        exposure.
      </p>
      {error && (
        <p role="alert" className="text-[11px] text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-[11px]">
          {message}
        </p>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        title={scheduled ? "Confirm scheduled launch" : "Confirm site access change"}
        description={
          mode === "public"
            ? "This immediately opens all published pages to everyone."
            : scheduled
              ? "This automatically opens all published pages at the selected time."
              : "This changes how the website is presented to visitors and staff."
        }
        footer={
          <>
            <button type="button" disabled={busy} onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || confirmPhrase !== expectedPhrase}
              onClick={() => void apply()}
            >
              {busy ? "Applying…" : scheduled ? "Schedule launch" : "Apply access mode"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p>
            <strong>{SITE_ACCESS_LABELS[mode]}</strong>
            {scheduled && scheduleLocal && (
              <span className="block">Public launch: {scheduleLocal} (your local timezone)</span>
            )}
          </p>
          <p>To continue, type <strong>{expectedPhrase}</strong> exactly.</p>
          <input
            aria-label="Access change confirmation"
            type="text"
            value={confirmPhrase}
            onChange={(event) => setConfirmPhrase(event.target.value)}
            autoComplete="off"
            className="w-full border border-mg-bd/30 bg-transparent p-2"
          />
        </div>
      </Dialog>
    </div>
  );
}
