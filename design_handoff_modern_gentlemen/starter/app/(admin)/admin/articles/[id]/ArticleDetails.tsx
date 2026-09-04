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
import {
  RelatedArticles,
  type RelatedCandidate,
} from "@/components/admin/articles/RelatedArticles";
import { ArticlePresentationPreview } from "@/components/admin/articles/ArticlePresentationPreview";
import {
  ARTICLE_FEATURED_MEDIA_KINDS,
  ARTICLE_APPEARANCES,
  ARTICLE_HEADER_MODES,
  ARTICLE_TEMPLATE_NAMES,
  type ArticleFeaturedMedia,
  type ArticleMediaAsset,
  type ArticlePresentation,
} from "@/lib/domain/articles";
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
  featuredMedia: ArticleFeaturedMedia;
  presentation: ArticlePresentation;
  readingMinutes: number | null;
  issueNo: string | null;
  tagIds: string[];
  relatedIds: string[];
}

const TEMPLATE_OPTIONS = ARTICLE_TEMPLATE_NAMES.map((name) => ({ value: name, label: name }));
const HEADER_MODE_LABELS: Record<ArticlePresentation["headerMode"], string> = {
  template: "Use template",
  standard: "Standard",
  large: "Large",
  largeMedia: "Large media",
  full: "Full bleed",
  titleOnly: "Title only",
  none: "No article header",
};
const APPEARANCE_LABELS: Record<ArticlePresentation["appearance"], string> = {
  template: "Use template",
  compact: "Compact",
  large: "Large",
};

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
  relatedCandidates,
  canWrite,
}: {
  initial: ArticleMetaForm;
  categories: TaxonomyOption[];
  authors: TaxonomyOption[];
  tags: TaxonomyOption[];
  relatedCandidates: RelatedCandidate[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState(initial);
  const [featuredUrl, setFeaturedUrl] = useState(initial.featuredAssetUrl);
  const [picking, setPicking] = useState<"cover" | "video" | "gallery" | null>(null);
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
        relatedIds: form.relatedIds,
        featuredMedia: form.featuredMedia,
        presentation: form.presentation,
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

  function setMedia(patch: Partial<ArticleFeaturedMedia>) {
    set("featuredMedia", { ...form.featuredMedia, ...patch });
  }

  function moveGallery(index: number, delta: -1 | 1) {
    const gallery = [...(form.featuredMedia.gallery ?? [])];
    const target = index + delta;
    if (target < 0 || target >= gallery.length) return;
    [gallery[index], gallery[target]] = [gallery[target], gallery[index]];
    setMedia({ gallery });
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
            <Select
              label="Article header"
              value={form.presentation.headerMode}
              onChange={(headerMode) =>
                set("presentation", {
                  ...form.presentation,
                  headerMode: headerMode as ArticlePresentation["headerMode"],
                })
              }
              options={ARTICLE_HEADER_MODES.map((value) => ({
                value,
                label: HEADER_MODE_LABELS[value],
              }))}
              disabled={!canWrite}
              help="Override the template header without changing its body design."
            />
            <Select
              label="Article appearance"
              value={form.presentation.appearance}
              onChange={(appearance) =>
                set("presentation", {
                  ...form.presentation,
                  appearance: appearance as ArticlePresentation["appearance"],
                })
              }
              options={ARTICLE_APPEARANCES.map((value) => ({
                value,
                label: APPEARANCE_LABELS[value],
              }))}
              disabled={!canWrite}
              help="Adjust the hero title scale while retaining the selected composition."
            />
          </div>
          <ArticlePresentationPreview
            template={form.template}
            presentation={form.presentation}
            title={form.title}
            dek={form.subtitle || form.excerpt}
            category={categories.find((category) => category.id === form.categoryId)?.label}
            issue={form.issueNo}
            author={authors.find((author) => author.id === form.authorId)?.label}
            readingMinutes={form.readingMinutes}
            image={featuredUrl}
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
              <p className="mt-1.5 text-[12px] text-mg-fg/60">
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
                            ? "border border-mg-accent bg-mg-accent/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mg-accentInk"
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
        <PanelSection title="Featured media">
          <Select
            label="Media type"
            value={form.featuredMedia.kind}
            onChange={(value) => setMedia({ kind: value as ArticleFeaturedMedia["kind"] })}
            options={ARTICLE_FEATURED_MEDIA_KINDS.map((value) => ({
              value,
              label: value[0].toUpperCase() + value.slice(1),
            }))}
            disabled={!canWrite}
          />
          {featuredUrl ? (
            <div className="border border-mg-bd/15 bg-mg-bg/40 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- external_url assets are not on an allowed remote host */}
              <img src={featuredUrl} alt="" className="h-32 w-full object-cover" />
            </div>
          ) : (
            <p className="text-[12px] text-mg-fg/60">
              No cover chosen. Card listings use the site fallback; this image also acts as a video
              poster.
            </p>
          )}

          {canWrite && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setPicking("cover")}>
                Choose cover
              </Button>
              {form.featuredAssetId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    set("featuredAssetId", null);
                    setFeaturedUrl(null);
                    setMedia({ cover: undefined });
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          )}

          {form.featuredMedia.kind === "video" && (
            <div className="space-y-2 border-t border-mg-bd/15 pt-3">
              <TextInput
                label="Video URL"
                value={form.featuredMedia.video?.url ?? ""}
                onChange={(url) =>
                  setMedia({
                    // A typed URL no longer refers to the previously selected
                    // library asset, so its id must leave with the old URL.
                    video: url ? { kind: "video", url } : undefined,
                  })
                }
                disabled={!canWrite}
                help="Choose a library video or enter an HTTPS/CDN URL."
              />
              {canWrite && (
                <Button size="sm" variant="ghost" onClick={() => setPicking("video")}>
                  Choose video
                </Button>
              )}
            </div>
          )}

          {form.featuredMedia.kind === "embed" && (
            <TextInput
              label="YouTube or Vimeo URL"
              value={form.featuredMedia.embedUrl ?? ""}
              onChange={(embedUrl) => setMedia({ embedUrl })}
              disabled={!canWrite}
              help="HTTPS YouTube and Vimeo share/player URLs are supported."
            />
          )}

          {form.featuredMedia.kind === "gallery" && (
            <div className="space-y-2 border-t border-mg-bd/15 pt-3">
              {(form.featuredMedia.gallery ?? []).map((item, index, gallery) => (
                <div
                  key={`${item.assetId ?? item.url}-${index}`}
                  className="flex items-center gap-2 border border-mg-bd/15 p-1.5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- picker supports external assets */}
                  <img src={item.url} alt="" className="h-12 w-16 object-cover" />
                  <span className="min-w-0 flex-1 truncate text-[11px]">
                    {item.alt || item.url}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={index === 0}
                    aria-label={`Move gallery item ${index + 1} up`}
                    onClick={() => moveGallery(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={index === gallery.length - 1}
                    aria-label={`Move gallery item ${index + 1} down`}
                    onClick={() => moveGallery(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove gallery item ${index + 1}`}
                    onClick={() =>
                      setMedia({ gallery: gallery.filter((_, itemIndex) => itemIndex !== index) })
                    }
                  >
                    ×
                  </Button>
                </div>
              ))}
              {canWrite && (form.featuredMedia.gallery?.length ?? 0) < 12 && (
                <Button size="sm" variant="ghost" onClick={() => setPicking("gallery")}>
                  Add image
                </Button>
              )}
            </div>
          )}
        </PanelSection>
      </Panel>

      <Panel className="h-fit lg:col-start-2">
        <PanelSection
          title="Keep reading"
          // The rail at the foot of the article page. Curated here, derived when
          // it is left empty — which is what every article created in the admin
          // has done since Phase 7c, because there was no way to curate one.
        >
          <RelatedArticles
            chosen={form.relatedIds}
            candidates={relatedCandidates}
            onChange={(ids) => set("relatedIds", ids)}
            disabled={!canWrite}
          />
        </PanelSection>
      </Panel>

      <MediaPickerDialog
        open={picking !== null}
        onClose={() => setPicking(null)}
        kind={picking === "video" ? "video" : "image"}
        onPick={(asset: AssetView) => {
          const mediaAsset: ArticleMediaAsset = {
            assetId: asset.id,
            url: asset.url,
            kind: asset.kind === "gif" ? "gif" : asset.kind === "video" ? "video" : "image",
            ...(asset.altText ? { alt: asset.altText } : {}),
          };
          if (picking === "video") setMedia({ video: { ...mediaAsset, kind: "video" } });
          else if (picking === "gallery") {
            const gallery = form.featuredMedia.gallery ?? [];
            if (!gallery.some((item) => item.assetId === mediaAsset.assetId))
              setMedia({ gallery: [...gallery, mediaAsset] });
          } else {
            // The id, not the URL — this column is a foreign key.
            set("featuredAssetId", asset.id);
            setFeaturedUrl(asset.url);
            setMedia({
              cover: mediaAsset,
              ...(form.featuredMedia.kind === "image" || form.featuredMedia.kind === "gif"
                ? { kind: mediaAsset.kind === "gif" ? "gif" : "image" }
                : {}),
            });
          }
        }}
      />
    </div>
  );
}
