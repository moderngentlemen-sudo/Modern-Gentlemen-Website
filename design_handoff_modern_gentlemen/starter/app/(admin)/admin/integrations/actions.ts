"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSource, deleteSource } from "@/lib/services/ingestion";
import { ok, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

/**
 * Source-list actions.
 *
 * One export per operation, written out rather than generated — the reason the
 * theme, navigation and article actions all record: a `"use server"` module may
 * export only async functions, and Next assigns each export an action id at
 * build time.
 *
 * No permission check here. `lib/services/ingestion.ts` asserts
 * `integration.write` on both of these and RLS re-asserts it underneath.
 */

/**
 * A discriminated union rather than one schema with optional halves.
 *
 * The previous version required `url` and `itemPath` for every kind, which was
 * honest while XML was the only one. With two adapters, a shared schema would
 * either demand a feed URL from a Shopify source or make both optional — and
 * "optional" here means a source can be created with no way to reach anything,
 * failing at the first run instead of at the form.
 *
 * `native` is deliberately absent: `0005_commerce.sql` seeds the one native
 * source and nothing should create a second.
 */
const CreateXmlFeed = z.object({
  name: z.string().trim().min(1, "A source needs a name."),
  kind: z.literal("xml_feed"),
  url: z.string().trim().min(1, "A feed needs a URL."),
  itemPath: z.string().trim().min(1, "Name the repeating element."),
});

const CreateShopify = z.object({
  name: z.string().trim().min(1, "A source needs a name."),
  kind: z.literal("shopify"),
  shopDomain: z.string().trim().min(1, "A Shopify source needs its myshopify.com domain."),
  /**
   * Required at creation, unlike a feed's. There is no anonymous Shopify
   * products endpoint, so a source without one cannot run at all.
   */
  credentialsRef: z
    .string()
    .trim()
    .min(1, "Name the environment variable holding the Admin API token."),
});

const Create = z.discriminatedUnion("kind", [CreateXmlFeed, CreateShopify]);

function invalid(error: z.ZodError): ActionResult<never> {
  const issue = error.issues[0];
  const path = issue?.path.join(".");
  return {
    ok: false,
    error: path ? `${path}: ${issue?.message}` : (issue?.message ?? "Invalid input"),
  };
}

export async function createSourceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = Create.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const input = parsed.data;
    const created = await createSource(
      input.kind === "xml_feed"
        ? {
            kind: input.kind,
            name: input.name,
            config: { url: input.url, item_path: input.itemPath },
          }
        : {
            kind: input.kind,
            name: input.name,
            config: { shop_domain: input.shopDomain },
            credentialsRef: input.credentialsRef,
          }
    );
    revalidatePath("/admin/integrations");
    return ok(created);
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteSourceAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await deleteSource(parsed.data.id);
    revalidatePath("/admin/integrations");
    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
