import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/**
 * Transcribed from `components/sections/StageLayout.tsx`.
 *
 * A container whose children are placed by `visual.stage` (see
 * `lib/blocks/stage.ts`), not by order. The slot is declared horizontal so the
 * canvas never inserts drop strips between children: they are absolutely
 * placed, and a strip would take space in a layout that has none.
 *
 * Fields are ordered by how often they are reached for: the background first,
 * then how it is shaded, then height and phone behaviour.
 */
export const stageLayout = defineBlock({
  type: "stageLayout",
  label: "Stage — free layout",
  category: "layout",
  description:
    "A full-screen canvas over a video or photograph. Drag every element anywhere, resize or scale it, and add new ones. Phones stack in reading order unless you place them freely.",
  fields: {
    video: field.video({
      label: "Background video",
      help: "Muted, looping MP4 under about 5 MB. Leave empty for a still image or a plain colour.",
    }),
    image: field.image({
      label: "Background image",
      help: "Shown while the video loads, instead of it for reduced motion, or on its own.",
    }),
    color: field.color({ label: "Background colour", default: "#0d0d0d" }),
    tone: field.select({
      label: "Text colour",
      default: "light",
      options: [
        { value: "light", label: "Light text (dark backgrounds)" },
        { value: "dark", label: "Dark text (light backgrounds)" },
        { value: "theme", label: "Follow the site theme" },
      ],
    }),
    scrim: field.number({
      label: "Shade over the background (%)",
      default: 35,
      min: 0,
      max: 90,
      integer: true,
    }),
    shade: field.select({
      label: "Shade style",
      default: "even",
      options: [
        { value: "even", label: "Even" },
        { value: "vignette", label: "Vignette" },
        { value: "bottom", label: "Darker at the bottom" },
        { value: "left", label: "Darker on the left" },
        { value: "none", label: "No shade" },
      ],
    }),
    monochrome: field.number({
      label: "Black and white (%)",
      default: 0,
      min: 0,
      max: 100,
      integer: true,
    }),
    height: field.select({
      label: "Height",
      default: "screen",
      options: [
        { value: "screen", label: "Fill the screen" },
        { value: "half", label: "Most of the screen (60%)" },
        { value: "16x9", label: "Widescreen 16:9" },
        { value: "16x10", label: "16:10" },
        { value: "4x3", label: "4:3" },
        { value: "21x9", label: "Cinema 21:9" },
      ],
    }),
    mobileLayout: field.select({
      label: "On phones",
      default: "stack",
      options: [
        { value: "stack", label: "Stack elements in reading order" },
        { value: "free", label: "Place elements freely" },
      ],
      help: "Reading order is the order in Layers.",
    }),
    mobileAlign: field.select({
      label: "Stacked elements sit",
      default: "center",
      options: [
        { value: "start", label: "At the top" },
        { value: "center", label: "In the middle" },
        { value: "end", label: "At the bottom" },
      ],
    }),
    mobileGap: field.number({
      label: "Stacked spacing (px)",
      default: 24,
      min: 0,
      max: 120,
      integer: true,
    }),
    focusX: field.number({
      label: "Background focus, across (%)",
      default: 50,
      min: 0,
      max: 100,
      integer: true,
    }),
    focusY: field.number({
      label: "Background focus, down (%)",
      default: 50,
      min: 0,
      max: 100,
      integer: true,
    }),
    standalone: field.boolean({
      label: "Hide the site header and footer on this page",
      default: false,
    }),
  },
  slot: { label: "Elements", direction: "horizontal", max: 60 },
  insertChildren: ["nativeHeading", "nativeText"],
});
