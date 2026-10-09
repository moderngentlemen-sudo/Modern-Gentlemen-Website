import { useEffect, useRef, useState } from "react";
import { Archive, Download, Loader2, PlugZap, Upload } from "lucide-react";
import type { SignatureDoc } from "../core/types";
import { downloadFile } from "../lib/download";
import { sha256Hex } from "../lib/hash";
import { hostFromConfig, verifyPublicImage } from "../publish/host";
import { docStore, assetStore } from "../storage/db";
import { blobToDataUrl, ingestDataUrl } from "../store/assets";
import { loadAll, toast, ui, updatePrefs, useStudio } from "../store/editor";
import { Modal, SectionTitle, TextField, Toggle } from "../ui/kit";

const ENV_HOST = (import.meta.env.VITE_ASSET_HOST as string | undefined) ?? "";
const EXPORT_SCHEMA = "signature-studio.v3.export";

async function tinyPng(): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 2;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#5b4cf0";
  ctx.fillRect(0, 0, 2, 2);
  return new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
}

async function exportAll() {
  const docs = await docStore.list();
  const assets: Record<string, string> = {};
  for (const d of docs)
    for (const id of Object.keys(d.assets)) {
      if (assets[id]) continue;
      const blob = await assetStore.get(id);
      if (blob) assets[id] = await blobToDataUrl(blob);
    }
  downloadFile(
    `signature-studio-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify({ schema: EXPORT_SCHEMA, docs, assets }),
    "application/json",
  );
}

async function importAll(file: File) {
  const data = JSON.parse(await file.text()) as { schema?: string; docs?: SignatureDoc[]; assets?: Record<string, string> };
  if (data.schema !== EXPORT_SCHEMA || !Array.isArray(data.docs)) throw new Error("This isn't a signature backup file.");
  for (const [id, url] of Object.entries(data.assets ?? {})) if (typeof url === "string" && url.startsWith("data:image/")) await ingestDataUrl(id, url);
  for (const d of data.docs) if (d?.schema === "signature-studio.v3" && d.id) await docStore.put(d);
  await loadAll();
  return data.docs.length;
}

export function SettingsDialog() {
  const open = useStudio((s) => s.dialog === "settings");
  const prefs = useStudio((s) => s.prefs);
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<null | "test" | "backup">(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setEndpoint(prefs.host?.endpoint ?? "");
    setToken(prefs.host?.token ?? "");
  }, [open]);

  const close = () => {
    // Keep the key even when the address is left on its default.
    const host = endpoint.trim() || token.trim() ? { endpoint: endpoint.trim(), token: token.trim() || undefined } : undefined;
    updatePrefs({ host });
    ui({ dialog: useStudio.getState().doc && useStudio.getState().dialogArg === "from-install" ? "install" : null, dialogArg: null });
  };
  const effective = endpoint.trim() || ENV_HOST;

  const test = async () => {
    const host = hostFromConfig({ endpoint: endpoint.trim(), token: token.trim() || undefined });
    if (!host) return toast("Enter the image host address first.", "error");
    setBusy("test");
    try {
      const blob = await tinyPng();
      const url = await host.publish(`s/${await sha256Hex(blob)}.png`, blob, "image/png");
      const v = await verifyPublicImage(url);
      if (v.ok) toast("Connected — uploads work and images are public.", "success");
      else toast(v.message ?? "Uploaded, but the image isn't publicly reachable.", "error");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't connect.", "error");
    } finally {
      setBusy(null);
    }
  };

  const backup = async () => {
    if (!effective || !token.trim()) return toast("Enter the host address and upload key first.", "error");
    setBusy("backup");
    try {
      const res = await fetch(`${effective.replace(/\/$/, "")}/admin/backup.tar`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
        credentials: "omit",
      });
      if (res.status === 401) throw new Error("The upload key was rejected.");
      if (!res.ok) throw new Error(`The image host answered ${res.status}.`);
      downloadFile(`signature-images-${new Date().toISOString().slice(0, 10)}.tar`, await res.blob());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Backup failed.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Settings"
      subtitle="Image hosting and backups."
      footer={
        <button className="btn primary" onClick={close}>
          Done
        </button>
      }
      testId="settings-dialog"
    >
      <SectionTitle>Image hosting</SectionTitle>
      <p className="hint" style={{ marginTop: -4 }}>
        Signature images must live on a public web address for Gmail to show them. This uses your own Cloudflare image Worker.
      </p>
      <TextField
        label="Host address"
        hint={ENV_HOST && !endpoint ? "using the built-in default" : undefined}
        placeholder={ENV_HOST || "https://images.example.com"}
        value={endpoint}
        onChange={setEndpoint}
        testId="host-endpoint"
      />
      <TextField label="Upload key" type="password" placeholder="The UPLOAD_KEY you set on the Worker" value={token} onChange={setToken} testId="host-token" />
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn sm" onClick={() => void test()} disabled={!!busy}>
          {busy === "test" ? <Loader2 size={14} className="spin" /> : <PlugZap size={14} />} Test connection
        </button>
        <button className="btn sm" onClick={() => void backup()} disabled={!!busy}>
          {busy === "backup" ? <Loader2 size={14} className="spin" /> : <Archive size={14} />} Download all hosted images
        </button>
      </div>
      <Toggle
        label="Host my signature images publicly"
        hint="Needed to add signatures to Gmail"
        checked={prefs.publishConsent}
        onChange={(v) => updatePrefs({ publishConsent: v })}
      />

      <SectionTitle>Your signatures</SectionTitle>
      <p className="hint" style={{ marginTop: -4 }}>
        Signatures are saved in this browser only. Export a backup to move them to another device.
      </p>
      <div className="row">
        <button className="btn sm" onClick={() => void exportAll().catch(() => toast("Export failed.", "error"))}>
          <Download size={14} /> Export backup
        </button>
        <button className="btn sm" onClick={() => file.current?.click()}>
          <Upload size={14} /> Import backup
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f)
              void importAll(f)
                .then((n) => toast(`Imported ${n} signature${n === 1 ? "" : "s"}`, "success"))
                .catch((err) => toast(err instanceof Error ? err.message : "Import failed.", "error"));
          }}
        />
      </div>
    </Modal>
  );
}
