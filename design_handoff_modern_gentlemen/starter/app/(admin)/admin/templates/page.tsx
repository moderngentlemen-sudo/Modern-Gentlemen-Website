import { requirePermission } from "@/lib/services/auth";
import { listTemplates } from "@/lib/services/templates";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { TemplatesList, type TemplateRow } from "./TemplatesList";

export default async function TemplatesIndex() {
  // The route's own gate. The layout proves the visitor is staff; this proves
  // they may read templates specifically.
  const user = await requirePermission("template.read");

  // Read through `lib/services/templates` rather than the generic document
  // service the patterns list uses. A template's `kind` decides what it is a
  // layout *for*, and the polymorphic repository does not select it — the list
  // would be a column short for the sake of sharing a function.
  const templates = await listTemplates();

  return (
    <>
      <AdminPageHeader eyebrow="Content" title="Templates">
        <p className="mt-2 max-w-[70ch] text-[13px] text-mg-fg/50">
          A template is a layout made of named <strong className="font-medium">areas</strong>, each
          one its own block tree, composed in the same builder as a page.
        </p>
      </AdminPageHeader>

      <TemplatesList
        templates={templates as TemplateRow[]}
        canWrite={user.permissions.has("template.write")}
        canDelete={user.permissions.has("template.delete")}
      />
    </>
  );
}
