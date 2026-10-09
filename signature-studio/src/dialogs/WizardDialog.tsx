/**
 * Quick start: details (typed or imported) → photo, industry, colour → pick
 * one of three designs made with your own information.
 */
import { useMemo, useRef, useState } from "react";
import { ClipboardPaste, Contact, Sparkles } from "lucide-react";
import { applyTemplate } from "../core/apply";
import { emptyDetails, newDoc } from "../core/defaults";
import { parseSignatureText, parseVCard, type Imported } from "../core/importDetails";
import { applyProfile, type Profile } from "../core/profile";
import { BUSINESS_CATEGORIES, TEMPLATES, type Template } from "../core/templates";
import type { AssetMeta, DetailKey, SignatureDoc } from "../core/types";
import { uid } from "../lib/id";
import { createFromTemplate } from "../screens/Home";
import { edit, toast, ui, updatePrefs, useStudio } from "../store/editor";
import { ImageDrop } from "../ui/ImageDrop";
import { Field, Modal, SWATCHES, TextField } from "../ui/kit";
import { Thumb } from "../ui/SigHtml";

const FIELDS: { key: DetailKey; label: string; placeholder: string; type?: string }[] = [
  { key: "name", label: "Full name", placeholder: "Jordan Ellis" },
  { key: "title", label: "Job title", placeholder: "Creative Director" },
  { key: "company", label: "Company", placeholder: "Modern Gentlemen" },
  { key: "email", label: "Email", placeholder: "you@company.com", type: "email" },
  { key: "phone", label: "Phone", placeholder: "+1 416 555 0182", type: "tel" },
  { key: "website", label: "Website", placeholder: "company.com" },
];

const PERSONAL = "Personal / creative";

/** Three designs with different layouts, led by the chosen industry. */
export function suggest(industry: string): Template[] {
  const pool =
    industry === PERSONAL
      ? TEMPLATES.filter((t) => t.group === "Artistic")
      : [...TEMPLATES.filter((t) => t.category === industry), ...TEMPLATES.filter((t) => t.group === "Business" && t.category !== industry)];
  const picks: Template[] = [];
  for (const t of [...pool, ...TEMPLATES]) {
    if (picks.length === 3) break;
    if (!picks.some((p) => p.id === t.id || p.layout === t.layout)) picks.push(t);
  }
  return picks;
}

export function WizardDialog() {
  const open = useStudio((s) => s.dialog === "wizard");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<Record<DetailKey, string>>>({});
  const [socials, setSocials] = useState<Imported["socials"]>([]);
  const [photo, setPhoto] = useState<AssetMeta | null>(null);
  const [industry, setIndustry] = useState(BUSINESS_CATEGORIES[0]);
  const [accent, setAccent] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const vcf = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(0);
    setPasting(false);
    setPasted("");
  };
  const close = () => {
    ui({ dialog: null });
    reset();
  };

  const merge = (r: Imported, source: string) => {
    const found = Object.entries(r.details).filter(([, v]) => v);
    if (!found.length && !r.socials.length) return toast(`Couldn't find any details in that ${source}.`, "error");
    setForm((f) => ({ ...f, ...Object.fromEntries(found) }));
    setSocials((s) => [...s, ...r.socials.filter((x) => !s.some((y) => y.platform === x.platform))]);
    toast(
      `Filled ${found.length} detail${found.length === 1 ? "" : "s"}${r.socials.length ? ` and ${r.socials.length} social link${r.socials.length === 1 ? "" : "s"}` : ""} — check them below`,
      "success",
    );
  };

  const profile: Profile = useMemo(
    () => ({
      details: { ...emptyDetails(), ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v ?? ""])) },
      socials: socials.map((s) => ({ id: uid("s"), platform: s.platform, url: s.url })),
      photo: photo ? { meta: photo, crop: { x: 0, y: 0, zoom: 1 }, shape: "circle" } : undefined,
      updatedAt: Date.now(),
    }),
    [form, socials, photo],
  );

  const previews = useMemo(
    () =>
      suggest(industry).map((t) => {
        const d: SignatureDoc = newDoc(t.id, t.design, t.name);
        applyTemplate(d, t.id);
        applyProfile(d, profile);
        if (accent) d.design.accent = accent;
        return { t, d };
      }),
    [industry, profile, accent],
  );

  const create = async (t: Template) => {
    updatePrefs({ profile });
    await createFromTemplate(t.id);
    if (accent) edit((d) => void (d.design.accent = accent));
    close();
    toast("Your signature is ready — fine-tune it, then Add to Gmail", "success");
  };

  const canNext = !!form.name?.trim();
  return (
    <Modal
      open={open}
      onClose={close}
      wide={step === 2}
      title={["About you", "Your look", "Pick a design"][step]}
      subtitle={
        [
          "Type your details, or bring them in from what you already have.",
          "Optional — skip anything you like.",
          "Made with your details. You can change everything later.",
        ][step]
      }
      testId="wizard"
      footer={
        <>
          {step > 0 && (
            <button className="btn ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <div className="grow" />
          {step < 2 && (
            <button className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)} data-testid="wizard-next">
              Continue
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
        <>
          <div className="row" style={{ flexWrap: "wrap", marginBottom: 14 }}>
            <button className="btn sm" onClick={() => setPasting(!pasting)} data-testid="wizard-paste">
              <ClipboardPaste size={14} /> Paste my current signature
            </button>
            <button className="btn sm" onClick={() => vcf.current?.click()}>
              <Contact size={14} /> Use a contact card (.vcf)
            </button>
            <input
              ref={vcf}
              type="file"
              accept=".vcf,text/vcard,text/x-vcard"
              hidden
              data-testid="wizard-vcf"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) merge(parseVCard(await f.text()), "contact card");
              }}
            />
          </div>
          {pasting && (
            <div className="card" style={{ marginBottom: 14, padding: 12 }}>
              <textarea
                className="textarea"
                rows={6}
                placeholder={
                  "Paste the signature from your emails here, e.g.\nJordan Ellis\nCreative Director, Modern Gentlemen\n+1 416 555 0182 | jordan@company.com"
                }
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                aria-label="Your current signature"
                data-testid="wizard-paste-text"
              />
              <button
                className="btn sm primary"
                style={{ marginTop: 8 }}
                disabled={!pasted.trim()}
                onClick={() => {
                  merge(parseSignatureText(pasted), "text");
                  setPasting(false);
                }}
                data-testid="wizard-paste-apply"
              >
                Fill in my details
              </button>
            </div>
          )}
          <div className="grid2">
            {FIELDS.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key] ?? ""}
                onChange={(v) => setForm((x) => ({ ...x, [f.key]: v }))}
                testId={`wizard-${f.key}`}
              />
            ))}
          </div>
          {socials.length > 0 && <p className="hint">Also found: {socials.map((s) => s.platform).join(", ")}.</p>}
        </>
      )}

      {step === 1 && (
        <>
          <Field label="Photo">
            <div className="image-slot">
              <ImageDrop assetId={photo?.id} round label="headshot" onFile={setPhoto} />
              <span className="hint">A friendly headshot makes emails feel personal. You can add one later.</span>
            </div>
          </Field>
          <Field label="What do you do?">
            <div className="chips">
              {[...BUSINESS_CATEGORIES, PERSONAL].map((c) => (
                <button key={c} className="chip" aria-pressed={industry === c} onClick={() => setIndustry(c)}>
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <Field label="A colour you like" hint="optional">
            <div className="swatches">
              {SWATCHES.map((s) => (
                <button
                  key={s}
                  className="swatch"
                  style={{ background: s }}
                  aria-label={s}
                  aria-pressed={accent === s}
                  onClick={() => setAccent(accent === s ? null : s)}
                />
              ))}
            </div>
          </Field>
        </>
      )}

      {step === 2 && (
        <div className="sig-grid">
          {previews.map(({ t, d }) => (
            <button key={t.id} className="sig-tile" onClick={() => void create(t)} data-testid={`wizard-pick-${t.id}`}>
              <Thumb doc={d} />
              <div className="tile-meta">
                <div>
                  <strong>{t.name}</strong>
                  <div className="muted">{t.description}</div>
                </div>
                <span className="badge brand">
                  <Sparkles size={11} /> {t.category}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
