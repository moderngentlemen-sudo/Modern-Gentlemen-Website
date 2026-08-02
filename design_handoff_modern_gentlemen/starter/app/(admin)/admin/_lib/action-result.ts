/**
 * The shape every admin server action returns.
 *
 * This lives in its own module, and the folder is underscore-prefixed so Next
 * treats it as private and never routes it. A `"use server"` file may export
 * **only** async functions, so a type declared beside the actions would break
 * `next build` — the same class of build-time-only rule as "route files may only
 * export the page component", which PROGRESS.md already records the repo hitting
 * once.
 *
 * Actions return this rather than throwing. An exception crossing the server
 * boundary reaches the client as a generic digest with no message, so every
 * failure an editor can cause has to come back as data.
 */

export interface SerializedIssue {
  key: string;
  type: string;
  path: string;
  message: string;
}

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; issues?: SerializedIssue[] };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, issues?: SerializedIssue[]): ActionResult<never> {
  return { ok: false, error, issues };
}
