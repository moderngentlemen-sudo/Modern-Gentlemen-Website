/** Live checks chip + list, and the Gmail size meter. */
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { estimateEmailSize, runChecks, type CheckIssue } from "../core/checks";
import { GMAIL_SIGNATURE_LIMIT } from "../render/validate";
import { darkModeRisk } from "../store/assets";
import { ui, useStudio, type Tab } from "../store/editor";

const HOST = (import.meta.env.VITE_ASSET_HOST as string | undefined) || "https://images.example.com";

/** Issues for the open signature (recomputed on every edit — it's a few milliseconds). */
export function useChecks() {
  const doc = useStudio((s) => s.doc!);
  const endpoint = useStudio((s) => s.prefs.host?.endpoint) || HOST;
  const size = useMemo(() => estimateEmailSize(doc, endpoint), [doc, endpoint]);
  const logo = doc.images.logo.assetId;
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let live = true;
    if (logo) void darkModeRisk(logo).then((r) => live && setDark(r));
    else setDark(false);
    return () => void (live = false);
  }, [logo]);
  const issues = useMemo(() => {
    const list = runChecks(doc, { size });
    if (dark)
      list.push({
        id: "dark-logo",
        level: "warning",
        message:
          "Your logo is dark on a transparent background, so it may vanish in dark mode. Use a version with a light outline, or put it on a light panel.",
        fix: { tab: "images", label: "Check in dark preview" },
      });
    return list;
  }, [doc, size, dark]);
  return { issues, size };
}

function fix(i: CheckIssue) {
  if (!i.fix) return;
  const patch: Parameters<typeof ui>[0] = {};
  if (i.fix.tab) patch.tab = i.fix.tab as Tab;
  if (i.fix.blockId) patch.selected = i.fix.blockId;
  if (i.id === "dark-logo") patch.darkPreview = true;
  ui(patch);
}

const ICON = {
  error: <AlertCircle size={15} color="var(--err)" />,
  warning: <AlertTriangle size={15} color="var(--warn)" />,
  tip: <Lightbulb size={15} color="var(--violet)" />,
};

export function ChecksChip() {
  const { issues } = useChecks();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  const problems = issues.filter((i) => i.level !== "tip");
  const worst = issues.some((i) => i.level === "error") ? "err" : problems.length ? "warn" : "ok";
  return (
    <div className="checks" ref={ref}>
      <button className={`chip checks-chip ${worst}`} onClick={() => setOpen(!open)} aria-expanded={open} data-testid="checks-chip">
        {worst === "ok" ? <CheckCircle2 size={14} /> : worst === "err" ? <AlertCircle size={14} /> : <AlertTriangle size={14} />}
        {worst === "ok" ? "Looks good" : `${problems.length} to check`}
      </button>
      {open && (
        <div className="checks-pop" role="dialog" aria-label="Signature checks" data-testid="checks-list">
          {!issues.length && (
            <p className="muted" style={{ margin: 0 }}>
              No problems found. Links, colours and size all look right.
            </p>
          )}
          {issues.map((i) => (
            <div key={i.id} className={`check-row ${i.level}`}>
              {ICON[i.level]}
              <span className="grow">{i.message}</span>
              {i.fix && (
                <button
                  className="btn sm"
                  onClick={() => {
                    fix(i);
                    setOpen(false);
                  }}
                >
                  {i.fix.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SizeMeter() {
  const { size } = useChecks();
  const pct = Math.min(100, (size / GMAIL_SIGNATURE_LIMIT) * 100);
  const tone = size > GMAIL_SIGNATURE_LIMIT ? "err" : pct > 85 ? "warn" : "ok";
  return (
    <div className={`size-meter ${tone}`} title="Gmail accepts signatures up to 10,000 characters" data-testid="size-meter">
      <div className="bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <span>
        {size.toLocaleString()} / {GMAIL_SIGNATURE_LIMIT.toLocaleString()} characters for Gmail
      </span>
    </div>
  );
}
