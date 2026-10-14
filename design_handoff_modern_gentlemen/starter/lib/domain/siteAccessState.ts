import { z } from "zod";

export const SITE_ACCESS_MODES = ["homepage-only", "private-preview", "public"] as const;
export type SiteAccessMode = (typeof SITE_ACCESS_MODES)[number];
export const SITE_ACCESS_KEY = "site-access-control";

const storedAccessSchema = z
  .object({
    mode: z.enum(["inherit", ...SITE_ACCESS_MODES]),
    scheduledPublicAt: z.string().datetime({ offset: true }).nullable(),
    version: z.number().int().min(0),
  })
  .strict();

export type StoredSiteAccess = z.infer<typeof storedAccessSchema>;

export interface SiteAccessState {
  /** Manually selected mode, prior to any scheduled launch. */
  mode: SiteAccessMode;
  /** The mode to enforce right now, including an elapsed scheduled launch. */
  effectiveMode: SiteAccessMode;
  scheduledPublicAt: string | null;
  updatedAt: string | null;
  version: number;
  source: "database" | "environment" | "fail-closed";
}

export const INITIAL_SITE_ACCESS: StoredSiteAccess = {
  mode: "inherit",
  scheduledPublicAt: null,
  version: 0,
};

export function environmentSiteAccessMode(): SiteAccessMode {
  if (process.env.SITE_ACCESS_MODE === "public") return "public";
  if (process.env.SITE_ACCESS_MODE === "private-preview") return "private-preview";
  return "homepage-only";
}

/**
 * An absent setting inherits the existing deployment's env choice, preserving
 * CI's SITE_ACCESS_MODE=public baseline. A malformed *present* setting, or a
 * database read error, must never inherit a public env: fail closed instead.
 */
export function resolveSiteAccess(
  raw: unknown,
  updatedAt: string | null,
  now = new Date()
): SiteAccessState {
  if (raw === null || raw === undefined) {
    const mode = environmentSiteAccessMode();
    return {
      mode,
      effectiveMode: mode,
      scheduledPublicAt: null,
      updatedAt,
      version: 0,
      source: "environment",
    };
  }
  const parsed = storedAccessSchema.safeParse(raw);
  if (!parsed.success) return lockedSiteAccess();
  const entry = parsed.data;
  const mode = entry.mode === "inherit" ? environmentSiteAccessMode() : entry.mode;
  const launched = entry.scheduledPublicAt !== null && Date.parse(entry.scheduledPublicAt) <= now.getTime();
  return {
    mode,
    effectiveMode: launched ? "public" : mode,
    scheduledPublicAt: entry.scheduledPublicAt,
    updatedAt,
    version: entry.version,
    source: entry.mode === "inherit" ? "environment" : "database",
  };
}

export function lockedSiteAccess(): SiteAccessState {
  return {
    mode: "homepage-only",
    effectiveMode: "homepage-only",
    scheduledPublicAt: null,
    updatedAt: null,
    version: 0,
    source: "fail-closed",
  };
}

export function staffCanBrowse(mode: SiteAccessMode, isStaff: boolean): boolean {
  return mode === "public" || isStaff;
}

export function showPublicChrome(mode: SiteAccessMode, isStaff: boolean): boolean {
  return mode === "public" || (mode === "private-preview" && isStaff);
}

/** Only accepted from admin actions, never a public or admin-auth bypass. */
export const siteAccessChangeSchema = z
  .object({
    mode: z.enum(SITE_ACCESS_MODES),
    scheduledPublicAt: z.string().datetime({ offset: true }).nullable(),
    expectedUpdatedAt: z.string().min(1),
    confirmation: z.enum(["CONFIRM", "LAUNCH", "SCHEDULE"]),
  })
  .strict();

export function validateSiteAccessChange(
  input: z.infer<typeof siteAccessChangeSchema>,
  now = new Date()
) {
  const { mode, scheduledPublicAt, confirmation } = input;
  if (scheduledPublicAt && mode === "public") {
    throw new Error("The public mode is already live; choose a restricted mode to schedule launch.");
  }
  if (scheduledPublicAt) {
    if (confirmation !== "SCHEDULE") throw new Error("Scheduling requires confirmation.");
    const when = Date.parse(scheduledPublicAt);
    if (when <= now.getTime() + 60_000 || when > now.getTime() + 366 * 86_400_000) {
      throw new Error("Schedule a launch more than one minute ahead and within one year.");
    }
  } else if (mode === "public") {
    if (confirmation !== "LAUNCH") throw new Error("Type LAUNCH to open the website to everyone.");
  } else if (confirmation !== "CONFIRM") {
    throw new Error("Confirm the access change before applying it.");
  }
}

/** Useful for the three state cards and all status indicators. */
export const SITE_ACCESS_LABELS: Record<SiteAccessMode, string> = {
  "homepage-only": "Homepage Only",
  "private-preview": "Private Preview",
  public: "Public Launch",
};
