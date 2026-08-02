import { requirePermission } from "@/lib/services/auth";
import { listAssets, listFolders } from "@/lib/services/media";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { MediaLibrary } from "@/components/admin/media/MediaLibrary";
import {
  assetUsagesAction,
  createFolderAction,
  deleteAssetAction,
  listAssetsAction,
  updateAssetAction,
  uploadAssetAction,
} from "./actions";

export default async function MediaIndex() {
  // The route's own gate. The layout proves the visitor is staff; this proves
  // they may read media specifically.
  const user = await requirePermission("media.read");

  const [{ assets, total }, folders] = await Promise.all([
    listAssets({ limit: 60 }),
    listFolders(),
  ]);

  return (
    <>
      <AdminPageHeader eyebrow="Content" title="Media">
        <p className="mt-2 text-[13px] text-mg-fg/50">
          Every image and clip the site uses, and what each one is used by.
        </p>
      </AdminPageHeader>

      <MediaLibrary
        initialAssets={assets}
        initialTotal={total}
        initialFolders={folders}
        canWrite={user.permissions.has("media.write")}
        canDelete={user.permissions.has("media.delete")}
        // Action *references*, not closures over them. A closure created in a
        // Server Component is an ordinary function, not a `"use server"`
        // reference, and Next refuses it at render — the bug that broke every
        // builder page load in Phase 4 and that no build or unit test caught.
        actions={{
          upload: uploadAssetAction,
          list: listAssetsAction,
          update: updateAssetAction,
          remove: deleteAssetAction,
          usages: assetUsagesAction,
          createFolder: createFolderAction,
        }}
      />
    </>
  );
}
