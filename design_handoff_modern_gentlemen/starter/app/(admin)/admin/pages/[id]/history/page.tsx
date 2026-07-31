import { notFound } from "next/navigation";
import Link from "next/link";

import { requirePermission } from "@/lib/services/auth";
import { getDocument } from "@/lib/services/documents";
import { listHistory, listPublishEvents } from "@/lib/services/revisions";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/admin/ui/Button";
import { StatusPill } from "@/components/admin/ui/Badge";

import { HistoryView, type EventRow, type RevisionRow } from "./HistoryView";

export default async function PageHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("revision.read");
  const page = await getDocument("page", id);
  if (!page) notFound();

  const [revisions, events] = await Promise.all([
    listHistory("page", id),
    listPublishEvents("page", id),
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow="History"
        title={page.title}
        actions={
          <Button href={`/admin/pages/${id}`} variant="outline" size="sm">
            Back to the builder
          </Button>
        }
      >
        <p className="mt-2 flex items-center gap-2 text-[13px] text-mg-fg/50">
          <Link href={`/admin/pages/${id}`} className="font-mono hover:text-mg-accent">
            /{page.slug}
          </Link>
          <StatusPill status={page.status} />
          <span className="font-mono">v{page.version}</span>
        </p>
      </AdminPageHeader>

      <HistoryView
        pageId={id}
        revisions={revisions as RevisionRow[]}
        events={events as EventRow[]}
        canRestore={user.permissions.has("revision.restore")}
      />
    </>
  );
}
