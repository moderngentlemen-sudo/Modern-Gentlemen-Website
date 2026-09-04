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
import { ARTICLE_TEMPLATE_NAMES, DEFAULT_ARTICLE_TEMPLATE } from "@/lib/domain/articles";
import type { DocumentStatus } from "@/lib/domain/documents";

import { createArticleAction, deleteArticleAction } from "./actions";

export interface ArticleRow {
  id: string;
  title: string;
  slug: string;
  status: DocumentStatus;
  version: number;
  updated_at: string;
}

/** Matches the slug rule the action enforces, and `PagesList`'s own helper. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const TEMPLATE_OPTIONS = ARTICLE_TEMPLATE_NAMES.map((name) => ({ value: name, label: name }));

export function ArticlesList({
  articles,
  search,
  total,
  page,
  pageCount,
  canWrite,
  canDelete,
}: {
  articles: ArticleRow[];
  search: string;
  total: number;
  page: number;
  pageCount: number;
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
  const [template, setTemplate] = useState<string>(DEFAULT_ARTICLE_TEMPLATE);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<ArticleRow | null>(null);

  function pageHref(nextPage: number): string {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `/admin/articles?${query}` : "/admin/articles";
  }

  function create() {
    setError(undefined);
    startTransition(async () => {
      const result = await createArticleAction({
        title,
        slug: slug || slugify(title),
        template,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreating(false);
      setTitle("");
      setSlug("");
      setSlugTouched(false);
      setTemplate(DEFAULT_ARTICLE_TEMPLATE);
      toast.push("Article created", "success");
      router.push(`/admin/articles/${result.data.id}`);
    });
  }

  function remove(article: ArticleRow) {
    startTransition(async () => {
      const result = await deleteArticleAction({ id: article.id });
      setConfirmDelete(null);
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push(`Deleted “${article.title}”`, "success");
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="px-8 py-8">
        <div className="mb-4 flex flex-col gap-3 min-[760px]:flex-row min-[760px]:items-end min-[760px]:justify-between">
          <form
            action="/admin/articles"
            method="get"
            role="search"
            className="flex max-w-xl flex-1 flex-wrap items-end gap-2"
          >
            <div className="w-full min-[520px]:flex-1">
              <label
                htmlFor="article-search"
                className="block font-mono text-[10px] uppercase tracking-[0.16em] text-mg-fg/70"
              >
                Search articles
              </label>
              <input
                id="article-search"
                name="q"
                type="search"
                defaultValue={search}
                maxLength={100}
                placeholder="Title, subtitle, excerpt, or slug"
                className="mt-1.5 min-h-10 w-full border border-mg-bd/25 bg-mg-surface px-3 py-2 text-[14px] text-mg-fg outline-none placeholder:text-mg-fg/60 focus:border-mg-accent focus:ring-2 focus:ring-mg-accent/20"
              />
            </div>
            <Button type="submit">Search</Button>
            {search && (
              <Button href="/admin/articles" variant="ghost">
                Clear
              </Button>
            )}
          </form>
          {canWrite && (
            <Button variant="solid" onClick={() => setCreating(true)}>
              New article
            </Button>
          )}
        </div>

        <p
          className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-mg-fg/60"
          aria-live="polite"
        >
          {search
            ? `${total} ${total === 1 ? "result" : "results"} for “${search}”`
            : `${total} ${total === 1 ? "article" : "articles"}`}
        </p>

        <Panel>
          {articles.length === 0 ? (
            <EmptyState
              eyebrow="Articles"
              title={search ? "No matching articles" : "No articles yet"}
              action={
                search ? (
                  <Button href="/admin/articles" variant="solid">
                    Clear search
                  </Button>
                ) : canWrite ? (
                  <Button variant="solid" onClick={() => setCreating(true)}>
                    Create the first article
                  </Button>
                ) : undefined
              }
            >
              {search
                ? "Try a different title, phrase, or URL slug."
                : "An article picks one of the twenty templates for its hero and body, and composes anything beyond that as sections in the builder."}
            </EmptyState>
          ) : (
            <Table caption="All articles">
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
                {articles.map((article) => (
                  <tr key={article.id} className="hover:bg-mg-fg/[0.02]">
                    <Td>
                      <Link
                        href={`/admin/articles/${article.id}`}
                        className="font-medium hover:text-mg-accentInk"
                      >
                        {article.title}
                      </Link>
                    </Td>
                    <Td className="font-mono text-[12px] text-mg-fg/60">/article/{article.slug}</Td>
                    <Td>
                      <StatusPill status={article.status} />
                    </Td>
                    <Td className="font-mono text-[12px] text-mg-fg/60">v{article.version}</Td>
                    <Td className="text-right">
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(article)}
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

        {pageCount > 1 && (
          <nav aria-label="Article pages" className="mt-5 flex items-center justify-between gap-4">
            <Button href={pageHref(page - 1)} variant="ghost" disabled={page <= 1}>
              Previous
            </Button>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mg-fg/60">
              Page {page} of {pageCount}
            </span>
            <Button href={pageHref(page + 1)} variant="ghost" disabled={page >= pageCount}>
              Next
            </Button>
          </nav>
        )}
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New article"
        description="The slug is the URL this article will live at, under /article/."
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
            placeholder="The Art of Arriving Early"
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
          <Select
            label="Template"
            value={template}
            onChange={setTemplate}
            options={TEMPLATE_OPTIONS}
            help="The hero and body pairing. Changeable at any time from the article's own panel."
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
              Delete article
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-mg-fg/60">
          Any media it referenced stays in the library; only the references go.
        </p>
      </Dialog>
    </>
  );
}
