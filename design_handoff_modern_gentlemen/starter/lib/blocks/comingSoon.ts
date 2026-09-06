import { AFTER_HOURS_PHOTO } from "./afterHours";
import type { BlockTree } from "./types";

/** Stable labels shared by page creation, template creation and the live studio. */
export const COMING_SOON_DESIGNS = [
  ["01", "The Masthead", "light"],
  ["02", "Split Tailoring", "light"],
  ["03", "Panoramic Arrival", "light"],
  ["04", "Red Statement", "accent"],
  ["05", "After Hours", "dark"],
  ["06", "Architectural Pause", "light"],
  ["07", "A Letter to You", "light"],
  ["08", "Objects of Interest", "light"],
  ["09", "The Quiet Frame", "light"],
  ["10", "Black Tie", "dark"],
  ["11", "Column Culture", "light"],
  ["12", "Red Margin", "light"],
  ["13", "Contact Sheet", "dark"],
  ["14", "Manifesto", "light"],
  ["15", "The Window", "light"],
  ["16", "Atelier Notes", "light"],
  ["17", "Horizon Line", "dark"],
  ["18", "Index of Intent", "light"],
  ["19", "The Portrait", "dark"],
  ["20", "The Invitation", "dark"],
  ["21", "After Hours — Refined Countdown", "dark"],
] as const;
export type ComingSoonId = (typeof COMING_SOON_DESIGNS)[number][0];
export const COMING_SOON_IDS = COMING_SOON_DESIGNS.map(([id]) => id) as [
  ComingSoonId,
  ...ComingSoonId[],
];

/** Fresh data on every call. Only the chosen design is saved; no launch date or photo is invented. */
export function comingSoonSections(variant: ComingSoonId): BlockTree {
  if (!COMING_SOON_DESIGNS.some(([id]) => id === variant))
    throw new Error("Unknown coming-soon design");
  return [
    {
      _key: "comingsoon",
      _type: "comingSoonStudio",
      settings: {
        variant,
        title: "Coming soon",
        brand: "Modern Gentlemen",
        showSignup: variant === "21",
        ...(variant === "21"
          ? { image: AFTER_HOURS_PHOTO, imageAlt: "A man walking along a wet city street at night" }
          : {}),
      },
    },
  ];
}
export function comingSoonTemplateAreas(variant: ComingSoonId): Record<string, BlockTree> {
  return {
    main: [
      ...comingSoonSections(variant),
      { _key: "pagecontent", _type: "documentContent", settings: {} },
    ],
  };
}
