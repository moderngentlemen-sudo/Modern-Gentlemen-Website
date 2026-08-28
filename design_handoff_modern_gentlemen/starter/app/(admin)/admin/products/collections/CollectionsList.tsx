"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { TextArea, TextInput } from "@/components/admin/ui/Input";
import { Panel } from "@/components/admin/ui/Panel";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Table, Td, Th } from "@/components/admin/ui/Table";
import { useToast } from "@/components/admin/ui/Toast";

import { createCollectionAction, deleteCollectionAction, updateCollectionAction } from "./actions";

export interface CollectionRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  status: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CollectionsList({
  collections,
  canWrite,
  canDelete,
}: {
  collections: CollectionRow[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CollectionRow | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<CollectionRow | null>(null);

  function reset() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setError(undefined);
  }

  function openEdit(collection: CollectionRow) {
    setName(collection.name);
    setSlug(collection.slug);
    // Editing never re-derives the slug: it is a live URL, and a typo fix in
    // the name must not break every link to it.
    setSlugTouched(true);
    setDescription(collection.description ?? "");
    setError(undefined);
    setEditing(collection);
  }

  function create() {
    setError(undefined);
    startTransition(async () => {
      const result = await createCollectionAction({
        name,
        slug: slug || slugify(name),
        description: description.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreating(false);
      reset();
      toast.push("Collection created", "success");
      router.refresh();
    });
  }

  function saveEdit() {
    if (!editing) return;
    setError(undefined);
    startTransition(async () => {
      const result = await updateCollectionAction({
        id: editing.id,
        name,
        slug,
        description: description.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(null);
      reset();
      toast.push("Saved", "success");
      router.refresh();
    });
  }

  function remove(collection: CollectionRow) {
    startTransition(async () => {
      const result = await deleteCollectionAction({ id: collection.id });
      setConfirmDelete(null);
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push(`Deleted “${collection.name}”`, "success");
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="px-8 py-8">
        {canWrite && (
          <div className="mb-4 flex justify-end">
            <Button
              variant="solid"
              onClick={() => {
                reset();
                setCreating(true);
              }}
            >
              New collection
            </Button>
          </div>
        )}

        <Panel>
          {collections.length === 0 ? (
            <EmptyState
              eyebrow="Collections"
              title="No collections yet"
              action={
                canWrite ? (
                  <Button
                    variant="solid"
                    onClick={() => {
                      reset();
                      setCreating(true);
                    }}
                  >
                    Create the first collection
                  </Button>
                ) : undefined
              }
            >
              A collection groups products for a landing page or a nav entry — “Gifts under £50”,
              “The watch edit”.
            </EmptyState>
          ) : (
            <Table caption="All collections">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Slug</Th>
                  <Th>Description</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => (
                  <tr key={collection.id} className="hover:bg-mg-fg/[0.02]">
                    <Td className="font-medium">{collection.name}</Td>
                    <Td className="font-mono text-[12px] text-mg-fg/60">{collection.slug}</Td>
                    <Td className="text-[13px] text-mg-fg/60">{collection.description ?? "—"}</Td>
                    <Td className="text-right">
                      {canWrite && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(collection)}
                          disabled={pending}
                        >
                          Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(collection)}
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
        title="New collection"
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
              if (!slugTouched) setSlug(slugify(next));
            }}
            placeholder="The watch edit"
            required
          />
          <TextInput
            label="Slug"
            value={slug}
            onChange={(next) => {
              setSlugTouched(true);
              setSlug(next);
            }}
            help="Lower-case words separated by hyphens."
            error={error}
            required
          />
          <TextArea label="Description" rows={3} value={description} onChange={setDescription} />
        </div>
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit “${editing?.name ?? ""}”`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="solid" onClick={saveEdit} loading={pending} disabled={!name.trim()}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput label="Name" value={name} onChange={setName} required />
          <TextInput
            label="Slug"
            value={slug}
            onChange={setSlug}
            help="This is a live URL. Changing it breaks existing links."
            error={error}
            required
          />
          <TextArea label="Description" rows={3} value={description} onChange={setDescription} />
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Delete “${confirmDelete?.name ?? ""}”?`}
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
              Delete collection
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-mg-fg/60">
          The products in it are untouched — they simply stop being listed under it.
        </p>
      </Dialog>
    </>
  );
}
