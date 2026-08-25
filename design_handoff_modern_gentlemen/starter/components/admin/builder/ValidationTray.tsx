"use client";

import { useShallow } from "zustand/react/shallow";
import { manifestFor } from "@/lib/blocks/manifests";
import { clsx } from "@/components/ui/clsx";
import { HAIRLINE, LABEL_SM } from "@/components/admin/ui/styles";
import { useBuilder } from "./StoreContext";

/**
 * The issues standing between this page and publishing.
 *
 * Local issues come from `validateTree` in the store; server issues come back
 * from a refused publish. Both are produced by the same pure code — the server
 * runs `validateDocumentPayload` over what is actually in the database, which
 * also catches an autosave that had not landed — so the two cannot disagree
 * about what is wrong, only about how fresh the answer is.
 *
 * Clicking an issue selects its block and scrolls to it. That is the whole
 * point of `BlockIssue.key` and `.path` existing.
 */
export function ValidationTray() {
  const issues = useBuilder(useShallow((s) => [...s.issues, ...s.serverIssues]));
  const select = useBuilder((s) => s.select);

  if (issues.length === 0) return null;

  const byBlock = new Map<string, typeof issues>();
  for (const issue of issues) {
    byBlock.set(issue.key, [...(byBlock.get(issue.key) ?? []), issue]);
  }

  return (
    <div className={clsx("border-t bg-mg-accent/5", HAIRLINE)}>
      <div className="max-h-[180px] overflow-y-auto px-4 py-3">
        <p className={clsx(LABEL_SM, "text-mg-accentSerif")}>
          {issues.length} {issues.length === 1 ? "issue" : "issues"} — fix before publishing
        </p>

        <ul className="mt-2 space-y-1">
          {[...byBlock.entries()].map(([key, blockIssues]) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => {
                  select(key);
                  document
                    .querySelector(`[data-block-key="${key}"]`)
                    ?.scrollIntoView({ block: "center" });
                }}
                className="w-full text-left text-[12px] hover:text-mg-accentInk"
              >
                <span className="font-medium">
                  {manifestFor(blockIssues[0].type)?.label ?? blockIssues[0].type}
                </span>
                <span className="text-mg-fg/50">
                  {" — "}
                  {blockIssues
                    .map((issue) =>
                      issue.path ? `${issue.path}: ${issue.message}` : issue.message
                    )
                    .join("; ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
