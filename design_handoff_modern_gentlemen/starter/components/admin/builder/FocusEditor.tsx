"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useShallow } from "zustand/react/shallow";

import { clsx } from "@/components/ui/clsx";
import { FOCUS_RING, HAIRLINE, LABEL_SM } from "@/components/admin/ui/styles";
import { manifestFor } from "@/lib/blocks/manifests";
import { findBlock } from "@/lib/blocks/traverse";
import type { BlockTree } from "@/lib/blocks/types";

import { adviseTree, type Advice } from "./advisories";
import { EditorExperienceSwitch, useEditorExperience } from "./EditorExperience";
import {
  CommandBar,
  CompareDevices,
  HistoryPane,
  SelectionBar,
  blockCommands,
  type FocusCommand,
  type MintPreview,
} from "./FocusTools";
import type { BrowseItem } from "./InsertMenu";
import { useBuilder, useBuilderStore } from "./StoreContext";
import { locate } from "./tree";

/**
 * Focus — the unified, canvas-first editor.
 *
 * The page gets nearly the whole window. A slim rail opens one pane at a time
 * (Insert, Layers, Page, Health) over the canvas, and the inspector floats
 * beside whatever is selected, or docks to the right when the editor prefers a
 * fixed column. Everything underneath is the same store, autosave, drag and
 * drop and renderers as the other two experiences: Focus is layout and
 * interaction, never a different document.
 *
 * **Browsing is previewed twice.** Hovering or focusing anything in the Insert
 * pane shows the real rendered block beside the pane (InsertMenu, WidgetLibrary)
 * AND a red line on the canvas at the exact place a click would insert it.
 * Hovering a layer outlines that block on the canvas (Navigator, via the
 * store's hover). Nothing is inserted or saved until a click.
 */

export type FocusPane = "insert" | "layers" | "page" | "health" | "history";
const PANES: readonly FocusPane[] = ["insert", "layers", "page", "health", "history"];
const INSPECTOR_KEY = "mg-focus-inspector";
const PANE_PIN_KEY = "mg-focus-pane-pinned";
const RAIL = 60;
const PANE = 320;
const CARD = 340;

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A refused write only means the preference lasts this visit.
  }
}

/** Where a click on the browsed item would land, mirroring the insert handlers. */
export function insertionTarget(
  tree: BlockTree,
  selectedKey: string | null,
  item: BrowseItem | null
): { kind: "after" | "inside" | "end"; key: string | null } | null {
  if (!item) return null;
  const selected = selectedKey ? findBlock(tree, selectedKey) : null;
  if (selected && !selected.locked) {
    const slot = manifestFor(selected._type)?.slot;
    const type = item.kind === "pattern" ? null : item.type;
    const intoGrid = item.kind === "block" && selected._type === "gridLayout";
    const intoSlot =
      item.kind === "widget" && slot && type && (!slot.allow || slot.allow.includes(type));
    if (intoGrid || intoSlot) return { kind: "inside", key: selected._key };
  }
  if (selected && locate(tree, selected._key)) return { kind: "after", key: selected._key };
  const last = tree[tree.length - 1];
  return { kind: "end", key: last ? last._key : null };
}

export function FocusLayout({
  topBar,
  canvas,
  insertPane,
  widgetsPane,
  layersPane,
  pagePane,
  inspector,
  inspectorFooter,
  isPage,
  commands = [],
  mintPreview,
}: {
  topBar: ReactNode;
  canvas: ReactNode;
  insertPane: (onBrowse: (item: BrowseItem | null) => void) => ReactNode;
  widgetsPane: (onBrowse: (item: BrowseItem | null) => void) => ReactNode;
  layersPane: ReactNode;
  pagePane: ReactNode | null;
  inspector: ReactNode;
  inspectorFooter?: ReactNode;
  isPage: boolean;
  /** Extra command-bar entries from the host, e.g. one "Insert …" per catalogue block. */
  commands?: FocusCommand[];
  /** Mints a draft preview link; enables Compare devices when present. */
  mintPreview?: MintPreview;
}) {
  const [pane, setPane] = useState<FocusPane | null>(null);
  const [insertTab, setInsertTab] = useState<"sections" | "widgets">("sections");
  const [pinned, setPinned] = useState(false);
  const [docked, setDocked] = useState(false);
  const [browsing, setBrowsing] = useState<BrowseItem | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [comparing, setComparing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setDocked(readPref(INSPECTOR_KEY) === "dock");
    const saved = readPref(PANE_PIN_KEY);
    if (PANES.includes(saved as FocusPane)) {
      setPinned(true);
      setPane(saved as FocusPane);
    }
  }, []);

  const selectedKey = useBuilder((s) => s.selectedKey);
  const tree = useBuilder((s) => s.tree);
  const select = useBuilder((s) => s.select);
  const issues = useBuilder(useShallow((s) => [...s.issues, ...s.serverIssues]));
  const selectedNode = selectedKey ? findBlock(tree, selectedKey) : undefined;

  const openPane = useCallback(
    (next: FocusPane | null) => {
      setPane((current) => {
        const value = current === next ? null : next;
        if (pinned) writePref(PANE_PIN_KEY, value ?? "");
        if (!value) setPinned(false);
        return value;
      });
      setBrowsing(null);
    },
    [pinned]
  );

  // Keyboard: "/" opens Insert with its search focused, "?" the shortcut sheet,
  // Escape closes the newest overlay first. Ignored while typing.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowCommands((open) => !open);
        return;
      }
      if (event.key === "Escape") {
        if (showCommands) return setShowCommands(false);
        if (comparing) return setComparing(false);
        if (showKeys) return setShowKeys(false);
        if (showLayout) return setShowLayout(false);
        if (pane && !pinned && !selectedKey) {
          setPane(null);
          railRef.current?.querySelector<HTMLElement>(`[data-pane-button="${pane}"]`)?.focus();
        }
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") {
        event.preventDefault();
        setPane("insert");
        setInsertTab("sections");
        requestAnimationFrame(() =>
          rootRef.current?.querySelector<HTMLInputElement>("[data-focus-pane] input")?.focus()
        );
      } else if (event.key === "?") {
        event.preventDefault();
        setShowKeys(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pane, pinned, selectedKey, showKeys, showLayout, showCommands, comparing]);

  const store = useBuilderStore();
  const { setMode } = useEditorExperience();
  const allCommands = useMemo<FocusCommand[]>(() => {
    const state = () => store.getState();
    const scrollTo = (key: string) =>
      mainRef.current
        ?.querySelector(`[data-block-key="${CSS.escape(key)}"]`)
        ?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    const edit: FocusCommand[] = [
      { id: "undo", label: "Undo", group: "Edit", hint: "Ctrl/⌘ Z", run: () => state().undo() },
      { id: "redo", label: "Redo", group: "Edit", hint: "Ctrl/⌘ ⇧ Z", run: () => state().redo() },
      {
        id: "select-all",
        label: "Select all blocks",
        group: "Edit",
        hint: "Ctrl/⌘ A",
        run: () => state().selectAll(),
      },
      {
        id: "duplicate",
        label: "Duplicate selection",
        group: "Edit",
        hint: "Ctrl/⌘ D",
        keywords: "copy clone",
        run: () => state().duplicateSelected(),
      },
      {
        id: "delete",
        label: "Delete selection",
        group: "Edit",
        hint: "Del",
        keywords: "remove",
        run: () => state().removeSelected(),
      },
      {
        id: "lock",
        label: "Lock or unlock selection",
        group: "Edit",
        run: () => {
          const s = state();
          const nodes = s.selectedKeys.map((key) => findBlock(s.tree, key));
          s.setSelectedLocked(!nodes.every((node) => node?.locked));
        },
      },
      {
        id: "side-by-side",
        label: "Put selection side by side",
        group: "Edit",
        keywords: "columns row wrap arrange",
        run: () => state().wrapSelectionInColumns(),
      },
      {
        id: "deselect",
        label: "Clear selection",
        group: "Edit",
        hint: "Esc",
        run: () => state().select(null),
      },
    ];
    const view: FocusCommand[] = [
      ...(["desktop", "tablet", "mobile"] as const).map((device) => ({
        id: `device:${device}`,
        label: `Preview on ${device}`,
        group: "View",
        keywords: "device breakpoint responsive",
        run: () => state().setDevice(device),
      })),
      {
        id: "zoom-in",
        label: "Zoom in",
        group: "View",
        run: () => state().setCanvasZoom(state().canvasZoom + 0.1),
      },
      {
        id: "zoom-out",
        label: "Zoom out",
        group: "View",
        run: () => state().setCanvasZoom(state().canvasZoom - 0.1),
      },
      {
        id: "zoom-reset",
        label: "Zoom to 100%",
        group: "View",
        run: () => state().setCanvasZoom(1),
      },
      { id: "rulers", label: "Toggle rulers", group: "View", run: () => state().toggleRulers() },
      ...(mintPreview
        ? [
            {
              id: "compare",
              label: "Compare devices side by side",
              group: "View",
              keywords: "responsive desktop tablet mobile phone preview",
              run: () => setComparing(true),
            },
          ]
        : []),
      {
        id: "inspector",
        label: docked ? "Float the inspector" : "Dock the inspector",
        group: "View",
        run: () => {
          setDocked(!docked);
          writePref(INSPECTOR_KEY, docked ? "float" : "dock");
        },
      },
    ];
    const panes: FocusCommand[] = PANES.filter((id) => id !== "page" || isPage).map((id) => ({
      id: `pane:${id}`,
      label: `Open ${paneTitle(id)}`,
      group: "Panes",
      hint: id === "insert" ? "/" : undefined,
      run: () => {
        setPane(id);
        setBrowsing(null);
      },
    }));
    const help: FocusCommand[] = [
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        group: "Help",
        hint: "?",
        run: () => setShowKeys(true),
      },
      {
        id: "layout:original",
        label: "Switch to the Original builder",
        group: "Help",
        keywords: "editor layout classic",
        run: () => setMode("original"),
      },
      {
        id: "layout:canvas",
        label: "Switch to the Canvas builder",
        group: "Help",
        keywords: "editor layout",
        run: () => setMode("canvas"),
      },
    ];
    return [
      ...edit,
      ...view,
      ...panes,
      ...blockCommands(tree, (key) => {
        state().select(key);
        scrollTo(key);
      }),
      ...commands,
      ...help,
    ];
  }, [store, setMode, docked, isPage, tree, commands, mintPreview]);

  const railButton = (id: FocusPane, label: string, icon: ReactNode, badge?: number) => (
    <button
      type="button"
      data-pane-button={id}
      aria-pressed={pane === id}
      aria-label={badge ? `${label}, ${badge} issue${badge === 1 ? "" : "s"}` : label}
      title={label}
      onClick={() => openPane(id)}
      className={clsx(
        "relative grid h-11 w-11 place-items-center text-[#f4f4f4]/75 transition-colors hover:bg-white/10 hover:text-white",
        pane === id && "bg-white/15 text-white shadow-[inset_2px_0_0_#c8102e]",
        FOCUS_RING
      )}
    >
      {icon}
      {badge ? (
        <span className="absolute right-0.5 top-0.5 grid min-w-[17px] place-items-center rounded-full bg-mg-accent px-1 font-mono text-[10px] text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );

  return (
    <div ref={rootRef} className="relative flex h-screen flex-col" data-focus-editor>
      {topBar}
      <div className="relative flex min-h-0 flex-1">
        <nav
          ref={railRef}
          aria-label="Editor tools"
          className="flex shrink-0 flex-col items-center gap-1 bg-[#141414] py-3"
          style={{ width: RAIL }}
        >
          <span aria-hidden className="mb-3 block h-[14px] w-[6px] bg-mg-accent" />
          <button
            type="button"
            aria-label="Command bar"
            aria-expanded={showCommands}
            title="Search and run anything (Ctrl/⌘ K)"
            onClick={() => setShowCommands(true)}
            className={clsx(
              "mb-2 grid h-11 w-11 place-items-center text-[#f4f4f4]/75 hover:bg-white/10 hover:text-white",
              FOCUS_RING
            )}
          >
            <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" />
          </button>
          {railButton("insert", "Insert", <Icon d="M12 5v14M5 12h14" />)}
          {railButton(
            "layers",
            "Layers",
            <Icon d="M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4" />
          )}
          {isPage &&
            railButton("page", "Page settings", <Icon d="M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4" />)}
          {railButton(
            "health",
            "Health",
            <Icon d="M3 12h4l2-5 4 10 2-5h6" />,
            issues.length || undefined
          )}
          {railButton(
            "history",
            "History",
            <Icon d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4M12 8v4l3 2" />
          )}
          {mintPreview && (
            <button
              type="button"
              aria-label="Compare devices"
              title="Compare desktop, tablet and phone side by side"
              onClick={() => setComparing(true)}
              className={clsx(
                "grid h-11 w-11 place-items-center text-[#f4f4f4]/75 hover:bg-white/10 hover:text-white",
                FOCUS_RING
              )}
            >
              <Icon d="M2 5h13v10H2zM6 19h5M17 8h5v11h-5z" />
            </button>
          )}
          <span className="flex-1" />
          <button
            type="button"
            aria-label="Editor layout"
            aria-expanded={showLayout}
            title="Editor layout"
            onClick={() => setShowLayout((v) => !v)}
            className={clsx(
              "grid h-11 w-11 place-items-center text-[#f4f4f4]/75 hover:bg-white/10 hover:text-white",
              FOCUS_RING
            )}
          >
            <Icon d="M4 5h16v14H4zM9 5v14" />
          </button>
          <button
            type="button"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            onClick={() => setShowKeys(true)}
            className={clsx(
              "grid h-11 w-11 place-items-center font-mono text-sm text-[#f4f4f4]/75 hover:bg-white/10 hover:text-white",
              FOCUS_RING
            )}
          >
            ?
          </button>
        </nav>

        {pane && (
          <aside
            data-focus-pane={pane}
            aria-label={paneTitle(pane)}
            className={clsx(
              "relative z-30 flex shrink-0 flex-col border-r bg-mg-surface",
              HAIRLINE
            )}
            style={{ width: PANE }}
          >
            <div className={clsx("flex items-center justify-between border-b px-3 py-2", HAIRLINE)}>
              <h2 className={LABEL_SM}>{paneTitle(pane)}</h2>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-pressed={pinned}
                  onClick={() => {
                    setPinned(!pinned);
                    writePref(PANE_PIN_KEY, pinned ? "" : pane);
                  }}
                  className={clsx("border px-2 py-1 text-[11px]", HAIRLINE, FOCUS_RING)}
                  title={
                    pinned ? "Stop reopening this pane" : "Reopen this pane every time you edit"
                  }
                >
                  {pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  type="button"
                  aria-label={`Close ${paneTitle(pane)}`}
                  onClick={() => openPane(null)}
                  className={clsx("border px-2 py-1 text-[11px]", HAIRLINE, FOCUS_RING)}
                >
                  ✕
                </button>
              </div>
            </div>
            {pane === "insert" && (
              <div
                className={clsx("flex border-b", HAIRLINE)}
                role="group"
                aria-label="Insert from"
              >
                {(["sections", "widgets"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    aria-pressed={insertTab === tab}
                    onClick={() => {
                      setInsertTab(tab);
                      setBrowsing(null);
                    }}
                    className={clsx(
                      "flex-1 border-b-2 px-3 py-2 text-xs",
                      insertTab === tab ? "border-mg-accent" : "border-transparent",
                      FOCUS_RING
                    )}
                  >
                    {tab === "sections" ? "Sections & patterns" : "Widgets & elements"}
                  </button>
                ))}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-hidden">
              {pane === "insert" &&
                (insertTab === "sections" ? insertPane(setBrowsing) : widgetsPane(setBrowsing))}
              {pane === "layers" && layersPane}
              {pane === "page" && pagePane}
              {pane === "health" && <HealthPane />}
              {pane === "history" && <HistoryPane />}
            </div>
          </aside>
        )}

        <main
          ref={mainRef}
          className="relative min-w-0 flex-1 overflow-y-auto bg-mg-bg"
          data-focus-canvas
        >
          {canvas}
          <InsertionMarker main={mainRef} item={browsing} />
          <SelectionBar />
        </main>

        {docked && selectedNode && (
          <aside
            aria-label="Inspector"
            className={clsx("flex shrink-0 flex-col border-l bg-mg-surface", HAIRLINE)}
            style={{ width: CARD }}
          >
            <InspectorHeader
              label={manifestFor(selectedNode._type)?.label ?? selectedNode._type}
              docked
              onDock={() => {
                setDocked(false);
                writePref(INSPECTOR_KEY, "float");
              }}
              onClose={() => select(null)}
            />
            <div className="min-h-0 flex-1 overflow-hidden">{inspector}</div>
            {inspectorFooter}
          </aside>
        )}

        {!docked && selectedNode && (
          <FloatingInspector
            key={selectedKey}
            root={rootRef}
            main={mainRef}
            selectedKey={selectedKey!}
            label={manifestFor(selectedNode._type)?.label ?? selectedNode._type}
            onDock={() => {
              setDocked(true);
              writePref(INSPECTOR_KEY, "dock");
            }}
            onClose={() => select(null)}
            footer={inspectorFooter}
          >
            {inspector}
          </FloatingInspector>
        )}
      </div>

      {showLayout && (
        <div
          role="dialog"
          aria-label="Editor layout"
          className={clsx("absolute bottom-16 z-50 border bg-mg-surface p-3 shadow-2xl", HAIRLINE)}
          style={{ left: RAIL + 8 }}
        >
          <p className={clsx(LABEL_SM, "mb-2")}>Editor layout</p>
          <EditorExperienceSwitch compact />
          <p className="mt-2 max-w-[300px] text-[12px] text-mg-fg/70">
            The same page in every layout. Switching never converts or saves anything.
          </p>
        </div>
      )}
      {showKeys && <ShortcutSheet onClose={() => setShowKeys(false)} />}
      {comparing && mintPreview && (
        <CompareDevices mintPreview={mintPreview} onClose={() => setComparing(false)} />
      )}
      {showCommands && (
        <CommandBar
          commands={allCommands}
          onBrowse={setBrowsing}
          onClose={() => setShowCommands(false)}
        />
      )}
    </div>
  );
}

function paneTitle(pane: FocusPane) {
  return {
    insert: "Insert",
    layers: "Layers",
    page: "Page settings",
    health: "Health",
    history: "History",
  }[pane];
}

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

function InspectorHeader({
  label,
  docked,
  onDock,
  onClose,
  onPointerDown,
}: {
  label: string;
  docked: boolean;
  onDock: () => void;
  onClose: () => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className={clsx(
        "flex items-center justify-between gap-2 border-b px-3 py-2",
        HAIRLINE,
        !docked && "cursor-move select-none"
      )}
    >
      <span className={LABEL_SM}>{label}</span>
      <div className="flex gap-1" onPointerDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onDock}
          className={clsx("border px-2 py-1 text-[11px]", HAIRLINE, FOCUS_RING)}
          title={
            docked ? "Float the inspector beside the selection" : "Dock the inspector to the right"
          }
        >
          {docked ? "Float" : "Dock"}
        </button>
        <button
          type="button"
          aria-label="Close inspector"
          onClick={onClose}
          className={clsx("border px-2 py-1 text-[11px]", HAIRLINE, FOCUS_RING)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * The inspector, floating beside the selected block.
 *
 * Placed to the block's right when there is room, else its left, else against
 * the canvas's right edge; vertically aligned with the block and clamped to the
 * window. It follows the block through scrolling and layout changes. Dragging
 * its header moves it anywhere; the position resets for the next selection
 * (the component is keyed by selection).
 */
function FloatingInspector({
  root,
  main,
  selectedKey,
  label,
  onDock,
  onClose,
  footer,
  children,
}: {
  root: React.RefObject<HTMLDivElement | null>;
  main: React.RefObject<HTMLElement | null>;
  selectedKey: string;
  label: string;
  onDock: () => void;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const card = useRef<HTMLElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [manual, setManual] = useState<{ left: number; top: number } | null>(null);
  const tree = useBuilder((s) => s.tree);
  const device = useBuilder((s) => s.device);

  const place = useCallback(() => {
    const rootEl = root.current;
    const mainEl = main.current;
    const block = mainEl?.querySelector<HTMLElement>(
      `[data-block-key="${CSS.escape(selectedKey)}"]`
    );
    if (!rootEl || !mainEl) return;
    const r = rootEl.getBoundingClientRect();
    const m = mainEl.getBoundingClientRect();
    const height = card.current?.offsetHeight ?? 420;
    const minTop = m.top - r.top + 8;
    const maxTop = Math.max(minTop, r.height - height - 8);
    if (!block) {
      setPos({ left: m.right - r.left - CARD - 16, top: minTop });
      return;
    }
    const b = block.getBoundingClientRect();
    let left = b.right - r.left + 16;
    if (left + CARD > m.right - r.left - 8) left = b.left - r.left - CARD - 16;
    if (left < m.left - r.left + 8) left = m.right - r.left - CARD - 16;
    const top = Math.min(Math.max(b.top - r.top, minTop), maxTop);
    setPos({ left, top });
  }, [root, main, selectedKey]);

  useLayoutEffect(() => {
    place();
  }, [place, tree, device]);
  useEffect(() => {
    const mainEl = main.current;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    mainEl?.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (observer && card.current) observer.observe(card.current);
    if (observer && mainEl) observer.observe(mainEl);
    return () => {
      cancelAnimationFrame(frame);
      mainEl?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [main, place]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !root.current || !card.current) return;
    const r = root.current.getBoundingClientRect();
    const c = card.current.getBoundingClientRect();
    const dx = event.clientX - c.left;
    const dy = event.clientY - c.top;
    const move = (e: PointerEvent) =>
      setManual({
        left: Math.min(Math.max(e.clientX - r.left - dx, 0), r.width - CARD),
        top: Math.min(Math.max(e.clientY - r.top - dy, 0), r.height - 60),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const at = manual ?? pos;
  return (
    <aside
      ref={card}
      aria-label="Inspector"
      data-floating-inspector={selectedKey}
      className={clsx(
        "absolute z-40 flex flex-col border bg-mg-surface shadow-[0_18px_48px_rgba(0,0,0,0.22)]",
        HAIRLINE
      )}
      style={{
        width: CARD,
        maxHeight: "calc(100% - 96px)",
        left: at?.left ?? -9999,
        top: at?.top ?? 0,
        visibility: at ? "visible" : "hidden",
      }}
    >
      <InspectorHeader
        label={label}
        docked={false}
        onDock={onDock}
        onClose={onClose}
        onPointerDown={startDrag}
      />
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      {footer}
    </aside>
  );
}

/** A red line on the canvas where the browsed item would be inserted. */
function InsertionMarker({
  main,
  item,
}: {
  main: React.RefObject<HTMLElement | null>;
  item: BrowseItem | null;
}) {
  const tree = useBuilder((s) => s.tree);
  const selectedKey = useBuilder((s) => s.selectedKey);
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
    label: string;
    offscreen: "above" | "below" | null;
  } | null>(null);

  useLayoutEffect(() => {
    const mainEl = main.current;
    const target = insertionTarget(tree, selectedKey, item);
    if (!mainEl || !target) {
      setBox(null);
      return;
    }
    const m = mainEl.getBoundingClientRect();
    const el = target.key
      ? mainEl.querySelector<HTMLElement>(`[data-block-key="${CSS.escape(target.key)}"]`)
      : null;
    const rect = el?.getBoundingClientRect();
    const y = rect ? (target.kind === "inside" ? rect.bottom - 10 : rect.bottom + 2) : m.top + 24;
    const name = target.key ? manifestFor(findBlock(tree, target.key)?._type ?? "")?.label : null;
    const label =
      target.kind === "inside"
        ? `Inserts inside ${name ?? "the selected block"}`
        : target.kind === "after"
          ? `Inserts after ${name ?? "the selection"}`
          : name
            ? "Inserts at the end of the page"
            : "Inserts as the first block";
    const top = y - m.top + mainEl.scrollTop;
    const offscreen = y < m.top ? "above" : y > m.bottom ? "below" : null;
    setBox({
      top,
      left: (rect ? rect.left : m.left + 24) - m.left,
      width: rect ? rect.width : m.width - 48,
      label,
      offscreen,
    });
  }, [main, tree, selectedKey, item]);

  if (!box) return null;
  return (
    <>
      <div
        aria-hidden
        data-insertion-marker
        className="pointer-events-none absolute z-20"
        style={{ top: box.top - 2, left: box.left, width: box.width }}
      >
        <div className="h-[3px] bg-mg-accent shadow-[0_0_0_3px_rgba(200,16,46,0.18)]" />
        <span className="absolute left-0 top-2 bg-mg-accent px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white">
          {box.label}
        </span>
      </div>
      {box.offscreen && (
        <div
          aria-live="polite"
          className="pointer-events-none sticky z-20 mx-auto w-fit bg-mg-accent px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white"
          style={box.offscreen === "above" ? { top: 8 } : { bottom: 8 }}
        >
          {box.label} {box.offscreen === "above" ? "↑" : "↓"}
        </div>
      )}
    </>
  );
}

/**
 * Every validation issue, grouped by block, then non-blocking suggestions with
 * one-click fixes. Hover an entry to outline its block, click it to edit.
 */
function HealthPane() {
  const issues = useBuilder(useShallow((s) => [...s.issues, ...s.serverIssues]));
  const tree = useBuilder((s) => s.tree);
  const advice = useMemo(() => adviseTree(tree), [tree]);
  const select = useBuilder((s) => s.select);
  const hover = useBuilder((s) => s.hover);
  const store = useBuilderStore();

  const reveal = (key: string) => {
    select(key);
    document
      .querySelector(`[data-block-key="${CSS.escape(key)}"]`)
      ?.scrollIntoView?.({ block: "center" });
  };
  const hoverProps = (key: string) => ({
    onMouseEnter: () => hover(key),
    onMouseLeave: () => hover(null),
    onFocus: () => hover(key),
    onBlur: () => hover(null),
  });
  function applyFix(item: Advice) {
    const state = store.getState();
    const fix = item.fix;
    if (!fix) return;
    if (fix.kind === "showOnAllDevices") state.setVisibility(item.key, { devices: undefined });
    else if (fix.kind === "unhide") state.setVisibility(item.key, { hidden: false });
    else if (fix.kind === "setHeadingLevel") state.setSetting(item.key, ["level"], fix.level);
    else if (fix.kind === "remove") state.remove(item.key);
    hover(null);
  }

  const byBlock = new Map<string, typeof issues>();
  for (const issue of issues) byBlock.set(issue.key, [...(byBlock.get(issue.key) ?? []), issue]);
  return (
    <div className="h-full overflow-y-auto p-3">
      {issues.length === 0 ? (
        <div className="text-[13px]">
          <p className="flex items-center gap-2 font-medium">
            <span aria-hidden className="h-2 w-2 rounded-full bg-[#2f9e5b]" />
            No issues
          </p>
          <p className="mt-2 text-mg-fg/70">
            Every block passes its checks. This list updates as you edit, and publishing stays
            blocked while anything is listed here.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-[12px] text-mg-fg/70">
            {issues.length} {issues.length === 1 ? "issue" : "issues"} to fix before publishing.
            Hover to find the block, click to edit it.
          </p>
          <ul className="space-y-2">
            {[...byBlock.entries()].map(([key, list]) => (
              <li key={key}>
                <button
                  type="button"
                  {...hoverProps(key)}
                  onClick={() => reveal(key)}
                  className={clsx(
                    "w-full border p-3 text-left text-[12px] hover:bg-mg-fg/5",
                    HAIRLINE,
                    FOCUS_RING
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <span aria-hidden className="h-2 w-2 rounded-full bg-mg-accent" />
                    {manifestFor(list[0].type)?.label ?? list[0].type}
                  </span>
                  <span className="mt-1 block text-mg-fg/70">
                    {list
                      .map((issue) =>
                        issue.path ? `${issue.path}: ${issue.message}` : issue.message
                      )
                      .join("; ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {advice.length > 0 && (
        <section aria-label="Suggestions" className="mt-5">
          <h3 className={clsx(LABEL_SM, "mb-2")}>Suggestions · {advice.length}</h3>
          <p className="mb-2 text-[12px] text-mg-fg/70">
            Worth a second look. None of these blocks publishing.
          </p>
          <ul className="space-y-2">
            {advice.map((item) => (
              <li
                key={item.id}
                className={clsx("border p-3 text-[12px]", HAIRLINE)}
                {...hoverProps(item.key)}
              >
                <p className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#c98a1b]" />
                  <span>{item.message}</span>
                </p>
                <div className="mt-2 flex gap-2 pl-4">
                  {item.fix && (
                    <button
                      type="button"
                      onClick={() => applyFix(item)}
                      className={clsx(
                        "border border-mg-fg/60 px-2 py-1 text-[11px] font-medium",
                        FOCUS_RING
                      )}
                    >
                      {item.fix.label}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => reveal(item.key)}
                    className={clsx("border px-2 py-1 text-[11px]", HAIRLINE, FOCUS_RING)}
                  >
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Search and run anything", "Ctrl/⌘ K"],
  ["Open Insert and search", "/"],
  ["Undo", "Ctrl/⌘ Z"],
  ["Redo", "Ctrl/⌘ Shift Z or Y"],
  ["Duplicate selection", "Ctrl/⌘ D"],
  ["Select all", "Ctrl/⌘ A"],
  ["Add to selection", "Shift + click"],
  ["Delete selection", "Delete"],
  ["Deselect, then close a pane", "Esc"],
  ["Preview while browsing", "Hover or Tab"],
  ["This sheet", "?"],
];

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center bg-black/40"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className={clsx("w-[520px] max-w-[92vw] border bg-mg-surface p-5", HAIRLINE)}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Keyboard shortcuts</h2>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            className={clsx("border px-2 py-1 text-xs", HAIRLINE, FOCUS_RING)}
          >
            Close
          </button>
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-6">
          {SHORTCUTS.map(([what, keys]) => (
            <div key={what} className={clsx("contents")}>
              <dt className={clsx("border-t py-2 text-[13px]", HAIRLINE)}>{what}</dt>
              <dd className={clsx("border-t py-2 text-right font-mono text-[11px]", HAIRLINE)}>
                {keys}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
