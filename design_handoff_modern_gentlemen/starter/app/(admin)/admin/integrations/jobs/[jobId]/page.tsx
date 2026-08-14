import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getJob, getSource, listItems } from "@/lib/services/ingestion";
import type { FieldChange } from "@/lib/domain/ingestion";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/admin/ui/Button";
import { JobReview } from "./JobReview";

/**
 * One import run, and everything it proposed.
 *
 * Items are read whole here — including `raw_payload`, which is the feed's own
 * record. It is the only thing that answers "why did the mapping produce that?",
 * and a reviewer who has to open a second tab to find out will approve without
 * looking.
 */
export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  const user = await requirePermission("integration.read");
  const job = await getJob(jobId);
  if (!job) notFound();

  const [source, items] = await Promise.all([getSource(job.source_id), listItems(jobId)]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Import run"
        title={source ? source.name : "Import run"}
        actions={
          source ? (
            <Button href={`/admin/integrations/${source.id}`} variant="ghost" size="sm">
              Back to source
            </Button>
          ) : undefined
        }
      >
        <p className="mt-2 text-[13px] text-mg-fg/50">
          {job.total_count} records — {job.created_count} new, {job.updated_count} changed,{" "}
          {job.unchanged_count} unchanged, {job.failed_count} failed.
        </p>
      </AdminPageHeader>

      <div className="px-8 py-8">
        <JobReview
          jobId={job.id}
          status={job.status}
          errorSummary={job.error_summary}
          items={items.map((item) => ({
            id: item.id,
            externalId: item.external_id,
            action: item.action,
            status: item.status,
            error: item.error,
            productId: item.product_id,
            name: nameOf(item.normalised_payload),
            diff: (item.diff as FieldChange[] | null) ?? null,
            raw: JSON.stringify(item.raw_payload, null, 2),
          }))}
          canRun={user.permissions.has("integration.run")}
          canWriteProducts={user.permissions.has("product.write")}
        />
      </div>
    </>
  );
}

/** The staged product's name, for a row a reviewer can recognise. */
function nameOf(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "name" in payload) {
    const name = (payload as { name?: unknown }).name;
    return typeof name === "string" ? name : null;
  }
  return null;
}
