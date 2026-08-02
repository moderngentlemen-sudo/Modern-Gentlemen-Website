"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionResult } from "@/app/(admin)/admin/_lib/action-result";
import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { TextArea, TextInput } from "@/components/admin/ui/Input";
import { Panel } from "@/components/admin/ui/Panel";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Table, Td, Th } from "@/components/admin/ui/Table";
import { useToast } from "@/components/admin/ui/Toast";
import { LABEL_SM } from "@/components/admin/ui/styles";

import {
  createAuthorAction,
  createCategoryAction,
  createTagAction,
  deleteAuthorAction,
  deleteCategoryAction,
  deleteTagAction,
  updateAuthorAction,
  updateCategoryAction,
  updateTagAction,
} from "./actions";

export interface TaxonomyRow {
  id: string;
  /** `name` for categories and authors, `label` for tags — normalised by the route. */
  title: string;
  slug: string;
  /** Free-text secondary column: a category's intro, an author's role. */
  detail: string | null;
}

type Kind = "category" | "tag" | "author";

interface KindConfig {
  singular: string;
  plural: string;
  titleLabel: string;
  detailLabel: string | null;
  detailMultiline: boolean;
  detailHelp?: string;
  create: (input: unknown) => Promise<ActionResult>;
  update: (input: unknown) => Promise<ActionResult>;
  remove: (input: unknown) => Promise<ActionResult>;
  /** The field name the action expects for the title. They genuinely differ. */
  titleKey: "name" | "label";
  detailKey: "intro" | "role" | null;
  emptyBlurb: string;
}

const CONFIG: Record<Kind, KindConfig> = {
  category: {
    singular: "category",
    plural: "Categories",
    titleLabel: "Name",
    detailLabel: "Intro",
    detailMultiline: true,
    detailHelp: "Shown under the heading on the category page.",
    create: createCategoryAction,
    update: updateCategoryAction,
    remove: deleteCategoryAction,
    titleKey: "name",
    detailKey: "intro",
    emptyBlurb:
      "Categories are the five editorial sections. Deleting one leaves its articles unfiled rather than deleting them.",
  },
  tag: {
    singular: "tag",
    plural: "Tags",
    titleLabel: "Label",
    detailLabel: null,
    detailMultiline: false,
    create: createTagAction,
    update: updateTagAction,
    remove: deleteTagAction,
    titleKey: "label",
    detailKey: null,
    emptyBlurb: "Tags cut across categories. An article can carry any number of them.",
  },
  author: {
    singular: "author",
    plural: "Authors",
    titleLabel: "Name",
    detailLabel: "Role",
    detailMultiline: false,
    detailHelp: 'e.g. "Editor-at-large"',
    create: createAuthorAction,
    update: updateAuthorAction,
    remove: deleteAuthorAction,
    titleKey: "name",
    detailKey: "role",
    emptyBlurb:
      "An author can be linked to a login later, so they can edit their own work. Deleting one leaves their articles authorless.",
  },
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function TaxonomyManager({
  categories,
  tags,
  authors,
  canWrite,
}: {
  categories: TaxonomyRow[];
  tags: TaxonomyRow[];
  authors: TaxonomyRow[];
  canWrite: boolean;
}) {
  return (
    <div className="space-y-8 px-8 py-8">
      <TaxonomySection kind="category" rows={categories} canWrite={canWrite} />
      <TaxonomySection kind="tag" rows={tags} canWrite={canWrite} />
      <TaxonomySection kind="author" rows={authors} canWrite={canWrite} />
    </div>
  );
}

function TaxonomySection({
  kind,
  rows,
  canWrite,
}: {
  kind: Kind;
  rows: TaxonomyRow[];
  canWrite: boolean;
}) {
  const config = CONFIG[kind];
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [editing, setEditing] = useState<TaxonomyRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TaxonomyRow | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string>();

  function openCreate() {
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setDetail("");
    setError(undefined);
    setCreating(true);
  }

  function openEdit(row: TaxonomyRow) {
    setTitle(row.title);
    setSlug(row.slug);
    // Editing an existing row must never re-derive the slug from the title:
    // the slug is a live URL, and quietly changing it because someone fixed a
    // typo in the name would break every link to it.
    setSlugTouched(true);
    setDetail(row.detail ?? "");
    setError(undefined);
    setEditing(row);
  }

  function payload(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      [config.titleKey]: title,
      slug: slug || slugify(title),
    };
    if (config.detailKey) body[config.detailKey] = detail.trim() || null;
    return body;
  }

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const result = editing
        ? await config.update({ id: editing.id, ...payload() })
        : await config.create(payload());

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCreating(false);
      setEditing(null);
      toast.push(editing ? "Saved" : `Created “${title}”`, "success");
      router.refresh();
    });
  }

  function remove(row: TaxonomyRow) {
    startTransition(async () => {
      const result = await config.remove({ id: row.id });
      setConfirmDelete(null);
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push(`Deleted “${row.title}”`, "success");
        router.refresh();
      }
    });
  }

  const open = creating || editing !== null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-grotesk text-[16px] font-semibold tracking-[-0.02em]">
          {config.plural}
        </h2>
        {canWrite && (
          <Button size="sm" onClick={openCreate}>
            New {config.singular}
          </Button>
        )}
      </div>

      <Panel>
        {rows.length === 0 ? (
          <EmptyState title={`No ${config.plural.toLowerCase()} yet`}>
            {config.emptyBlurb}
          </EmptyState>
        ) : (
          <Table caption={`All ${config.plural.toLowerCase()}`}>
            <thead>
              <tr>
                <Th>{config.titleLabel}</Th>
                <Th>Slug</Th>
                {config.detailLabel && <Th>{config.detailLabel}</Th>}
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-mg-fg/[0.02]">
                  <Td className="font-medium">{row.title}</Td>
                  <Td className="font-mono text-[12px] text-mg-fg/50">{row.slug}</Td>
                  {config.detailLabel && (
                    <Td className="max-w-[380px] truncate text-mg-fg/60">{row.detail ?? "—"}</Td>
                  )}
                  <Td className="text-right">
                    {canWrite && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => setConfirmDelete(row)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Dialog
        open={open}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${config.singular}` : `New ${config.singular}`}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="solid" onClick={submit} loading={pending} disabled={!title.trim()}>
              {editing ? "Save" : "Create"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput
            label={config.titleLabel}
            value={title}
            onChange={(next) => {
              setTitle(next);
              if (!slugTouched) setSlug(slugify(next));
            }}
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
          {config.detailLabel &&
            (config.detailMultiline ? (
              <TextArea
                label={config.detailLabel}
                rows={3}
                value={detail}
                onChange={setDetail}
                help={config.detailHelp}
              />
            ) : (
              <TextInput
                label={config.detailLabel}
                value={detail}
                onChange={setDetail}
                help={config.detailHelp}
              />
            ))}
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Delete “${confirmDelete?.title ?? ""}”?`}
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
              Delete {config.singular}
            </Button>
          </>
        }
      >
        <p className={LABEL_SM}>What happens to the articles</p>
        <p className="mt-1 text-[13px] text-mg-fg/60">{config.emptyBlurb}</p>
      </Dialog>
    </section>
  );
}
