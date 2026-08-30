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

import type { ZodTypeAny } from "zod";

import { bindingQuerySchema, hasBindingShape } from "./bindingDescriptor";
import { manifestFor } from "./manifests";
import { blockProps } from "./normalize";
import { walkBlocks } from "./traverse";
import { BLOCK_SPACING, type BlockNode, type BlockSlot, type BlockTree } from "./types";

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

  for (const field of ["spaceBefore", "spaceAfter"] as const) {
    const value = node.design?.[field];
    if (value !== undefined && !(BLOCK_SPACING as readonly unknown[]).includes(value)) {
      issues.push({
        key,
        type: node._type,
        path: `design.${field}`,
        message: "Choose a supported section spacing value.",
      });
    }
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

  const props = blockProps(node);

  /**
   * A bound field holds `{ $bind: … }` where its literal value would sit, and
   * the literal type would of course reject that — `latestGrid.items` bound to a
   * query is not an array. Before this, every such block failed publish
   * validation, so no page carrying a binding could be published at all. It
   * stayed latent because the seed data is entirely literals.
   *
   * Bound fields are therefore lifted out and their queries checked on their
   * own, and the rest of the props are validated against a schema with those
   * fields omitted. Omitting rather than unioning is what keeps issue paths
   * precise: a `z.union` reports a failure inside a bound group at the group's
   * path, and the properties panel needs `article.href`, not `article`.
   */
  const boundFields = manifest.bindable.filter((name) => hasBindingShape(props[name]));

  let target: Record<string, unknown> = props;
  let schema: ZodTypeAny = manifest.strictSchema;

  if (boundFields.length > 0) {
    target = { ...props };
    for (const name of boundFields) delete target[name];

    schema = manifest.strictSchema.omit(
      Object.fromEntries(boundFields.map((name) => [name, true as const]))
    );

    for (const name of boundFields) {
      const query = (props[name] as { $bind: unknown }).$bind;
      const parsedQuery = bindingQuerySchema.safeParse(query);
      if (parsedQuery.success) continue;
      for (const issue of parsedQuery.error.issues) {
        issues.push({
          key,
          type: node._type,
          path: [name, "$bind", ...issue.path].join("."),
          message: issue.message,
        });
      }
    }
  }

  const parsed = schema.safeParse(target);
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

  issues.push(...slotIssues(node, key, manifest.slot));

  return { ok: issues.length === 0, issues };
}

/**
 * The container contract: what a block's `children` may hold.
 *
 * Only the *shape* of the slot is checked here. Each child is validated in its
 * own right by `validateTree`, whose `walkBlocks` already descends — so this
 * deliberately says nothing about a child's props, and a nested tree gets the
 * same scrutiny as a flat one for free.
 *
 * Exported for its own tests: `allow` has no consumer among the shipped
 * manifests (`columns` accepts anything), so reaching that branch through a
 * real manifest is impossible and testing it through one would only assert
 * that today's policy is today's policy.
 */
export function slotIssues(
  node: BlockNode,
  key: string,
  slot: BlockSlot | undefined
): BlockIssue[] {
  const children = Array.isArray(node.children) ? node.children : [];
  const issues: BlockIssue[] = [];

  if (!slot) {
    // Silence on a leaf with no children is the common case; children on a leaf
    // means the tree has been built by something that ignored the manifest.
    if (children.length > 0) {
      issues.push({
        key,
        type: node._type,
        path: "children",
        message: `"${node._type}" does not accept child blocks.`,
      });
    }
    return issues;
  }

  if (slot.min !== undefined && children.length < slot.min) {
    issues.push({
      key,
      type: node._type,
      path: "children",
      message: `${slot.label} needs at least ${slot.min} block${slot.min === 1 ? "" : "s"}.`,
    });
  }

  if (slot.max !== undefined && children.length > slot.max) {
    issues.push({
      key,
      type: node._type,
      path: "children",
      message: `${slot.label} holds at most ${slot.max} block${slot.max === 1 ? "" : "s"}.`,
    });
  }

  if (slot.allow) {
    children.forEach((child, index) => {
      if (slot.allow!.includes(child._type)) return;
      issues.push({
        key,
        type: node._type,
        // Indexed, so the panel can point at the offending child rather than
        // the container.
        path: `children.${index}`,
        message: `"${child._type}" is not allowed in ${slot.label}.`,
      });
    });
  }

  return issues;
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
