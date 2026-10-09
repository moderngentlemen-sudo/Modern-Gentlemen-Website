/**
 * One way to read and write any picture in a signature — the shared headshot
 * and logo, or an image block — so the image inspector and the image editor
 * work the same everywhere.
 */
import { findBlock } from "../core/blocks";
import type { FrameShape, ImageLook } from "../core/imageLook";
import type { AssetMeta, ImageShape, SignatureDoc } from "../core/types";
import { edit, tree } from "../store/editor";

/** "photo", "logo" or "block:<id>". */
export type ImageArg = string;
type Crop = { x: number; y: number; zoom: number };

export interface ImageTarget {
  kind: "photo" | "logo" | "image";
  assetId?: string;
  crop: Crop;
  aspect?: number;
  /** Photos are always square. */
  fixedAspect?: number;
  look: ImageLook;
  frame: FrameShape;
  /** Display width in px. */
  width: number;
  title: string;
}

const legacyOf = (f: FrameShape): ImageShape => (f === "circle" ? "circle" : f === "square" ? "square" : "rounded");

export function readImage(doc: SignatureDoc, arg: ImageArg): ImageTarget | null {
  if (arg === "photo" || arg === "logo") {
    const slot = doc.images[arg];
    return {
      kind: arg,
      assetId: slot.assetId,
      crop: slot.crop,
      aspect: slot.aspect,
      fixedAspect: arg === "photo" ? 1 : undefined,
      look: slot.look ?? {},
      frame: slot.look?.frame ?? slot.shape,
      width: slot.size,
      title: arg === "photo" ? "Edit photo" : "Edit logo",
    };
  }
  const id = arg.replace(/^block:/, "");
  const hit = tree(doc) ? findBlock(tree(doc), id) : null;
  if (!hit || hit.block.type !== "image") return null;
  const b = hit.block;
  return {
    kind: "image",
    assetId: b.assetId,
    crop: b.crop ?? { x: 0, y: 0, zoom: 1 },
    aspect: b.aspect,
    look: b.look ?? {},
    frame: b.look?.frame ?? (b.radius ? "rounded" : "square"),
    width: b.width,
    title: "Edit image",
  };
}

export interface ImagePatch {
  crop?: Partial<Crop>;
  aspect?: number | null;
  /** Merged into the look; `undefined` values remove a setting. */
  look?: Partial<ImageLook>;
  /** Replace the picture (the asset must be added to `meta` or already be in the signature). */
  asset?: AssetMeta;
  remove?: boolean;
}

export function writeImage(arg: ImageArg, patch: ImagePatch, key?: string) {
  edit(
    (d) => {
      if (patch.asset) d.assets[patch.asset.id] = patch.asset;
      const apply = (o: { crop?: Crop; aspect?: number; look?: ImageLook; assetId?: string }) => {
        if (patch.crop) o.crop = { ...(o.crop ?? { x: 0, y: 0, zoom: 1 }), ...patch.crop };
        if (patch.aspect !== undefined) o.aspect = patch.aspect ?? undefined;
        if (patch.asset) o.assetId = patch.asset.id;
        if (patch.remove) o.assetId = undefined;
        if (patch.look) {
          const next: ImageLook = { ...o.look, ...patch.look };
          for (const k of Object.keys(next) as (keyof ImageLook)[]) if (next[k] === undefined) delete next[k];
          o.look = Object.keys(next).length ? next : undefined;
        }
      };
      if (arg === "photo" || arg === "logo") {
        const slot = d.images[arg];
        apply(slot);
        // Quick-mode templates only know three shapes; keep the closest one in step.
        if (patch.look && "frame" in patch.look) slot.shape = legacyOf(patch.look.frame ?? "square");
      } else {
        const hit = tree(d) ? findBlock(tree(d), arg.replace(/^block:/, "")) : null;
        if (hit && hit.block.type === "image") {
          apply(hit.block);
          if (patch.look && "frame" in patch.look) delete hit.block.radius;
          if (patch.asset && !patch.remove && hit.block.width > patch.asset.width) hit.block.width = Math.min(patch.asset.width, 480);
        }
      }
    },
    key ? `img.${arg}.${key}` : undefined,
  );
}
