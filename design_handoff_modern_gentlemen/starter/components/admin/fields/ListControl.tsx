"use client";

import { clsx } from "@/components/ui/clsx";
import { Button, IconButton } from "@/components/admin/ui/Button";
import { Badge } from "@/components/admin/ui/Badge";
import { HAIRLINE, LABEL, LABEL_SM, HELP_TEXT } from "@/components/admin/ui/styles";
import {
  fieldSetDefaults,
  isField,
  type Field,
  type FieldSet,
  type ListField,
} from "@/lib/blocks/fields";

import { countIssuesAtOrBelow, issuesFor } from "./issues";
import { FieldControl, FieldSetControls, type ControlContext } from "./FieldControl";

/**
 * The repeater, for `field.list`. Fourteen manifest fields use one.
 *
 * `ListField.of` is either a `FieldSet` (a list of objects — `latestGrid.items`)
 * or a single `Field` (a list of scalars — `productRow.slugs`). `isField()` is
 * the discriminator, and the two render quite differently, so the branch is
 * taken once here rather than inside every row.
 */
export function ListControl({
  field,
  path,
  ctx,
}: {
  field: ListField;
  path: (string | number)[];
  ctx: ControlContext;
}) {
  const raw = ctx.read(path);
  const items = Array.isArray(raw) ? raw : [];
  const scalar = isField(field.of);

  const atMax = field.max !== undefined && items.length >= field.max;
  const atMin = field.min !== undefined && items.length <= field.min;
  const noun = field.itemLabel ?? "item";

  /**
   * A new row carries only the declared defaults. List items are validated with
   * `.strict()` at publish, so seeding any extra key would produce an issue the
   * editor never typed.
   *
   * Note `fieldSetDefaults` skips list fields entirely, which is why a block's
   * initial list content comes from `manifest.insertDefaults` and not from here.
   */
  function blank(): unknown {
    if (isField(field.of)) return (field.of as Field & { default?: unknown }).default ?? "";
    return fieldSetDefaults(field.of as FieldSet);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className={LABEL}>
          {field.label}
          {field.required && <span className="text-mg-accentSerif"> *</span>}
        </span>
        <span className={LABEL_SM}>{items.length}</span>
      </div>
      {field.help && <span className={HELP_TEXT}>{field.help}</span>}

      <div className="mt-2 space-y-2">
        {items.map((_, index) => {
          const itemPath = [...path, index];
          const issueCount = countIssuesAtOrBelow(ctx.issues, itemPath);

          return (
            <div key={index} className={clsx("border", HAIRLINE)}>
              <div className={clsx("flex items-center gap-2 border-b px-2 py-1.5", HAIRLINE)}>
                <span className={clsx(LABEL_SM, "flex-1 truncate")}>
                  {noun} {index + 1}
                </span>
                {issueCount > 0 && <Badge tone="danger">{issueCount}</Badge>}
                <IconButton
                  label={`Move ${noun} ${index + 1} up`}
                  disabled={index === 0 || ctx.disabled}
                  onClick={() => ctx.listMove(path, index, index - 1)}
                >
                  ↑
                </IconButton>
                <IconButton
                  label={`Move ${noun} ${index + 1} down`}
                  disabled={index === items.length - 1 || ctx.disabled}
                  onClick={() => ctx.listMove(path, index, index + 1)}
                >
                  ↓
                </IconButton>
                <IconButton
                  label={`Remove ${noun} ${index + 1}`}
                  disabled={atMin || ctx.disabled}
                  onClick={() => ctx.listRemove(path, index)}
                >
                  ✕
                </IconButton>
              </div>

              <div className="space-y-3 px-3 py-3">
                {scalar ? (
                  <FieldControl
                    name={String(index)}
                    field={field.of as Field}
                    path={itemPath}
                    ctx={ctx}
                  />
                ) : (
                  <FieldSetControls fields={field.of as FieldSet} path={itemPath} ctx={ctx} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {issuesFor(ctx.issues, path).map((issue, i) => (
        <span key={i} className="mt-1 block font-mono text-[10px] text-mg-accentSerif">
          {issue.message}
        </span>
      ))}

      <Button
        size="sm"
        variant="outline"
        className="mt-2"
        disabled={atMax || ctx.disabled}
        onClick={() => ctx.listAdd(path, blank())}
      >
        + Add {noun}
      </Button>
      {atMax && <span className={HELP_TEXT}>{field.max} is the most this field takes.</span>}
    </div>
  );
}
