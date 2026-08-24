import { requirePermission } from "@/lib/services/auth";
import { getTheme, listThemeHistory, listThemePublishEvents } from "@/lib/services/theme";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/admin/ui/Button";
import { StatusPill } from "@/components/admin/ui/Badge";
import {
  HistoryView,
  type EventRow,
  type RevisionRow,
} from "@/components/admin/history/HistoryView";

import { rollbackThemeAction } from "../actions";

/**
 * The theme's history — the last document-shaped editor without one.
 *
 * **None of this is new data.** `0017` put `theme` on `document_table()`'s
 * allowlist so the palette could be published through `publish_document`, and
 * that function writes a `revisions` row and a `publish_events` row inside the
 * same transaction as every publish. Every theme publish since has been
 * recorded; there was simply no screen, so the one change with the widest blast
 * radius in the whole admin — the root layout's `<style>` block, which reaches
 * all 65 static pages plus the admin itself — was also the only one an editor
 * could not review or undo.
 *
 * `force-dynamic` matches `/admin/theme` next door: this reads the editor's own
 * session through RLS, and a cached copy of one editor's history is not a thing
 * to serve another.
 */
export const dynamic = "force-dynamic";

export default async function ThemeHistory() {
  const user = await requirePermission("revision.read");

  const [theme, revisions, events] = await Promise.all([
    getTheme(),
    listThemeHistory(),
    listThemePublishEvents(),
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow="History"
        title="Theme"
        actions={
          <Button href="/admin/theme" variant="outline" size="sm">
            Back to the theme
          </Button>
        }
      >
        <p className="mt-2 flex items-center gap-2 text-[13px] text-mg-fg/50">
          {/* The theme has no slug and no public path of its own — it is one row
              that every page renders through — so this carries the status and
              the version and nothing that looks like a link. */}
          <StatusPill status={theme.status} />
          <span className="font-mono">v{theme.version}</span>
        </p>
      </AdminPageHeader>

      <HistoryView
        documentId={theme.id}
        documentLabel="theme"
        rollback={rollbackThemeAction}
        revisions={revisions as RevisionRow[]}
        events={events as EventRow[]}
        canRestore={user.permissions.has("revision.restore")}
      />
    </>
  );
}
