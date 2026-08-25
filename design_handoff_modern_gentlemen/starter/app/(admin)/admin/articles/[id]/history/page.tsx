import { notFound } from "next/navigation";
import Link from "next/link";

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

/**
 * Article history — the same screen pages get, from the same polymorphic
 * `revisions` and `publish_events` tables. Only the rollback action differs,
 * and it differs solely in the document type it names.
 */
export default async function ArticleHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("revision.read");
  const article = await getDocument("article", id);
  if (!article) notFound();

  const [revisions, events] = await Promise.all([
    listHistory("article", id),
    listPublishEvents("article", id),
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow="History"
        title={article.title}
        actions={
          <Button href={`/admin/articles/${id}`} variant="outline" size="sm">
            Back to the article
          </Button>
        }
      >
        <p className="mt-2 flex items-center gap-2 text-[13px] text-mg-fg/50">
          <Link href={`/admin/articles/${id}`} className="font-mono hover:text-mg-accentInk">
            /article/{article.slug}
          </Link>
          <StatusPill status={article.status} />
          <span className="font-mono">v{article.version}</span>
        </p>
      </AdminPageHeader>

      <HistoryView
        documentId={id}
        documentLabel="article"
        rollback={rollbackAction}
        revisions={revisions as RevisionRow[]}
        events={events as EventRow[]}
        canRestore={user.permissions.has("revision.restore")}
      />
    </>
  );
}
