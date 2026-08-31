import type { Metadata } from "next";

import { SectionRenderer } from "@/components/SectionRenderer";
import { canonicalSiteUrl } from "@/lib/db/env";
import { canonicalUrl, pageTitle } from "@/lib/domain/seo";
import { getPublishedGlobalTemplate } from "@/lib/services/publicContent";

const DESCRIPTION =
  "The Modern Gentlemen store — considered objects for style, grooming, watches and the road. Free UK shipping over £50.";

/** Filtered query-string views all describe the same canonical store. */
export const metadata: Metadata = {
  title: pageTitle("The Store"),
  description: DESCRIPTION,
  alternates: { canonical: canonicalUrl(canonicalSiteUrl(), "/shop") },
  openGraph: {
    type: "website",
    title: pageTitle("The Store"),
    description: DESCRIPTION,
    url: canonicalUrl(canonicalSiteUrl(), "/shop"),
  },
};

/** The singleton shop archive may be framed without making its client filtering dynamic. */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const template = await getPublishedGlobalTemplate("shop");
  return template ? <SectionRenderer sections={template} documentContent={children} /> : children;
}
