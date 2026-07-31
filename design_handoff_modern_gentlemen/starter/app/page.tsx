import { SectionRenderer } from "@/components/SectionRenderer";
import { DEMO_SECTIONS } from "@/lib/demo/home-sections";
// Phase 7 replaces this import with a database read; the Block[] shape is
// identical either way, which is the point of the seam.

/**
 * Homepage — 7 canonical sections rendered from an ordered Block[] (verbatim
 * copy from design_files/Modern Gentlemen Homepage.dc.html). Runs on demo data
 * today; a Supabase `pages.sections` fetch slots in behind this same shape.
 */
export default async function HomePage() {
  const sections = DEMO_SECTIONS;
  return <SectionRenderer sections={sections} />;
}
