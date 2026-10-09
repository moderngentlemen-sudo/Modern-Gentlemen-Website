import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Blocks,
  Check,
  Eye,
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
import { ChecksChip, SizeMeter } from "../ui/Checks";
import { MoreMenu } from "../ui/MoreMenu";
import {
  copySelected,
  duplicateSelected,
  enterBuilder,
  enterQuick,
  enterSelected,
  nudgeSelected,
  pasteBlock,
  removeSelected,
  selectAdjacent,
  selectOutward,
} from "../builder/actions";

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
      if (k === "escape") {
        selectOutward();
        return;
      }
      if (!mod && !e.altKey && (k === "arrowup" || k === "arrowdown")) {
        e.preventDefault();
        selectAdjacent(k === "arrowup" ? -1 : 1);
        return;
      }
      if (mod && k === "v" && pasteBlock()) return e.preventDefault();
      if (!sel) return;
      if (k === "delete" || k === "backspace") {
        e.preventDefault();
        removeSelected();
      } else if (mod && k === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (k === "enter" && !mod && !t.closest("button, a, [role=button], [role=menuitem]")) {
        e.preventDefault();
        enterSelected();
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
      <div className="mode-switch wide-only" role="group" aria-label="Editor mode">
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
      <button className="icon-btn wide-only" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)">
        <Redo2 size={18} />
      </button>
      <button className="icon-btn desktop-only" onClick={() => ui({ dialog: "settings" })} aria-label="Settings" title="Settings">
        <Settings size={18} />
      </button>
      <MoreMenu />
      <button
        className="btn accent install-btn"
        onClick={() => ui({ dialog: "install" })}
        data-testid="open-install"
        aria-label="Add to Gmail"
        title="Add to Gmail"
      >
        <Mail size={17} /> <span className="desktop-only">Add to Gmail</span>
      </button>
    </header>
  );
}

/** Device, dark mode and inbox fonts: occasional checks, kept in one menu so the toolbar stays on one row. */
function ViewMenu() {
  const device = useStudio((s) => s.device);
  const dark = useStudio((s) => s.darkPreview);
  const fallbackFonts = useStudio((s) => s.fallbackFonts);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  const active = [device === "mobile" && "Phone", dark && "Dark", fallbackFonts && "Inbox fonts"].filter(Boolean) as string[];
  return (
    <div className="menu-wrap" ref={ref}>
      <button
        className={`chip view-btn${active.length ? " on" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        title="Preview on a phone, in dark mode, or with the fonts most inboxes show"
        data-testid="view-menu"
      >
        <Eye size={14} /> {active.length ? active.join(" · ") : "View"}
      </button>
      {open && (
        <div className="menu view-menu" role="dialog" aria-label="Preview options">
          <div className="view-row">
            <span>Device</span>
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
          </div>
          <label className="view-row" title="Approximate how dark-mode inboxes recolour it">
            <span>
              <Moon size={14} /> Dark mode
            </span>
            <Switch checked={dark} onChange={(v) => ui({ darkPreview: v })} label="Dark mode preview" />
          </label>
          <label className="view-row" title="Show the fonts most recipients will actually see">
            <span>
              <Type size={14} /> Inbox fonts
            </span>
            <Switch checked={fallbackFonts} onChange={(v) => ui({ fallbackFonts: v })} label="Inbox fonts preview" />
          </label>
        </div>
      )}
    </div>
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
  const ownReply = builder && !!doc.reply.custom && !!doc.replyBlocks;
  const editable = builder && !(variant === "reply" && doc.reply.compact && !ownReply);
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
          label="Signature version"
          value={variant}
          onChange={(v) => ui({ variant: v, selected: null })}
          options={[
            { value: "full", label: "New email" },
            { value: "reply", label: "Reply" },
          ]}
        />
        <ChecksChip />
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
        <ViewMenu />
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
      <SizeMeter />
      <p className="preview-note">
        {editable && variant === "reply" && ownReply
          ? "You're editing the reply layout. Switch to New email to edit the main one."
          : editable
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
