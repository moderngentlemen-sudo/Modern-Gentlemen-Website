"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createMenuItem,
  deleteMenuItem,
  reorderMenuItems,
  updateMenu,
  updateMenuItem,
} from "@/lib/services/navigation";
import {
  EDITABLE_MENU_LINK_TYPES,
  menuFeatureSchema,
  MENU_STATUSES,
} from "@/lib/domain/navigation";
import { ok, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

/**
 * Navigation actions.
 *
 * Written out one per operation rather than generated from a factory, for the
 * reason the article actions record: a `"use server"` module may export only
 * async functions and Next assigns each export an action id at build time, so a
 * factory-produced export would *probably* work — and "probably", with a failure
 * mode that only appears when a real browser opens a real page, is the exact
 * combination that broke every builder load in Phase 4.
 *
 * **Every write revalidates `/` as a layout.** The chrome is rendered by
 * `app/(site)/layout.tsx`, so a menu change touches every public page at once;
 * revalidating one path would leave the other sixty-four serving the old nav
 * until their hour was up. This is the navigation equivalent of the rule
 * `publicPathForPage` exists to enforce — the thing that makes an edit visible
 * without a deploy.
 */

const Id = z.object({ id: z.string().uuid() });

const LinkType = z.enum(EDITABLE_MENU_LINK_TYPES);

/**
 * The shape rule `menu_item_target_shape` states in SQL, restated here so an
 * editor gets a sentence instead of a constraint violation. The database keeps
 * its own copy — this one exists to produce a readable message, not to replace it.
 */
const ItemBody = z
  .object({
    label: z.string().trim().min(1, "Enter a label").max(120),
    linkType: LinkType,
    targetId: z.string().uuid().nullable().optional(),
    url: z.string().trim().max(2000).nullable().optional(),
    group: z.string().trim().max(120).nullable().optional(),
    feature: menuFeatureSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.linkType === "url") {
      if (!value.url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["url"],
          message: "Enter a URL or path for a link of this kind",
        });
      }
      return;
    }

    if (!value.targetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetId"],
        message: `Choose which ${value.linkType} this points at`,
      });
    }
  });

const CreateItem = ItemBody.and(
  z.object({
    menuId: z.string().uuid(),
    parentId: z.string().uuid().nullable().optional(),
    position: z.number().int().min(0).max(999).optional(),
  })
);

const UpdateItem = ItemBody.and(Id);

const Reorder = z.object({
  positions: z
    .array(z.object({ id: z.string().uuid(), position: z.number().int().min(0).max(999) }))
    .max(200),
});

const MenuPatch = Id.extend({
  name: z.string().trim().min(1, "Enter a name").max(120).optional(),
  location: z.string().trim().max(120).nullable().optional(),
  status: z.enum(MENU_STATUSES).optional(),
});

function invalid(error: z.ZodError): ActionResult<never> {
  return { ok: false, error: error.issues[0]?.message ?? "Invalid input" };
}

/** The chrome is in the site layout, so every menu write touches every page. */
function done(): ActionResult {
  revalidatePath("/admin/navigation", "layout");
  revalidatePath("/", "layout");
  return ok(undefined);
}

/** `options` is one column holding two unrelated things; both are optional and
 *  an absent one is an absent key, not an empty string — the same rule the
 *  builder follows when an optional field is cleared. */
function optionsOf(input: { group?: string | null; feature?: unknown }): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  if (input.group) options.group = input.group;
  if (input.feature) options.feature = input.feature;
  return options;
}

export async function createMenuItemAction(input: unknown): Promise<ActionResult> {
  const parsed = CreateItem.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await createMenuItem({
      menuId: parsed.data.menuId,
      parentId: parsed.data.parentId ?? null,
      label: parsed.data.label,
      linkType: parsed.data.linkType,
      targetId: parsed.data.linkType === "url" ? null : (parsed.data.targetId ?? null),
      url: parsed.data.linkType === "url" ? (parsed.data.url ?? null) : null,
      options: optionsOf(parsed.data),
      position: parsed.data.position,
    });
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateMenuItemAction(input: unknown): Promise<ActionResult> {
  const parsed = UpdateItem.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await updateMenuItem(parsed.data.id, {
      label: parsed.data.label,
      linkType: parsed.data.linkType,
      targetId: parsed.data.linkType === "url" ? null : (parsed.data.targetId ?? null),
      url: parsed.data.linkType === "url" ? (parsed.data.url ?? null) : null,
      options: optionsOf(parsed.data),
    });
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteMenuItemAction(input: unknown): Promise<ActionResult> {
  const parsed = Id.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    // Children go too — `menu_items.parent_id` carries `on delete cascade`, so
    // the confirmation names how many are about to go with it.
    await deleteMenuItem(parsed.data.id);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function reorderMenuItemsAction(input: unknown): Promise<ActionResult> {
  const parsed = Reorder.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await reorderMenuItems(parsed.data.positions);
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateMenuAction(input: unknown): Promise<ActionResult> {
  const parsed = MenuPatch.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await updateMenu(parsed.data.id, {
      name: parsed.data.name,
      location: parsed.data.location,
      status: parsed.data.status,
    });
    return done();
  } catch (error) {
    return toActionResult(error);
  }
}
