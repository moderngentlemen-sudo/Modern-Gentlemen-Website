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

import { createTemplateAction, deleteTemplateAction, renameTemplateAction } from "./actions";

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
  canWrite,
  canDelete,
}: {
  templates: TemplateRow[];
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
                          className="font-medium hover:text-mg-accent"
                        >
                          {template.name}
                        </Link>
                      </Td>
                      <Td className="font-mono text-[12px] text-mg-fg/50">{template.key}</Td>
                      <Td className="font-mono text-[12px] text-mg-fg/50">{template.kind}</Td>
                      <Td className="font-mono text-[12px] text-mg-fg/50">
                        {areas.length === 0 ? "—" : areas.join(", ")}
                      </Td>
                      <Td>
                        <StatusPill status={template.status} />
                      </Td>
                      <Td className="font-mono text-[12px] text-mg-fg/50">v{template.version}</Td>
                      <Td className="text-right">
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
