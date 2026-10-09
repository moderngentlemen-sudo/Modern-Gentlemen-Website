/** Seasonal & promotional banner library: pick one, adjust the words, and it becomes an image. */
import { useEffect, useMemo, useState } from "react";
import { bannerSvg, bannersFor, type BannerSpec } from "../core/seasonal";
import { findBlock } from "../core/blocks";
import { ingestFile, UploadError } from "../store/assets";
import { edit, toast, tree, ui, useStudio } from "../store/editor";
import { Modal, TextField, Toggle } from "../ui/kit";

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function BannerDialog() {
  const open = useStudio((s) => s.dialog === "banners");
  const target = useStudio((s) => s.dialogArg);
  const accent = useStudio((s) => s.doc?.design.accent);
  const [headline, setHeadline] = useState("");
  const [sub, setSub] = useState("");
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const list = useMemo(() => bannersFor(), []);
  useEffect(() => {
    if (open) {
      setHeadline("");
      setSub("");
    }
  }, [open]);
  const close = () => ui({ dialog: null, dialogArg: null });
  const opts = () => ({ headline: headline.trim() || undefined, sub: sub.trim() || undefined, accent: mine ? accent : undefined });

  const pick = async (b: BannerSpec) => {
    setBusy(b.id);
    try {
      const o = opts();
      const svg = bannerSvg(b, o);
      const meta = await ingestFile(new Blob([svg], { type: "image/svg+xml" }), `banner-${b.id}.png`);
      const alt = `${o.headline ?? b.headline} — ${o.sub ?? b.sub}`;
      edit((d) => {
        d.assets[meta.id] = meta;
        if (target === "addon") {
          Object.assign(d.addons.banner, { enabled: true, assetId: meta.id, alt });
          return;
        }
        const root = tree(d);
        const hit = target?.startsWith("block:") ? findBlock(root, target.slice(6)) : null;
        if (hit && hit.block.type === "image") {
          Object.assign(hit.block, { assetId: meta.id, alt, width: Math.min(600, d.design.width) });
        }
      });
      toast(`Added the “${b.label}” banner`, "success");
      close();
    } catch (e) {
      toast(e instanceof UploadError ? e.message : "That banner couldn't be made.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Banner library"
      subtitle="Seasonal and promotional banners. Change the words, then pick one."
      wide
      testId="banner-dialog"
    >
      <div className="banner-form">
        <TextField label="Headline" hint="optional" placeholder="Keep each banner's own" value={headline} onChange={setHeadline} testId="banner-headline" />
        <TextField label="Second line" hint="optional" placeholder="Keep each banner's own" value={sub} onChange={setSub} />
        <Toggle label="Use my accent colour" checked={mine} onChange={setMine} />
      </div>
      <div className="banner-grid">
        {list.map((b) => (
          <button
            key={b.id}
            className="banner-pick"
            onClick={() => void pick(b)}
            disabled={!!busy}
            data-testid={`banner-${b.id}`}
            aria-label={`Use the ${b.label} banner`}
          >
            <img src={svgUrl(bannerSvg(b, opts()))} alt="" width={300} height={75} />
            <span>{busy === b.id ? "Adding…" : b.label}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
