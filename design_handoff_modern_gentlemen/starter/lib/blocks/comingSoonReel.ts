import { field } from "./fields";

/**
 * CS22–CS35: the sizzle-reel coming-soon designs.
 *
 * Fourteen compositions chosen from the Coming Soon mockup gallery. They share
 * one renderer (`components/sections/ReelLanding.tsx`) and one settings group,
 * `reel`, so switching between them keeps the video, launch date and copy.
 * The arrangement of each design is fixed; everything a visitor reads or
 * follows is editable.
 */
export const REEL_DESIGNS = [
  ["22", "Red Clock", "dark"],
  ["23", "Monochrome", "dark"],
  ["24", "Through the Window", "light"],
  ["25", "The Dial", "dark"],
  ["26", "The Line", "dark"],
  ["27", "Frosted Panel", "dark"],
  ["28", "Knockout", "light"],
  ["29", "Red Band", "accent"],
  ["30", "Monogram", "dark"],
  ["31", "The Seal", "dark"],
  ["32", "Pull Quote", "dark"],
  ["33", "Big Seconds", "dark"],
  ["34", "Clock Hands", "dark"],
  ["35", "The Auction", "light"],
] as const;
export type ReelDesignId = (typeof REEL_DESIGNS)[number][0];
export function isReelDesign(id: string): id is ReelDesignId {
  return REEL_DESIGNS.some(([value]) => value === id);
}

/** A file in /public, so a fresh page plays without an upload. Replace it from the media library. */
export const REEL_VIDEO = "/media/coming-soon-reel.mp4";
export const REEL_POSTER = "/media/coming-soon-reel.jpg";

export const REEL_DEFAULTS = {
  video: REEL_VIDEO,
  poster: REEL_POSTER,
  standalone: true,
  caption: "",
  countdown: {
    target: "",
    days: "Days",
    hours: "Hours",
    minutes: "Minutes",
    seconds: "Seconds",
    message: "We are open.",
  },
  placeholder: "Your email address",
};
export type ReelConfig = {
  video?: string;
  poster?: string;
  standalone?: boolean;
  caption?: string;
  countdown?: Partial<typeof REEL_DEFAULTS.countdown>;
  placeholder?: string;
};

export const reelFields = field.group({
  label: "Sizzle reel designs (CS22–CS35)",
  fields: {
    video: field.video({
      label: "Background video",
      default: REEL_VIDEO,
      help: "Muted, looping MP4. Keep it short and under about 5 MB so it starts quickly on phones.",
    }),
    poster: field.image({
      label: "Still image",
      default: REEL_POSTER,
      help: "Shown before the video loads, and instead of it for visitors who prefer reduced motion.",
    }),
    standalone: field.boolean({
      label: "Use standalone page (hide site header/footer)",
      default: true,
    }),
    caption: field.text({
      label: "Video caption",
      default: "",
      help: "Small label beside the video in Frosted Panel and The Auction.",
    }),
    countdown: field.group({
      label: "Launch countdown",
      fields: {
        target: field.text({
          label: "Launch date & time with timezone",
          default: "",
          help: "ISO date with timezone, e.g. 2026-12-01T09:00:00Z. Until a valid date is set the countdown shows dashes; no date is invented.",
        }),
        days: field.text({ label: "Days label", default: "Days" }),
        hours: field.text({ label: "Hours label", default: "Hours" }),
        minutes: field.text({ label: "Minutes label", default: "Minutes" }),
        seconds: field.text({ label: "Seconds label", default: "Seconds" }),
        message: field.text({ label: "Message shown at launch time", default: "We are open." }),
      },
    }),
    placeholder: field.text({ label: "Email placeholder", default: "Your email address" }),
  },
});

/** Starter copy per design. Copy only: no launch date is invented. */
export const REEL_STARTERS: Record<
  ReelDesignId,
  {
    title: string;
    eyebrow?: string;
    intro?: string;
    buttonLabel: string;
    signature?: string;
    brand?: string;
    caption?: string;
    details?: { title: string; text?: string }[];
  }
> = {
  "22": {
    title: "The doors open in",
    intro:
      "Style, grooming, watches and culture, under one considered roof. Sign up and you will hear first.",
    buttonLabel: "Notify me",
  },
  "23": { title: "Soon.", eyebrow: "Modern Gentlemen", buttonLabel: "Notify me" },
  "24": {
    title: "Coming soon",
    eyebrow: "Opening soon",
    intro: "A glimpse through the window. The full house opens shortly.",
    buttonLabel: "Notify me",
  },
  "25": {
    title: "Every second counts. Ours are numbered.",
    eyebrow: "Wound, set and nearly ready",
    intro: "Modern Gentlemen opens soon. Leave your email for first access.",
    signature: "Calibre MG-01",
    buttonLabel: "Notify me",
  },
  "26": { title: "Opening soon", buttonLabel: "Notify me" },
  "27": {
    title: "The doors open shortly.",
    eyebrow: "Coming soon",
    intro: "Style, grooming, watches, culture and film, with a store to match.",
    caption: "Now showing · The Modern Gentlemen reel",
    buttonLabel: "Notify me",
  },
  "28": {
    title: "Soon",
    eyebrow: "Modern Gentlemen",
    intro: "The reel plays through the letters. The whole picture arrives shortly.",
    buttonLabel: "Notify me",
  },
  "29": {
    title: "Be the first through the door.",
    eyebrow: "Doors open soon",
    signature: "Coming soon",
    buttonLabel: "Notify me",
  },
  "30": {
    title: "Our initials, your invitation.",
    eyebrow: "Coming soon",
    buttonLabel: "Notify me",
  },
  "31": {
    title: "Sealed until launch day",
    signature: "London",
    buttonLabel: "Notify me",
  },
  "32": {
    title: "Good things come to those who wait.",
    intro: "Better things come to those who sign up first.",
    signature: "The Editors, Modern Gentlemen",
    buttonLabel: "Sign up first",
  },
  "33": {
    title: "Every second brings us closer.",
    eyebrow: "Counting, quietly",
    buttonLabel: "Notify me",
  },
  "34": { title: "Mark the hour.", eyebrow: "London time, right now", buttonLabel: "Notify me" },
  "35": {
    title: "Lot 001",
    eyebrow: "Evening sale · London",
    intro: "A house of style, grooming, watches and culture, with a store and a club.",
    signature: "Viewing by appointment",
    brand: "Modern Gentlemen (British, est. 2026)",
    caption: "Fig. 1. The house at dusk, moving image.",
    details: [{ title: "Estimate", text: "Beyond reasonable" }],
    buttonLabel: "Register to bid",
  },
};
