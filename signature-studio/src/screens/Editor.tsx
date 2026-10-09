import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Blocks,
  Check,
  Eye,
  CreditCard,
  History,
  Plus,
  Send,
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
import { goHome, redo, toast, ui, undo, useStudio, edit, type Tab } from "../store/editor";
import { loadFonts } from "../store/fonts";
import type { SignatureDoc } from "../core/types";
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
import { DragLayer, PhoneFit, Stage } from "../builder/Stage";
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
  placeImageFile,
  removeSelected,
  resizeSelectedBy,
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

type RailItem = { id: string; label: string; icon: ReactNode; tabs: Tab[] };

/** The builder rail: five places, each holding one or more panels. */
const BUILDER_RAIL: RailItem[] = [
  { id: "blocks", label: "Add", icon: <Plus size={20} />, tabs: ["blocks"] },
  { id: "layers", label: "Layers", icon: <Layers size={20} />, tabs: ["layers"] },
  { id: "content", label: "Content", icon: <User size={20} />, tabs: ["details", "images", "social"] },
  { id: "style", label: "Style", icon: <Palette size={20} />, tabs: ["design", "templates"] },
  { id: "publish", label: "Publish", icon: <Send size={20} />, tabs: ["card"] },
];

const SUB_LABEL: Partial<Record<Tab, string>> = {
  details: "Details",
  images: "Images",
  social: "Social",
  design: "Design",
  templates: "Templates",
  card: "Card",
};

/** Quick mode is a guided path: these steps, in order, then Add to Gmail. */
const QUICK_STEPS: Tab[] = ["templates", "details", "images", "social", "design", "addons"];

const lastSub: Record<string, Tab> = {};

function stepDone(tab: Tab, doc: SignatureDoc): boolean {
  switch (tab) {
    case "templates":
      return !!doc.templateId;
    case "details":
      return !!doc.details.name.trim() && !!(doc.details.email.trim() || doc.details.phone.trim());
    case "images":
      return !!(doc.images.photo.assetId || doc.images.logo.assetId);
    case "social":
      return doc.socials.some((s) => s.url.trim());
    default:
      return false;
  }
}

/** Back / Next under each Quick-mode step. */
function StepNav({ tab }: { tab: Tab }) {
  const i = QUICK_STEPS.indexOf(tab);
  if (i < 0) return null;
  const prev = QUICK_STEPS[i - 1];
  const next = QUICK_STEPS[i + 1];
  const label = (t: Tab) => QUICK_TABS.find((q) => q.id === t)!.label;
  return (
    <div className="step-nav" data-testid="step-nav">
      <span className="step-count">
        Step {i + 1} of {QUICK_STEPS.length}
      </span>
      <div className="grow" />
      {prev && (
        <button className="btn sm ghost" onClick={() => ui({ tab: prev })}>
          Back
        </button>
      )}
      {next ? (
        <button className="btn sm primary" onClick={() => ui({ tab: next })} data-testid="step-next">
          Next: {label(next)} →
        </button>
      ) : (
        <button className="btn sm accent" onClick={() => ui({ dialog: "install" })} data-testid="step-install">
          <Mail size={14} /> Add to Gmail
        </button>
      )}
    </div>
  );
}

/** The Publish place: the one big action first, then the card and history. */
function PublishIntro() {
  return (
    <div className="publish-intro">
      <h2>Publish</h2>
      <p className="lede">Prepare your images and copy the signature into Gmail, Outlook or Apple Mail.</p>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <button className="btn accent" onClick={() => ui({ dialog: "install" })} data-testid="publish-install">
          <Mail size={16} /> Add to Gmail
        </button>
        <button className="btn" onClick={() => ui({ dialog: "history" })}>
          <History size={16} /> Versions
        </button>
      </div>
    </div>
  );
}

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
      if (!mod && (e.code === "BracketLeft" || e.code === "BracketRight")) {
        if (resizeSelectedBy(e.code === "BracketRight" ? 1 : -1, e.shiftKey)) e.preventDefault();
        return;
      }
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
    // Paste an image (a screenshot, a copied logo) straight into the layout.
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (!builder || useStudio.getState().dialog || t.closest?.("input, textarea, [contenteditable]")) return;
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (!file) return;
      e.preventDefault();
      void placeImageFile(file);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
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
      {editable && <PhoneFit />}
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

/** Register the signature's brand fonts with the page when it opens. */
function useBrandFonts() {
  const fonts = useStudio((s) => s.doc?.customFonts);
  useEffect(() => {
    if (!fonts?.length) return;
    void loadFonts(fonts).then((missing) => {
      if (missing.length) toast(`${missing.join(", ")} isn't on this device. Upload the font again to use it here.`, "info");
    });
  }, [fonts]);
}

export function Editor() {
  const builder = useStudio((s) => s.doc?.mode === "builder");
  const doc = useStudio((s) => s.doc!);
  useBrandFonts();
  useShortcuts(builder);
  const tab = useStudio((s) => s.tab);
  const quickActive = QUICK_TABS.some((t) => t.id === tab) ? tab : QUICK_TABS[0].id;
  const place = BUILDER_RAIL.find((r) => r.tabs.includes(tab)) ?? BUILDER_RAIL[0];
  const active = builder ? (place.tabs.includes(tab) ? tab : place.tabs[0]) : quickActive;
  if (builder) lastSub[place.id] = active;
  const Panel = PANELS[active === "install" ? "details" : active];
  return (
    <div className={`editor${builder ? " builder" : ""}`}>
      <Topbar />
      <nav className="nav" role="tablist" aria-label="Editor sections">
        {builder
          ? BUILDER_RAIL.map((r) => (
              <button
                key={r.id}
                role="tab"
                aria-selected={place.id === r.id}
                onClick={() => ui({ tab: lastSub[r.id] ?? r.tabs[0] })}
                data-testid={`tab-${r.id}`}
              >
                {r.icon}
                {r.label}
              </button>
            ))
          : QUICK_TABS.map((t) => {
              const step = QUICK_STEPS.indexOf(t.id);
              return (
                <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => ui({ tab: t.id })} data-testid={`tab-${t.id}`}>
                  {t.icon}
                  {t.label}
                  {step >= 0 && (
                    <span className={`step-dot${stepDone(t.id, doc) ? " done" : ""}`} aria-hidden="true">
                      {stepDone(t.id, doc) ? <Check size={9} /> : step + 1}
                    </span>
                  )}
                </button>
              );
            })}
        {!builder && (
          <>
            <div className="sep" />
            <button role="tab" aria-selected={false} onClick={() => ui({ dialog: "install" })}>
              <Mail size={20} />
              Install
            </button>
          </>
        )}
      </nav>
      <section className="panel" role="tabpanel">
        {builder && place.id === "publish" && <PublishIntro />}
        {builder && place.tabs.length > 1 && (
          <div className="sub-tabs" role="tablist" aria-label={place.label}>
            {place.tabs.map((t) => (
              <button key={t} role="tab" aria-selected={active === t} onClick={() => ui({ tab: t })} data-testid={`tab-${t}`}>
                {SUB_LABEL[t]}
              </button>
            ))}
          </div>
        )}
        <Panel />
        {!builder && <StepNav tab={active} />}
      </section>
      <Preview />
      {builder && <Inspector />}
      <DragLayer />
    </div>
  );
}
