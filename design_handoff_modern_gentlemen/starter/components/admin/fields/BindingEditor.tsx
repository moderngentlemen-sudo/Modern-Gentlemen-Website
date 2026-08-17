"use client";

import { useState } from "react";

import { clsx } from "@/components/ui/clsx";
import { IconButton } from "@/components/admin/ui/Button";
import { Select } from "@/components/admin/ui/Select";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { TextInput } from "@/components/admin/ui/Input";
import { Toggle } from "@/components/admin/ui/Toggle";
import { FOCUS_RING, HELP_TEXT, LABEL_SM } from "@/components/admin/ui/styles";
import type { BindingQuery } from "@/lib/blocks/binding";
import {
  coerceFilterValue,
  filterValueToInput,
  filterableFieldFor,
  filterableFieldsFor,
  type FilterableField,
} from "@/lib/blocks/bindingFields";

/**
 * The literal / dynamic switch for a bindable field.
 *
 * A bound field holds `{ $bind: query }` instead of a literal, so the block says
 * "the six newest Culture stories" rather than carrying six hand-copied cards
 * that go stale. Only fields named in `manifest.bindable` may be bound — seven
 * across the whole set — so an editor cannot bind a headline to a product feed.
 */
const SOURCES = [
  { value: "articles", label: "Articles" },
  { value: "categories", label: "Categories" },
  { value: "products", label: "Products" },
] as const;

const DIRECTIONS = [
  { value: "desc", label: "Newest first" },
  { value: "asc", label: "Oldest first" },
] as const;

export function BindingModeSwitch({
  bound,
  onChange,
  disabled,
}: {
  bound: boolean;
  onChange: (bound: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex border border-mg-bd/25" role="group" aria-label="Field source">
      {[
        { key: false, label: "Literal" },
        { key: true, label: "Dynamic" },
      ].map((option) => (
        <button
          key={String(option.key)}
          type="button"
          disabled={disabled}
          aria-pressed={bound === option.key}
          onClick={() => onChange(option.key)}
          className={clsx(
            "px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors",
            bound === option.key ? "bg-mg-accent text-white" : "text-mg-fg/60 hover:text-mg-fg",
            disabled && "pointer-events-none opacity-40",
            FOCUS_RING
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const BOOLEAN_OPTIONS = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
] as const;

/**
 * One `filter` entry: a fact, and the value it must equal.
 *
 * The value control is built from the field's declared type rather than being a
 * text box for all three. That is the whole reason `bindingFields.ts` carries
 * types: both sources match with `===`, so `lead: "true"` and `issue: 40` match
 * nothing at all and render an empty block with no error anywhere. A boolean
 * gets a Yes/No select and a number gets a number box, so neither is typable.
 */
function FilterRow({
  field,
  value,
  onChange,
  onRemove,
  disabled,
}: {
  field: FilterableField;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean | undefined) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const raw = filterValueToInput(value);

  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        {field.type === "boolean" ? (
          <Select
            label={field.label}
            value={raw}
            options={BOOLEAN_OPTIONS}
            placeholder="— either —"
            help={field.help}
            disabled={disabled}
            onChange={(next) => onChange(coerceFilterValue("boolean", next))}
          />
        ) : field.type === "number" ? (
          <NumberInput
            label={field.label}
            value={typeof value === "number" ? value : undefined}
            help={field.help}
            disabled={disabled}
            onChange={(next) => onChange(next)}
          />
        ) : (
          <TextInput
            label={field.label}
            value={raw}
            help={field.help}
            disabled={disabled}
            onChange={(next) => onChange(coerceFilterValue("string", next))}
          />
        )}
      </div>
      <IconButton
        label={`Remove the ${field.label} filter`}
        disabled={disabled}
        className="mb-1"
        onClick={onRemove}
      >
        ✕
      </IconButton>
    </div>
  );
}

/**
 * The `filter` map, as rows.
 *
 * Equality only, because that is all either source implements — no ranges, no
 * "contains". Presented as "Category is style" rather than an operator picker,
 * so the control cannot promise a comparison the resolver would ignore.
 *
 * A row whose value is cleared is **removed from the map rather than stored as
 * empty**: `{ category: "" }` matches no row, so keeping it would turn a
 * half-finished edit into a block that renders nothing.
 */
function FilterFields({
  source,
  filter,
  onChange,
  disabled,
}: {
  source: string | undefined;
  filter: BindingQuery["filter"];
  onChange: (filter: BindingQuery["filter"]) => void;
  disabled?: boolean;
}) {
  const available = filterableFieldsFor(source);
  const stored = filter ?? {};

  /**
   * Rows an editor has opened but not yet filled in.
   *
   * Needed because an empty filter is not a storable one: `{ category: "" }`
   * matches no row, so writing the key the moment it is chosen would mean a
   * half-typed filter renders an empty block. The row therefore lives here until
   * it holds a value, and moves into the query the moment it does.
   */
  const [pending, setPending] = useState<string[]>([]);

  const keys = [...Object.keys(stored), ...pending.filter((key) => !(key in stored))];
  const unused = available.filter((field) => !keys.includes(field.key));

  function write(key: string, value: string | number | boolean | undefined) {
    const next = { ...stored };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChange(Object.keys(next).length > 0 ? next : undefined);
  }

  /**
   * A value edited down to nothing leaves the query but keeps its row.
   *
   * Emptying a box to retype it is the ordinary way anyone changes one, and
   * dropping the row at that moment makes the control vanish from under the
   * cursor — found by the test for exactly this, which could not type the new
   * value because the box it had just cleared no longer existed. So the key
   * leaves `filter` (an empty filter matches nothing and must not be stored)
   * while the row moves back to `pending` and stays on screen.
   */
  function set(key: string, value: string | number | boolean | undefined) {
    if (value === undefined) {
      setPending((current) => (current.includes(key) ? current : [...current, key]));
    }
    write(key, value);
  }

  /** The ✕. Unlike clearing a value, this is meant to take the row away. */
  function remove(key: string) {
    setPending((current) => current.filter((pendingKey) => pendingKey !== key));
    write(key, undefined);
  }

  if (available.length === 0) {
    return (
      <span className={HELP_TEXT}>
        {source ? "This source has no filterable fields." : "Choose a source to filter on it."}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <span className={LABEL_SM}>Only where</span>

      {keys.length === 0 && (
        <span className={HELP_TEXT}>Everything in the source, newest first.</span>
      )}

      {keys.map((key) => {
        const value = stored[key];
        const field = filterableFieldFor(source, key);

        // A key the vocabulary no longer knows — a stored filter from before a
        // rename. Shown rather than dropped, because silently discarding part of
        // a saved query on open is how an editor loses work without being told.
        if (!field) {
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-mg-accentSerif">
                {key}: {String(value)} — not a field of this source
              </span>
              <IconButton
                label={`Remove the ${key} filter`}
                disabled={disabled}
                onClick={() => remove(key)}
              >
                ✕
              </IconButton>
            </div>
          );
        }

        return (
          <FilterRow
            key={key}
            field={field}
            value={value}
            disabled={disabled}
            onChange={(next) => set(key, next)}
            onRemove={() => remove(key)}
          />
        );
      })}

      {!disabled && unused.length > 0 && (
        <Select
          label="Add a filter"
          value=""
          options={unused.map((field) => ({ value: field.key, label: field.label }))}
          placeholder="— choose a field —"
          onChange={(key) => {
            const field = filterableFieldFor(source, key);
            if (!field) return;
            // Booleans are the one type with a sensible opening value: a filter
            // on `lead` almost always means `lead: true`, and it is storable
            // immediately. Text and number rows open empty and stay out of the
            // query until they hold something.
            if (field.type === "boolean") write(key, true);
            else setPending((current) => [...current, key]);
          }}
        />
      )}
    </div>
  );
}

export function BindingEditor({
  query,
  onChange,
  issues,
  disabled,
}: {
  query: Partial<BindingQuery>;
  onChange: (query: Partial<BindingQuery>) => void;
  issues?: Record<string, string>;
  disabled?: boolean;
}) {
  const patch = (next: Partial<BindingQuery>) => onChange({ ...query, ...next });

  return (
    <div className="space-y-3 border border-mg-accent/30 bg-mg-accent/[0.03] p-3">
      <span className={LABEL_SM}>Dynamic content</span>

      <Select
        label="Source"
        value={query.source ?? ""}
        options={SOURCES}
        placeholder="Choose a source"
        error={issues?.source}
        required
        disabled={disabled}
        // Changing the source clears the filter, and it has to: the keys belong
        // to the source's row shape, so `category` carried over to `products`
        // would be a filter that can never match — the block silently empties
        // and nothing says why. Losing a filter on a deliberate source change is
        // the lesser surprise, and the only alternative that keeps it is a
        // per-source memory this control does not need.
        onChange={(source) => patch({ source, filter: undefined })}
      />

      <FilterFields
        source={query.source}
        filter={query.filter}
        disabled={disabled}
        onChange={(filter) => patch({ filter })}
      />

      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          label="How many"
          value={query.limit}
          min={1}
          integer
          disabled={disabled}
          help="Leave empty for the source's own default."
          onChange={(limit) => patch({ limit })}
        />
        <NumberInput
          label="Skip"
          value={query.offset}
          min={0}
          integer
          disabled={disabled}
          help="Rows to pass over first — 1 when a lead block above already shows the newest."
          onChange={(offset) => patch({ offset })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <TextInput
          label="Sort by"
          value={query.sort?.field ?? ""}
          placeholder="publishedAt"
          disabled={disabled}
          onChange={(fieldName) =>
            patch({
              sort: fieldName
                ? { field: fieldName, direction: query.sort?.direction ?? "desc" }
                : undefined,
            })
          }
        />
        <Select
          label="Order"
          value={query.sort?.direction ?? "desc"}
          options={DIRECTIONS}
          disabled={disabled || !query.sort?.field}
          onChange={(direction) =>
            query.sort?.field
              ? patch({ sort: { field: query.sort.field, direction: direction as "asc" | "desc" } })
              : undefined
          }
        />
      </div>

      <Toggle
        label="Single record"
        checked={query.single === true}
        disabled={disabled}
        help="For group fields that take one item rather than a list."
        onChange={(single) => patch({ single: single || undefined })}
      />

      <span className={HELP_TEXT}>
        Resolved when the page renders, so the block stays current as new content is published.
      </span>
    </div>
  );
}
