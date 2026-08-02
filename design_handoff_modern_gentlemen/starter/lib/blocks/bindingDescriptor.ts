/**
 * The shape of a `{ $bind: … }` descriptor, on its own.
 *
 * This lives apart from `binding.ts` to break an import cycle. `binding.ts`
 * imports `manifests/index.ts` (it needs `manifest.bindable` to know which
 * fields may be bound), every manifest imports `defineBlock.ts`, and
 * `defineBlock` needs the descriptor schema to build a publish-path schema that
 * accepts a binding where a literal would sit. Importing `binding.ts` from
 * `defineBlock.ts` would close that loop.
 *
 * So the descriptor — which depends on nothing but zod — sits here, and
 * `binding.ts` re-exports it so existing callers are unaffected.
 */

import { z } from "zod";

export const bindingQuerySchema = z.object({
  /** Which collection to read, e.g. "articles". Resolved against the source map. */
  source: z.string().min(1),
  filter: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  sort: z
    .object({
      field: z.string().min(1),
      direction: z.enum(["asc", "desc"]).default("desc"),
    })
    .optional(),
  limit: z.number().int().positive().optional(),
  /** Resolve to a single record rather than a list — for group fields. */
  single: z.boolean().optional(),
  /** Rename source keys onto the block's shape: `{ title: "name" }`. */
  map: z.record(z.string()).optional(),
  /** Take one field's value per row, for scalar lists such as `productRow.slugs`. */
  pluck: z.string().min(1).optional(),
});

export type BindingQuery = z.infer<typeof bindingQuerySchema>;

export const bindingDescriptorSchema = z.object({ $bind: bindingQuerySchema });
export type BindingDescriptor = z.infer<typeof bindingDescriptorSchema>;

export function isBindingDescriptor(value: unknown): value is BindingDescriptor {
  return bindingDescriptorSchema.safeParse(value).success;
}

/**
 * Does this value *claim* to be a binding, whether or not its query is valid?
 *
 * Resolution wants `isBindingDescriptor` — only a well-formed descriptor should
 * ever be sent to a source. Validation wants this: an editor who has bound a
 * field but left the source blank should be told "source is required", not
 * "expected array, received object", which is what they get if a malformed
 * binding is treated as an ordinary wrong-typed literal.
 */
export function hasBindingShape(value: unknown): value is { $bind: unknown } {
  return typeof value === "object" && value !== null && "$bind" in value;
}
