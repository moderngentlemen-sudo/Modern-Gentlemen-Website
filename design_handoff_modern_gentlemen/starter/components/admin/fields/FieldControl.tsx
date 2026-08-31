"use client";

import type { Field, FieldSet } from "@/lib/blocks/fields";
import type { BlockIssue } from "@/lib/blocks/validate";
import { PanelSection } from "@/components/admin/ui/Panel";
import { TextArea, TextInput } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { Toggle } from "@/components/admin/ui/Toggle";

import { countIssuesAtOrBelow, issuesFor } from "./issues";
import { ListControl } from "./ListControl";
import { MediaUrlControl } from "./MediaUrlControl";
import { RichTextEditor } from "./RichTextEditor";

/**
 * The field → control mapping.
 *
 * It lives here rather than in `lib/blocks` because that package is a pure leaf
 * and cannot import React. `fields.ts` describes what a field *is*; this decides
 * what an editor sees, reading the manifest as data.
 */
export interface ControlContext {
  /** Every issue on this block, already block-relative. */
  issues: readonly BlockIssue[];
  /** Read the current value at a path. */
  read: (path: (string | number)[]) => unknown;
  /** Write a value at a path — always into the node's `settings`. */
  write: (path: (string | number)[], value: unknown) => void;
  /** Remove the key at a path, for clearing an optional field. */
  clear: (path: (string | number)[]) => void;
  listAdd: (path: (string | number)[], item: unknown) => void;
  listRemove: (path: (string | number)[], index: number) => void;
  listMove: (path: (string | number)[], from: number, to: number) => void;
  disabled?: boolean;
}

export interface FieldControlProps {
  name: string;
  field: Field;
  path: (string | number)[];
  ctx: ControlContext;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function FieldControl({ field, path, ctx }: FieldControlProps) {
  const value = ctx.read(path);
  const error = issuesFor(ctx.issues, path)[0]?.message;
  const common = {
    label: field.label,
    help: field.help,
    error,
    required: field.required,
    disabled: ctx.disabled,
  };

  /**
   * Clearing an optional field removes the key rather than writing "".
   * An empty string satisfies `z.string()`, so it would persist as a present
   * value where the component expected `undefined` and its own fallback.
   */
  const writeString = (next: string) => {
    if (next === "" && !field.required) ctx.clear(path);
    else ctx.write(path, next);
  };

  switch (field.kind) {
    case "text":
    case "url":
      return (
        <TextInput
          {...common}
          type={field.kind === "url" ? "text" : "text"}
          value={asString(value)}
          placeholder={field.placeholder}
          onChange={writeString}
        />
      );

    case "textarea":
      return (
        <TextArea
          {...common}
          rows={4}
          value={asString(value)}
          placeholder={field.placeholder}
          onChange={writeString}
        />
      );

    case "richText":
      return (
        <RichTextEditor
          {...common}
          value={asString(value)}
          placeholder={field.placeholder}
          onChange={writeString}
        />
      );

    case "image":
    case "video":
      return (
        <MediaUrlControl
          {...common}
          kind={field.kind}
          value={asString(value)}
          placeholder={field.placeholder}
          onChange={writeString}
        />
      );

    case "select":
      return (
        <Select
          {...common}
          value={asString(value)}
          options={field.options}
          placeholder={field.required ? undefined : "—"}
          onChange={(next) => (next === "" ? ctx.clear(path) : ctx.write(path, next))}
        />
      );

    case "number":
      return (
        <NumberInput
          {...common}
          value={typeof value === "number" ? value : undefined}
          min={field.min}
          max={field.max}
          integer={field.integer}
          onChange={(next) => (next === undefined ? ctx.clear(path) : ctx.write(path, next))}
        />
      );

    case "boolean":
      return (
        <Toggle
          label={field.label}
          help={field.help}
          disabled={ctx.disabled}
          checked={value === true}
          onChange={(next) => ctx.write(path, next)}
        />
      );

    case "group":
      return (
        <PanelSection title={field.label} issueCount={countIssuesAtOrBelow(ctx.issues, path)}>
          <FieldSetControls fields={field.fields} path={path} ctx={ctx} />
        </PanelSection>
      );

    case "list":
      return <ListControl field={field} path={path} ctx={ctx} />;
  }
}

/** Renders every field in a set, in manifest order. */
export function FieldSetControls({
  fields,
  path,
  ctx,
}: {
  fields: FieldSet;
  path: (string | number)[];
  ctx: ControlContext;
}) {
  return (
    <>
      {Object.entries(fields).map(([name, field]) => (
        <FieldControl key={name} name={name} field={field} path={[...path, name]} ctx={ctx} />
      ))}
    </>
  );
}
