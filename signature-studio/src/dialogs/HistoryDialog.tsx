/** Version history: save named snapshots of a signature and bring them back. */
import { useEffect, useState } from "react";
import { History, RotateCcw, Trash2 } from "lucide-react";
import type { Version } from "../core/versions";
import { versionStore } from "../storage/db";
import { deleteVersion, restoreVersion, saveVersion, toast, ui, useStudio } from "../store/editor";
import { Modal } from "../ui/kit";
import { SigHtml, previewHtml } from "../ui/SigHtml";

export function HistoryDialog() {
  const open = useStudio((s) => s.dialog === "history");
  const docId = useStudio((s) => s.doc?.id);
  const [list, setList] = useState<Version[]>([]);
  const [name, setName] = useState("");
  const [peek, setPeek] = useState<string | null>(null);
  const reload = () => docId && void versionStore.list(docId).then(setList);
  useEffect(() => {
    if (open) {
      reload();
      setName("");
      setPeek(null);
    }
  }, [open, docId]);
  if (!docId) return null;
  const close = () => ui({ dialog: null });
  const save = async () => {
    const v = await saveVersion(name);
    if (v) toast(`Saved “${v.name}”`, "success");
    setName("");
    reload();
  };
  const shown = list.find((v) => v.id === peek);
  return (
    <Modal
      open={open}
      onClose={close}
      title="Version history"
      subtitle="Save the design as it is now, and come back to it any time."
      testId="history-dialog"
      wide
    >
      <form
        className="row"
        style={{ gap: 8, marginBottom: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <input
          className="input grow"
          placeholder="Name this version (optional), e.g. “Before the rebrand”"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Version name"
          data-testid="version-name"
        />
        <button className="btn primary" type="submit" data-testid="version-save">
          <History size={15} /> Save version
        </button>
      </form>
      {!list.length && <p className="hint">No saved versions yet. Restoring one always saves the current design first, so nothing is lost.</p>}
      <div className="versions">
        <ul className="version-list" data-testid="version-list">
          {list.map((v) => (
            <li key={v.id} className={peek === v.id ? "on" : ""}>
              <button className="version-pick" onClick={() => setPeek(v.id)} data-testid="version">
                <strong>{v.name}</strong>
                <span className="hint">
                  {new Date(v.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  {v.auto ? " · automatic" : ""}
                </span>
              </button>
              <button
                className="btn sm"
                onClick={() => {
                  void restoreVersion(v).then(close);
                }}
                data-testid="version-restore"
              >
                <RotateCcw size={13} /> Restore
              </button>
              <button className="icon-btn sm" aria-label={`Delete ${v.name}`} title="Delete" onClick={() => void deleteVersion(docId, v.id).then(reload)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
        {shown && (
          <div className="version-peek" data-testid="version-peek">
            <SigHtml html={previewHtml(shown.doc)} />
          </div>
        )}
      </div>
    </Modal>
  );
}
