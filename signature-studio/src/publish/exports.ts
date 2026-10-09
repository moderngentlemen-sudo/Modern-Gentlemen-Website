/**
 * Exports beyond the email itself: a crisp PNG of the signature (for a
 * website, LinkedIn or a slide) and a print-ready business card sheet.
 */
import type { SignatureDoc } from "../core/types";
import { downloadFile, safeFileName } from "../lib/download";
import { esc } from "../lib/escape";
import { renderSignature } from "../render/render";
import { assetStore } from "../storage/db";
import { blobToDataUrl } from "../store/assets";
import { previewSource } from "../ui/samples";

/** The signature as a 2× PNG on white. */
export async function exportPng(doc: SignatureDoc): Promise<void> {
  const html = renderSignature(doc, { variant: "full", mode: "preview", sourceUrl: previewSource }).html;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;padding:24px;background:#ffffff;display:inline-block;";
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    await Promise.all(
      [...host.querySelectorAll("img")].map((img) => (img.complete ? Promise.resolve() : new Promise((r) => ((img.onload = r), (img.onerror = r))))),
    );
    await document.fonts.ready;
    const { toPng } = await import("html-to-image");
    let url: string;
    try {
      url = await toPng(host, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: false });
    } catch {
      // Webfonts that can't be inlined (network/CORS): fall back to system fonts.
      url = await toPng(host, { pixelRatio: 2, backgroundColor: "#ffffff", skipFonts: true });
    }
    const blob = await (await fetch(url)).blob();
    downloadFile(`${safeFileName(doc.name)}.png`, blob);
  } finally {
    host.remove();
  }
}

/**
 * A print sheet for the business card: the front (and back) at the standard
 * 3.5 × 2 in size with crop marks, opened in the browser's print dialog —
 * choose "Save as PDF" for a file, or print directly.
 */
export async function printCard(doc: SignatureDoc): Promise<boolean> {
  const card = doc.card;
  if (!card.assetId) return false;
  const load = async (id?: string) => {
    if (!id) return null;
    const blob = await assetStore.get(id);
    return blob ? blobToDataUrl(blob) : null;
  };
  const [front, back] = await Promise.all([load(card.assetId), load(card.backAssetId)]);
  if (!front) return false;
  const meta = doc.assets[card.assetId];
  const landscape = !meta || meta.width >= meta.height;
  const w = landscape ? "3.5in" : "2in";
  const h = landscape ? "2in" : "3.5in";
  const face = (src: string, label: string) => `
    <figure>
      <div class="card" style="width:${w};height:${h}">
        <img src="${src}" alt="${label}">
        <i class="m tl"></i><i class="m tr"></i><i class="m bl"></i><i class="m br"></i>
      </div>
      <figcaption>${label} · ${landscape ? "3.5 × 2 in (88.9 × 50.8 mm)" : "2 × 3.5 in"}</figcaption>
    </figure>`;
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.name)} – business card</title>
<style>
  @page { size: letter; margin: 0.6in; }
  body { font: 11px system-ui, sans-serif; color: #555; margin: 0; }
  h1 { font-size: 13px; color: #15131a; margin: 0 0 4px; }
  p { margin: 0 0 24px; }
  .sheet { display: flex; flex-wrap: wrap; gap: 0.6in; }
  figure { margin: 0; }
  .card { position: relative; }
  .card img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .m { position: absolute; width: 0.25in; height: 0.25in; border: 0 solid #000; }
  .tl { left: -0.3in; top: -0.3in; border-right-width: 0.5px; border-bottom-width: 0.5px; }
  .tr { right: -0.3in; top: -0.3in; border-left-width: 0.5px; border-bottom-width: 0.5px; }
  .bl { left: -0.3in; bottom: -0.3in; border-right-width: 0.5px; border-top-width: 0.5px; }
  .br { right: -0.3in; bottom: -0.3in; border-left-width: 0.5px; border-top-width: 0.5px; }
  figcaption { margin-top: 0.35in; }
</style></head><body>
<h1>${esc(doc.name)}</h1>
<p>Print at 100% (no “fit to page”). For a print shop, choose “Save as PDF”. Crop marks show the trim edge.</p>
<div class="sheet">${face(front, "Front")}${back ? face(back, "Back") : ""}</div>
<script>window.addEventListener("load", () => setTimeout(() => window.print(), 300));</script>
</body></html>`;
  const win = window.open("", "_blank");
  if (!win) {
    // Pop-ups blocked: download the sheet instead.
    downloadFile(`${safeFileName(doc.name)}-card.html`, page, "text/html");
    return true;
  }
  win.document.open();
  win.document.write(page);
  win.document.close();
  return true;
}
