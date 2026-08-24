"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { TextArea, TextInput } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { Panel } from "@/components/admin/ui/Panel";
import { StatusPill } from "@/components/admin/ui/Badge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Table, Td, Th } from "@/components/admin/ui/Table";
import { useToast } from "@/components/admin/ui/Toast";
import type { DocumentStatus } from "@/lib/domain/documents";

import {
  createPatternAction,
  deletePatternAction,
  renamePatternAction,
  setPatternDetailsAction,
} from "./actions";

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
  /**
   * The two pattern-only columns, merged in by the page.
   *
   * They are not part of the generic document shape and never will be — see the
   * note on the merge in `page.tsx`.
   */
  description: string | null;
  categoryId: string | null;
}

/** A pattern category as a `Select` option. `pattern_categories`, by label. */
export interface CategoryOption {
  value: string;
  label: string;
}

/**
 * The "no category" option.
 *
 * A `Select` cannot hold `null`, and an empty string is what an unselected
 * option yields, so the two are converted at the edges of this component rather
 * than being allowed to reach the action — which takes a uuid or null and
 * nothing else.
 */
const NO_CATEGORY = "";

type SyncMode = "detachable" | "synced";

/**
 * The two things a pattern can be, in the words an editor needs.
 *
 * `sync_mode` is fixed at creation and there is no editor for it, which is why
 * the explanation belongs beside the one control that sets it. Changing it
 * afterwards is not a rename: every page already using the pattern holds either
 * copies or references, and flipping the column would not convert them.
 */
const SYNC_OPTIONS = [
  { value: "detachable", label: "Detachable — insert a copy" },
  { value: "synced", label: "Synced — insert a link" },
] as const;

const SYNC_HELP: Record<SyncMode, string> = {
  detachable:
    "Inserting it copies its blocks into the page. Editing the pattern afterwards changes nothing that already uses it. This cannot be changed later.",
  synced:
    "Pages store a link, and its blocks are substituted when the page renders — so editing the pattern updates every page using it. Only the published version appears on the live site. This cannot be changed later.",
};

/** `Editorial Trio` → `editorial-trio`, matching the key rule the action enforces. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The category select, shared by the create and edit dialogs.
 *
 * One component rather than two copies because the "no category" conversion is
 * the fiddly part — `NO_CATEGORY` in, `null` out — and it is exactly the kind of
 * thing that gets written correctly once and wrongly the second time.
 *
 * The categories themselves are seeded by `0003_content_spine.sql` and there is
 * deliberately no editor for them here: five rows that have existed since
 * Phase 1 are the gap this closes, and a management screen for a fixed
 * vocabulary would be a different, larger feature.
 */
function PatternCategorySelect({
  categories,
  value,
  onChange,
  error,
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <Select
      label="Category"
      value={value}
      onChange={onChange}
      options={[{ value: NO_CATEGORY, label: "No category" }, ...categories]}
      help="Groups this pattern in the builder's insert menu."
      error={error}
    />
  );
}

export function PatternsList({
  patterns,
  categories,
  canWrite,
  canDelete,
}: {
  patterns: PatternRow[];
  categories: CategoryOption[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [syncMode, setSyncMode] = useState<SyncMode>("detachable");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>(NO_CATEGORY);
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
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<string>(NO_CATEGORY);

  function openRename(pattern: PatternRow) {
    setError(undefined);
    setRenameName(pattern.title);
    setRenameKey(pattern.slug);
    setEditDescription(pattern.description ?? "");
    setEditCategoryId(pattern.categoryId ?? NO_CATEGORY);
    setRenaming(pattern);
  }

  function saveEdits() {
    if (!renaming) return;
    setError(undefined);
    startTransition(async () => {
      // Two actions because the two halves go through different services — the
      // rename through the generic `renameDocument`, the details through the
      // pattern-only update. Sequential rather than in parallel so a failure in
      // the first stops the second: reporting "saved" for half a dialog is
      // worse than reporting the failure.
      const renamed = await renamePatternAction({
        id: renaming.id,
        name: renameName,
        key: renameKey,
      });
      if (!renamed.ok) {
        setError(renamed.error);
        return;
      }

      const detailed = await setPatternDetailsAction({
        id: renaming.id,
        description: editDescription,
        categoryId: editCategoryId === NO_CATEGORY ? null : editCategoryId,
      });
      if (!detailed.ok) {
        setError(detailed.error);
        return;
      }

      setRenaming(null);
      toast.push("Pattern updated", "success");
      router.refresh();
    });
  }

  function create() {
    setError(undefined);
    startTransition(async () => {
      const result = await createPatternAction({
        name,
        key: key || slugify(name),
        syncMode,
        description,
        categoryId: categoryId === NO_CATEGORY ? null : categoryId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreating(false);
      setName("");
      setKey("");
      setDescription("");
      setCategoryId(NO_CATEGORY);
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
                          Edit
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
            required
          />
          {/*
            ✅ **Collected as of this phase**, both of them. The repository has
            accepted a description since Phase 4 and no caller passed one, so
            the builder's rail — which renders `pattern.description` and falls
            back to "N sections" — showed the fallback for every pattern that
            has ever existed.
          */}
          <TextArea
            label="Description"
            value={description}
            onChange={setDescription}
            rows={2}
            placeholder="Three editorial cards with a lead image."
            help="Shown in the builder's insert menu, in place of the section count."
          />
          <PatternCategorySelect
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
          />
          {/*
            ✅ **A real choice as of this phase.** It was hard-coded to
            `detachable` for three phases and deliberately not offered, because
            no public route expanded a `_ref` — a synced pattern rendered in
            preview and vanished from the live site. The public paths expand
            now, so the option means what it says.
          */}
          <Select
            label="Inserting it"
            value={syncMode}
            onChange={(next) => setSyncMode(next as SyncMode)}
            options={SYNC_OPTIONS}
            help={SYNC_HELP[syncMode]}
            error={error}
            required
          />
        </div>
      </Dialog>

      <Dialog
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title={`Edit “${renaming?.title ?? ""}”`}
        description="The key is an internal handle, not a URL — no public page links to it, and renaming changes nothing about the pages already using this pattern."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={saveEdits}
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
            required
          />
          <TextArea
            label="Description"
            value={editDescription}
            onChange={setEditDescription}
            rows={2}
            help="Shown in the builder's insert menu, in place of the section count."
          />
          <PatternCategorySelect
            categories={categories}
            value={editCategoryId}
            onChange={setEditCategoryId}
            error={error}
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
        {/*
          ⚠️ This said "pages keep their sections — inserting a pattern copies
          its blocks rather than linking to it", which stopped being true the
          moment `synced` became a real choice. It is now the opposite of a
          reassurance: a page holding a *reference* to a deleted pattern renders
          a gap on the live site, and the only place that shows up is the
          builder's canvas. The copy has to cover both modes, because this
          dialog does not know which one it is looking at.
        */}
        <p className="text-[13px] text-mg-fg/60">
          Pages that inserted this pattern as a <strong className="font-semibold">copy</strong> keep
          their sections. Pages that <strong className="font-semibold">link</strong> to it — a
          synced pattern — will render nothing where it was, until the reference is removed or
          detached.
        </p>
      </Dialog>
    </>
  );
}
