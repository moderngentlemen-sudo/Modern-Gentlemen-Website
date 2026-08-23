import type { Metadata } from "next";
import { SectionRenderer, type Block } from "@/components/SectionRenderer";
import { expandPatternRefs } from "@/lib/services/patterns";
import { expandPublicPatterns, soleFramedDocument } from "@/lib/services/publicContent";
import { resolvePreview } from "@/lib/services/preview";
import { readAreas } from "@/lib/blocks/areas";
import {
  collectContentMarkers,
  applyTemplate,
  resolvePreviewArea,
  DOCUMENT_CONTENT_GAP_TYPE,
} from "@/lib/blocks/templateContent";
import { BLOCK_TREE_KEY, type DocumentType } from "@/lib/domain/documents";
import type { BlockTree } from "@/lib/blocks/types";
import { PreviewBar } from "./PreviewBar";

export const metadata: Metadata = {
  title: "Preview — Modern Gentlemen",
  // A preview URL is a capability, not a page. It must never be indexed, and
  // must never be cached — the whole point is that it shows the draft as it is
  // right now.
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/**
 * Renders an unpublished document to whoever holds a valid token.
 *
 * The viewer may be signed out entirely, so nothing here checks a permission:
 * `resolve_preview` in `0010_publishing.sql` performs the capability check
 * inside the database and hands back exactly one document's draft payload. See
 * that migration for why the alternatives were rejected.
 *
 * The draft renders through the same `SectionRenderer` the live site uses, so
 * what an approver sees is what publishing would produce — not a separate
 * preview renderer that could drift from the real one.
 *
 * ⚠️ **`?area=` is how a template names the tree to show, and it is in the URL
 * rather than in the token by necessity, not by preference.** `preview_sessions`
 * has a `context` jsonb column that looks like the right home for it —
 * `resolve_preview` does not return that column, and it is the only way an
 * anonymous holder can read the row at all. Widening the function's return type
 * means dropping and recreating a `security definer` function that `anon`
 * executes, for a value that gates nothing: the token already hands over the
 * template's whole draft payload, **every area of it**, so which one gets drawn
 * is a view concern and not a capability boundary. Keeping it in the query
 * string also lets the bar offer the other areas as plain links instead of
 * minting a token each time somebody switches.
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const preview = await resolvePreview(token);

  if (!preview) return <PreviewUnavailable />;

  // Every type resolves to the same shape, so the bar and the renderer below
  // stay one call each. The five types that keep one ordered tree simply have
  // no area to name — `PreviewBar` reads that as "say nothing about areas"
  // rather than as a template with none, which is a different thing and shows
  // a different message.
  const view: PreviewView =
    preview.entityType === "template"
      ? await templateView(preview.entityId, preview.data, first(query.area))
      : { sections: await sectionsFor(preview.entityType, preview.data), areaNames: [] };

  return (
    <>
      <PreviewBar
        entityType={preview.entityType}
        expiresAt={preview.expiresAt}
        token={token}
        area={view.area}
        areaNames={view.areaNames}
        framing={view.framing}
      />
      {view.sections.length > 0 ? (
        <SectionRenderer sections={view.sections} />
      ) : (
        <EmptyDraft entityType={preview.entityType} area={view.area} />
      )}
    </>
  );
}

/** A repeated query parameter is a malformed link, not a choice to guess at. */
function first(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

interface PreviewView {
  sections: Block[];
  /** The template area on screen. `undefined` for every type that has no areas. */
  area?: string;
  /** Every area this template has, alphabetically. Empty for the other types. */
  areaNames: string[];
  /** The page whose sections stand in at the marker, when exactly one does. */
  framing?: string;
}

/**
 * One area of a template, composed the way the live site composes a page.
 *
 * The composition is `composePublishedPage`'s, with the two trees swapped
 * round: there the page is the subject and the template is the frame, here the
 * template is the subject and a page stands in for the content. Both end at the
 * same `applyTemplate` call, which is what makes a marker nested inside a
 * `columns`/`column` land in the right place without a second rule.
 *
 * **Two pattern expansions with different sources, deliberately.** The
 * template's own tree is a draft being previewed, so its synced patterns
 * resolve draft-first — an editor previewing a layout wants the patterns as
 * they currently stand. The page spliced into it is *live* content, so its
 * patterns resolve exactly as `/` resolves them, published only. Using one
 * source for both would make half the screen a lie in one direction or the
 * other.
 *
 * ⚠️ **`applyTemplate` is called only when the area actually holds a marker.**
 * It returns its second argument when there is none — the right answer for a
 * page (render the page, unframed) and precisely the wrong one here, where it
 * would replace a `header` area's blocks with the stand-in content.
 */
async function templateView(
  templateId: string,
  payload: unknown,
  requested: string | null
): Promise<PreviewView> {
  const areas = readAreas(payload);
  const areaNames = Object.keys(areas).sort();
  const area = resolvePreviewArea(areas, requested);

  // A template with no areas at all — `0003` defaults the column to
  // `{"areas":{}}`, and a row predating the builder can still be in that state.
  if (area === null) return { sections: [], areaNames };

  const tree = await expandPatternRefs(areas[area], { preferDraft: true });
  if (collectContentMarkers(tree).length === 0) return { sections: tree, area, areaNames };

  const framed = await soleFramedDocument(templateId);
  const substitute: BlockTree = framed
    ? await expandPublicPatterns(framed.sections)
    : [{ _key: "documentcontentgap", _type: DOCUMENT_CONTENT_GAP_TYPE, settings: {} }];

  return {
    sections: applyTemplate(tree, substitute),
    area,
    areaNames,
    framing: framed?.title,
  };
}

/**
 * Pulls the block tree out of the payload and expands any synced patterns.
 *
 * `preferDraft` is deliberate: a preview should show patterns as they currently
 * stand, otherwise it would not reflect what publishing this page would
 * actually put on the site.
 */
async function sectionsFor(type: DocumentType, payload: unknown): Promise<Block[]> {
  const key = BLOCK_TREE_KEY[type];
  if (!key) return [];

  const raw = (payload as Record<string, unknown> | null)?.[key];
  if (!Array.isArray(raw)) return [];

  return expandPatternRefs(raw as Block[], { preferDraft: true });
}

/**
 * Shown for a token that is unknown, expired or revoked — the three are not
 * distinguished, so a guesser learns nothing from which message they get.
 */
function PreviewUnavailable() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-[440px] text-center">
        <p className="font-serif text-lg italic text-mg-accentSerif">Preview</p>
        <h1 className="mt-2 font-grotesk text-[28px] font-semibold tracking-[-0.03em]">
          This link has expired
        </h1>
        <p className="mt-3 text-mg-fg/60">
          Preview links are temporary. Ask whoever shared it with you for a new one.
        </p>
      </div>
    </main>
  );
}

/**
 * `area` is named when there is one, because "this template has no sections
 * yet" is misleading for a template whose *other* area is full — and switching
 * areas is one click away in the bar below.
 */
function EmptyDraft({ entityType, area }: { entityType: DocumentType; area?: string }) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-[440px] text-center">
        <p className="font-serif text-lg italic text-mg-fg/50">Nothing to show</p>
        <h1 className="mt-2 font-grotesk text-[28px] font-semibold tracking-[-0.03em]">
          {area ? `The ${area} area is empty` : `This ${entityType} has no sections yet`}
        </h1>
        <p className="mt-3 text-mg-fg/60">
          {area
            ? "Add a section to this area in the builder, or switch areas below."
            : "The draft is empty. Add a section in the builder and reload this preview."}
        </p>
      </div>
    </main>
  );
}
