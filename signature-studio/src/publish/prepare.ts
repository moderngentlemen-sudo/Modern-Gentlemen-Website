/**
 * Install readiness: derive → hash → publish → verify → render.
 * Copying is only enabled once every image is published and verified.
 */
import { create } from "zustand";
import { sha256Hex } from "../lib/hash";
import { TEST_HOST_ENABLED, isTestHostUrl } from "../lib/url";
import type { SignatureDoc, Variant } from "../core/types";
import { renderSignature, type ImageRequest } from "../render/render";
import { validateEmailHtml } from "../render/validate";
import { cardDataFromDoc, cardPageUrl, encodeCard } from "../core/digitalCard";
import { editSilently, useStudio } from "../store/editor";
import { derive } from "./derive";
import { hostFromConfig, verifyPublicImage } from "./host";
import { publishCard } from "../cloud/account";

export type ImageState = "waiting" | "working" | "ready" | "attention" | "failed";

export interface ImageStatus {
  key: string;
  label: string;
  state: ImageState;
  message?: string;
}

export const usePublish = create<{ statuses: Record<string, ImageStatus>; running: boolean }>(() => ({ statuses: {}, running: false }));

const setStatus = (s: ImageStatus) => usePublish.setState((st) => ({ statuses: { ...st.statuses, [s.key]: s } }));
const REVERIFY = 6 * 60 * 60 * 1000;

export function emailHtml(doc: SignatureDoc, variant: Variant) {
  const r = renderSignature(doc, { variant, mode: "email", resolve: (req) => doc.published[req.key]?.url ?? null });
  const problems = [...r.errors.map((m) => ({ level: "error" as const, message: m })), ...validateEmailHtml(r.html, { allowTestHost: TEST_HOST_ENABLED })];
  return { html: r.html, images: r.images, problems, ready: !problems.some((p) => p.level === "error") };
}

async function publishOne(req: ImageRequest, force: boolean): Promise<boolean> {
  const st = useStudio.getState();
  const doc = st.doc!;
  const base = { key: req.key, label: req.label };
  const cached = doc.published[req.key];
  if (cached && !force && Date.now() - cached.verifiedAt < REVERIFY) {
    setStatus({ ...base, state: "ready", message: isTestHostUrl(cached.url) ? "Ready on the local TEST host" : undefined });
    return true;
  }
  const host = hostFromConfig(st.prefs.host);
  if (!host) {
    setStatus({ ...base, state: "attention", message: "Image hosting isn't set up. Open Settings." });
    return false;
  }
  try {
    setStatus({ ...base, state: "working", message: "Preparing…" });
    const out = await derive(
      req,
      (id) => doc.assets[id]?.mime,
      (id) => doc.assets[id],
    );
    const hash = await sha256Hex(out.blob);
    setStatus({ ...base, state: "working", message: "Publishing…" });
    const url = await host.publish(`s/${hash}.${out.ext}`, out.blob, out.mime);
    setStatus({ ...base, state: "working", message: "Checking it's public…" });
    const v = await verifyPublicImage(url);
    if (!v.ok) {
      setStatus({ ...base, state: "failed", message: v.message });
      return false;
    }
    editSilently((d) => void (d.published[req.key] = { url, hash, verifiedAt: Date.now() }));
    setStatus({ ...base, state: "ready", message: isTestHostUrl(url) ? "Ready on the local TEST host" : undefined });
    return true;
  } catch (err) {
    setStatus({ ...base, state: "failed", message: err instanceof Error ? err.message : "Something went wrong." });
    return false;
  }
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<unknown>) {
  const q = [...items];
  await Promise.all(
    Array.from({ length: Math.min(n, q.length) }, async () => {
      while (q.length) await fn(q.shift()!);
    }),
  );
}

/** Publish the digital card's own images and compute its public link. */
async function prepareDigitalCard(force: boolean) {
  const doc = useStudio.getState().doc!;
  const card = doc.card;
  const wanted = card.digitalLink || card.hotspots.some((h) => h.action === "digital-card");
  if (!card.enabled || !wanted || !card.assetId || !doc.assets[card.assetId]) return;
  const full = (assetId: string, label: string): ImageRequest => {
    const m = doc.assets[assetId];
    const w = Math.min(m.width, 1050);
    const h = Math.round((w * m.height) / m.width);
    return {
      kind: "crop",
      key: `crop|${m.hash}|${w}x${h}|full`,
      label,
      assetId,
      w: Math.round(w / 2),
      h: Math.round(h / 2),
      rect: { sx: 0, sy: 0, sw: m.width, sh: m.height },
      shape: "square",
      radius: 0,
    };
  };
  const reqs = [full(card.assetId, "Digital card (front)")];
  if (card.backAssetId && doc.assets[card.backAssetId]) reqs.push(full(card.backAssetId, "Digital card (back)"));
  const photo = doc.images.photo.assetId && doc.assets[doc.images.photo.assetId] ? doc.images.photo : null;
  if (photo) {
    const m = doc.assets[photo.assetId!];
    const side = Math.min(m.width, m.height);
    reqs.push({
      kind: "crop",
      key: `crop|${m.hash}|160x160|card-photo`,
      label: "Digital card photo",
      assetId: photo.assetId!,
      w: 160,
      h: 160,
      rect: { sx: (m.width - side) / 2, sy: (m.height - side) / 2, sw: side, sh: side },
      shape: "circle",
      radius: 0,
    });
  }
  for (const r of reqs) await publishOne(r, force);
  const now = useStudio.getState().doc!;
  const url = (r?: ImageRequest) => (r ? now.published[r.key]?.url : undefined);
  if (!url(reqs[0])) return;
  const images = { front: url(reqs[0]), back: card.backAssetId ? url(reqs[1]) : undefined, photo: photo ? url(reqs[reqs.length - 1]) : undefined };
  // Signed in: a short link whose card updates with the signature. Otherwise the card lives in the link itself.
  const short = await publishCard(now, images).catch(() => null);
  const link = short ?? cardPageUrl(location.origin, "/", await encodeCard(cardDataFromDoc(now, images)));
  const slug = short ? short.split("/c/")[1] : undefined;
  if (link !== now.digitalCardUrl || slug !== now.cardSlug)
    editSilently((d) => {
      d.digitalCardUrl = link;
      d.cardSlug = slug;
      d.cardImages = images;
    });
}

export async function prepareAll(variants: Variant[], force = false) {
  usePublish.setState({ running: true, statuses: {} });
  try {
    await prepareDigitalCard(force);
    const doc = useStudio.getState().doc!;
    const reqs = new Map<string, ImageRequest>();
    for (const v of variants) for (const r of renderSignature(doc, { variant: v, mode: "email", resolve: () => null }).images) reqs.set(r.key, r);
    await pool([...reqs.values()], 3, (r) => publishOne(r, force));
  } finally {
    usePublish.setState({ running: false });
  }
}
