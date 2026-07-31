import type { Metadata } from "next";
import { SectionRenderer, type Block } from "@/components/SectionRenderer";
import { expandPatternRefs } from "@/lib/services/patterns";
import { resolvePreview } from "@/lib/services/preview";
import { BLOCK_TREE_KEY, type DocumentType } from "@/lib/domain/documents";
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
 */
export default async function PreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await resolvePreview(token);

  if (!preview) return <PreviewUnavailable />;

  const sections = await sectionsFor(preview.entityType, preview.data);

  return (
    <>
      <PreviewBar entityType={preview.entityType} expiresAt={preview.expiresAt} />
      {sections.length > 0 ? (
        <SectionRenderer sections={sections} />
      ) : (
        <EmptyDraft entityType={preview.entityType} />
      )}
    </>
  );
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

function EmptyDraft({ entityType }: { entityType: DocumentType }) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-[440px] text-center">
        <p className="font-serif text-lg italic text-mg-fg/50">Nothing to show</p>
        <h1 className="mt-2 font-grotesk text-[28px] font-semibold tracking-[-0.03em]">
          This {entityType} has no sections yet
        </h1>
        <p className="mt-3 text-mg-fg/60">
          The draft is empty. Add a section in the builder and reload this preview.
        </p>
      </div>
    </main>
  );
}
