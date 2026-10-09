/** Editor "More" menu: save as template and exports. */
import { useEffect, useRef, useState } from "react";
import { Blocks, BookmarkPlus, Code2, History, Redo2, Settings, Image as ImageIcon, MoreHorizontal, Printer } from "lucide-react";
import { templateFromDoc, type SavedTemplate } from "../core/myTemplates";
import { exportPng, printCard } from "../publish/exports";
import { redo, toast, ui, updatePrefs, useStudio } from "../store/editor";
import { enterBuilder, enterQuick } from "../builder/actions";
import { Modal, TextField } from "./kit";

const NO_TEMPLATES: SavedTemplate[] = [];

export function MoreMenu() {
  const doc = useStudio((s) => s.doc!);
  const canRedo = useStudio((s) => s.future.length > 0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  const run = (fn: () => void | Promise<unknown>) => async () => {
    setOpen(false);
    setBusy(true);
    try {
      await fn();
    } catch {
      toast("That didn't work — try again.", "error");
    } finally {
      setBusy(false);
    }
  };
  const builder = doc.mode === "builder";
  // On phones the top bar has room only for the essentials; these move into this menu.
  const narrow = [
    {
      icon: <Blocks size={16} />,
      label: builder ? "Switch to Quick (simple forms)" : "Switch to Builder (drag and drop)",
      run: () => (builder ? enterQuick() : enterBuilder()),
      id: "menu-mode",
    },
    { icon: <Redo2 size={16} />, label: "Redo", run: () => redo(), id: "menu-redo", disabled: !canRedo },
    { icon: <Settings size={16} />, label: "Settings", run: () => ui({ dialog: "settings" }), id: "menu-settings" },
  ];
  const items = [
    { icon: <History size={16} />, label: "Version history…", run: () => ui({ dialog: "history" }), id: "open-history" },
    { icon: <BookmarkPlus size={16} />, label: "Save as my template", run: () => ui({ dialog: "saveTemplate" }), id: "save-template" },
    {
      icon: <ImageIcon size={16} />,
      label: "Download as image (PNG)",
      run: () => exportPng(doc).then(() => toast("Image downloaded", "success")),
      id: "export-png",
    },
    { icon: <Code2 size={16} />, label: "Copy or download HTML…", run: () => ui({ dialog: "install" }), id: "export-html" },
    ...(doc.card.assetId && doc.card.kind === "card"
      ? [{ icon: <Printer size={16} />, label: "Print business card (PDF)", run: () => printCard(doc), id: "print-card" }]
      : []),
  ];
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-label="More" aria-expanded={open} title="More" disabled={busy} data-testid="more-menu">
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {narrow.map((it) => (
            <button key={it.id} role="menuitem" className="narrow-only" onClick={run(it.run)} disabled={it.disabled} data-testid={it.id}>
              {it.icon}
              {it.label}
            </button>
          ))}
          {items.map((it) => (
            <button key={it.id} role="menuitem" onClick={run(it.run)} data-testid={it.id}>
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SaveTemplateDialog() {
  const open = useStudio((s) => s.dialog === "saveTemplate");
  const doc = useStudio((s) => s.doc);
  const mine = useStudio((s) => s.prefs.myTemplates) ?? NO_TEMPLATES;
  const [name, setName] = useState("");
  useEffect(() => {
    if (open && doc) setName(doc.name.replace(/ signature$/i, ""));
  }, [open]);
  if (!doc) return null;
  const close = () => ui({ dialog: null });
  const save = () => {
    updatePrefs({ myTemplates: [templateFromDoc(doc, name), ...mine] });
    toast("Saved to My templates — find it on your dashboard", "success");
    close();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Save as my template"
      subtitle="Saves the design — layout, colours, blocks, logo — without your personal details, so it works for anyone."
      testId="save-template-dialog"
      footer={
        <>
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={!name.trim()} data-testid="save-template-confirm">
            Save template
          </button>
        </>
      }
    >
      <TextField label="Template name" value={name} onChange={setName} testId="template-name" />
    </Modal>
  );
}
