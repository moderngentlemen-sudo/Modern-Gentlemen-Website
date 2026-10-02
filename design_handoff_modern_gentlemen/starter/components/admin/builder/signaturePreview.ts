import {
  MG_SIGNATURE_SECTIONS,
  SIGNATURE_DEFAULTS,
  signatureType,
  type SignatureId,
  type SignatureProps,
} from "@/lib/blocks/mgSignatureSections";

const architecture = "/images/studio/mega-menu-architecture.png";
const tailoring = "/images/studio/editorial-tailoring.png";
const watch = "/images/signature/watch-placeholder.svg";
const road = "/images/hero-cover.jpg";
const portraits = "/images/style-mono.jpg";

/** Illustration is confined to the picker and gallery, never inserted into a document. */
const featureImages: Partial<Record<SignatureId, string>> = {
  coverStory: portraits,
  dispatchDesk: tailoring,
  styleForecast: tailoring,
  capsuleWardrobe: portraits,
  openRoad: road,
  garageNotes: road,
  fortyEightHours: architecture,
  chefsCounter: "/images/signature/table-placeholder.svg",
  cellarNotes: "/images/signature/cellar-placeholder.svg",
  screeningNotes: road,
  inGoodCompany: portraits,
  livingWell: architecture,
  residence: architecture,
  brandPerspective: tailoring,
};
const cardImages: Partial<Record<SignatureId, string[]>> = {
  watchVault: [watch, watch, watch],
  greatEscapes: [architecture, architecture, architecture],
  hotelRegister: [architecture, architecture, architecture],
  afterHours: [architecture, "/images/signature/table-placeholder.svg", portraits],
  makersMethods: ["/images/film-tailor.jpg", tailoring, portraits, tailoring],
  livingWell: [architecture, architecture, architecture],
  dailyRitual: ["/images/grooming.jpg", portraits, tailoring],
  mgPresents: [architecture, "/images/signature/table-placeholder.svg", portraits],
};

export function signaturePreview(type: string): Partial<SignatureProps> {
  const section = MG_SIGNATURE_SECTIONS.find(({ id }) => signatureType(id) === type);
  if (!section) return {};
  const image = featureImages[section.id];
  const images = cardImages[section.id];
  return {
    ...(image
      ? { image, imageAlt: "Illustrative design image; replace with approved photography" }
      : {}),
    ...(images
      ? {
          items: SIGNATURE_DEFAULTS[section.id].items?.map((entry, index) => ({
            ...entry,
            image: images[index % images.length],
            alt: "Illustrative design image; replace with approved photography",
          })),
        }
      : {}),
  };
}
