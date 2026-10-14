"use server";

import { ok } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";
import { setSiteAccess } from "@/lib/services/siteAccess";

/** The public cannot invoke this successfully: settings.write + RLS are required. */
export async function changeSiteAccessAction(input: unknown) {
  try {
    return ok(await setSiteAccess(input));
  } catch (error) {
    return toActionResult(error);
  }
}
