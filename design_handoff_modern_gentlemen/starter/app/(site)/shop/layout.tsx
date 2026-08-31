import { SectionRenderer } from "@/components/SectionRenderer";
import { getPublishedGlobalTemplate } from "@/lib/services/publicContent";

/** The singleton shop archive may be framed without making its client filtering dynamic. */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const template = await getPublishedGlobalTemplate("shop");
  return template ? <SectionRenderer sections={template} documentContent={children} /> : children;
}
