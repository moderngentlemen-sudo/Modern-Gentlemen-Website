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

import { createPageAction, deletePageAction } from "./actions";

export interface PageRow {
  id: string;
  title: string;
  slug: string;
  status: DocumentStatus;
  version: number;
  updated_at: string;
}

/** `A Page Title` → `a-page-title`, matching the slug rule the action enforces. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function PagesList({
  pages,
  canWrite,
  canDelete,
}: {
  pages: PageRow[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<PageRow | null>(null);

  function create() {
    setError(undefined);
    startTransition(async () => {
      const result = await createPageAction({ title, slug: slug || slugify(title) });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreating(false);
      setTitle("");
      setSlug("");
      setSlugTouched(false);
      toast.push("Page created", "success");
      router.push(`/admin/pages/${result.data.id}`);
    });
  }

  function remove(page: PageRow) {
    startTransition(async () => {
      const result = await deletePageAction({ id: page.id });
      setConfirmDelete(null);
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push(`Deleted “${page.title}”`, "success");
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
              New page
            </Button>
          </div>
        )}

        <Panel>
          {pages.length === 0 ? (
            <EmptyState
              eyebrow="Pages"
              title="No pages yet"
              action={
                canWrite ? (
                  <Button variant="solid" onClick={() => setCreating(true)}>
                    Create the first page
                  </Button>
                ) : undefined
              }
            >
              A page is an ordered list of sections. Create one, then compose it in the builder.
            </EmptyState>
          ) : (
            <Table caption="All pages">
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Slug</Th>
                  <Th>Status</Th>
                  <Th>Version</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id} className="hover:bg-mg-fg/[0.02]">
                    <Td>
                      <Link
                        href={`/admin/pages/${page.id}`}
                        className="font-medium hover:text-mg-accentInk"
                      >
                        {page.title}
                      </Link>
                    </Td>
                    <Td className="font-mono text-[12px] text-mg-fg/60">/{page.slug}</Td>
                    <Td>
                      <StatusPill status={page.status} />
                    </Td>
                    <Td className="font-mono text-[12px] text-mg-fg/60">v{page.version}</Td>
                    <Td className="text-right">
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(page)}
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
        title="New page"
        description="The slug is the URL this page will live at."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="solid" onClick={create} loading={pending} disabled={!title.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput
            label="Title"
            value={title}
            onChange={(next) => {
              setTitle(next);
              if (!slugTouched) setSlug(slugify(next));
            }}
            placeholder="The Cover Story"
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
              Delete page
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-mg-fg/60">
          System pages are additionally protected by their own delete policy in the database, so
          this may still be refused.
        </p>
      </Dialog>
    </>
  );
}
