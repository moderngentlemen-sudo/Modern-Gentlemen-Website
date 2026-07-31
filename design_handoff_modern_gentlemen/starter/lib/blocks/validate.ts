/**
 * Publish validation — the authoring-time counterpart to `normalize.ts`.
 *
 * Where the renderer is deliberately forgiving, this is deliberately strict:
 * it uses each manifest's `strictSchema`, so a prop the manifest does not
 * declare is an issue rather than something quietly dropped. An undeclared prop
 * almost always means a manifest has fallen behind its component, and finding
 * that here beats finding it as a missing element on a published page.
 *
 * Issues carry the block's `_key` and a field path so the builder can put the
 * editor's cursor on the offending control rather than saying "something is
 * wrong with this page".
 */

import { manifestFor } from "./manifests";
import { blockProps } from "./normalize";
import { walkBlocks } from "./traverse";
import type { BlockNode, BlockTree } from "./types";

export interface BlockIssue {
  /** `_key` of the offending block, or `""` when the node has none. */
  key: string;
  type: string;
  /** Dotted path within the block's props; `""` for a whole-block issue. */
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: BlockIssue[];
}

export function validateBlock(node: BlockNode): ValidationResult {
  const key = typeof node._key === "string" ? node._key : "";
  const issues: BlockIssue[] = [];

  if (!key) {
    issues.push({
      key: "",
      type: node._type,
      path: "_key",
      message: "Block has no _key. Keys are how reordering keeps identity.",
    });
  }

  const manifest = manifestFor(node._type);
  if (!manifest) {
    issues.push({
      key,
      type: node._type,
      path: "",
      message: `Unknown block type "${node._type}" — no manifest is registered for it.`,
    });
    return { ok: false, issues };
  }

  const parsed = manifest.strictSchema.safeParse(blockProps(node));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        key,
        type: node._type,
        path: issue.path.join("."),
        message: issue.message,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function validateTree(tree: BlockTree | undefined): ValidationResult {
  const issues: BlockIssue[] = [];
  const seenKeys = new Map<string, number>();

  walkBlocks(tree, (node) => {
    issues.push(...validateBlock(node).issues);

    if (typeof node._key === "string" && node._key) {
      const count = (seenKeys.get(node._key) ?? 0) + 1;
      seenKeys.set(node._key, count);
      // Reported once, on the first repeat, rather than on every later one.
      if (count === 2) {
        issues.push({
          key: node._key,
          type: node._type,
          path: "_key",
          message: `Duplicate _key "${node._key}" — keys must be unique within a tree.`,
        });
      }
    }
  });

  return { ok: issues.length === 0, issues };
}

/** One-line-per-issue rendering, for CLI output and test failure messages. */
export function formatIssues(issues: BlockIssue[]): string {
  return issues
    .map((i) => `  ${i.type}[${i.key || "?"}]${i.path ? `.${i.path}` : ""}: ${i.message}`)
    .join("\n");
}
