/** Stable ids from the approved mockup boards; independent of the legacy library numbers. */
export const SECTION_STUDIES = [
  ["01", "Editorial Index", "index", "light"],
  ["02", "Collector’s Edit", "collection", "dark"],
  ["03", "Destination Dossier", "dossier", "light"],
  ["04", "Inside the Atelier", "film", "dark"],
  ["05", "Private Gathering", "gathering", "light"],
  ["06", "Reading Path", "path", "light"],
  ["07", "The Lead & the Brief", "brief", "light"],
  ["08", "The Typographic Statement", "statement", "light"],
  ["09", "The Editor’s Letter", "letter", "light"],
  ["10", "The Double Exposure", "diptych", "dark"],
  ["11", "The Category Crossroads", "crossroads", "dark"],
  ["12", "The Weekend Reading Room", "reading", "light"],
  ["13", "The Wardrobe Equation", "wardrobe", "light"],
  ["14", "The Material Study", "material", "dark"],
  ["15", "The Object in Profile", "anatomy", "dark"],
  ["16", "The Comparison Edit", "comparison", "light"],
  ["17", "The Seasonal Lookbook", "lookbook", "light"],
  ["18", "The Daily Ritual", "ritual", "dark"],
  ["19", "The City Field Notes", "fieldnotes", "light"],
  ["20", "The Room with a View", "panorama", "light"],
  ["21", "The Address Book", "directory", "light"],
  ["22", "The Long Way Home", "journey", "dark"],
  ["23", "The Table Setting", "table", "light"],
  ["24", "The Architectural Detail", "architecture", "light"],
  ["25", "The Conversation Portrait", "portrait", "dark"],
  ["26", "The Culture Calendar", "calendar", "light"],
  ["27", "The Screening Room", "screening", "dark"],
  ["28", "The Reading Shelf", "shelf", "light"],
  ["29", "The Creative Process", "process", "light"],
  ["30", "The Photo Essay", "essay", "dark"],
  ["31", "The Correspondence", "correspondence", "light"],
  ["32", "The Membership Invitation", "invitation", "dark"],
  ["33", "The Experience Triptych", "triptych", "light"],
  ["34", "The Partnership Canvas", "partnership", "light"],
  ["35", "The Manifesto Strip", "manifesto", "accent"],
  ["36", "The Next Chapter", "next", "light"],
] as const;

export type SectionStudy = (typeof SECTION_STUDIES)[number];
export type SectionStudyId = SectionStudy[0];
export type SectionStudyType = `mgStudy${SectionStudyId}`;
export type SectionStudyLayout = SectionStudy[2];

export function sectionStudyType(id: SectionStudyId): SectionStudyType {
  return `mgStudy${id}`;
}

/** New study actions fail closed without changing any legacy link behavior. */
export function studyHref(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const href = value.trim();
  if (/[\u0000-\u0020\\]/.test(href)) return undefined;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("#")) return href;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) return href;
  return undefined;
}
