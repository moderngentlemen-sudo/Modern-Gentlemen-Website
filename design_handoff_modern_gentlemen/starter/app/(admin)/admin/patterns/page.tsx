import { requirePermission } from "@/lib/services/auth";
import { listDocuments } from "@/lib/services/documents";
import { listPatternCategories, listPatterns } from "@/lib/services/patterns";
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
  const documents = await listDocuments("pattern", { limit: 100 });

  // Two reads because the two halves live in different vocabularies, and the
  // comment above says why. `listDocuments` gives the generic document shape the
  // list and the shared builder run on; `listPatterns` gives the columns only a
  // pattern has — `description` and `category_id`, which nothing collected until
  // now. Merged by id rather than joined in SQL: the document repository's
  // aliasing is what makes a pattern interchangeable with a page everywhere
  // else, and widening its select for two pattern-only columns would give that
  // up for one screen.
  const details = new Map((await listPatterns()).map((row) => [row.id, row]));
  const categories = await listPatternCategories();

  const patterns = documents.map((doc) => ({
    ...doc,
    description: details.get(doc.id)?.description ?? null,
    categoryId: details.get(doc.id)?.category_id ?? null,
  }));

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
        categories={categories.map((c) => ({ value: c.id, label: c.label }))}
        canWrite={user.permissions.has("pattern.write")}
        canDelete={user.permissions.has("pattern.delete")}
      />
    </>
  );
}
