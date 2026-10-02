import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/services/auth";
import { editorialConcept } from "@/lib/domain/editorialCollection";
import { EditorialCollection } from "@/components/sections/EditorialCollection";
import { EditorialArticle } from "@/components/article/EditorialArticle";
import { collectionPreviewById } from "@/components/admin/builder/collectionPreview";
export const metadata = { title: "MG collection preview", robots: { index: false, follow: false } };

export default async function CollectionPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("page.read");
  const { id } = await params;
  const c = editorialConcept(id);
  if (!c) notFound();
  const props = collectionPreviewById(id);
  return (
    <main>
      <p style={{ padding: "12px 24px", font: "11px monospace", borderBottom: "1px solid #8885" }}>
        MODERN GENTLEMEN · {c.id} · Illustrative live preview
      </p>
      {c.kind === "article" ? (
        <EditorialArticle
          preview
          design={{ preset: `collection-${c.id}` }}
          article={{
            slug: "preview",
            title: c.name,
            dek: props.intro,
            category: c.group,
            author: "Modern Gentlemen",
            read: 8,
            image: props.image,
          }}
        >
          <EditorialCollection id={c.id} {...props} />
        </EditorialArticle>
      ) : (
        <EditorialCollection id={c.id} {...props} />
      )}
    </main>
  );
}
