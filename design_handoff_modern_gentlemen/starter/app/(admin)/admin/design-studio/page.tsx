import { requirePermission } from "@/lib/services/auth";
import { loadStudioPage } from "@/lib/services/studioPublishing";
import { DesignStudioShell } from "@/components/admin/DesignStudioShell";
import {
  saveStudioAction,
  loadStudioAction,
  previewStudioAction,
  publishStudioAction,
} from "./actions";

export default async function DesignStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await requirePermission("page.write");
  const { id } = await searchParams;
  const initial = id ? await loadStudioPage(id) : null;
  return (
    <DesignStudioShell
      initial={initial}
      actions={{
        save: saveStudioAction,
        load: loadStudioAction,
        preview: previewStudioAction,
        publish: publishStudioAction,
      }}
      canPublish={user.permissions.has("page.publish")}
      canPreview={user.permissions.has("preview.create")}
    />
  );
}
