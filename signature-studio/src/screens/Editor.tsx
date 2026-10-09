import { useEffect, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Mail,
  Monitor,
  Moon,
  Palette,
  Puzzle,
  Redo2,
  Settings,
  Share2,
  Smartphone,
  Type,
  Undo2,
  User,
} from "lucide-react";
import { goHome, redo, ui, undo, useStudio, edit, type Tab } from "../store/editor";
import { Segmented, Switch } from "../ui/kit";
import { previewHtml, SigHtml, useSourcesVersion } from "../ui/SigHtml";
import { TemplatesPanel } from "../panels/TemplatesPanel";
import { DetailsPanel } from "../panels/DetailsPanel";
import { ImagesPanel } from "../panels/ImagesPanel";
import { SocialPanel } from "../panels/SocialPanel";
import { DesignPanel } from "../panels/DesignPanel";
import { AddOnsPanel } from "../panels/AddOnsPanel";
import { CardPanel } from "../panels/CardPanel";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "templates", label: "Templates", icon: <LayoutTemplate size={20} /> },
  { id: "details", label: "Details", icon: <User size={20} /> },
  { id: "images", label: "Images", icon: <ImageIcon size={20} /> },
  { id: "social", label: "Social", icon: <Share2 size={20} /> },
  { id: "design", label: "Design", icon: <Palette size={20} /> },
  { id: "addons", label: "Add-ons", icon: <Puzzle size={20} /> },
  { id: "card", label: "Canva", icon: <CreditCard size={20} /> },
];

const PANELS: Record<Exclude<Tab, "install">, () => ReactNode> = {
  templates: TemplatesPanel,
  details: DetailsPanel,
  images: ImagesPanel,
  social: SocialPanel,
  design: DesignPanel,
  addons: AddOnsPanel,
  card: CardPanel,
};

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement;
      // Let text fields keep their own undo.
      if (t.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function Topbar() {
  const doc = useStudio((s) => s.doc!);
  const saving = useStudio((s) => s.saving);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={goHome} aria-label="Back to my signatures" title="My signatures">
        <ArrowLeft size={20} />
      </button>
      <input className="name" value={doc.name} onChange={(e) => edit((d) => void (d.name = e.target.value), "name")} aria-label="Signature name" />
      <span className="save-state desktop-only" aria-live="polite">
        {saving === "saving" ? (
          "Saving…"
        ) : saving === "error" ? (
          "Not saved"
        ) : (
          <>
            <Check size={12} /> Saved
          </>
        )}
      </span>
      <div className="grow" />
      <button className="icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)">
        <Undo2 size={18} />
      </button>
      <button className="icon-btn" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)">
        <Redo2 size={18} />
      </button>
      <button className="icon-btn desktop-only" onClick={() => ui({ dialog: "settings" })} aria-label="Settings" title="Settings">
        <Settings size={18} />
      </button>
      <button className="btn primary" onClick={() => ui({ dialog: "install" })} data-testid="open-install">
        <Mail size={17} /> <span>Add to Gmail</span>
      </button>
    </header>
  );
}

function Preview() {
  useSourcesVersion();
  const doc = useStudio((s) => s.doc!);
  const variant = useStudio((s) => s.variant);
  const device = useStudio((s) => s.device);
  const dark = useStudio((s) => s.darkPreview);
  const fallbackFonts = useStudio((s) => s.fallbackFonts);
  const html = previewHtml(doc, variant, fallbackFonts);
  return (
    <main className="preview-area" aria-label="Preview">
      <div className="preview-tools">
        <Segmented
          inline
          label="Device"
          value={device}
          onChange={(v) => ui({ device: v })}
          options={[
            { value: "desktop", label: <Monitor size={16} />, title: "Desktop" },
            { value: "mobile", label: <Smartphone size={16} />, title: "Phone" },
          ]}
        />
        <Segmented
          inline
          label="Signature version"
          value={variant}
          onChange={(v) => ui({ variant: v })}
          options={[
            { value: "full", label: "New email" },
            { value: "reply", label: "Reply" },
          ]}
        />
        <label className="chip" title="Approximate how dark-mode inboxes recolour it">
          <Moon size={14} /> Dark
          <Switch checked={dark} onChange={(v) => ui({ darkPreview: v })} label="Dark mode preview" />
        </label>
        <label className="chip" title="Show the fonts most recipients will actually see">
          <Type size={14} /> Inbox fonts
          <Switch checked={fallbackFonts} onChange={(v) => ui({ fallbackFonts: v })} label="Inbox fonts preview" />
        </label>
      </div>
      <div className={`mail${device === "mobile" ? " mobile" : ""}${dark ? " dark" : ""}`}>
        <div className="mail-bar">
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          {variant === "reply" ? "Re: Project kickoff" : "New message"}
        </div>
        <div className="mail-head">
          <div>
            To <b>alex@client.com</b>
          </div>
          <div>
            Subject <b>{variant === "reply" ? "Re: Project kickoff" : "Great to meet you"}</b>
          </div>
        </div>
        <div className="mail-body">
          <div className="msg">
            Hi Alex,
            <br />
            {variant === "reply" ? "Sounds good — talk Thursday." : "It was great meeting you today. Here are my details so we can stay in touch."}
          </div>
          {html ? <SigHtml html={html} className="sig-host" testId="preview" /> : <p className="muted">Add your name in Details to see your signature.</p>}
        </div>
      </div>
      <p className="preview-note">
        {variant === "reply"
          ? "The reply version is lighter, so long threads stay tidy."
          : "Links and buttons work in the preview. What you see is what recipients get."}
        {doc.card.enabled && doc.card.hotspots.length > 0 && variant === "full" && " Hover the card to try its clickable areas."}
      </p>
    </main>
  );
}

export function Editor() {
  useShortcuts();
  const tab = useStudio((s) => s.tab);
  const running = useStudio((s) => s.saving === "saving");
  const Panel = PANELS[tab === "install" ? "details" : tab];
  return (
    <div className="editor" data-busy={running || undefined}>
      <Topbar />
      <nav className="nav" role="tablist" aria-label="Editor sections">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => ui({ tab: t.id })} data-testid={`tab-${t.id}`}>
            {t.icon}
            {t.label}
          </button>
        ))}
        <div className="sep" />
        <button role="tab" aria-selected={false} onClick={() => ui({ dialog: "install" })}>
          <Mail size={20} />
          Install
        </button>
      </nav>
      <section className="panel" role="tabpanel">
        <Panel />
      </section>
      <Preview />
    </div>
  );
}

export const Spinner = () => <Loader2 size={16} className="spin" />;
