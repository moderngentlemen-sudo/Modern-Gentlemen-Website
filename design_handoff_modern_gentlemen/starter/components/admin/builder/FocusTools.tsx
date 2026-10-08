"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { clsx } from "@/components/ui/clsx";
import { FOCUS_RING, HAIRLINE, LABEL_SM } from "@/components/admin/ui/styles";
import { findBlock, flattenBlocks } from "@/lib/blocks/traverse";
import type { BlockTree } from "@/lib/blocks/types";

import { cannotWrapInColumns } from "./arrange";
import { blockLabel, blockSnippet, describeStep, type HistoryStep } from "./history";
import type { BrowseItem } from "./InsertMenu";
import { useBuilder, useBuilderStore } from "./StoreContext";

/**
 * Focus's power tools: the History pane, the command bar and the selection bar.
 * Each is a view over the same store the canvas edits; none of them keeps a
 * second copy of the document.
 */

// ── History ────────────────────────────────────────────────────────────────

/**
 * Checkpoint names, keyed by the tree they name. Trees are immutable, so a tree
 * reference *is* a point in history; a WeakMap lets a checkpoint vanish with
 * the history entry that held it (the store keeps fifty).
 */
const checkpoints = new WeakMap<BlockTree, string>();
const stepCache = new WeakMap<BlockTree, { before: BlockTree; step: HistoryStep }>();

function cachedStep(before: BlockTree, after: BlockTree): HistoryStep {
  const hit = stepCache.get(after);
  if (hit && hit.before === before) return hit.step;
  const step = describeStep(before, after);
  stepCache.set(after, { before, step });
  return step;
}

/**
 * Every undo step in plain words, newest first. Click one to travel there (it
 * runs undo or redo as many times as it takes, so nothing is lost: the steps
 * after it stay available as redo until the next edit). Hover a step to
 * outline the block it touched.
 */
export function HistoryPane() {
  const store = useBuilderStore();
  const past = useBuilder((s) => s.past);
  const future = useBuilder((s) => s.future);
  const tree = useBuilder((s) => s.tree);
  const hover = useBuilder((s) => s.hover);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [, bump] = useState(0);

  const states = useMemo(() => [...past, tree, ...[...future].reverse()], [past, tree, future]);
  const current = past.length;
  const steps = states.map((state, index) =>
    index === 0
      ? { label: "Where this session began", key: null }
      : cachedStep(states[index - 1], state)
  );

  function travel(target: number) {
    const state = store.getState();
    const go = target < current ? state.undo : state.redo;
    for (let i = 0; i < Math.abs(target - current); i++) go();
  }

  function saveName() {
    const trimmed = name.trim();
    if (trimmed) checkpoints.set(tree, trimmed);
    else checkpoints.delete(tree);
    setNaming(false);
    setName("");
    bump((n) => n + 1);
  }

  return (
    <div className="flex h-full flex-col">
      <div className={clsx("border-b p-3", HAIRLINE)}>
        {naming ? (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveName();
            }}
          >
            <input
              autoFocus
              aria-label="Checkpoint name"
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Before the hero rewrite"
              className={clsx(
                "min-w-0 flex-1 border bg-transparent px-2 py-1 text-[12px]",
                HAIRLINE,
                FOCUS_RING
              )}
            />
            <button
              type="submit"
              className={clsx("border px-2 py-1 text-[11px]", HAIRLINE, FOCUS_RING)}
            >
              Save
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setName(checkpoints.get(tree) ?? "");
              setNaming(true);
            }}
            className={clsx("w-full border px-2 py-1.5 text-[12px]", HAIRLINE, FOCUS_RING)}
          >
            {checkpoints.has(tree) ? "Rename this checkpoint" : "Name this point"}
          </button>
        )}
        <p className="mt-2 text-[11px] leading-snug text-mg-fg/60">
          The last 50 steps in this area, kept until you reload. Click a step to go back to it; the
          later steps stay as redo until your next edit.
        </p>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Edit history">
        {steps
          .map((step, index) => ({ step, index }))
          .reverse()
          .map(({ step, index }) => {
            const undone = index > current;
            const checkpoint = checkpoints.get(states[index]);
            const live = step.key && findBlock(tree, step.key) ? step.key : null;
            return (
              <li key={index}>
                <button
                  type="button"
                  aria-current={index === current ? "step" : undefined}
                  onClick={() => travel(index)}
                  onMouseEnter={() => hover(live)}
                  onMouseLeave={() => hover(null)}
                  onFocus={() => hover(live)}
                  onBlur={() => hover(null)}
                  className={clsx(
                    "flex w-full items-start gap-2 px-2 py-1.5 text-left text-[12px] hover:bg-mg-fg/5",
                    index === current && "bg-mg-fg/[0.07] font-medium",
                    undone && "text-mg-fg/60",
                    FOCUS_RING
                  )}
                >
                  <span
                    aria-hidden
                    className={clsx(
                      "mt-[5px] h-2 w-2 shrink-0 rounded-full border",
                      index === current ? "border-mg-accent bg-mg-accent" : "border-mg-fg/40"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    {checkpoint && (
                      <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-mg-accentInk">
                        ◆ {checkpoint}
                      </span>
                    )}
                    <span className={clsx(undone && "line-through decoration-mg-fg/30")}>
                      {step.label}
                    </span>
                  </span>
                  {index === current && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mg-fg/60">
                      Now
                    </span>
                  )}
                  {undone && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em]">Redo</span>
                  )}
                </button>
              </li>
            );
          })}
      </ol>
    </div>
  );
}

// ── Command bar ────────────────────────────────────────────────────────────

export interface FocusCommand {
  id: string;
  label: string;
  group: string;
  /** A keyboard shortcut or short note shown at the right. */
  hint?: string;
  /** Extra words the search matches but does not show. */
  keywords?: string;
  /** Previewed on the canvas as an insertion point while highlighted. */
  browse?: BrowseItem;
  /** Outlined on the canvas while highlighted. */
  blockKey?: string;
  run: () => void;
}

/**
 * Every word of the query must appear somewhere in the command; labels that
 * start with the query rank first, then word starts, then the rest, keeping
 * the original order within each band.
 */
export function rankCommands(commands: FocusCommand[], query: string): FocusCommand[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return commands;
  const q = words.join(" ");
  const scored: { command: FocusCommand; score: number; index: number }[] = [];
  commands.forEach((command, index) => {
    const label = command.label.toLowerCase();
    const haystack = `${label} ${command.group} ${command.keywords ?? ""}`.toLowerCase();
    if (!words.every((word) => haystack.includes(word))) return;
    const score = label.startsWith(q)
      ? 0
      : label.split(/\s+/).some((part) => part.startsWith(words[0]))
        ? 1
        : 2;
    scored.push({ command, score, index });
  });
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map((s) => s.command);
}

/** Commands for jumping to any block on the page, by label and a piece of its copy. */
export function blockCommands(tree: BlockTree, onGo: (key: string) => void): FocusCommand[] {
  return flattenBlocks(tree).map((node) => {
    const snippet = blockSnippet(node);
    return {
      id: `go:${node._key}`,
      label: snippet ? `${blockLabel(node)} — “${snippet}”` : blockLabel(node),
      group: "Go to block",
      keywords: node._type,
      blockKey: node._key,
      run: () => onGo(node._key),
    };
  });
}

/**
 * Ctrl/⌘K: search and run anything. Arrow keys move, Enter runs, Escape closes.
 * Highlighting an insert command draws its insertion point on the canvas, and
 * highlighting a block outlines it: the same hover previews as the panes.
 */
export function CommandBar({
  commands,
  onClose,
  onBrowse,
}: {
  commands: FocusCommand[];
  onClose: () => void;
  onBrowse: (item: BrowseItem | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const hover = useBuilder((s) => s.hover);
  const list = useRef<HTMLUListElement>(null);
  const results = useMemo(() => rankCommands(commands, query).slice(0, 60), [commands, query]);
  const current = results[Math.min(active, results.length - 1)] as FocusCommand | undefined;

  // Keyed by id: the host rebuilds its command objects on every render, and
  // re-previewing an unchanged highlight would loop through the store.
  const currentRef = useRef(current);
  currentRef.current = current;
  const currentId = current?.id;
  useEffect(() => {
    onBrowse(currentRef.current?.browse ?? null);
    hover(currentRef.current?.blockKey ?? null);
  }, [currentId, onBrowse, hover]);
  useEffect(
    () => () => {
      onBrowse(null);
      hover(null);
    },
    [onBrowse, hover]
  );
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-command-index="${active}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  function run(command: FocusCommand | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  let lastGroup = "";
  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command bar"
        className={clsx(
          "flex max-h-[70vh] w-[620px] max-w-[92vw] flex-col border bg-mg-surface shadow-2xl",
          HAIRLINE
        )}
      >
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="focus-command-list"
          aria-activedescendant={current ? `focus-command-${active}` : undefined}
          aria-label="Search commands"
          placeholder="Insert, go to a block, switch device, undo…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              run(current);
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
          className={clsx("border-b bg-transparent px-4 py-3 text-[15px] outline-none", HAIRLINE)}
        />
        <ul
          ref={list}
          id="focus-command-list"
          role="listbox"
          aria-label="Commands"
          className="min-h-0 flex-1 overflow-y-auto py-1"
        >
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-[13px] text-mg-fg/60">
              Nothing matches “{query}”.
            </li>
          )}
          {results.map((command, index) => {
            const heading = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <li key={command.id} role="presentation">
                {heading && (
                  <p className={clsx(LABEL_SM, "px-4 pb-1 pt-3")} aria-hidden>
                    {heading}
                  </p>
                )}
                <div
                  id={`focus-command-${index}`}
                  role="option"
                  aria-selected={index === active}
                  data-command-index={index}
                  onMouseMove={() => index !== active && setActive(index)}
                  onClick={() => run(command)}
                  className={clsx(
                    "flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-[13px]",
                    index === active && "bg-mg-fg/[0.07] shadow-[inset_2px_0_0_#c8102e]"
                  )}
                >
                  <span className="truncate">{command.label}</span>
                  {command.hint && (
                    <span className="shrink-0 font-mono text-[10px] text-mg-fg/60">
                      {command.hint}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p
          className={clsx(
            "flex gap-4 border-t px-4 py-2 font-mono text-[10px] text-mg-fg/60",
            HAIRLINE
          )}
        >
          <span>↑↓ move</span>
          <span>↵ run</span>
          <span>Esc close</span>
        </p>
      </div>
    </div>
  );
}

// ── Selection bar ──────────────────────────────────────────────────────────

/**
 * Shown while two or more blocks are selected: the group actions an editor
 * reaches for most, one click each, every one a single undo step. The full
 * group inspector (style class, width, background) stays in the inspector.
 */
export function SelectionBar() {
  const selectedKeys = useBuilder((s) => s.selectedKeys);
  const selectedKey = useBuilder((s) => s.selectedKey);
  const tree = useBuilder((s) => s.tree);
  const store = useBuilderStore();
  if (selectedKeys.length < 2) return null;

  const nodes = selectedKeys
    .map((key) => findBlock(tree, key))
    .filter((node): node is NonNullable<typeof node> => !!node);
  const allLocked = nodes.every((node) => node.locked);
  const allHidden = nodes.every((node) => node.visibility?.hidden);
  const anchor = selectedKey ? findBlock(tree, selectedKey) : undefined;
  const state = () => store.getState();
  const wrapRefusal = cannotWrapInColumns(tree, selectedKeys);

  const action = (
    label: string,
    onClick: () => void,
    opts?: { title?: string; disabled?: boolean }
  ): ReactNode => (
    <button
      type="button"
      onClick={onClick}
      title={opts?.title}
      disabled={opts?.disabled}
      className={clsx(
        "px-3 py-1.5 text-[12px] text-[#f4f4f4] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white disabled:cursor-not-allowed disabled:text-[#f4f4f4]/40 disabled:hover:bg-transparent"
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      role="toolbar"
      aria-label={`${nodes.length} blocks selected`}
      data-selection-bar
      className="pointer-events-auto sticky bottom-4 z-30 mx-auto flex w-fit items-center divide-x divide-white/15 bg-[#141414] shadow-2xl"
    >
      <span className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#f4f4f4]/75">
        {nodes.length} selected
      </span>
      {action("Duplicate", () => state().duplicateSelected(), { title: "Ctrl/⌘ D" })}
      {action(allHidden ? "Show" : "Hide", () =>
        state().setSelectedVisibility({ hidden: !allHidden })
      )}
      {anchor &&
        action(
          "Match spacing",
          () =>
            state().setSelectedDesign({
              spaceBefore: anchor.design?.spaceBefore,
              spaceAfter: anchor.design?.spaceAfter,
            }),
          { title: `Give every selected block the spacing of ${blockLabel(anchor)}` }
        )}
      {action(allLocked ? "Unlock" : "Lock", () => state().setSelectedLocked(!allLocked))}
      {action("Side by side", () => state().wrapSelectionInColumns(), {
        title: wrapRefusal ?? "Put these blocks in one Columns row, one per column",
        disabled: wrapRefusal !== null,
      })}
      {action("Delete", () => state().removeSelected(), { title: "Delete" })}
      {action("Clear", () => state().select(null), { title: "Esc" })}
    </div>
  );
}

// ── Compare devices ────────────────────────────────────────────────────────

export type MintPreview = (
  device: "desktop" | "tablet" | "mobile"
) => Promise<{ ok: boolean; data?: { path: string }; error?: string }>;

/** The widths the site's own breakpoints are judged at: wide desktop, tablet, phone. */
export const COMPARE_FRAMES = [
  { device: "desktop", label: "Desktop", width: 1440 },
  { device: "tablet", label: "Tablet", width: 820 },
  { device: "mobile", label: "Phone", width: 390 },
] as const;
const COMPARE_GAP = 24;

/**
 * The draft at three real widths at once. Each frame is the token preview page
 * in an iframe, so media queries, device visibility and the public renderer all
 * behave exactly as they will live, which a scaled-down canvas cannot promise.
 *
 * It waits for autosave to settle before minting the link, so the frames show
 * the edit just made rather than the one before it.
 */
export function CompareDevices({
  mintPreview,
  onClose,
}: {
  mintPreview: MintPreview;
  onClose: () => void;
}) {
  const store = useBuilderStore();
  const [status, setStatus] = useState<
    { kind: "waiting" } | { kind: "ready"; path: string } | { kind: "error"; message: string }
  >({ kind: "waiting" });
  const [round, setRound] = useState(0);
  const [box, setBox] = useState({ width: 1200, height: 700 });
  const stage = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => close.current?.focus(), []);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: "waiting" });
    const settled = () => {
      const state = store.getState();
      return !state.dirty && state.save.kind !== "saving";
    };
    const mint = async () => {
      unsubscribe?.();
      unsubscribe = undefined;
      const result = await mintPreview("desktop");
      if (cancelled) return;
      setStatus(
        result.ok && result.data
          ? { kind: "ready", path: result.data.path }
          : { kind: "error", message: result.error ?? "The preview could not be created." }
      );
    };
    let unsubscribe: (() => void) | undefined;
    if (settled()) void mint();
    else
      unsubscribe = store.subscribe((state) => {
        if (state.save.kind === "error") {
          unsubscribe?.();
          setStatus({
            kind: "error",
            message: "Your latest edits did not save, so they cannot be previewed yet.",
          });
        } else if (settled()) void mint();
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [store, mintPreview, round]);

  const total = COMPARE_FRAMES.reduce((sum, frame) => sum + frame.width, 0);
  const scale = Math.min(1, (box.width - COMPARE_GAP * 2) / total);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compare devices"
      className="absolute inset-0 z-50 flex flex-col bg-[#1b1b1d]"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 text-[#f4f4f4]">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#f4f4f4]/75">
          Compare devices · your saved draft, rendered by the live site
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRound((n) => n + 1)}
            className="border border-white/30 px-3 py-1 text-[12px] hover:bg-white/10"
          >
            Refresh
          </button>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            className="border border-white/30 px-3 py-1 text-[12px] hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
      <div ref={stage} className="relative min-h-0 flex-1 overflow-hidden p-0">
        {status.kind === "waiting" && (
          <p role="status" className="p-8 text-center text-[13px] text-[#f4f4f4]/80">
            Saving your latest edits, then rendering…
          </p>
        )}
        {status.kind === "error" && (
          <p role="alert" className="p-8 text-center text-[13px] text-[#f4f4f4]">
            {status.message}
          </p>
        )}
        {status.kind === "ready" && (
          <div
            className="flex h-full items-start justify-center"
            style={{ gap: COMPARE_GAP / 2, paddingTop: 12 }}
          >
            {COMPARE_FRAMES.map((frame) => (
              <figure key={frame.device} className="flex flex-col items-center">
                <figcaption className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#f4f4f4]/75">
                  {frame.label} · {frame.width}px
                </figcaption>
                <div
                  className="overflow-hidden bg-white shadow-2xl"
                  style={{ width: frame.width * scale, height: box.height - 48 }}
                >
                  <iframe
                    key={`${status.path}:${round}`}
                    data-compare-frame={frame.device}
                    title={`${frame.label} preview`}
                    src={status.path}
                    style={{
                      width: frame.width,
                      height: (box.height - 48) / scale,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                      border: 0,
                    }}
                  />
                </div>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
