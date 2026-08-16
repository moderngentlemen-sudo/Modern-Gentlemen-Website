import { requirePermission } from "@/lib/services/auth";
import { listDocuments } from "@/lib/services/documents";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { PatternsList, type PatternRow } from "./PatternsList";

export default async function PatternsIndex() {
  // The route's own gate. The layout proves the visitor is staff; this proves
  // they may read patterns specifically.
  const user = await requirePermission("pattern.read");

  // Read through the generic document repository rather than
  // `lib/services/patterns.listPatterns`: it aliases `name`→`title` and
  // `key`→`slug`, which is what lets this list and the shared builder treat a
  // pattern exactly like a page. The pattern-specific service is for the
  // columns only it has (`sync_mode`, `category_id`).
  const patterns = await listDocuments("pattern", { limit: 100 });

  return (
    <>
      <AdminPageHeader eyebrow="Content" title="Patterns">
        <p className="mt-2 text-[13px] text-mg-fg/50">
          A pattern is a saved group of sections, composed in the same builder as a page. Inserting
          one copies its blocks into the page.
        </p>
      </AdminPageHeader>

      <PatternsList
        patterns={patterns as PatternRow[]}
        canWrite={user.permissions.has("pattern.write")}
        canDelete={user.permissions.has("pattern.delete")}
      />
    </>
  );
}
