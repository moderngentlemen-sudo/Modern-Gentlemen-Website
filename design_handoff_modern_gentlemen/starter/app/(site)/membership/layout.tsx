import type { Metadata } from "next";

import { canonicalSiteUrl } from "@/lib/db/env";
import { canonicalUrl, pageTitle } from "@/lib/domain/seo";

const DESCRIPTION =
  "The Debrief — Modern Gentlemen membership. The complete archive, the films, and 15% off the store. Three tiers, monthly or annual.";

/** A layout because `membership/page.tsx` is `"use client"` — the monthly/annual
 *  toggle drives price across all three tiers, so the page holds state. */
export const metadata: Metadata = {
  title: pageTitle("Membership"),
  description: DESCRIPTION,
  alternates: { canonical: canonicalUrl(canonicalSiteUrl(), "/membership") },
  openGraph: {
    type: "website",
    title: pageTitle("Membership"),
    description: DESCRIPTION,
    url: canonicalUrl(canonicalSiteUrl(), "/membership"),
  },
};

export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return children;
}
