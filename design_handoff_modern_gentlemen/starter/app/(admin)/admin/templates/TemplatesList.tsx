"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { TextInput } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { Panel } from "@/components/admin/ui/Panel";
import { StatusPill } from "@/components/admin/ui/Badge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Table, Td, Th } from "@/components/admin/ui/Table";
import { useToast } from "@/components/admin/ui/Toast";
import { areaNamesOf } from "@/lib/blocks/areas";
import {
  TEMPLATE_KINDS,
  TEMPLATE_KIND_DESCRIPTION,
  type TemplateKind,
} from "@/lib/domain/templates";
import type { DocumentStatus } from "@/lib/domain/documents";

import {
  assignTemplateAction,
  createTemplateAction,
  deleteTemplateAction,
  renameTemplateAction,
} from "./actions";

/**
 * What a template may be assigned to, and what it is assigned to now.
 *
 * Computed on the server — a client component cannot read the database, and the
 * picker needs to know which targets another template already claims so it can
 * say who it would displace rather than failing on a unique index afterwards.
 */
export interface Assignable {
  id: string;
  targets: { value: string; label: string; heldBy: { id: string; name: string } | null }[];
  current: string[];
}

/** "Applies to" for a row, in words. `—` when nothing, which is the default. */
function assignmentLabel(assignable: Assignable | undefined): string {
  if (!assignable) return "—";
  if (assignable.targets.length === 0) return "not rendered yet";
  if (assignable.current.length === 0) return "—";

  const labels = assignable.current.map(
    (value) => assignable.targets.find((t) => t.value === value)?.label ?? value
  );
  return labels.join(", ");
}

/**
 * A template as the repository returns it — its own column names, unlike the
 * pattern list's aliased row, because `kind` has no equivalent on a page and
 * the generic document repository does not select it.
 */
export interface TemplateRow {
  id: string;
  key: string;
  kind: TemplateKind;
  name: string;
  status: DocumentStatus;
  version: number;
  updated_at: string;
  draft_data: unknown;
}

/** `Editorial Layout` → `editorial-layout`, matching the key rule the action enforces. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const KIND_OPTIONS = TEMPLATE_KINDS.map((kind) => ({ value: kind, label: kind }));

export function TemplatesList({
  templates,
  assignable,
  canWrite,
  canDelete,
}: {
  templates: TemplateRow[];
  assignable: Assignable[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [kind, setKind] = useState<TemplateKind>("page");
  const [keyTouched, setKeyTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<TemplateRow | null>(null);

  const [assigning, setAssigning] = useState<TemplateRow | null>(null);
  // `""` is "applies to nothing" — the select needs a value for that option and
  // `null` is not one, so it is translated at the boundary rather than carried
  // through the form as a magic string.
  const [assignTarget, setAssignTarget] = useState("");

  const assignmentFor = (id: string) => assignable.find((row) => row.id === id);

  function openAssign(template: TemplateRow) {
    setError(undefined);
    setAssignTarget(assignmentFor(template.id)?.current[0] ?? "");
    setAssigning(template);
  }

  function assign() {
    if (!assigning) return;
    setError(undefined);
    startTransition(async () => {
      const result = await assignTemplateAction({
        id: assigning.id,
        target: assignTarget === "" ? null : assignTarget,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAssigning(null);
      toast.push(
        result.data.paths === 0
          ? "Assignment saved — no published page uses it yet"
          : `Assignment saved — ${result.data.paths} page${result.data.paths === 1 ? "" : "s"} refreshed`,
        "success"
      );
      router.refresh();
    });
  }

  // Renaming opens holding what is there rather than empty — the create
  // dialog's slugify-as-you-type would be wrong here, since changing a name
  // must not silently move a key an editor has already used elsewhere.
  const [renaming, setRenaming] = useState<TemplateRow | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameKey, setRenameKey] = useState("");

  function openRename(template: TemplateRow) {
    setError(undefined);
    setRenameName(template.name);
    setRenameKey(template.key);
    setRenaming(template);
  }

  function rename() {
    if (!renaming) return;
    setError(undefined);
    startTransition(async () => {
      const result = await renameTemplateAction({
        id: renaming.id,
        name: renameName,
        key: renameKey,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRenaming(null);
      toast.push("Template renamed", "success");
      router.refresh();
    });
  }

  function create() {
    setError(undefined);
    startTransition(async () => {
      const result = await createTemplateAction({ name, key: key || slugify(name), kind });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreating(false);
      setName("");
      setKey("");
      setKeyTouched(false);
      toast.push("Template created", "success");
      router.push(`/admin/templates/${result.data.id}`);
    });
  }

  function remove(template: TemplateRow) {
    startTransition(async () => {
      const result = await deleteTemplateAction({ id: template.id });
      setConfirmDelete(null);
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push(`Deleted “${template.name}”`, "success");
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="px-8 py-8">
        {canWrite && (
          <div className="mb-4 flex justify-end">
            <Button variant="solid" onClick={() => setCreating(true)}>
              New template
            </Button>
          </div>
        )}

        <Panel>
          {templates.length === 0 ? (
            <EmptyState
              eyebrow="Templates"
              title="No templates yet"
              action={
                canWrite ? (
                  <Button variant="solid" onClick={() => setCreating(true)}>
                    Create the first template
                  </Button>
                ) : undefined
              }
            >
              A template is a layout built from named areas — a header, a main column, a footer —
              each one its own block tree. Create one, then compose its areas in the builder.
            </EmptyState>
          ) : (
            <Table caption="All templates">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Key</Th>
                  <Th>Kind</Th>
                  <Th>Areas</Th>
                  <Th>Applies to</Th>
                  <Th>Status</Th>
                  <Th>Version</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => {
                  const areas = areaNamesOf(template.draft_data);
                  return (
                    <tr key={template.id} className="hover:bg-mg-fg/[0.02]">
                      <Td>
                        <Link
                          href={`/admin/templates/${template.id}`}
                          className="font-medium hover:text-mg-accentInk"
                        >
                          {template.name}
                        </Link>
                      </Td>
                      <Td className="font-mono text-[12px] text-mg-fg/60">{template.key}</Td>
                      <Td className="font-mono text-[12px] text-mg-fg/60">{template.kind}</Td>
                      <Td className="font-mono text-[12px] text-mg-fg/60">
                        {areas.length === 0 ? "—" : areas.join(", ")}
                      </Td>
                      <Td className="font-mono text-[12px] text-mg-fg/60">
                        {assignmentLabel(assignmentFor(template.id))}
                      </Td>
                      <Td>
                        <StatusPill status={template.status} />
                      </Td>
                      <Td className="font-mono text-[12px] text-mg-fg/60">v{template.version}</Td>
                      <Td className="text-right">
                        {canWrite && (assignmentFor(template.id)?.targets.length ?? 0) > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openAssign(template)}
                            disabled={pending}
                          >
                            Assign
                          </Button>
                        )}
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openRename(template)}
                            disabled={pending}
                          >
                            Rename
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDelete(template)}
                            disabled={pending}
                          >
                            Delete
                          </Button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New template"
        description="The key identifies this template to editors. It is not a URL — a template has no public page of its own."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="solid" onClick={create} loading={pending} disabled={!name.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput
            label="Name"
            value={name}
            onChange={(next) => {
              setName(next);
              if (!keyTouched) setKey(slugify(next));
            }}
            placeholder="Editorial layout"
            required
          />
          <TextInput
            label="Key"
            value={key}
            onChange={(next) => {
              setKeyTouched(true);
              setKey(next);
            }}
            help="Lower-case words separated by hyphens."
            required
          />
          <Select
            label="Kind"
            value={kind}
            onChange={(next) => setKind(next as TemplateKind)}
            options={KIND_OPTIONS}
            // The kind cannot be changed later — `template_assignments` resolves
            // through it — so the one place it is chosen is the one place it has
            // to be explained.
            help={`${TEMPLATE_KIND_DESCRIPTION[kind]} This cannot be changed later.`}
            error={error}
            required
          />
        </div>
      </Dialog>

      <Dialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title={`Rename “${renaming?.name ?? ""}”`}
        description="The key is an internal handle, not a URL. A template's kind is fixed at creation and is not renameable."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={rename}
              loading={pending}
              disabled={!renameName.trim() || !renameKey.trim()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput label="Name" value={renameName} onChange={setRenameName} required />
          <TextInput
            label="Key"
            value={renameKey}
            onChange={setRenameKey}
            help="Lower-case words separated by hyphens."
            error={error}
            required
          />
        </div>
      </Dialog>

      <Dialog
        open={assigning !== null}
        onClose={() => setAssigning(null)}
        title={assigning ? `Assign “${assigning.name}”` : "Assign"}
        description="A template frames the records it is assigned to. Publishing it changes them; publishing them keeps the frame."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssigning(null)}>
              Cancel
            </Button>
            <Button variant="solid" loading={pending} onClick={assign}>
              Save
            </Button>
          </>
        }
      >
        <Select
          label="Applies to"
          value={assignTarget}
          onChange={setAssignTarget}
          error={error}
          help="“Nothing” removes every assignment this template holds."
          options={[
            { value: "", label: "Nothing" },
            ...(assignmentFor(assigning?.id ?? "")?.targets ?? []).map((target) => ({
              value: target.value,
              // The holder is named in the option rather than enforced away.
              // A target claimed by another template is a perfectly ordinary
              // thing to take over — `assignTemplate` clears it first — and the
              // one thing an editor needs is to know that is what they are
              // doing before they do it, not a `23505` afterwards.
              label:
                target.heldBy && target.heldBy.id !== assigning?.id
                  ? `${target.label} — currently ${target.heldBy.name}`
                  : target.label,
            })),
          ]}
        />

        <p className="mt-3 text-[12px] text-mg-fg/60">
          Only the scopes the public site reads are offered — a whole content type, or one record.
          Taxonomy-scoped assignment exists in the schema and is deliberately not offered here,
          because nothing on the public site resolves it yet.
        </p>

        {assigning?.status !== "published" && (
          <p className="mt-3 text-[12px] text-mg-fg/60">
            ⚠️ This template is a draft. The assignment saves, but nothing changes on the site until
            the template is published — the public reader takes published payloads only.
          </p>
        )}
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Delete “${confirmDelete?.name ?? ""}”?`}
        description="This cannot be undone from here. Its revision history goes with it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => confirmDelete && remove(confirmDelete)}
            >
              Delete template
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-mg-fg/60">
          Every area in this template is deleted with it, and any assignment pointing at it goes too
          — <span className="font-mono text-[12px]">template_assignments</span> cascades on the
          template id.
        </p>
      </Dialog>
    </>
  );
}
