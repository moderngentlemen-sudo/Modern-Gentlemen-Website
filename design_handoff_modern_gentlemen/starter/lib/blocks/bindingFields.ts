/**
 * What a binding may be filtered on, per source.
 *
 * `BindingQuery.filter` is `Record<string, string | number | boolean>` and both
 * sources match with `===`. The same vocabulary drives typed `where`
 * conditions. That is a small contract with one large trap in it:
 * **a filter whose value is the wrong type matches nothing, silently.** `issue`
 * is the string `"040"`, not the number 40; `lead` is a real boolean, not
 * `"true"`. Either mistake returns an empty list, which renders as an empty
 * block — no error, nothing in a log, and an editor with no way to tell a
 * mistyped filter from a category that genuinely has no stories in it.
 *
 * So the editor does not offer a free-text key box. It offers these, each
 * carrying the type its column actually holds, and builds the value control from
 * that type. The trap is unreachable rather than merely documented.
 *
 * ⚠️ **This list is a promise about the row shapes in `lib/blocks/sources/demo.ts`
 * and `lib/services/bindingSources.ts`**, which are kept identical field for
 * field precisely so one descriptor means the same thing against either.
 * `bindingFields.test.ts` checks every entry below against real demo rows —
 * both that the key exists and that the declared type matches what is in it — so
 * renaming a row key breaks a test rather than quietly emptying a block.
 *
 * Not every key is here. A row carries what the blocks render — `title`,
 * `image`, `href` — and filtering on a headline is not a thing anyone wants.
 * These are the *facts* about a row: what it is filed under, which issue it ran
 * in, whether it leads its category.
 */

import type { BindingConditionOperator } from "./bindingDescriptor";

export type FilterValueType = "string" | "number" | "boolean";

export interface FilterableField {
  key: string;
  label: string;
  type: FilterValueType;
  help?: string;
}

export interface ConditionOperatorOption {
  value: BindingConditionOperator;
  label: string;
}

const UNIVERSAL_OPERATORS: readonly ConditionOperatorOption[] = [
  { value: "equals", label: "is" },
  { value: "not_equals", label: "is not" },
  { value: "exists", label: "is present" },
  { value: "not_exists", label: "is missing" },
];

const STRING_OPERATORS: readonly ConditionOperatorOption[] = [
  ...UNIVERSAL_OPERATORS,
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
];

const NUMBER_OPERATORS: readonly ConditionOperatorOption[] = [
  ...UNIVERSAL_OPERATORS,
  { value: "greater_than", label: "is greater than" },
  { value: "greater_than_or_equal", label: "is at least" },
  { value: "less_than", label: "is less than" },
  { value: "less_than_or_equal", label: "is at most" },
];

export const FILTERABLE_FIELDS: Readonly<Record<string, readonly FilterableField[]>> =
  Object.freeze({
    articles: [
      {
        key: "category",
        label: "Category",
        type: "string",
        help: "The category's slug — style, grooming, watches, culture, film.",
      },
      { key: "categoryName", label: "Category name", type: "string" },
      {
        key: "issue",
        label: "Issue",
        type: "string",
        // Stored with its leading zero, which is why this is not a number.
        help: 'Zero-padded, as printed: "040".',
      },
      // ⚠️ **`author` is deliberately absent, and the reason is a real
      // divergence between the two sources rather than an oversight.** The
      // Supabase source sets `author` on every article row; the demo source sets
      // it on each category's *lead* row only — its grid cards were transcribed
      // without a byline. So `filter: { author: … }` would return different rows
      // depending on which map the site was handed, which is exactly the
      // property `publicEditorial.test.ts` compares the two on. Found by the
      // conformance test below on its first run. Offering it needs the demo
      // cards to carry a byline first.
      {
        key: "lead",
        label: "Leads its category",
        type: "boolean",
        help: "True for the newest story in each category — what a lead block wants.",
      },
    ],
    categories: [
      { key: "slug", label: "Slug", type: "string" },
      { key: "name", label: "Name", type: "string" },
    ],
    products: [
      { key: "slug", label: "Slug", type: "string" },
      {
        key: "group",
        label: "Group",
        type: "string",
        help: "The store's filter vocabulary: Style, Watches, Grooming, Accessories.",
      },
      {
        key: "price",
        label: "Price",
        type: "number",
        help: "In pounds, as the catalogue holds it.",
      },
    ],
  });

export function filterableFieldsFor(source: string | undefined): readonly FilterableField[] {
  return (source && FILTERABLE_FIELDS[source]) || [];
}

export function filterableFieldFor(
  source: string | undefined,
  key: string
): FilterableField | undefined {
  return filterableFieldsFor(source).find((field) => field.key === key);
}

export function conditionOperatorsFor(type: FilterValueType): readonly ConditionOperatorOption[] {
  if (type === "string") return STRING_OPERATORS;
  if (type === "number") return NUMBER_OPERATORS;
  return UNIVERSAL_OPERATORS;
}

export function conditionNeedsValue(operator: BindingConditionOperator): boolean {
  return operator !== "exists" && operator !== "not_exists";
}

/**
 * Turn what a control produced into the typed value the filter needs.
 *
 * `undefined` means "not a usable value yet" — an empty box, or a number box
 * holding something that is not a number — and the caller drops the key rather
 * than storing a filter that can never match. An empty string is deliberately
 * *not* a valid filter: `category: ""` matches no row and is always a
 * half-finished edit rather than an intention.
 */
export function coerceFilterValue(
  type: FilterValueType,
  raw: string
): string | number | boolean | undefined {
  if (type === "boolean") return raw === "true" ? true : raw === "false" ? false : undefined;

  if (type === "number") {
    if (raw.trim() === "") return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return raw === "" ? undefined : raw;
}

/** The inverse, for putting a stored value back into a text or select control. */
export function filterValueToInput(value: string | number | boolean | undefined): string {
  return value === undefined ? "" : String(value);
}
