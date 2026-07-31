import { InvalidDocumentError } from "@/lib/services/documents";
import { InvalidTransitionError } from "@/lib/domain/documents";
import { ForbiddenError, UnauthenticatedError } from "@/lib/domain/permissions";
import { fail, type ActionResult } from "./action-result";

/**
 * Turns a thrown service error into an ActionResult an editor can read.
 *
 * The unknown case is deliberately generic. A Postgres error string can carry
 * table names, constraint names and column values; none of that belongs in a
 * browser, and none of it helps the person trying to publish a page.
 */
export function toActionResult(error: unknown): ActionResult<never> {
  if (error instanceof UnauthenticatedError) {
    return fail("Your session has expired. Sign in again to continue.");
  }

  if (error instanceof ForbiddenError) {
    const [resource, action] = error.permission.split(".");
    return fail(`You do not have permission to ${action} this ${resource}.`);
  }

  if (error instanceof InvalidDocumentError) {
    return fail(
      `This page has ${error.issues.length} validation ${
        error.issues.length === 1 ? "issue" : "issues"
      } and cannot be published yet.`,
      error.issues.map((issue) => ({
        key: issue.key,
        type: issue.type,
        path: issue.path,
        message: issue.message,
      }))
    );
  }

  if (error instanceof InvalidTransitionError) {
    return fail(`A ${error.from} document cannot become ${error.to}.`);
  }

  // A message we wrote ourselves (a slug collision, a missing document) is safe
  // to show; anything else is not.
  if (error instanceof Error && error.name === "Error") return fail(error.message);

  console.error("[admin action]", error);
  return fail("Something went wrong. Please try again.");
}
