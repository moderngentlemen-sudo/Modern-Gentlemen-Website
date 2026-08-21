"use client";

import { useState } from "react";

import { clsx } from "@/components/ui/clsx";
import { areaNameOf } from "@/lib/blocks/areas";
import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { TextInput } from "@/components/admin/ui/Input";
import { FOCUS_RING, HAIRLINE, LABEL_SM } from "@/components/admin/ui/styles";

import { useBuilder } from "./StoreContext";

/**
 * The area switcher — the one piece of builder UI a template needs that a page
 * does not.
 *
 * A template holds several block trees under names (`{ areas: { header: […],
 * main: […] } }`) while every other document type holds one. The store still
 * holds exactly one tree at a time; this chooses which. That is the whole of
 * the difference, and it is why the canvas, the library rail, the properties
 * panel and the publish bar needed no changes at all.
 *
 * **It renders nothing for a document without areas**, so it can sit
 * unconditionally in the builder's layout rather than making the layout know
 * which types have areas.
 *
 * ⚠️ **Order is alphabetical, and cannot be anything else today.** Postgres
 * `jsonb` sorts object keys by length and then bytewise, so the order areas
 * were written in is not the order they read back in — measured, not assumed;
 * see `lib/blocks/areas.ts`. Presenting them in payload order would show an
 * arrangement that looks deliberate and is not.
 */
export function AreaSwitcher() {
  const doc = useBuilder((s) => s.doc);
  const areaIssues = useBuilder((s) => s.areaIssues);
  const setArea = useBuilder((s) => s.setArea);
  const addArea = useBuilder((s) => s.addArea);
  const renameArea = useBuilder((s) => s.renameArea);
  const removeArea = useBuilder((s) => s.removeArea);
  const tree = useBuilder((s) => s.tree);

  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  const names = doc.areaNames;
  if (!names) return null;

  // The open area is derived from `treeKey` rather than stored beside it: two
  // fields that must agree are two fields that can disagree. `areaNameOf` is
  // the only thing that takes that path apart, here as in the store.
  const open = areaNameOf(doc.treeKey) ?? names[0];

  function openAdd() {
    setName("");
    setError(undefined);
    setAdding(true);
  }

  function openRename() {
    setName(open);
    setError(undefined);
    setRenaming(true);
  }

  function submitAdd() {
    const message = addArea(name.trim());
    if (message) setError(message);
    else setAdding(false);
  }

  function submitRename() {
    const message = renameArea(open, name.trim());
    if (message) setError(message);
    else setRenaming(false);
  }

  function submitRemove() {
    const message = removeArea(open);
    setConfirmRemove(false);
    if (message) setError(message);
  }

  return (
    <>
      <div
        className={clsx(
          "flex flex-wrap items-center gap-2 border-b bg-mg-surface px-4 py-2",
          HAIRLINE
        )}
      >
        <span className={LABEL_SM}>Areas</span>

        <div
          className="flex flex-wrap items-center gap-1"
          role="tablist"
          aria-label="Template area"
        >
          {names.map((area) => {
            const active = area === open;
            const issues = areaIssues[area] ?? 0;

            return (
              <button
                key={area}
                type="button"
                role="tab"
                aria-selected={active}
                /*
                  A stable hook for tests, the same idiom `[data-block-key]`
                  gives the canvas — and here it is load-bearing rather than
                  convenient. The issue badge below is inside the button, so it
                  lands in the accessible name: an area with one issue is named
                  "header 1", and a spec matching "header" exactly would stop
                  finding it the moment a block went invalid. Matching loosely
                  is worse — "header" is a substring of "header-two". So the
                  name stays informative for a screen reader and locators use
                  this instead.
                */
                data-area={area}
                onClick={() => setArea(area)}
                className={clsx(
                  "flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                  active
                    ? "border-mg-fg bg-mg-fg text-mg-bg"
                    : "border-mg-bd/25 text-mg-fg/60 hover:text-mg-fg",
                  FOCUS_RING
                )}
              >
                {area}
                {/*
                  The count is the point of `areaIssues`. Publish validates every
                  area while the tray only ever sees the open one, so without a
                  per-area number an editor could be told "no issues" and then
                  refused a publish over a block in an area they were not
                  looking at.
                */}
                {issues > 0 && (
                  <span
                    className={clsx(
                      "inline-flex min-w-[14px] justify-center px-1 text-[9px]",
                      active ? "bg-mg-bg/20" : "bg-mg-accent/10 text-mg-accentSerif"
                    )}
                    title={`${issues} validation ${issues === 1 ? "issue" : "issues"}`}
                  >
                    {issues}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={openAdd}>
            Add area
          </Button>
          <Button size="sm" variant="ghost" onClick={openRename}>
            Rename area
          </Button>
          {/*
            Removing the last area would leave a template with no tree the
            builder can open — uneditable by the screen that emptied it. The
            store refuses it; hiding the control means an editor never meets the
            refusal.
          */}
          {names.length > 1 && (
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(true)}>
              Remove area
            </Button>
          )}
        </div>
      </div>

      {/*
        An area operation that failed outside a dialog — only `removeArea` can,
        since the other two report into their own form.
      */}
      {error && !adding && !renaming && (
        <p className="border-b border-mg-accent/30 bg-mg-accent/5 px-4 py-2 font-mono text-[10px] text-mg-accentSerif">
          {error}
        </p>
      )}

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add an area"
        description="An area is one named block tree inside this template. Areas are listed alphabetically."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="solid" onClick={submitAdd} disabled={!name.trim()}>
              Add
            </Button>
          </>
        }
      >
        <TextInput
          label="Name"
          value={name}
          onChange={setName}
          placeholder="main"
          help="Lower-case words separated by hyphens."
          error={error}
          required
        />
      </Dialog>

      <Dialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title={`Rename “${open}”`}
        description="The blocks in this area move with it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={submitRename}
              disabled={!name.trim() || name.trim() === open}
            >
              Save
            </Button>
          </>
        }
      >
        <TextInput
          label="Name"
          value={name}
          onChange={setName}
          help="Lower-case words separated by hyphens."
          error={error}
          required
        />
      </Dialog>

      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`Remove “${open}”?`}
        description="The blocks in this area go with it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitRemove}>
              Remove area
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-mg-fg/60">
          {/*
            Undo does not span areas — the stack is cleared on every switch, so
            it cannot restore blocks into an area that no longer exists. Saying
            so here is cheaper than an editor finding out.
          */}
          {tree.length === 0
            ? "This area is empty."
            : `This area holds ${tree.length} ${tree.length === 1 ? "block" : "blocks"}.`}{" "}
          Undo does not reach across areas, so this cannot be undone from the canvas — but nothing
          is lost until the draft saves.
        </p>
      </Dialog>
    </>
  );
}
