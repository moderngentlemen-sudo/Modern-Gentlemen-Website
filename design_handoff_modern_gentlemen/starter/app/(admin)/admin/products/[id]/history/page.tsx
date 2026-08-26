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
 * Product history — the same screen pages and articles get, from the same
 * polymorphic `revisions` and `publish_events` tables. Only the rollback action
 * differs, and it differs solely in the document type it names. `HistoryView`
 * was generalised for exactly this in Phase 5b and needed nothing further.
 *
 * Worth naming what rollback restores here: the block tree and the `seo` block
 * of `draft_data`, not the price. A product's commerce columns live outside the
 * document payload, so rolling back to v3 does not un-do a price change — the
 * details form is the only thing that writes those, and they have no history.
 */
export default async function ProductHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("revision.read");
  const product = await getDocument("product", id);
  if (!product) notFound();

  const [revisions, events] = await Promise.all([
    listHistory("product", id),
    listPublishEvents("product", id),
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow="History"
        title={product.title}
        actions={
          <Button href={`/admin/products/${id}`} variant="outline" size="sm">
            Back to the product
          </Button>
        }
      >
        <p className="mt-2 flex items-center gap-2 text-[13px] text-mg-fg/60">
          <Link href={`/admin/products/${id}`} className="font-mono hover:text-mg-accentInk">
            /product/{product.slug}
          </Link>
          <StatusPill status={product.status} />
          <span className="font-mono">v{product.version}</span>
        </p>
      </AdminPageHeader>

      <HistoryView
        documentId={id}
        documentLabel="product"
        rollback={rollbackAction}
        revisions={revisions as RevisionRow[]}
        events={events as EventRow[]}
        canRestore={user.permissions.has("revision.restore")}
      />
    </>
  );
}
