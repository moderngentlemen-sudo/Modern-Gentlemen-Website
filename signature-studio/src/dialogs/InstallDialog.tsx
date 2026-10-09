import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, Download, ExternalLink, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import type { Variant } from "../core/types";
import { copyRich, copyText } from "../lib/clipboard";
import { downloadFile, safeFileName } from "../lib/download";
import { TEST_HOST_ENABLED } from "../lib/url";
import { hostFromConfig } from "../publish/host";
import { emailHtml, prepareAll, usePublish, type ImageStatus } from "../publish/prepare";
import { GMAIL_SIGNATURE_LIMIT, htmlDocument, htmlToPlainText } from "../render/validate";
import { toast, ui, updatePrefs, useStudio } from "../store/editor";
import { Modal, Toggle } from "../ui/kit";
import { SigHtml } from "../ui/SigHtml";

type Client = "gmail" | "gmail-app" | "outlook" | "apple";

const CLIENTS: { id: Client; name: string; note: string }[] = [
  { id: "gmail", name: "Gmail", note: "On a computer · recommended" },
  { id: "gmail-app", name: "Gmail app", note: "iPhone, iPad, Android" },
  { id: "outlook", name: "Outlook", note: "Web, new Outlook, Mac" },
  { id: "apple", name: "Apple Mail", note: "Mac, iPhone, iPad" },
];

function Steps({ client, hasReply }: { client: Client; hasReply: boolean }) {
  if (client === "gmail" || client === "gmail-app")
    return (
      <>
        {client === "gmail-app" && (
          <div className="callout warn" style={{ marginBottom: 12 }}>
            <AlertTriangle size={16} />
            <span>
              The Gmail phone and tablet apps only support plain-text signatures. Set it up once in Gmail on the web (on an iPad, open gmail.com in Safari and
              choose <b>Request Desktop Website</b>) — it's then used for mail you send from the web, and the app's own signature can be switched off.
            </span>
          </div>
        )}
        <ol className="steps-list">
          <li>
            <span>
              Click <b>Copy signature</b> above.
            </span>
          </li>
          <li>
            <span>
              Open Gmail settings:{" "}
              <a href="https://mail.google.com/mail/u/0/#settings/general" target="_blank" rel="noreferrer">
                Settings → General <ExternalLink size={12} />
              </a>
            </span>
          </li>
          <li>
            <span>
              Scroll to <b>Signature</b>, click <b>Create new</b> and give it a name.
            </span>
          </li>
          <li>
            <span>
              Click inside the signature box and paste (<b>⌘V</b> on Mac, <b>Ctrl+V</b> on Windows).
            </span>
          </li>
          {hasReply && (
            <li>
              <span>
                Optional: create a second signature and paste the <b>reply</b> version.
              </span>
            </li>
          )}
          <li>
            <span>
              Under <b>Signature defaults</b>, choose it for new emails
              {hasReply ? " (and the reply version for replies/forwards)" : " and for replies/forwards"}.
            </span>
          </li>
          <li>
            <span>
              Scroll to the bottom and click <b>Save Changes</b>. Done!
            </span>
          </li>
        </ol>
      </>
    );
  if (client === "outlook")
    return (
      <ol className="steps-list">
        <li>
          <span>
            Click <b>Copy signature</b>.
          </span>
        </li>
        <li>
          <span>
            In Outlook open <b>Settings → Account → Signatures</b> (Outlook on the web:{" "}
            <a href="https://outlook.office.com/mail/options/accounts-category/signatures-subcategory" target="_blank" rel="noreferrer">
              open signatures <ExternalLink size={12} />
            </a>
            ).
          </span>
        </li>
        <li>
          <span>Create a new signature, name it and paste into the editor.</span>
        </li>
        <li>
          <span>Pick it as the default for new messages and replies, then Save.</span>
        </li>
      </ol>
    );
  return (
    <ol className="steps-list">
      <li>
        <span>
          Click <b>Copy signature</b>.
        </span>
      </li>
      <li>
        <span>
          Mac: <b>Mail → Settings → Signatures</b>, click <b>+</b>. iPhone/iPad: <b>Settings → Apps → Mail → Signature</b>.
        </span>
      </li>
      <li>
        <span>
          Paste. On a Mac, untick <b>Always match my default message font</b>.
        </span>
      </li>
      <li>
        <span>Choose the signature for your account. Close the window to save.</span>
      </li>
    </ol>
  );
}

function StatusIcon({ s }: { s: ImageStatus }) {
  if (s.state === "ready") return <CheckCircle2 size={18} color="var(--ok)" />;
  if (s.state === "failed") return <XCircle size={18} color="var(--err)" />;
  if (s.state === "attention") return <AlertTriangle size={18} color="var(--warn)" />;
  return <Loader2 size={18} className="spin" color="var(--brand)" />;
}

function CopyBox({ variant, title, testId }: { variant: Variant; title: string; testId: string }) {
  const doc = useStudio((s) => s.doc!);
  const out = useMemo(() => emailHtml(doc, variant), [doc, variant]);
  const [copied, setCopied] = useState(false);
  const warnings = out.problems.filter((p) => p.level !== "error");
  const copy = async () => {
    try {
      await copyRich(out.html, htmlToPlainText(out.html));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast("Copied! Now paste it into your email settings.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't copy.", "error");
    }
  };
  return (
    <div className="copy-box">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{title}</strong>
        <span className={`badge ${out.html.length > GMAIL_SIGNATURE_LIMIT * 0.9 ? "warn" : "ok"}`} title="Gmail allows up to 10,000 characters">
          {Math.round((out.html.length / GMAIL_SIGNATURE_LIMIT) * 100)}% of Gmail's limit
        </span>
      </div>
      <div className="pv">
        <SigHtml html={out.html} />
      </div>
      {!out.ready && (
        <div className="callout err">
          <XCircle size={16} />
          <span>{out.problems.find((p) => p.level === "error")?.message}</span>
        </div>
      )}
      {warnings.map((w) => (
        <div key={w.message} className="callout warn">
          <AlertTriangle size={16} />
          <span>{w.message}</span>
        </div>
      ))}
      <div className="row">
        <button className="btn primary" disabled={!out.ready} onClick={() => void copy()} data-testid={testId}>
          {copied ? <Check size={17} /> : <Copy size={17} />} {copied ? "Copied" : "Copy signature"}
        </button>
        <button
          className="btn ghost sm"
          disabled={!out.ready}
          onClick={() => downloadFile(`${safeFileName(doc.name)}${variant === "reply" ? "-reply" : ""}.html`, htmlDocument(out.html, doc.name), "text/html")}
        >
          <Download size={15} /> HTML
        </button>
      </div>
    </div>
  );
}

export function InstallDialog() {
  const open = useStudio((s) => s.dialog === "install");
  const doc = useStudio((s) => s.doc);
  const prefs = useStudio((s) => s.prefs);
  const { statuses, running } = usePublish();
  const [step, setStep] = useState(0);
  const [client, setClient] = useState<Client>("gmail");
  const close = () => ui({ dialog: null });
  const host = hostFromConfig(prefs.host);
  const list = Object.values(statuses);
  const done = !running && list.length > 0 && list.every((s) => s.state === "ready");
  const blocked = !running && list.some((s) => s.state !== "ready");
  const hasReply = !!doc?.reply.compact || (doc?.mode === "builder" && !!doc.reply.custom);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (!usePublish.getState().running) usePublish.setState({ statuses: {} });
  }, [open]);

  const prepare = (force = false) => void prepareAll(hasReply ? ["full", "reply"] : ["full"], force);

  useEffect(() => {
    if (open && step === 1 && prefs.publishConsent && host && !running && !list.length) prepare();
  }, [open, step, prefs.publishConsent]);

  useEffect(() => {
    if (open && step === 1 && done) setStep(2);
  }, [done]);

  if (!doc) return null;
  const titles = ["Where do you send email from?", "Preparing your images", "Copy & paste"];
  return (
    <Modal
      open={open}
      onClose={close}
      wide={step === 2}
      title={titles[step]}
      subtitle={
        step === 0
          ? "We'll show the exact steps for your email app."
          : step === 1
            ? "Images are hosted so every recipient sees them — even in Gmail."
            : "Your signature is ready."
      }
      testId="install-dialog"
      footer={
        <>
          {step > 0 && (
            <button className="btn ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <div className="grow" />
          {step === 0 && (
            <button className="btn primary" onClick={() => setStep(1)} data-testid="install-next">
              Continue
            </button>
          )}
          {step === 1 && (
            <button className="btn primary" disabled={!done} onClick={() => setStep(2)} data-testid="install-continue">
              Continue
            </button>
          )}
          {step === 2 && (
            <button className="btn" onClick={close}>
              Finish
            </button>
          )}
        </>
      }
    >
      <div className="progress" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i key={i} className={i <= step ? "on" : ""} />
        ))}
      </div>

      {step === 0 && (
        <div className="client-grid" role="radiogroup" aria-label="Email app">
          {CLIENTS.map((c) => (
            <button key={c.id} className="client" aria-pressed={client === c.id} onClick={() => setClient(c.id)}>
              <strong>{c.name}</strong>
              <span>{c.note}</span>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <>
          {TEST_HOST_ENABLED && (
            <div className="badge warn" style={{ marginBottom: 10 }}>
              Test build — local image host accepted
            </div>
          )}
          {!host ? (
            <div className="callout err" style={{ marginBottom: 12 }}>
              <XCircle size={16} />
              <span>
                Image hosting isn't set up yet.{" "}
                <button className="btn sm" onClick={() => ui({ dialog: "settings", dialogArg: "from-install" })}>
                  Open Settings
                </button>
              </span>
            </div>
          ) : (
            <div className="callout brand" style={{ marginBottom: 12 }}>
              <ShieldCheck size={16} />
              <span>
                Images are uploaded to <b>{host.label}</b> with anonymous file names (no name or email in the link), then checked from the outside to be sure
                they load.
              </span>
            </div>
          )}
          {!prefs.publishConsent && (
            <Toggle
              label="Host my signature images publicly"
              hint="Required so recipients can see them"
              checked={false}
              onChange={(v) => updatePrefs({ publishConsent: v })}
              testId="consent"
            />
          )}
          {list.length > 0 && (
            <ul className="ready-list" data-testid="ready-list">
              {list.map((s) => (
                <li key={s.key}>
                  <StatusIcon s={s} />
                  <span className="what">
                    {s.label}
                    {s.message && <small>{s.message}</small>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {running && (
            <p className="hint">
              <Loader2 size={13} className="spin" style={{ verticalAlign: -2 }} /> Working…
            </p>
          )}
          {blocked && (
            <button className="btn sm" onClick={() => prepare(true)}>
              <RefreshCw size={14} /> Try again
            </button>
          )}
          {prefs.publishConsent && host && !running && !list.length && (
            <button className="btn primary" onClick={() => prepare()}>
              Prepare signature
            </button>
          )}
        </>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 20 }} className="install-grid">
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <CopyBox variant="full" title="New emails" testId="copy-full" />
            {hasReply && <CopyBox variant="reply" title="Replies & forwards" testId="copy-reply" />}
          </div>
          <div>
            <strong style={{ display: "block", marginBottom: 10 }}>{CLIENTS.find((c) => c.id === client)!.name} steps</strong>
            <Steps client={client} hasReply={hasReply} />
            {doc.digitalCardUrl && (
              <div className="card" style={{ marginTop: 16 }}>
                <strong>Your digital business card</strong>
                <p className="hint" style={{ margin: "4px 0 10px" }}>
                  Share it anywhere — texts, LinkedIn, a QR code at events.
                </p>
                <div className="row">
                  <a className="btn sm" href={doc.digitalCardUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> Open
                  </a>
                  <button className="btn sm" onClick={() => void copyText(doc.digitalCardUrl!).then(() => toast("Link copied", "success"))}>
                    <Copy size={14} /> Copy link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
