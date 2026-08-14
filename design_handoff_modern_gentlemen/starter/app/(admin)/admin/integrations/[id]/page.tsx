import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/services/auth";
import { getSource, listJobs, listMappings } from "@/lib/services/ingestion";
import { xmlFeedConfigSchema } from "@/lib/domain/ingestion";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Button } from "@/components/admin/ui/Button";
import { SourceEditor } from "./SourceEditor";

/**
 * One source: how it is configured, how its fields map onto ours, and what its
 * last twenty runs did.
 *
 * The config is parsed here rather than in the client component so a row saved
 * before a schema change still renders — `safeParse` falls back to the defaults
 * and the operator can re-save, where a throw would leave them with a screen
 * they cannot use to fix the thing that broke it.
 */
export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await requirePermission("integration.read");
  const source = await getSource(id);
  if (!source) notFound();

  const [mappings, jobs] = await Promise.all([listMappings(id), listJobs(id)]);

  const parsedConfig = xmlFeedConfigSchema.safeParse(source.config);
  const config = parsedConfig.success
    ? parsedConfig.data
    : {
        url: "",
        item_path: "",
        fulfilment: "direct" as const,
        currency: "GBP",
        timeout_ms: 30_000,
      };

  return (
    <>
      <AdminPageHeader
        eyebrow="Integrations"
        title={source.name}
        actions={
          <Button href="/admin/integrations" variant="ghost" size="sm">
            All sources
          </Button>
        }
      >
        <p className="mt-2 text-[13px] text-mg-fg/50">
          {source.kind === "xml_feed"
            ? "An XML feed. Map its fields onto ours, then run it — everything it finds is staged for review."
            : `A ${source.kind} source.`}
        </p>
      </AdminPageHeader>

      <div className="px-8 py-8">
        <SourceEditor
          source={{
            id: source.id,
            name: source.name,
            kind: source.kind,
            enabled: source.enabled,
            credentialsRef: source.credentials_ref,
            configValid: parsedConfig.success,
            url: config.url,
            itemPath: config.item_path,
            fulfilment: config.fulfilment,
            currency: config.currency,
          }}
          mappings={mappings.map((mapping) => ({
            target_field: mapping.target_field,
            source_path: mapping.source_path,
            transform: mapping.transform,
            fallback: mapping.fallback,
            is_required: mapping.is_required,
          }))}
          jobs={jobs.map((job) => ({
            id: job.id,
            status: job.status,
            total: job.total_count,
            created: job.created_count,
            updated: job.updated_count,
            unchanged: job.unchanged_count,
            failed: job.failed_count,
            errorSummary: job.error_summary,
            createdAt: job.created_at,
          }))}
          canWrite={user.permissions.has("integration.write")}
          canRun={user.permissions.has("integration.run")}
        />
      </div>
    </>
  );
}
