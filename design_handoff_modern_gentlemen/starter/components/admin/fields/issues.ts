/**
 * Mapping validation issues onto the controls that caused them.
 *
 * `BlockIssue.path` is a dotted path within a block's props — `items.0.title` —
 * and `validate.ts` produces it in that shape *specifically* so an editor can be
 * put on the offending control rather than told "something is wrong with this
 * page". These helpers are the other half of that contract.
 */

import type { BlockIssue } from "@/lib/blocks/validate";

/** A control's path as zod would render it: `["items", 0, "title"]` → `items.0.title`. */
export function pathKey(path: readonly (string | number)[]): string {
  return path.join(".");
}

/** Issues belonging to exactly this control. */
export function issuesFor(issues: readonly BlockIssue[], path: readonly (string | number)[]) {
  const key = pathKey(path);
  return issues.filter((issue) => issue.path === key);
}

/**
 * Does an issue exist anywhere *below* this path?
 *
 * The `.` matters: without it `items.1` would count `items.10`'s issues as its
 * own, and a collapsed group would show a badge for a sibling's problem.
 */
export function hasNestedIssues(
  issues: readonly BlockIssue[],
  path: readonly (string | number)[]
): boolean {
  const prefix = `${pathKey(path)}.`;
  return issues.some((issue) => issue.path.startsWith(prefix));
}

/** How many issues sit at or below this path — the count a section header shows. */
export function countIssuesAtOrBelow(
  issues: readonly BlockIssue[],
  path: readonly (string | number)[]
): number {
  const key = pathKey(path);
  const prefix = `${key}.`;
  return issues.filter((issue) => issue.path === key || issue.path.startsWith(prefix)).length;
}

/**
 * Strips the document-level tree prefix a service adds.
 *
 * `validateDocumentPayload` prefixes each issue with the path of the tree it
 * came from, so a field issue arrives as `sections.items.0.title` while a
 * *whole-block* issue arrives as exactly `sections` — the prefix and nothing
 * else. That second case has to map to `""`, not to a control.
 */
export function stripTreePrefix(path: string, treeKey: string): string {
  if (path === treeKey) return "";
  return path.startsWith(`${treeKey}.`) ? path.slice(treeKey.length + 1) : path;
}

/** Every issue rewritten into block-relative form. */
export function toBlockRelative(issues: readonly BlockIssue[], treeKey: string): BlockIssue[] {
  return issues.map((issue) => ({ ...issue, path: stripTreePrefix(issue.path, treeKey) }));
}
