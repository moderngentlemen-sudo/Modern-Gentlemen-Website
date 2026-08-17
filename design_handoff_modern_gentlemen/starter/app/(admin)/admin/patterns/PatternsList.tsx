"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { TextInput } from "@/components/admin/ui/Input";
import { Panel } from "@/components/admin/ui/Panel";
import { StatusPill } from "@/components/admin/ui/Badge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Table, Td, Th } from "@/components/admin/ui/Table";
import { useToast } from "@/components/admin/ui/Toast";
import type { DocumentStatus } from "@/lib/domain/documents";

import { createPatternAction, deletePatternAction, renamePatternAction } from "./actions";

/**
 * `title` and `slug` are the *aliases* the document repository returns for a
 * pattern's `name` and `key` columns, which is why this row looks like a page's.
 */
export interface PatternRow {
  id: string;
  title: string;
  slug: string;
  status: DocumentStatus;
  version: number;
  updated_at: string;
}

/** `Editorial Trio` → `editorial-trio`, matching the key rule the action enforces. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function PatternsList({
  patterns,
  canWrite,
  canDelete,
}: {
  patterns: PatternRow[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<PatternRow | null>(null);

  // Renaming edits the row in place, so the dialog opens holding what is there
  // rather than empty — the create dialog's `slugify`-as-you-type would be
  // wrong here, since changing a name must not silently move the key an editor
  // has already told other people about.
  const [renaming, setRenaming] = useState<PatternRow | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameKey, setRenameKey] = useState("");

  function openRename(pattern: PatternRow) {
    setError(undefined);
    setRenameName(pattern.title);
    setRenameKey(pattern.slug);
    setRenaming(pattern);
  }

  function rename() {
    if (!renaming) return;
    setError(undefined);
    startTransition(async () => {
      const result = await renamePatternAction({
        id: renaming.id,
        name: renameName,
        key: renameKey,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRenaming(null);
      toast.push("Pattern renamed", "success");
      router.refresh();
    });
  }

  function create() {
    setError(undefined);
    startTransition(async () => {
      const result = await createPatternAction({ name, key: key || slugify(name) });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreating(false);
      setName("");
      setKey("");
      setKeyTouched(false);
      toast.push("Pattern created", "success");
      router.push(`/admin/patterns/${result.data.id}`);
    });
  }

  function remove(pattern: PatternRow) {
    startTransition(async () => {
      const result = await deletePatternAction({ id: pattern.id });
      setConfirmDelete(null);
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push(`Deleted “${pattern.title}”`, "success");
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
              New pattern
            </Button>
          </div>
        )}

        <Panel>
          {patterns.length === 0 ? (
            <EmptyState
              eyebrow="Patterns"
              title="No patterns yet"
              action={
                canWrite ? (
                  <Button variant="solid" onClick={() => setCreating(true)}>
                    Create the first pattern
                  </Button>
                ) : undefined
              }
            >
              A pattern is a saved group of sections you can drop into any page. Create one, then
              compose it in the builder.
            </EmptyState>
          ) : (
            <Table caption="All patterns">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Key</Th>
                  <Th>Status</Th>
                  <Th>Version</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {patterns.map((pattern) => (
                  <tr key={pattern.id} className="hover:bg-mg-fg/[0.02]">
                    <Td>
                      <Link
                        href={`/admin/patterns/${pattern.id}`}
                        className="font-medium hover:text-mg-accent"
                      >
                        {pattern.title}
                      </Link>
                    </Td>
                    <Td className="font-mono text-[12px] text-mg-fg/50">{pattern.slug}</Td>
                    <Td>
                      <StatusPill status={pattern.status} />
                    </Td>
                    <Td className="font-mono text-[12px] text-mg-fg/50">v{pattern.version}</Td>
                    <Td className="text-right">
                      {canWrite && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openRename(pattern)}
                          disabled={pending}
                        >
                          Rename
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(pattern)}
                          disabled={pending}
                        >
                          Delete
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New pattern"
        description="The key identifies this pattern to editors. It is not a URL — a pattern has no public page of its own."
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
            placeholder="Editorial trio"
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
            error={error}
            required
          />
        </div>
      </Dialog>

      <Dialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title={`Rename “${renaming?.title ?? ""}”`}
        description="The key is an internal handle, not a URL — no public page links to it, and pages built from this pattern keep the blocks they copied."
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
        title={`Delete “${confirmDelete?.title ?? ""}”?`}
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
              Delete pattern
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-mg-fg/60">
          Pages that already use this pattern keep their sections — inserting a pattern copies its
          blocks rather than linking to it.
        </p>
      </Dialog>
    </>
  );
}
