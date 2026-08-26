"use client";

import { clsx } from "@/components/ui/clsx";
import { IconButton } from "@/components/admin/ui/Button";
import { Select } from "@/components/admin/ui/Select";
import { HAIRLINE, HELP_TEXT, LABEL_SM } from "@/components/admin/ui/styles";
import { KEEP_READING_COUNT } from "@/lib/domain/articles";

export interface RelatedCandidate {
  id: string;
  title: string;
  /** Shown as a marker, because a curated draft is invisible to the public. */
  status: string;
}

/**
 * KEEP READING, curated.
 *
 * `article_relations` has carried rows since Phase 7c and had no editor at all:
 * the seeder wrote the demo's exact trios because the ordering — module
 * insertion order — is what the article baseline expects, and nobody could
 * change one afterwards. This is that editor.
 *
 * **An ordered list, not a set of chips.** Tags above are a set, so they toggle;
 * these three are a sequence, left to right, and `position` exists precisely to
 * store it. Hence add / move / remove rather than a multi-select.
 *
 * The candidate list excludes the article itself — the table's CHECK forbids the
 * self-reference and the picker should not offer what the database refuses —
 * and anything already chosen, so the two constraints the domain normalizes for
 * are unreachable from here rather than merely corrected afterwards.
 */
export function RelatedArticles({
  chosen,
  candidates,
  onChange,
  disabled,
}: {
  chosen: string[];
  candidates: RelatedCandidate[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const available = candidates.filter((candidate) => !chosen.includes(candidate.id));
  const full = chosen.length >= KEEP_READING_COUNT;

  function move(from: number, to: number) {
    const next = [...chosen];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  return (
    <div>
      {chosen.length === 0 ? (
        <p className="text-[12px] text-mg-fg/60">
          None chosen. The article page falls back to the newest stories filed under the same
          category.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {chosen.map((id, index) => {
            const candidate = byId.get(id);

            return (
              <li key={id} className={clsx("flex items-center gap-1 border px-2 py-1.5", HAIRLINE)}>
                <span className={clsx(LABEL_SM, "w-4 shrink-0")}>{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {/* A row whose article has since been deleted cannot happen —
                      `related_id` cascades — so an unknown id here means the
                      candidate list was filtered, not that the data is broken. */}
                  {candidate?.title ?? "Unknown article"}
                </span>
                {candidate && candidate.status !== "published" && (
                  <span className={clsx(LABEL_SM, "shrink-0 text-mg-accentSerif")}>
                    {candidate.status}
                  </span>
                )}
                <IconButton
                  label={`Move ${candidate?.title ?? "article"} up`}
                  disabled={disabled || index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  ↑
                </IconButton>
                <IconButton
                  label={`Move ${candidate?.title ?? "article"} down`}
                  disabled={disabled || index === chosen.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  ↓
                </IconButton>
                <IconButton
                  label={`Remove ${candidate?.title ?? "article"}`}
                  disabled={disabled}
                  onClick={() => onChange(chosen.filter((chosenId) => chosenId !== id))}
                >
                  ✕
                </IconButton>
              </li>
            );
          })}
        </ol>
      )}

      {!disabled && !full && available.length > 0 && (
        <div className="mt-2">
          <Select
            label="Add an article"
            // Always empty: this is an action dressed as a select, not a bound
            // value. Holding the last choice would make the control look like it
            // stores something, and re-picking it would be a no-op.
            value=""
            onChange={(id) => id && onChange([...chosen, id])}
            options={available.map((candidate) => ({
              value: candidate.id,
              label:
                candidate.status === "published"
                  ? candidate.title
                  : `${candidate.title} — ${candidate.status}`,
            }))}
            placeholder="— choose —"
          />
        </div>
      )}

      {full && (
        <span className={HELP_TEXT}>
          {KEEP_READING_COUNT} is what the grid renders. Remove one to swap it.
        </span>
      )}

      <span className={HELP_TEXT}>
        A draft stays hidden on the public page until it is published — the row is filtered by RLS,
        not by the page.
      </span>
    </div>
  );
}
