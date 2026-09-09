"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { StudioSource, StudioIssue } from "@/lib/blocks/studioPublishing";
import { hostStudioMedia, type UploadStudioMedia } from "./studioMedia";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type Saved = { id: string; title: string; slug: string; updatedAt: string; issues: StudioIssue[] };
type Loaded = Saved & { document: StudioSource };
type Actions = {
  upload: UploadStudioMedia;
  save(input: unknown): Promise<Result<Saved>>;
  load(id: string): Promise<Result<Loaded>>;
  preview(input: unknown): Promise<Result<{ path: string; expiresAt: string }>>;
  publish(input: unknown): Promise<Result<{ version: number }>>;
};
export function DesignStudioShell({
  initial,
  actions,
  canPublish,
  canPreview,
}: {
  initial: Loaded | null;
  actions: Actions;
  canPublish: boolean;
  canPreview: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const hostedMedia = useRef(new Map<string, string>());
  const [saved, setSaved] = useState<Saved | null>(initial);
  const [title, setTitle] = useState(initial?.title || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(!initial),
    [status, setStatus] = useState("");
  const [previewPath, setPreviewPath] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const normalizedSlug = slug.trim().toLowerCase();
  const slugError =
    normalizedSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)
      ? "Use lowercase letters, numbers, and single hyphens, such as test-page."
      : "";
  const initialized = useRef(false);
  const request = useRef<{
    id: string;
    resolve: (doc: StudioSource) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  useEffect(() => {
    const sendInitial = () => {
      if (initialized.current) return;
      initialized.current = true;
      if (initial)
        frame.current?.contentWindow?.postMessage(
          { type: "mg-studio-load", source: initial.document.source },
          location.origin
        );
      else setReady(true);
    };
    function receive(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "mg-studio-ready") sendInitial();
      if (event.data?.type === "mg-studio-loaded") setReady(true);
      if (event.data?.type === "mg-studio-changed") {
        setDirty(true);
        setReviewed(false);
        setPreviewPath("");
      }
      if (
        event.data?.type === "mg-studio-snapshot" &&
        request.current?.id === event.data.requestId
      ) {
        const pending = request.current!;
        request.current = null;
        clearTimeout(pending.timer);
        if (event.data.error) pending.reject(new Error(event.data.error));
        else pending.resolve(event.data.document);
      }
    }
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      if (request.current) {
        clearTimeout(request.current.timer);
        request.current.reject(new Error("Studio closed."));
        request.current = null;
      }
    };
  }, [initial]);
  function snapshot() {
    return new Promise<StudioSource>((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        request.current = null;
        reject(
          new Error(
            "Studio did not respond. Your browser draft is still available; reload and try again."
          )
        );
      }, 15000);
      request.current = { id, resolve, reject, timer };
      frame.current?.contentWindow?.postMessage(
        { type: "mg-studio-capture", requestId: id },
        location.origin
      );
    });
  }
  async function save() {
    if (busy || !ready || !title.trim() || !normalizedSlug || slugError) return;
    setBusy(true);
    setStatus("Saving Studio draft…");
    setReviewed(false);
    setPreviewPath("");
    try {
      const document = await hostStudioMedia(
        await snapshot(),
        actions.upload,
        hostedMedia.current,
        (current, total) =>
          setStatus(
            `Uploading media ${current} of ${total}… Your browser draft is still available.`
          )
      );
      setStatus("Saving Studio draft…");
      const result = await actions.save({
        ...(saved ? { id: saved.id, expectedUpdatedAt: saved.updatedAt } : {}),
        title,
        slug: normalizedSlug,
        document,
      });
      if (!result.ok) throw new Error(result.error);
      setSaved(result.data);
      setTitle(result.data.title);
      setSlug(result.data.slug);
      setDirty(false);
      window.history.replaceState(null, "", `/admin/design-studio?id=${result.data.id}`);
      setStatus(
        result.data.issues.length
          ? "Draft saved. Resolve the publishing checks below before previewing or publishing."
          : "Draft saved. Open the site preview and review all three screen sizes before publishing."
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Save failed. Your browser draft remains available."
      );
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    if (!saved) return;
    setBusy(true);
    try {
      const result = await actions.preview({ id: saved.id, expectedUpdatedAt: saved.updatedAt });
      if (!result.ok) throw new Error(result.error);
      setPreviewPath(result.data.path);
      setStatus("Site preview ready. Review it before publishing.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!saved || dirty || !reviewed || busy) return;
    setBusy(true);
    try {
      const result = await actions.publish({ id: saved.id, expectedUpdatedAt: saved.updatedAt });
      if (!result.ok) throw new Error(result.error);
      setStatus(`Published version ${result.data.version}. Your page is live at /${saved.slug}.`);
      // Publication advances the page timestamp; refresh the next save's conflict guard.
      const refreshed = await actions.load(saved.id);
      if (refreshed.ok) setSaved(refreshed.data);
      else {
        setReady(false);
        setStatus(
          `Published version ${result.data.version}. Reopen this page before making further saves.`
        );
      }
      setReviewed(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Publishing failed.");
    } finally {
      setBusy(false);
    }
  }
  const eligible = !!saved && !dirty && !saved.issues.length && !busy;
  const previewReason = busy
    ? "Please wait for the current action to finish."
    : !saved
      ? title.trim() && normalizedSlug && !slugError
        ? "This draft has not been saved to the site yet. Save to site must succeed before a site preview is available."
        : "Enter a page title and URL, then click Save to site to enable the site preview. The Studio's browser save does not save to the site."
      : dirty
        ? "Click Save to site to save your latest changes and recheck this page before creating a preview."
        : saved.issues.length
          ? "Site preview and publishing are unavailable because this saved page has the publishing checks listed below."
          : "";
  const publishReason =
    previewReason ||
    (!previewPath
      ? "Create a site preview first, then open it and review the saved page."
      : !reviewed
        ? "Open the site preview, then select ‘I reviewed this saved page’ to enable Publish page."
        : "");
  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-mg-bg" aria-label="Design Studio">
      <header className="flex flex-wrap items-center gap-3 border-b border-mg-bd px-4 py-2 text-sm">
        <Link href="/admin/pages" className="underline">
          Back to pages
        </Link>
        <label>
          Page title{" "}
          <input
            className="border bg-mg-bg px-2"
            value={title}
            disabled={!!saved || busy}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </label>
        <div className="min-w-0">
          <label>
            URL /{" "}
            <input
              className="max-w-full border bg-mg-bg px-2"
              value={slug}
              disabled={!!saved || busy}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              onBlur={() => setSlug(normalizedSlug)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={!!slugError}
              aria-describedby="studio-url-help"
              maxLength={120}
            />
          </label>
          <p id="studio-url-help" className="max-w-sm text-xs" aria-live="polite">
            {slugError || "Lowercase letters, numbers and hyphens. Example: test-page."}
          </p>
        </div>
        <button
          disabled={!ready || busy || !title.trim() || !normalizedSlug || !!slugError}
          onClick={save}
        >
          Save to site
        </button>
        {saved && (
          <button
            disabled={busy}
            onClick={() => {
              setSaved(null);
              setSlug("");
              setDirty(true);
              setReviewed(false);
              setPreviewPath("");
              window.history.replaceState(null, "", "/admin/design-studio");
              setStatus("Choose a new title and URL, then save a new page.");
            }}
          >
            Save as new page
          </button>
        )}
        {canPreview && (
          <button disabled={!eligible} onClick={preview} aria-describedby="studio-preview-help">
            Create site preview
          </button>
        )}
        {previewPath && (
          <a href={previewPath} target="_blank" rel="noreferrer" className="underline">
            Open site preview
          </a>
        )}
        {eligible && previewPath && (
          <label>
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />{" "}
            I reviewed this saved page
          </label>
        )}
        {canPublish && (
          <button
            disabled={!eligible || !reviewed}
            onClick={publish}
            aria-describedby={
              previewReason && canPreview ? "studio-preview-help" : "studio-publish-help"
            }
          >
            Publish page
          </button>
        )}
        {saved && (
          <a href={`/admin/pages/${saved.id}/history`} className="underline">
            History
          </a>
        )}
      </header>
      <div className="max-h-40 overflow-auto px-4 py-2 text-sm" aria-live="polite">
        {status ||
          (saved
            ? "Saved Studio page loaded."
            : "Save a new Studio page to make it available across devices.")}
        {dirty && saved && <span> · Unsaved Studio changes</span>}
        {canPreview && <p id="studio-preview-help">{previewReason}</p>}
        {canPublish && (
          <p id="studio-publish-help">
            {!canPreview || publishReason !== previewReason ? publishReason : ""}
          </p>
        )}
        {!!saved?.issues.length && (
          <div>
            <p>{saved.issues.length} publishing checks in the saved page</p>
            <ul>
              {saved.issues.map((issue, index) => (
                <li key={index}>
                  {issue.path}: {issue.message}
                </li>
              ))}
            </ul>
            <p>
              Resolve these items, then click Save to site to check again. Features awaiting
              publishing support can remain in your draft.
            </p>
          </div>
        )}
      </div>
      <iframe
        inert={busy}
        onLoad={() =>
          frame.current?.contentWindow?.postMessage({ type: "mg-studio-hello" }, location.origin)
        }
        ref={frame}
        title="Modern Gentlemen Design Studio"
        src="/api/admin/design-studio"
        className="min-h-0 w-full flex-1 border-0"
        allow="autoplay; fullscreen"
        style={busy ? { pointerEvents: "none" } : undefined}
      />
    </section>
  );
}
