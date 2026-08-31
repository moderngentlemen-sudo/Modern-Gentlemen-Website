import type { ReactNode } from "react";

import type { BlockVisibility } from "@/lib/blocks/types";

const ALL_DEVICES = ["desktop", "tablet", "mobile"] as const;

function scopeForKey(key: string): string {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `visibility-${(hash >>> 0).toString(36)}`;
}

export function visibilityCss(blockKey: string, devices: BlockVisibility["devices"]) {
  const scope = scopeForKey(blockKey);
  const selector = `[data-mg-visibility="${scope}"]`;
  const selected = new Set(devices ?? ALL_DEVICES);
  const rules = [`${selector}{display:none}`];

  if (selected.has("desktop")) {
    rules.push(`@media(min-width:1025px){${selector}{display:contents}}`);
  }
  if (selected.has("tablet")) {
    rules.push(`@media(min-width:681px) and (max-width:1024px){${selector}{display:contents}}`);
  }
  if (selected.has("mobile")) {
    rules.push(`@media(max-width:680px){${selector}{display:contents}}`);
  }

  return { scope, css: rules.join("") };
}

/**
 * Public responsive visibility without changing legacy layout geometry.
 *
 * A globally hidden block renders nothing. Device targeting uses
 * `display:contents` while visible, so the extra persistence boundary does not
 * become a flex/grid item or otherwise change the component's placement.
 * Untargeted legacy blocks return their child directly and keep the verified
 * DOM exactly as it was.
 */
export function BlockVisibilityFrame({
  blockKey,
  visibility,
  children,
}: {
  blockKey: string;
  visibility?: BlockVisibility;
  children: ReactNode;
}) {
  if (visibility?.hidden === true) return null;

  const devices = visibility?.devices;
  if (!devices || ALL_DEVICES.every((device) => devices.includes(device))) return children;

  const { scope, css } = visibilityCss(blockKey, devices);
  return (
    <>
      <style data-mg-visibility-style={scope}>{css}</style>
      <div data-mg-visibility={scope}>{children}</div>
    </>
  );
}
