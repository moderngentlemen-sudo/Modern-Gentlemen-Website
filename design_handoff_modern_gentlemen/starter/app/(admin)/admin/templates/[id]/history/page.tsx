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

export default async function TemplateHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("revision.read");
  const template = await getDocument("template", id);
  if (!template) notFound();

  const [revisions, events] = await Promise.all([
    listHistory("template", id),
    listPublishEvents("template", id),
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow="History"
        title={template.title}
        actions={
          <Button href={`/admin/templates/${id}`} variant="outline" size="sm">
            Back to the builder
          </Button>
        }
      >
        <p className="mt-2 flex items-center gap-2 text-[13px] text-mg-fg/50">
          {/* A template's key is not a path, so this is plain text rather than a
              link to the public site. */}
          <span className="font-mono">{template.slug}</span>
          <StatusPill status={template.status} />
          <span className="font-mono">v{template.version}</span>
        </p>
      </AdminPageHeader>

      <HistoryView
        documentId={id}
        documentLabel="template"
        rollback={rollbackAction}
        revisions={revisions as RevisionRow[]}
        events={events as EventRow[]}
        canRestore={user.permissions.has("revision.restore")}
      />
    </>
  );
}
