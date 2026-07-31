/**
 * Field vocabulary — one description of a block's editable surface, read by
 * three consumers that must never disagree:
 *
 *   the properties panel   picks a control from `kind` and renders `label`
 *   publish validation     runs the derived Zod schema
 *   the renderer           applies defaults and drops anything undeclared
 *
 * The Zod schema is *derived* from the fields rather than written alongside
 * them. A hand-written schema is a second description of the same thing, and
 * two descriptions drift — which is the exact failure this phase exists to
 * remove.
 *
 * Defaults live on the field, not on the manifest, for the same reason: a
 * field's default is a property of that field. They are transcribed from each
 * section component's own destructuring defaults, so passing a normalized
 * block to a component renders identically to passing the raw one.
 */

import { z, type ZodTypeAny } from "zod";

export interface FieldBase {
  /** Human name shown by the properties panel. Never empty — conformance checks. */
  readonly label: string;
  /** Optional editor guidance under the control. */
  readonly help?: string;
  readonly required?: boolean;
}

/**
 * String-valued kinds. They differ only in the control the panel picks —
 * `image` opens the media library, `richText` gets a formatting bar, `url`
 * validates a href — so they share one runtime shape.
 */
export type StringKind = "text" | "textarea" | "richText" | "url" | "image" | "video";

export interface StringField extends FieldBase {
  readonly kind: StringKind;
  readonly default?: string;
  readonly placeholder?: string;
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectField extends FieldBase {
  readonly kind: "select";
  readonly options: readonly SelectOption[];
  readonly default?: string;
}

export interface NumberField extends FieldBase {
  readonly kind: "number";
  readonly default?: number;
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

export interface BooleanField extends FieldBase {
  readonly kind: "boolean";
  readonly default?: boolean;
}

export interface GroupField extends FieldBase {
  readonly kind: "group";
  readonly fields: FieldSet;
}

export interface ListField extends FieldBase {
  readonly kind: "list";
  /** A field set for a list of objects, or a single field for a list of scalars. */
  readonly of: FieldSet | Field;
  readonly min?: number;
  readonly max?: number;
  /** Singular noun for the "Add …" button, e.g. "story". */
  readonly itemLabel?: string;
}

export type Field = StringField | SelectField | NumberField | BooleanField | GroupField | ListField;
export type FieldSet = Readonly<Record<string, Field>>;

/** True when a `ListField.of` is a single field (scalar list) rather than a field set. */
export function isField(value: FieldSet | Field): value is Field {
  return "kind" in value && typeof (value as Field).kind === "string";
}

// ---------------------------------------------------------------------------
// Builders. Namespaced under `field` so `field.number` / `field.boolean` don't
// read as the global types they'd otherwise shadow.
// ---------------------------------------------------------------------------

type Spec<T extends Field> = Omit<T, "kind">;

const stringField =
  (kind: StringKind) =>
  (spec: Spec<StringField>): StringField => ({ kind, ...spec });

export const field = {
  text: stringField("text"),
  textarea: stringField("textarea"),
  richText: stringField("richText"),
  url: stringField("url"),
  image: stringField("image"),
  video: stringField("video"),

  select: (spec: Spec<SelectField>): SelectField => ({ kind: "select", ...spec }),
  number: (spec: Spec<NumberField>): NumberField => ({ kind: "number", ...spec }),
  boolean: (spec: Spec<BooleanField>): BooleanField => ({ kind: "boolean", ...spec }),
  group: (spec: Spec<GroupField>): GroupField => ({ kind: "group", ...spec }),
  list: (spec: Spec<ListField>): ListField => ({ kind: "list", ...spec }),

  /**
   * Sugar for the `{ label, href }` pair that appears on most CTAs. `extra`
   * carries the per-block additions (FeatureSplit's cta also has a `style`).
   */
  link: (spec: {
    label: string;
    help?: string;
    required?: boolean;
    extra?: FieldSet;
  }): GroupField => ({
    kind: "group",
    label: spec.label,
    help: spec.help,
    required: spec.required,
    fields: {
      label: field.text({ label: "Label", required: true }),
      href: field.url({ label: "Link", required: true }),
      ...spec.extra,
    },
  }),
};

/** Convenience for `select` options built from a plain string union. */
export function options(...values: string[]): SelectOption[] {
  return values.map((value) => ({ value, label: value }));
}

// ---------------------------------------------------------------------------
// Zod derivation
// ---------------------------------------------------------------------------

/**
 * `strict` makes object shapes reject undeclared keys instead of stripping
 * them. Publish validation wants that (an undeclared key is a manifest that has
 * fallen behind its component); the render path does not, because dropping a
 * stray key silently is better than failing a page.
 */
export function fieldToZod(f: Field, strict = false): ZodTypeAny {
  const base = baseSchema(f, strict);

  if (f.kind === "group") {
    // A group carries no default of its own; its members carry theirs.
    return f.required ? base : base.optional();
  }
  if (f.kind === "list") {
    return f.required ? base : base.optional();
  }
  // `.default()` must come last: it is what makes the value present after parse.
  if (f.default !== undefined) return base.default(f.default);
  return f.required ? base : base.optional();
}

function baseSchema(f: Field, strict: boolean): ZodTypeAny {
  switch (f.kind) {
    case "text":
    case "textarea":
    case "richText":
    case "image":
    case "video":
    case "url":
      // Deliberately not `.url()` on `url`: hrefs here are mostly site-relative
      // ("/article/speed-considered"), which a URL check would reject.
      return f.required ? z.string().min(1) : z.string();

    case "select":
      return z.enum(f.options.map((o) => o.value) as [string, ...string[]]);

    case "number": {
      let schema = z.number();
      if (f.integer) schema = schema.int();
      if (f.min !== undefined) schema = schema.min(f.min);
      if (f.max !== undefined) schema = schema.max(f.max);
      return schema;
    }

    case "boolean":
      return z.boolean();

    case "group":
      return fieldSetToZod(f.fields, strict);

    case "list": {
      const item = isField(f.of) ? fieldToZod(f.of, strict) : fieldSetToZod(f.of, strict);
      let schema = z.array(item);
      if (f.min !== undefined) schema = schema.min(f.min);
      if (f.max !== undefined) schema = schema.max(f.max);
      return schema;
    }
  }
}

export function fieldSetToZod(fields: FieldSet, strict = false) {
  const shape = Object.fromEntries(
    Object.entries(fields).map(([name, f]) => [name, fieldToZod(f, strict)])
  );
  const object = z.object(shape);
  return strict ? object.strict() : object;
}

/**
 * The defaults a field set contributes, as a plain object. Groups recurse; a
 * group appears only if one of its members has a default, so a block whose
 * optional `cta` group is entirely default-less does not gain an empty `cta`.
 */
export function fieldSetDefaults(fields: FieldSet): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [name, f] of Object.entries(fields)) {
    if (f.kind === "group") {
      const nested = fieldSetDefaults(f.fields);
      if (Object.keys(nested).length > 0) out[name] = nested;
      continue;
    }
    if (f.kind === "list") continue;
    if (f.default !== undefined) out[name] = f.default;
  }

  return out;
}
