import { useEffect, type ReactNode } from "react";
import {
  ArrowLeft,
  Blocks,
  Check,
  CreditCard,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
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
  ZoomIn,
  ZoomOut,
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
import { BlocksPanel, LayersPanel } from "../builder/Panels";
import { Inspector } from "../builder/Inspector";
import { DragLayer, Stage } from "../builder/Stage";
import { copySelected, duplicateSelected, enterBuilder, enterQuick, nudgeSelected, pasteBlock, removeSelected } from "../builder/actions";

type NavItem = { id: Tab; label: string; icon: ReactNode };

const QUICK_TABS: NavItem[] = [
  { id: "templates", label: "Templates", icon: <LayoutTemplate size={20} /> },
  { id: "details", label: "Details", icon: <User size={20} /> },
  { id: "images", label: "Images", icon: <ImageIcon size={20} /> },
  { id: "social", label: "Social", icon: <Share2 size={20} /> },
  { id: "design", label: "Design", icon: <Palette size={20} /> },
  { id: "addons", label: "Add-ons", icon: <Puzzle size={20} /> },
  { id: "card", label: "Canva", icon: <CreditCard size={20} /> },
];

const BUILDER_TABS: NavItem[] = [
  { id: "blocks", label: "Blocks", icon: <Blocks size={20} /> },
  { id: "layers", label: "Layers", icon: <Layers size={20} /> },
  { id: "templates", label: "Templates", icon: <LayoutTemplate size={20} /> },
  { id: "details", label: "Details", icon: <User size={20} /> },
  { id: "images", label: "Images", icon: <ImageIcon size={20} /> },
  { id: "social", label: "Social", icon: <Share2 size={20} /> },
  { id: "design", label: "Design", icon: <Palette size={20} /> },
  { id: "card", label: "Canva", icon: <CreditCard size={20} /> },
];

const PANELS: Record<Exclude<Tab, "install">, () => ReactNode> = {
  blocks: BlocksPanel,
  layers: LayersPanel,
  templates: TemplatesPanel,
  details: DetailsPanel,
  images: ImagesPanel,
  social: SocialPanel,
  design: DesignPanel,
  addons: AddOnsPanel,
  card: CardPanel,
};

function useShortcuts(builder: boolean) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      // Text fields keep their own keys (and their own undo).
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (!builder || useStudio.getState().dialog) return;
      const sel = useStudio.getState().selected;
      if (k === "escape") ui({ selected: null });
      if (mod && k === "v" && pasteBlock()) return e.preventDefault();
      if (!sel) return;
      if (k === "delete" || k === "backspace") {
        e.preventDefault();
        removeSelected();
      } else if (mod && k === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (mod && k === "c") {
        if (copySelected()) e.preventDefault();
      } else if (e.altKey && (k === "arrowup" || k === "arrowdown")) {
        e.preventDefault();
        nudgeSelected(k === "arrowup" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [builder]);
}

function Topbar() {
  const doc = useStudio((s) => s.doc!);
  const saving = useStudio((s) => s.saving);
  const canUndo = useStudio((s) => s.past.length > 0);
  const canRedo = useStudio((s) => s.future.length > 0);
  const builder = doc.mode === "builder";
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
      <div className="mode-switch" role="group" aria-label="Editor mode">
        <button aria-pressed={!builder} onClick={() => builder && enterQuick()} data-testid="mode-quick" title="Simple forms">
          Quick
        </button>
        <button aria-pressed={builder} onClick={() => !builder && enterBuilder()} data-testid="mode-builder" title="Drag-and-drop builder">
          <Blocks size={14} /> Builder
        </button>
      </div>
      <button className="icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)">
        <Undo2 size={18} />
      </button>
      <button className="icon-btn" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)">
        <Redo2 size={18} />
      </button>
      <button className="icon-btn desktop-only" onClick={() => ui({ dialog: "settings" })} aria-label="Settings" title="Settings">
        <Settings size={18} />
      </button>
      <button className="btn accent" onClick={() => ui({ dialog: "install" })} data-testid="open-install">
        <Mail size={17} /> <span className="desktop-only">Add to Gmail</span>
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
  const builder = doc.mode === "builder";
  const zoom = useStudio((s) => s.zoom);
  const html = previewHtml(doc, variant, fallbackFonts, builder);
  const setZoom = (z: number) => ui({ zoom: Math.round(Math.min(2, Math.max(0.5, z)) * 100) / 100 });
  const editable = builder && !(variant === "reply" && doc.reply.compact);
  return (
    <main
      className="preview-area"
      aria-label="Preview"
      onPointerDown={(e) => {
        // Clicking the empty canvas clears the selection.
        if (builder && e.target === e.currentTarget) ui({ selected: null });
      }}
    >
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
        <div className="zoom-ctl" role="group" aria-label="Zoom">
          <button onClick={() => setZoom(zoom - 0.1)} aria-label="Zoom out" title="Zoom out">
            <ZoomOut size={15} />
          </button>
          <button onClick={() => setZoom(1)} title="Actual size" data-testid="zoom-level" style={{ minWidth: 46 }}>
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => setZoom(zoom + 0.1)} aria-label="Zoom in" title="Zoom in">
            <ZoomIn size={15} />
          </button>
        </div>
        <label className="chip desktop-only" title="Show the fonts most recipients will actually see">
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
          {editable ? (
            <Stage html={html} />
          ) : html ? (
            <div style={{ zoom }}>
              <SigHtml html={html} className="sig-host" testId="preview" />
            </div>
          ) : (
            <p className="muted">Add your name in Details to see your signature.</p>
          )}
        </div>
      </div>
      <p className="preview-note">
        {editable
          ? "Click to select · drag to move · drop blocks into columns to place them side by side."
          : variant === "reply"
            ? doc.reply.compact
              ? "The reply version is a compact text signature. Turn it off in Design to use your layout in replies."
              : "The reply version is lighter, so long threads stay tidy."
            : "Links and buttons work in the preview. What you see is what recipients get."}
      </p>
    </main>
  );
}

export function Editor() {
  const builder = useStudio((s) => s.doc?.mode === "builder");
  useShortcuts(builder);
  const tab = useStudio((s) => s.tab);
  const tabs = builder ? BUILDER_TABS : QUICK_TABS;
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  const Panel = PANELS[active === "install" ? "details" : active];
  return (
    <div className={`editor${builder ? " builder" : ""}`}>
      <Topbar />
      <nav className="nav" role="tablist" aria-label="Editor sections">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => ui({ tab: t.id })} data-testid={`tab-${t.id}`}>
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
      {builder && <Inspector />}
      <DragLayer />
    </div>
  );
}
