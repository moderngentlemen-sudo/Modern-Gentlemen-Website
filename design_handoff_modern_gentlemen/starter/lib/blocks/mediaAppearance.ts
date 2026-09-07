import { field } from "./fields";
export const mediaAppearanceFields = {
  brightness: field.number({ label: "Brightness (%)", min: 0, max: 200 }),
  contrast: field.number({ label: "Contrast (%)", min: 0, max: 200 }),
  saturation: field.number({ label: "Saturation (%)", min: 0, max: 200 }),
  grayscale: field.number({ label: "Grayscale (%)", min: 0, max: 100 }),
  opacity: field.number({ label: "Opacity (%)", min: 0, max: 100 }),
  radius: field.number({ label: "Corner radius (px)", min: 0, max: 200 }),
  focalX: field.number({ label: "Horizontal focal point (%)", min: 0, max: 100 }),
  focalY: field.number({ label: "Vertical focal point (%)", min: 0, max: 100 }),
};
export type MediaAppearance = Partial<Record<keyof typeof mediaAppearanceFields, number>>;
export function mediaAppearanceStyle(value?: MediaAppearance) {
  if (!value) return undefined;
  const valid = Object.fromEntries(
    Object.entries(value).filter(
      ([key, n]) =>
        key in mediaAppearanceFields &&
        typeof n === "number" &&
        Number.isFinite(n) &&
        n >= 0 &&
        n <= mediaAppearanceFields[key as keyof MediaAppearance].max!
    )
  );
  const filters = ["brightness", "contrast", "saturation", "grayscale"]
    .filter((key) => valid[key] !== undefined)
    .map((key) => `${key === "saturation" ? "saturate" : key}(${valid[key]}%)`);
  const style = {
    filter: filters.length ? filters.join(" ") : undefined,
    opacity: valid.opacity === undefined ? undefined : valid.opacity / 100,
    borderRadius: valid.radius,
    objectPosition:
      valid.focalX === undefined && valid.focalY === undefined
        ? undefined
        : `${valid.focalX ?? 50}% ${valid.focalY ?? 50}%`,
  };
  return Object.values(style).some((v) => v !== undefined) ? style : undefined;
}
