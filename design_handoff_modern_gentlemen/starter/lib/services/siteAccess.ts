import { cache } from "react";
import { createPublicClient } from "@/lib/db/public";
import { createClient } from "@/lib/db/server";
import type { Json } from "@/lib/db/database.types";
import { requirePermission } from "@/lib/services/auth";
import {
  SITE_ACCESS_KEY,
  lockedSiteAccess,
  resolveSiteAccess,
  siteAccessChangeSchema,
  validateSiteAccessChange,
  type SiteAccessState,
} from "@/lib/domain/siteAccessState";

export const getSiteAccess = cache(async (): Promise<SiteAccessState> => {
  try {
    const { data, error } = await createPublicClient()
      .from("site_settings")
      .select("value, updated_at")
      .eq("key", SITE_ACCESS_KEY)
      .maybeSingle();
    if (error) {
      console.error("Site access lookup failed:", error.message);
      return lockedSiteAccess();
    }
    return resolveSiteAccess(data?.value, data?.updated_at ?? null);
  } catch (error) {
    console.error("Site access is unavailable:", error);
    return lockedSiteAccess();
  }
});

export async function getAdminSiteAccess(): Promise<SiteAccessState> {
  await requirePermission("settings.read");
  const { data, error } = await (
    await createClient()
  )
    .from("site_settings")
    .select("value, updated_at")
    .eq("key", SITE_ACCESS_KEY)
    .maybeSingle();
  if (error || !data) {
    console.error("Admin site access settings are unavailable:", error?.message);
    return lockedSiteAccess();
  }
  return resolveSiteAccess(data.value, data.updated_at);
}

/**
 * Explicit operator action: not a theme draft. A public launch is a security-
 * sensitive change and takes effect without a rebuild when its DB write commits.
 * The editor's own session, settings.write and database RLS all participate.
 */
export async function setSiteAccess(input: unknown): Promise<SiteAccessState> {
  const user = await requirePermission("settings.write");
  const parsed = siteAccessChangeSchema.parse(input);
  validateSiteAccessChange(parsed);
  const db = await createClient();

  const existing = await db
    .from("site_settings")
    .select("value, updated_at")
    .eq("key", SITE_ACCESS_KEY)
    .maybeSingle();
  if (existing.error || !existing.data) {
    throw new Error("Site access settings could not be loaded. Refresh and try again.");
  }
  if (existing.data.updated_at !== parsed.expectedUpdatedAt) {
    throw new Error("Site access changed in another session. Refresh before continuing.");
  }

  const current = resolveSiteAccess(existing.data.value, existing.data.updated_at);
  if (current.source === "fail-closed") {
    throw new Error("The saved site access settings are invalid. Repair them before continuing.");
  }
  const result = await db
    .from("site_settings")
    .update({
      value: {
        mode: parsed.mode,
        scheduledPublicAt: parsed.scheduledPublicAt,
        version: current.version + 1,
      } satisfies Json,
      updated_by: user.id,
    })
    .eq("key", SITE_ACCESS_KEY)
    .eq("updated_at", parsed.expectedUpdatedAt)
    .select("value, updated_at")
    .maybeSingle();

  if (result.error) throw new Error("Site access could not be updated.");
  if (!result.data) {
    throw new Error(
      "Site access changed during the update. Refresh and review before trying again."
    );
  }
  return resolveSiteAccess(result.data.value, result.data.updated_at);
}
