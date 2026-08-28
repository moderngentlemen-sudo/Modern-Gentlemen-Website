import { notFound } from "next/navigation";
import Link from "next/link";

import { requirePermission } from "@/lib/services/auth";
import { getDocument } from "@/lib/services/documents";
import { listHistory, listPublishEvents } from "@/lib/services/revisions";
import { publicPathForCategory } from "@/lib/domain/routes";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/admin/ui/Button";
import { StatusPill } from "@/components/admin/ui/Badge";

import {
  HistoryView,
  type EventRow,
  type RevisionRow,
} from "@/components/admin/history/HistoryView";

import { rollbackAction } from "../actions";

export default async function CategoryHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("revision.read");
  const category = await getDocument("category", id);
  if (!category) notFound();

  const [revisions, events] = await Promise.all([
    listHistory("category", id),
    listPublishEvents("category", id),
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow="History"
        title={category.title}
        actions={
          <Button href={`/admin/categories/${id}`} variant="outline" size="sm">
            Back to the builder
          </Button>
        }
      >
        <p className="mt-2 flex items-center gap-2 text-[13px] text-mg-fg/60">
          {/* Unlike a pattern, a category *is* a public path — one segment deep,
              not nested under /category. See `publicPathForCategory`. */}
          <Link
            href={publicPathForCategory(category.slug)}
            className="font-mono hover:text-mg-accentInk"
          >
            {publicPathForCategory(category.slug)}
          </Link>
          <StatusPill status={category.status} />
          <span className="font-mono">v{category.version}</span>
        </p>
      </AdminPageHeader>

      <HistoryView
        documentId={id}
        documentLabel="category"
        rollback={rollbackAction}
        revisions={revisions as RevisionRow[]}
        events={events as EventRow[]}
        canRestore={user.permissions.has("revision.restore")}
      />
    </>
  );
}
