/**
 * "Suggest designs": three directions picked by Claude from Signet's own
 * templates, personalised in colour and type, previewed with your content.
 * Needs an account (the request goes through the cloud, which holds the key).
 */
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { applySuggestion, buildRequest, validateSuggestions, type Suggestion } from "../core/aiSuggest";
import { blocksFromDoc } from "../core/blocks";
import type { SignatureDoc } from "../core/types";
import { cloud } from "../cloud";
import { useAccount } from "../cloud/account";
import type { SuggestError } from "../cloud/api";
import { edit, toast, ui, undo, useStudio } from "../store/editor";
import { Thumb } from "../ui/SigHtml";

const MESSAGES: Record<SuggestError, string> = {
  not_configured: "AI suggestions aren't switched on for this app yet.",
  limit: "That's today's 20 suggestions. Try again tomorrow.",
  sign_in: "Sign in again to get suggestions.",
  declined: "No suggestions for that request. Try different words.",
  busy: "The suggestion service is busy. Try again in a minute.",
  failed: "Couldn't get suggestions. Try again.",
};

function preview(doc: SignatureDoc, s: Suggestion): SignatureDoc {
  const copy = structuredClone(doc);
  applySuggestion(copy, s);
  return copy;
}

export function AiSuggest() {
  const doc = useStudio((s) => s.doc!);
  const user = useAccount((s) => s.user);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!cloud) return null;
  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await cloud!.suggestDesigns(buildRequest(doc, brief));
      if (!r.ok) return setError(MESSAGES[r.error]);
      const s = validateSuggestions(r.data);
      if (!s.length) return setError(MESSAGES.failed);
      setList(s);
    } catch {
      setError(MESSAGES.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ai-suggest" data-testid="ai-suggest">
      <div className="ai-head">
        <Sparkles size={16} />
        <strong>Suggest designs</strong>
      </div>
      {!user ? (
        <p className="hint">
          Sign in to get three design directions picked for your role.{" "}
          <button className="btn sm" onClick={() => ui({ dialog: "account" })}>
            Sign in
          </button>
        </p>
      ) : (
        <>
          <div className="row" style={{ gap: 6 }}>
            <input
              className="input sm"
              placeholder="Optional: “warmer”, “law firm”, “bold”…"
              aria-label="What you're after"
              value={brief}
              maxLength={200}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && void ask()}
            />
            <button className="btn sm primary" onClick={() => void ask()} disabled={busy} data-testid="ai-ask">
              {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Suggest
            </button>
          </div>
          <p className="hint">Sends your job title, company and current look — never your contact details.</p>
          {error && (
            <p className="hint ai-error" role="status">
              {error}
            </p>
          )}
          {list?.map((s) => (
            <button
              key={s.templateId}
              className="sig-tile"
              onClick={() => {
                edit((d) => {
                  applySuggestion(d, s);
                  if (d.mode === "builder") d.blocks = blocksFromDoc(d);
                });
                toast(`Applied “${s.title}”`, "success", { label: "Undo", run: undo });
              }}
              data-testid={`ai-apply-${s.templateId}`}
            >
              <Thumb doc={preview(doc, s)} width={350} height={130} />
              <div className="tile-meta">
                <div>
                  <strong>{s.title}</strong>
                  <div className="muted">{s.why}</div>
                </div>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
