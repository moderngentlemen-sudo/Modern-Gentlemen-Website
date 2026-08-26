import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getDocument } from "@/lib/services/documents";
import { listHistory, listPublishEvents } from "@/lib/services/revisions";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/admin/ui/Button";
import { StatusPill } from "@/components/admin/ui/Badge";

import {
  HistoryView,
  type EventRow,
  type RevisionRow,
} from "@/components/admin/history/HistoryView";

import { rollbackAction } from "../actions";

export default async function PatternHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("revision.read");
  const pattern = await getDocument("pattern", id);
  if (!pattern) notFound();

  const [revisions, events] = await Promise.all([
    listHistory("pattern", id),
    listPublishEvents("pattern", id),
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow="History"
        title={pattern.title}
        actions={
          <Button href={`/admin/patterns/${id}`} variant="outline" size="sm">
            Back to the builder
          </Button>
        }
      >
        <p className="mt-2 flex items-center gap-2 text-[13px] text-mg-fg/60">
          {/* A pattern's key is not a path, so unlike the page header this is
              plain text rather than a link to the public site. */}
          <span className="font-mono">{pattern.slug}</span>
          <StatusPill status={pattern.status} />
          <span className="font-mono">v{pattern.version}</span>
        </p>
      </AdminPageHeader>

      <HistoryView
        documentId={id}
        documentLabel="pattern"
        rollback={rollbackAction}
        revisions={revisions as RevisionRow[]}
        events={events as EventRow[]}
        canRestore={user.permissions.has("revision.restore")}
      />
    </>
  );
}
