import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/homepage";
import { getPage } from "@/lib/db/repositories/pages";
import { requirePermission } from "./auth";

/** Choosing a homepage changes the published site; it never publishes a draft. */
export async function setHomepage(pageId: string): Promise<void> {
  await requirePermission("page.publish");
  await requirePermission("page.write");
  const db = await createClient();
  const page = await getPage(db, pageId);
  if (!page) throw new Error("Page not found.");
  if (page.status !== "published" || !page.published_data) {
    throw new Error("Publish this page before setting it as the homepage.");
  }
  // The database repeats the published-state check while locking the target.
  await repo.setHomepagePageId(db, pageId);
}
