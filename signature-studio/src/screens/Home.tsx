import { useMemo, useState } from "react";
import { Blocks, Copy, Wand2, CreditCard, Download, Palette, Plus, Search, Settings, Trash2, Upload } from "lucide-react";
import { BRAND } from "../brand";
import { applyBrand, applyTemplate } from "../core/apply";
import { applyProfile } from "../core/profile";
import { block, col } from "../core/blocks";
import { newDoc, SAMPLE_DETAILS, SAMPLE_SOCIALS } from "../core/defaults";
import { ARTISTIC_CATEGORIES, BUSINESS_CATEGORIES, MODERN_CATEGORIES, DEFAULT_TEMPLATE, getTemplate, TEMPLATES, type TemplateGroup } from "../core/templates";
import type { BrandKit, SignatureDoc } from "../core/types";
import { uid } from "../lib/id";
import { go } from "../router";
import { createDoc, deleteDoc, openDoc, toast, ui, updatePrefs, useStudio } from "../store/editor";
import { docFromTemplate, type SavedTemplate } from "../core/myTemplates";
import { Segmented, Switch } from "../ui/kit";
import { sampleDoc } from "../ui/samples";
import { Thumb } from "../ui/SigHtml";
import { install, isIos, usePwa } from "../pwa";

const NO_TEMPLATES: SavedTemplate[] = [];

export interface CreateOptions {
  /** Start from an imported Canva design. */
  canva?: "signature" | "card";
  /** Start with an empty drag-and-drop canvas. */
  blank?: boolean;
  /** Restyle with this brand kit. */
  brand?: BrandKit;
}

/** New signature from a template, carrying over the user's own details if they have any. */
export async function createFromTemplate(templateId: string, opts: CreateOptions = {}) {
  const t = getTemplate(templateId);
  const name =
    opts.canva === "signature" ? "My Canva signature" : opts.canva === "card" ? "My business card" : opts.blank ? "My signature" : `${t.name} signature`;
  const doc = newDoc(t.id, t.design, name);
  applyTemplate(doc, t.id);
  const profile = useStudio.getState().prefs.profile;
  const last = profile ? null : useStudio.getState().docs.find((d) => d.details.name.trim());
  if (profile) {
    applyProfile(doc, profile);
    // The logo isn't part of the profile; keep the one from the last signature.
    const prev = useStudio.getState().docs.find((d) => d.images.logo.assetId && d.assets[d.images.logo.assetId]);
    if (prev) {
      const id = prev.images.logo.assetId!;
      doc.assets[id] = prev.assets[id];
      doc.images.logo = { ...doc.images.logo, assetId: id };
    }
  } else if (last) {
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
  if (opts.brand) {
    applyBrand(doc, opts.brand, { fillEmpty: true });
    // Sample content isn't the user's: their brand's company and website win.
    if (!profile && !last && !opts.canva) {
      if (opts.brand.company) doc.details.company = opts.brand.company;
      if (opts.brand.website) doc.details.website = opts.brand.website;
    }
  }
  if (opts.canva) {
    Object.assign(doc.card, { enabled: true, kind: opts.canva, cardOnly: opts.canva === "signature" });
    if (opts.canva === "signature") Object.assign(doc.card, { digitalLink: false, inReplies: true, radius: 0, width: 600 });
  }
  if (opts.blank) {
    doc.mode = "builder";
    doc.blocks = col([block("name"), block("title"), block("divider", { width: 220 }), block("contacts"), block("socials")], { gap: 8 });
  }
  await createDoc(doc);
  if (opts.canva) ui({ tab: "card" });
  if (opts.blank) ui({ tab: "blocks" });
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

/** "Install app": the browser's own prompt where there is one, instructions on iPhone/iPad. */
function InstallAppButton() {
  const prompt = usePwa((s) => s.prompt);
  const installed = usePwa((s) => s.installed);
  if (installed || (!prompt && !isIos())) return null;
  return (
    <button
      className="btn ghost sm"
      data-testid="install-app"
      title="Use it like an app — it works offline"
      onClick={() =>
        prompt
          ? void install().then((ok) => ok && toast(`${BRAND.name} is installed`, "success"))
          : toast("In Safari, tap Share, then “Add to Home Screen”.", "info")
      }
    >
      <Download size={16} /> <span className="desktop-only">Install app</span>
    </button>
  );
}

export function Home() {
  const docs = useStudio((s) => s.docs);
  const brand = useStudio((s) => s.prefs.brand);
  const [group, setGroup] = useState<"All" | TemplateGroup>("All");
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [inBrand, setInBrand] = useState(true);
  const base = docs.find((d) => d.details.name.trim()) ?? null;
  const useBrand = brand && inBrand ? brand : undefined;

  const categories =
    group === "Business"
      ? BUSINESS_CATEGORIES
      : group === "Artistic"
        ? ARTISTIC_CATEGORIES
        : group === "Modern"
          ? MODERN_CATEGORIES
          : group === "Modern Gentlemen"
            ? []
            : [...new Set([...BUSINESS_CATEGORIES, ...ARTISTIC_CATEGORIES, ...MODERN_CATEGORIES])];
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter(
      (t) =>
        (group === "All" || t.group === group) &&
        (!category || t.category === category) &&
        (!q || `${t.name} ${t.category} ${t.description} ${t.group}`.toLowerCase().includes(q)),
    ).map((t) => {
      const sample = sampleDoc(t.id, base);
      if (!useBrand) return { t, sample };
      const branded = structuredClone(sample);
      applyBrand(branded, useBrand, { fillEmpty: true });
      return { t, sample: branded };
    });
  }, [group, category, query, base, useBrand]);

  const start = [
    {
      id: "wizard",
      icon: <Wand2 size={20} />,
      title: "Quick start",
      text: "Answer three questions, get three designs made with your details.",
      run: async () => ui({ dialog: "wizard" }),
    },
    {
      id: "blank",
      icon: <Blocks size={20} />,
      title: "Start from scratch",
      text: "An empty canvas in the drag-and-drop builder.",
      run: () => createFromTemplate(DEFAULT_TEMPLATE, { blank: true, brand: brand }),
    },
    {
      id: "canva-signature",
      icon: <Upload size={20} />,
      title: "Canva signature",
      text: "Bring in a signature you designed in Canva.",
      run: () => createFromTemplate(DEFAULT_TEMPLATE, { canva: "signature" }),
    },
    {
      id: "canva-card",
      icon: <CreditCard size={20} />,
      title: "Business card",
      text: "A clickable card plus a shareable digital card.",
      run: () => createFromTemplate(DEFAULT_TEMPLATE, { canva: "card" }),
    },
  ];

  return (
    <div className="home">
      <header className="app-top">
        <a
          className="logo"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("/");
          }}
        >
          <span className="logo-mark" aria-hidden="true">
            S
          </span>
          {BRAND.name}
        </a>
        <div className="row">
          <InstallAppButton />
          <button className="btn ghost sm" onClick={() => ui({ dialog: "brand" })} data-testid="open-brand">
            <Palette size={16} /> Brand kit
          </button>
          <button className="btn ghost sm" onClick={() => ui({ dialog: "settings" })}>
            <Settings size={16} /> <span className="desktop-only">Settings</span>
          </button>
        </div>
      </header>

      <section className="dash-intro">
        <h1>{docs.length ? "Your signatures" : "Let's make your signature"}</h1>
        <p>Pick a template, build your own with drag and drop, or bring a design from Canva.</p>
        <div className="start-grid">
          {start.map((s) => (
            <button key={s.id} className="start-card" onClick={() => void s.run()} data-testid={s.id.startsWith("canva-") ? s.id : `start-${s.id}`}>
              <span className="start-ico">{s.icon}</span>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      </section>

      {docs.length > 0 && (
        <section className="section">
          <h2>My signatures</h2>
          <div className="sig-grid">
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
                      {d.mode === "builder" ? "Custom layout" : getTemplate(d.templateId).name} · {ago(d.updatedAt)}
                    </div>
                  </div>
                  {d.card.enabled && <span className="badge brand">{d.card.kind === "signature" ? "Canva" : "Card"}</span>}
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
            <button className="new-tile" onClick={() => void createFromTemplate(DEFAULT_TEMPLATE, { blank: true, brand })}>
              <span>
                <Plus size={22} />
              </span>
              Blank signature
            </button>
          </div>
        </section>
      )}

      <MyTemplates />

      <section className="section" id="templates">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Templates</h2>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {brand && (
              <label className="chip" title="Show templates in your brand colours and fonts">
                <Palette size={14} /> My brand
                <Switch checked={inBrand} onChange={setInBrand} label="Preview templates in my brand" />
              </label>
            )}
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
                { value: "Modern", label: "Modern" },
                { value: "Modern Gentlemen", label: "Modern Gentlemen" },
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
          {list.map(({ t, sample }) => (
            <button
              key={t.id}
              className="sig-tile"
              onClick={() => void createFromTemplate(t.id, { brand: useBrand })}
              data-testid={`template-${t.id}`}
              title={t.description}
            >
              <Thumb doc={sample} />
              <div className="tile-meta">
                <div style={{ minWidth: 0 }}>
                  <strong>{t.name}</strong>
                  <div className="muted">{t.description}</div>
                </div>
                <span className={`badge ${t.group === "Business" ? "" : "brand"}`}>{t.category}</span>
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

/** A signature from one of your saved templates, with your saved details. */
async function createFromSaved(t: SavedTemplate) {
  const doc = docFromTemplate(t);
  const profile = useStudio.getState().prefs.profile;
  if (profile) applyProfile(doc, profile);
  else {
    doc.details = { ...SAMPLE_DETAILS, custom: [] };
    doc.socials = SAMPLE_SOCIALS();
  }
  await createDoc(doc);
  if (doc.mode === "builder") ui({ tab: "blocks" });
}

function MyTemplates() {
  const mine = useStudio((s) => s.prefs.myTemplates) ?? NO_TEMPLATES;
  const profile = useStudio((s) => s.prefs.profile);
  const previews = useMemo(
    () =>
      mine.map((t) => {
        const d = docFromTemplate(t);
        if (profile) applyProfile(d, profile);
        else {
          d.details = { ...SAMPLE_DETAILS, custom: [] };
          d.socials = SAMPLE_SOCIALS();
        }
        return { t, d };
      }),
    [mine, profile],
  );
  if (!mine.length) return null;
  return (
    <section className="section">
      <h2>My templates</h2>
      <div className="sig-grid">
        {previews.map(({ t, d }) => (
          <div
            key={t.id}
            className="sig-tile"
            role="button"
            tabIndex={0}
            onClick={() => void createFromSaved(t)}
            onKeyDown={(e) => e.key === "Enter" && void createFromSaved(t)}
            data-testid="my-template"
          >
            <Thumb doc={d} />
            <div className="tile-meta">
              <div style={{ minWidth: 0 }}>
                <strong>{t.name}</strong>
                <div className="muted">Saved {new Date(t.createdAt).toLocaleDateString()}</div>
              </div>
              <span className="badge brand">Mine</span>
            </div>
            <div className="tile-actions">
              <button
                className="icon-btn sm"
                title="Delete template"
                aria-label={`Delete template ${t.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete the template “${t.name}”? Signatures made from it stay.`))
                    updatePrefs({ myTemplates: mine.filter((x) => x.id !== t.id) });
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
