import { flattenBlocks } from "@/lib/blocks/traverse";
import type { BlockNode, BlockTree } from "@/lib/blocks/types";

import { blockLabel } from "./history";

/**
 * Advice for the Health pane: things worth a second look that do **not** block
 * publishing. Validation (`lib/blocks/validate.ts`) decides what is publishable;
 * this only reads the tree for common accessibility and layout slips, and
 * offers a one-click fix where the fix is unambiguous.
 */

export type AdviceFix =
  | { kind: "showOnAllDevices" }
  | { kind: "unhide" }
  | { kind: "setHeadingLevel"; level: string }
  | { kind: "remove" };

export interface Advice {
  id: string;
  key: string;
  message: string;
  fix?: AdviceFix & { label: string };
}

function settingsOf(node: BlockNode): Record<string, unknown> {
  return (node.settings ?? node) as Record<string, unknown>;
}

export function adviseTree(tree: BlockTree): Advice[] {
  const out: Advice[] = [];
  const nodes = flattenBlocks(tree);
  let h1Seen = false;
  let previousLevel = 0;

  for (const node of nodes) {
    const label = blockLabel(node);
    const s = settingsOf(node);

    if (node.visibility?.devices && node.visibility.devices.length === 0) {
      out.push({
        id: `devices:${node._key}`,
        key: node._key,
        message: `${label} is set to show on no device, so nobody will see it.`,
        fix: { kind: "showOnAllDevices", label: "Show on all devices" },
      });
    } else if (node.visibility?.hidden) {
      out.push({
        id: `hidden:${node._key}`,
        key: node._key,
        message: `${label} is hidden from the public page.`,
        fix: { kind: "unhide", label: "Show it" },
      });
    }

    if (node._type === "nativeImage" && s.src && !(typeof s.alt === "string" && s.alt.trim())) {
      out.push({
        id: `alt:${node._key}`,
        key: node._key,
        message: `${label} has no alternative text. Add some unless the image is decorative.`,
      });
    }

    if (node._type === "nativeHeading" && !node.visibility?.hidden) {
      const level = Number(String(s.level ?? "h2").slice(1)) || 2;
      if (level === 1 && h1Seen) {
        out.push({
          id: `h1:${node._key}`,
          key: node._key,
          message: `${label} is a second H1. A page reads best with one.`,
          fix: { kind: "setHeadingLevel", level: "h2", label: "Make it H2" },
        });
      } else if (previousLevel && level > previousLevel + 1) {
        const fixed = `h${previousLevel + 1}`;
        out.push({
          id: `skip:${node._key}`,
          key: node._key,
          message: `${label} jumps from H${previousLevel} to H${level}; screen readers use the outline.`,
          fix: { kind: "setHeadingLevel", level: fixed, label: `Make it ${fixed.toUpperCase()}` },
        });
      }
      if (level === 1) h1Seen = true;
      previousLevel = level;
    }

    if ((node._type === "columns" || node._type === "gridLayout") && !node.children?.length) {
      out.push({
        id: `empty:${node._key}`,
        key: node._key,
        message: `${label} is empty and renders nothing.`,
        fix: { kind: "remove", label: "Remove it" },
      });
    }
  }
  return out;
}
