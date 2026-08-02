"use client";

import { clsx } from "@/components/ui/clsx";
import { Select } from "@/components/admin/ui/Select";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { TextInput } from "@/components/admin/ui/Input";
import { Toggle } from "@/components/admin/ui/Toggle";
import { FOCUS_RING, HELP_TEXT, LABEL_SM } from "@/components/admin/ui/styles";
import type { BindingQuery } from "@/lib/blocks/binding";

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
        onChange={(source) => patch({ source })}
      />

      <NumberInput
        label="How many"
        value={query.limit}
        min={1}
        integer
        disabled={disabled}
        help="Leave empty for the source's own default."
        onChange={(limit) => patch({ limit })}
      />

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
