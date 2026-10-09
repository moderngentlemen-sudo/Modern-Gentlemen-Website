/**
 * The image library: every image uploaded on this device, newest first, so a
 * logo or headshot can be reused in another signature without finding the
 * file again. Metadata only; the images themselves are already in the asset store.
 */
import type { AssetMeta } from "../core/types";
import { libraryStore } from "../storage/db";

const MAX = 48;

export async function libraryList(): Promise<AssetMeta[]> {
  try {
    return await libraryStore.get();
  } catch {
    return [];
  }
}

export async function rememberImage(meta: AssetMeta): Promise<void> {
  try {
    const list = await libraryStore.get();
    const { origin: _origin, ...plain } = meta;
    await libraryStore.put([plain, ...list.filter((m) => m.hash !== meta.hash)].slice(0, MAX));
  } catch {
    /* a convenience only */
  }
}

export async function forgetImage(id: string): Promise<void> {
  try {
    await libraryStore.put((await libraryStore.get()).filter((m) => m.id !== id));
  } catch {
    /* a convenience only */
  }
}
