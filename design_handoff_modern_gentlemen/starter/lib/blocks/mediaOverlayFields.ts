import { field, options, type FieldSet } from "./fields";
export const mediaOverlayFields: FieldSet = {
  mode: field.select({ label: "Overlay", options: options("none", "solid", "linear", "radial") }),
  color: field.text({ label: "Overlay color" }),
  endColor: field.text({ label: "Gradient end color" }),
  opacity: field.number({ label: "Overlay opacity", min: 0, max: 100 }),
  angle: field.number({ label: "Gradient angle", min: 0, max: 360 }),
  start: field.number({ label: "First stop", min: 0, max: 100 }),
  end: field.number({ label: "Last stop", min: 0, max: 100 }),
  x: field.number({ label: "Gradient center X", min: 0, max: 100 }),
  y: field.number({ label: "Gradient center Y", min: 0, max: 100 }),
};
