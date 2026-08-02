"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/admin/ui/Button";
import { TextArea, TextInput } from "@/components/admin/ui/Input";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { Select } from "@/components/admin/ui/Select";
import { Panel, PanelSection } from "@/components/admin/ui/Panel";
import { useToast } from "@/components/admin/ui/Toast";
import { MediaPickerDialog } from "@/components/admin/media/MediaPickerDialog";
import { ARTICLE_TEMPLATE_NAMES } from "@/lib/domain/articles";
import type { AssetView } from "@/lib/services/media";

import { updateArticleMetaAction } from "../actions";

export interface TaxonomyOption {
  id: string;
  label: string;
}

export interface ArticleMetaForm {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  excerpt: string | null;
  template: string;
  categoryId: string | null;
  authorId: string | null;
  featuredAssetId: string | null;
  featuredAssetUrl: string | null;
  readingMinutes: number | null;
  issueNo: string | null;
  tagIds: string[];
}

const TEMPLATE_OPTIONS = ARTICLE_TEMPLATE_NAMES.map((name) => ({ value: name, label: name }));

/**
 * The part of an article that is not a block tree.
 *
 * `featured_asset_id` is a real foreign key to `media_assets`, so this control
 * stores the asset's **id** — unlike an `image` field in a block, which stores
 * its URL. That is not an inconsistency to tidy away: a column with a foreign
 * key gets referential integrity and `on delete set null` for free, while a
 * block field has to keep working when it holds a third-party CDN URL the
 * library does not own. Different constraints, different representations.
 */
export function ArticleDetails({
  initial,
  categories,
  authors,
  tags,
  canWrite,
}: {
  initial: ArticleMetaForm;
  categories: TaxonomyOption[];
  authors: TaxonomyOption[];
  tags: TaxonomyOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState(initial);
  const [featuredUrl, setFeaturedUrl] = useState(initial.featuredAssetUrl);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string>();

  function set<K extends keyof ArticleMetaForm>(key: K, value: ArticleMetaForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    setError(undefined);
    startTransition(async () => {
      const result = await updateArticleMetaAction({
        id: form.id,
        title: form.title,
        slug: form.slug,
        // An empty box means "no value", not an empty string — the same rule the
        // properties panel follows when an optional field is cleared.
        subtitle: form.subtitle?.trim() || null,
        excerpt: form.excerpt?.trim() || null,
        template: form.template,
        categoryId: form.categoryId,
        authorId: form.authorId,
        featuredAssetId: form.featuredAssetId,
        readingMinutes: form.readingMinutes ?? null,
        issueNo: form.issueNo?.trim() || null,
        tagIds: form.tagIds,
      });

      if (!result.ok) {
        setError(result.error);
        toast.push(result.error, "error");
        return;
      }

      toast.push("Saved", "success");
      router.refresh();
    });
  }

  function toggleTag(tagId: string) {
    set(
      "tagIds",
      form.tagIds.includes(tagId)
        ? form.tagIds.filter((id) => id !== tagId)
        : [...form.tagIds, tagId]
    );
  }

  return (
    <div className="grid gap-6 px-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel>
        <PanelSection title="Identity">
          <TextInput
            label="Title"
            value={form.title}
            onChange={(v) => set("title", v)}
            disabled={!canWrite}
            required
          />
          <TextInput
            label="Slug"
            value={form.slug}
            onChange={(v) => set("slug", v)}
            disabled={!canWrite}
            help="Lives at /article/<slug>. Changing it breaks existing links."
            error={error}
            required
          />
          <TextInput
            label="Subtitle"
            value={form.subtitle ?? ""}
            onChange={(v) => set("subtitle", v)}
            disabled={!canWrite}
          />
          <TextArea
            label="Excerpt"
            rows={3}
            value={form.excerpt ?? ""}
            onChange={(v) => set("excerpt", v)}
            disabled={!canWrite}
            help="Used by card listings and as the default meta description."
          />
        </PanelSection>

        <PanelSection title="Presentation">
          <Select
            label="Template"
            value={form.template}
            onChange={(v) => set("template", v)}
            options={TEMPLATE_OPTIONS}
            disabled={!canWrite}
            help="One of the twenty hero × body pairings."
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Reading minutes"
              value={form.readingMinutes ?? undefined}
              onChange={(v) => set("readingMinutes", v ?? null)}
              min={1}
              max={180}
              integer
              disabled={!canWrite}
            />
            <TextInput
              label="Issue no."
              value={form.issueNo ?? ""}
              onChange={(v) => set("issueNo", v)}
              disabled={!canWrite}
              placeholder="042"
            />
          </div>
        </PanelSection>

        <PanelSection title="Filing">
          <Select
            label="Category"
            value={form.categoryId ?? ""}
            onChange={(v) => set("categoryId", v || null)}
            options={categories.map((c) => ({ value: c.id, label: c.label }))}
            placeholder="— none —"
            disabled={!canWrite}
          />
          <Select
            label="Author"
            value={form.authorId ?? ""}
            onChange={(v) => set("authorId", v || null)}
            options={authors.map((a) => ({ value: a.id, label: a.label }))}
            placeholder="— none —"
            disabled={!canWrite}
          />

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-mg-fg/60">Tags</p>
            {tags.length === 0 ? (
              <p className="mt-1.5 text-[12px] text-mg-fg/45">
                No tags exist yet. Create them under Taxonomy.
              </p>
            ) : (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const on = form.tagIds.includes(tag.id);
                  return (
                    <li key={tag.id}>
                      <button
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        disabled={!canWrite}
                        aria-pressed={on}
                        className={
                          on
                            ? "border border-mg-accent bg-mg-accent/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mg-accent"
                            : "border border-mg-bd/25 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mg-fg/60 hover:border-mg-fg"
                        }
                      >
                        {tag.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </PanelSection>

        {canWrite && (
          <PanelSection title="Save">
            <Button variant="solid" onClick={save} loading={pending}>
              Save details
            </Button>
          </PanelSection>
        )}
      </Panel>

      <Panel className="h-fit">
        <PanelSection title="Featured image">
          {featuredUrl ? (
            <div className="border border-mg-bd/15 bg-mg-bg/40 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- external_url assets are not on an allowed remote host */}
              <img src={featuredUrl} alt="" className="h-32 w-full object-cover" />
            </div>
          ) : (
            <p className="text-[12px] text-mg-fg/45">
              None chosen. Card listings fall back to the article&rsquo;s first image.
            </p>
          )}

          {canWrite && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setPicking(true)}>
                Choose
              </Button>
              {form.featuredAssetId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    set("featuredAssetId", null);
                    setFeaturedUrl(null);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
        </PanelSection>
      </Panel>

      <MediaPickerDialog
        open={picking}
        onClose={() => setPicking(false)}
        kind="image"
        onPick={(asset: AssetView) => {
          // The id, not the URL — this column is a foreign key.
          set("featuredAssetId", asset.id);
          setFeaturedUrl(asset.url);
        }}
      />
    </div>
  );
}
