import { requirePermission } from "@/lib/services/auth";
import { listSources } from "@/lib/services/ingestion";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { SourcesList } from "./SourcesList";

/**
 * The integrations index — every product source, and what its last run did.
 *
 * `product_sources` and the whole ingestion pipeline were built by `0005` and
 * `0006` two phases before anything wrote to them. This is the first screen to
 * read them.
 */
export default async function IntegrationsIndex() {
  const user = await requirePermission("integration.read");
  const sources = await listSources();

  return (
    <>
      <AdminPageHeader eyebrow="Commerce" title="Integrations">
        <p className="mt-2 text-[13px] text-mg-fg/60">
          Product feeds. A run stages what it finds for review — nothing reaches the catalogue until
          someone approves it, and an imported product arrives as a draft.
        </p>
      </AdminPageHeader>

      <SourcesList
        sources={sources.map((source) => ({
          id: source.id,
          name: source.name,
          kind: source.kind,
          enabled: source.enabled,
          lastStatus: source.last_status,
          lastSyncedAt: source.last_synced_at,
        }))}
        canWrite={user.permissions.has("integration.write")}
      />
    </>
  );
}
