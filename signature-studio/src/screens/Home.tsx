import { useMemo, useState } from "react";
import { Copy, CreditCard, Mail, MousePointerClick, Palette, Plus, Search, Settings, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { applyTemplate } from "../core/apply";
import { newDoc, SAMPLE_DETAILS, SAMPLE_SOCIALS } from "../core/defaults";
import { ARTISTIC_CATEGORIES, BUSINESS_CATEGORIES, DEFAULT_TEMPLATE, getTemplate, TEMPLATES, type TemplateGroup } from "../core/templates";
import type { SignatureDoc } from "../core/types";
import { uid } from "../lib/id";
import { createDoc, deleteDoc, openDoc, toast, ui, useStudio } from "../store/editor";
import { Segmented } from "../ui/kit";
import { sampleDoc } from "../ui/samples";
import { Thumb } from "../ui/SigHtml";

/** New signature from a template, carrying over the user's own details if they have any. */
export async function createFromTemplate(templateId: string, opts: { canva?: "signature" | "card" } = {}) {
  const t = getTemplate(templateId);
  const doc = newDoc(t.id, t.design, opts.canva === "signature" ? "My Canva signature" : opts.canva === "card" ? "My business card" : `${t.name} signature`);
  applyTemplate(doc, t.id);
  const last = useStudio.getState().docs.find((d) => d.details.name.trim());
  if (last) {
    doc.details = structuredClone(last.details);
    doc.socials = structuredClone(last.socials);
    for (const slot of ["photo", "logo"] as const) {
      const id = last.images[slot].assetId;
      if (id && last.assets[id]) {
        doc.assets[id] = last.assets[id];
        doc.images[slot] = { ...doc.images[slot], assetId: id, crop: last.images[slot].crop, link: last.images[slot].link };
      }
    }
  } else if (!opts.canva) {
    // Sample content so the template looks finished; a Canva import starts
    // empty because its links must point at the user's real details.
    doc.details = { ...SAMPLE_DETAILS, custom: [] };
    doc.socials = SAMPLE_SOCIALS();
  }
  if (opts.canva) {
    Object.assign(doc.card, { enabled: true, kind: opts.canva, cardOnly: opts.canva === "signature" });
    if (opts.canva === "signature") Object.assign(doc.card, { digitalLink: false, inReplies: true, radius: 0, width: 600 });
  }
  await createDoc(doc);
  if (opts.canva) ui({ tab: "card" });
}

function duplicate(doc: SignatureDoc) {
  const copy: SignatureDoc = { ...structuredClone(doc), id: uid("sig"), name: `${doc.name} copy`, createdAt: Date.now(), updatedAt: Date.now() };
  void createDoc(copy);
}

function ago(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}

export function Home() {
  const docs = useStudio((s) => s.docs);
  const [group, setGroup] = useState<"All" | TemplateGroup>("All");
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const base = docs.find((d) => d.details.name.trim()) ?? null;

  const categories = group === "Business" ? BUSINESS_CATEGORIES : group === "Artistic" ? ARTISTIC_CATEGORIES : [...BUSINESS_CATEGORIES, ...ARTISTIC_CATEGORIES];
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter(
      (t) =>
        (group === "All" || t.group === group) &&
        (!category || t.category === category) &&
        (!q || `${t.name} ${t.category} ${t.description} ${t.group}`.toLowerCase().includes(q)),
    );
  }, [group, category, query]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="home">
      <header className="home-top">
        <div className="logo">
          <span className="logo-mark">
            <Sparkles size={18} />
          </span>
          Signature Studio
        </div>
        <button className="btn ghost sm" onClick={() => ui({ dialog: "settings" })}>
          <Settings size={16} /> Settings
        </button>
      </header>

      <section className="hero">
        <div>
          <h1>
            Email signatures that <em>get noticed.</em>
          </h1>
          <p>
            Pick from {TEMPLATES.length} designer templates for every industry and style, make it yours in minutes, and add it to Gmail with one copy and paste.
          </p>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn primary" onClick={() => scrollTo("templates")} data-testid="browse-templates">
              <Palette size={18} /> Choose a template
            </button>
            <button className="btn" onClick={() => void createFromTemplate(DEFAULT_TEMPLATE, { canva: "signature" })} data-testid="start-canva">
              <Upload size={18} /> Import from Canva
            </button>
          </div>
          <div className="hero-points">
            <span>
              <Mail size={15} /> Gmail-ready in one paste
            </span>
            <span>
              <MousePointerClick size={15} /> Canva designs, clickable in Gmail
            </span>
            <span>
              <Wand2 size={15} /> No account needed
            </span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="blob" />
          <div className="hero-card a">
            <Thumb doc={sampleDoc("corporate-classic", base)} width={420} height={150} />
          </div>
          <div className="hero-card b">
            <Thumb doc={sampleDoc("art-neon", base)} width={420} height={150} />
          </div>
        </div>
      </section>

      {docs.length > 0 && (
        <section className="section">
          <h2>My signatures</h2>
          <div className="sig-grid">
            <button className="new-tile" onClick={() => scrollTo("templates")}>
              <span>
                <Plus size={22} />
              </span>
              New signature
            </button>
            {docs.map((d) => (
              <div
                key={d.id}
                className="sig-tile"
                role="button"
                tabIndex={0}
                onClick={() => openDoc(d)}
                onKeyDown={(e) => e.key === "Enter" && openDoc(d)}
                data-testid="my-signature"
              >
                <Thumb doc={d} />
                <div className="tile-meta">
                  <div style={{ minWidth: 0 }}>
                    <strong>{d.name}</strong>
                    <div className="muted">
                      {getTemplate(d.templateId).name} · {ago(d.updatedAt)}
                    </div>
                  </div>
                  {d.card.enabled && <span className="badge brand">Card</span>}
                </div>
                <div className="tile-actions">
                  <button
                    className="icon-btn sm"
                    title="Duplicate"
                    aria-label={`Duplicate ${d.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicate(d);
                    }}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    className="icon-btn sm"
                    title="Delete"
                    aria-label={`Delete ${d.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete “${d.name}”? This can't be undone.`)) void deleteDoc(d.id).then(() => toast("Signature deleted"));
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2>Designed in Canva?</h2>
        <p className="muted" style={{ margin: "-6px 0 14px", maxWidth: 720 }}>
          Bring your design in exactly as you made it. We keep it pixel-perfect, make your phone, email, website and social icons clickable, and get it ready
          for Gmail.
        </p>
        <div className="sig-grid">
          <button
            className="sig-tile canva-tile"
            onClick={() => void createFromTemplate(DEFAULT_TEMPLATE, { canva: "signature" })}
            data-testid="canva-signature"
          >
            <span className="canva-ico">
              <Mail size={22} />
            </span>
            <strong>Email signature design</strong>
            <span className="muted">Your whole signature, designed in Canva. Recipients see exactly your design.</span>
          </button>
          <button className="sig-tile canva-tile" onClick={() => void createFromTemplate(DEFAULT_TEMPLATE, { canva: "card" })} data-testid="canva-card">
            <span className="canva-ico">
              <CreditCard size={22} />
            </span>
            <strong>Business card</strong>
            <span className="muted">A clickable card in your signature, plus a shareable digital card with Save Contact.</span>
          </button>
        </div>
      </section>

      <section className="section" id="templates">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Templates</h2>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <Segmented
              inline
              label="Template group"
              value={group}
              onChange={(g) => {
                setGroup(g);
                setCategory(null);
              }}
              options={[
                { value: "All", label: "All" },
                { value: "Business", label: "Business" },
                { value: "Artistic", label: "Artistic" },
              ]}
            />
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--ink-3)" }} />
              <input
                className="input"
                style={{ paddingLeft: 36, width: 230 }}
                placeholder="Search: law, neon, salon…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search templates"
              />
            </div>
          </div>
        </div>
        <div className="chips" style={{ marginBottom: 16 }}>
          <button className="chip" aria-pressed={!category} onClick={() => setCategory(null)}>
            All {group === "All" ? "styles" : group.toLowerCase()}
          </button>
          {categories.map((c) => (
            <button key={c} className="chip" aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="sig-grid">
          {list.map((t) => (
            <button key={t.id} className="sig-tile" onClick={() => void createFromTemplate(t.id)} data-testid={`template-${t.id}`} title={t.description}>
              <Thumb doc={sampleDoc(t.id, base)} />
              <div className="tile-meta">
                <div style={{ minWidth: 0 }}>
                  <strong>{t.name}</strong>
                  <div className="muted">{t.description}</div>
                </div>
                <span className={`badge ${t.group === "Artistic" ? "brand" : ""}`}>{t.category}</span>
              </div>
            </button>
          ))}
          {!list.length && <p className="muted">No templates match. Try another word.</p>}
        </div>
      </section>
      <footer className="section muted" style={{ fontSize: 12.5, paddingBottom: 40 }}>
        Your signatures are saved in this browser. Back them up from Settings.
      </footer>
    </div>
  );
}
