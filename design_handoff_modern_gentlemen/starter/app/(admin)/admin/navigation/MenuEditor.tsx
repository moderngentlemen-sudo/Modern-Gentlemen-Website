"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { TextInput } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { Panel } from "@/components/admin/ui/Panel";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { useToast } from "@/components/admin/ui/Toast";
import { LABEL_SM } from "@/components/admin/ui/styles";
import {
  isLinkTargetKind,
  type LinkTargetKind,
  type MenuFeature,
  type MenuLinkType,
} from "@/lib/domain/navigation";
import type { LinkTarget } from "@/lib/services/navigation";

import {
  createMenuItemAction,
  deleteMenuItemAction,
  reorderMenuItemsAction,
  updateMenuItemAction,
} from "./actions";

export interface EditorItem {
  id: string;
  label: string;
  linkType: MenuLinkType;
  targetId: string | null;
  url: string | null;
  group: string | null;
  feature: MenuFeature | null;
  children: EditorItem[];
}

export interface LinkTargets {
  categories: LinkTarget[];
  pages: LinkTarget[];
  articles: LinkTarget[];
  products: LinkTarget[];
}

const LINK_TYPE_OPTIONS = [
  { value: "category", label: "Category" },
  { value: "page", label: "Page" },
  { value: "article", label: "Article" },
  { value: "product", label: "Product" },
  { value: "url", label: "URL or path" },
] as const satisfies readonly { value: MenuLinkType; label: string }[];

const TARGET_LIST: Record<LinkTargetKind, keyof LinkTargets> = {
  category: "categories",
  page: "pages",
  article: "articles",
  product: "products",
};

interface Draft {
  /** null for a new item; the item being edited otherwise. */
  item: EditorItem | null;
  parentId: string | null;
  label: string;
  linkType: MenuLinkType;
  targetId: string;
  url: string;
  group: string;
}

const emptyDraft = (parentId: string | null): Draft => ({
  item: null,
  parentId,
  label: "",
  linkType: "category",
  targetId: "",
  url: "",
  group: "",
});

/**
 * A menu's two levels.
 *
 * Not the block builder: a menu is a list of links, not a document, and the
 * builder is a `h-screen` canvas that owns the viewport for editing block trees.
 * This is the taxonomy screen's shape — a table, a dialog, a confirm — which is
 * what the operations here actually are.
 *
 * Reordering is a pair of move buttons rather than drag-and-drop. Each press
 * sends the whole level's positions, so the order that arrives is always
 * internally consistent; dnd would buy a nicer gesture for a list that is six
 * items long, at the cost of a second ordering path to keep correct.
 */
export function MenuEditor({
  menuId,
  items,
  targets,
  canWrite,
}: {
  menuId: string;
  items: EditorItem[];
  targets: LinkTargets;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EditorItem | null>(null);
  const [error, setError] = useState<string>();

  function openCreate(parentId: string | null) {
    setError(undefined);
    setDraft(emptyDraft(parentId));
  }

  function openEdit(item: EditorItem, parentId: string | null) {
    setError(undefined);
    setDraft({
      item,
      parentId,
      label: item.label,
      linkType: item.linkType,
      targetId: item.targetId ?? "",
      url: item.url ?? "",
      group: item.group ?? "",
    });
  }

  function submit() {
    if (!draft) return;
    setError(undefined);

    const body = {
      label: draft.label,
      linkType: draft.linkType,
      targetId: draft.linkType === "url" ? null : draft.targetId || null,
      url: draft.linkType === "url" ? draft.url : null,
      group: draft.parentId === null ? null : draft.group.trim() || null,
      // A feature card is authored nowhere else yet, so an edit must carry the
      // existing one through rather than dropping it: `options` is written whole.
      feature: draft.item?.feature ?? null,
    };

    startTransition(async () => {
      const result = draft.item
        ? await updateMenuItemAction({ id: draft.item.id, ...body })
        : await createMenuItemAction({
            menuId,
            parentId: draft.parentId,
            position: nextPosition(draft.parentId),
            ...body,
          });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDraft(null);
      toast.push(draft.item ? "Saved" : `Added “${draft.label}”`, "success");
      router.refresh();
    });
  }

  function nextPosition(parentId: string | null): number {
    const siblings = parentId === null ? items : (findItem(items, parentId)?.children ?? []);
    return siblings.length;
  }

  function remove(item: EditorItem) {
    startTransition(async () => {
      const result = await deleteMenuItemAction({ id: item.id });
      setConfirmDelete(null);
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push(`Deleted “${item.label}”`, "success");
        router.refresh();
      }
    });
  }

  /** Sends the whole level, so the resulting order cannot be half-applied. */
  function move(siblings: EditorItem[], index: number, delta: number) {
    const next = [...siblings];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];

    startTransition(async () => {
      const result = await reorderMenuItemsAction({
        positions: next.map((item, position) => ({ id: item.id, position })),
      });
      if (!result.ok) toast.push(result.error, "error");
      else router.refresh();
    });
  }

  const targetOptions =
    draft && isLinkTargetKind(draft.linkType)
      ? targets[TARGET_LIST[draft.linkType]].map((t) => ({
          value: t.id,
          label: `${t.label} — /${t.slug}`,
        }))
      : [];

  return (
    <div className="space-y-6 px-8 py-8">
      <Panel>
        {items.length === 0 ? (
          <EmptyState title="This menu is empty">
            Nothing renders where it is mounted until it has at least one entry.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-mg-bd/10">
            {items.map((item, index) => (
              <li key={item.id} className="px-4 py-3">
                <Row
                  item={item}
                  canWrite={canWrite}
                  pending={pending}
                  onEdit={() => openEdit(item, null)}
                  onDelete={() => setConfirmDelete(item)}
                  onUp={() => move(items, index, -1)}
                  onDown={() => move(items, index, 1)}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                />

                {(item.children.length > 0 || canWrite) && (
                  <div className="mt-2 border-l border-mg-bd/15 pl-4">
                    <ul className="divide-y divide-mg-bd/10">
                      {item.children.map((child, childIndex) => (
                        <li key={child.id} className="py-2">
                          <Row
                            item={child}
                            canWrite={canWrite}
                            pending={pending}
                            onEdit={() => openEdit(child, item.id)}
                            onDelete={() => setConfirmDelete(child)}
                            onUp={() => move(item.children, childIndex, -1)}
                            onDown={() => move(item.children, childIndex, 1)}
                            isFirst={childIndex === 0}
                            isLast={childIndex === item.children.length - 1}
                          />
                        </li>
                      ))}
                    </ul>

                    {canWrite && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => openCreate(item.id)}
                      >
                        Add sub-link
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {canWrite && (
        <Button size="sm" onClick={() => openCreate(null)} disabled={pending}>
          Add entry
        </Button>
      )}

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.item ? "Edit link" : draft?.parentId ? "New sub-link" : "New entry"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              variant="solid"
              onClick={submit}
              loading={pending}
              disabled={!draft?.label.trim()}
            >
              {draft?.item ? "Save" : "Add"}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <TextInput
              label="Label"
              value={draft.label}
              onChange={(label) => setDraft({ ...draft, label })}
              help="Shown as typed. The header renders it in capitals."
              required
            />

            <Select
              label="Links to"
              value={draft.linkType}
              onChange={(value) =>
                setDraft({ ...draft, linkType: value as MenuLinkType, targetId: "", url: "" })
              }
              options={LINK_TYPE_OPTIONS}
            />

            {draft.linkType === "url" ? (
              <TextInput
                label="URL or path"
                value={draft.url}
                onChange={(url) => setDraft({ ...draft, url })}
                help="A path like /shop, or a full URL to somewhere else."
                error={error}
                required
              />
            ) : (
              <Select
                label="Target"
                value={draft.targetId}
                onChange={(targetId) => setDraft({ ...draft, targetId })}
                options={[{ value: "", label: "Choose…" }, ...targetOptions]}
                help="The link follows this item's slug, so renaming it never breaks the menu."
                error={error}
              />
            )}

            {draft.parentId !== null && (
              <TextInput
                label="Column"
                value={draft.group}
                onChange={(group) => setDraft({ ...draft, group })}
                help="The mega-menu column heading this link sits under. Links sharing a heading share a column."
              />
            )}

            <p className={LABEL_SM}>
              Visibility rules are not applied on the public site — the chrome is statically
              rendered and reads no session.
            </p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete link"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => confirmDelete && remove(confirmDelete)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-mg-fg/70">
          Delete “{confirmDelete?.label}”?
          {confirmDelete && confirmDelete.children.length > 0 && (
            <>
              {" "}
              Its {confirmDelete.children.length} sub-link
              {confirmDelete.children.length === 1 ? "" : "s"} will go with it.
            </>
          )}
        </p>
      </Dialog>
    </div>
  );
}

function findItem(items: EditorItem[], id: string): EditorItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    const found = findItem(item.children, id);
    if (found) return found;
  }
  return null;
}

function Row({
  item,
  canWrite,
  pending,
  onEdit,
  onDelete,
  onUp,
  onDown,
  isFirst,
  isLast,
}: {
  item: EditorItem;
  canWrite: boolean;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onUp: () => void;
  onDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <span className="text-[13px] font-medium">{item.label}</span>
        <span className="ml-2 font-mono text-[11px] text-mg-fg/60">
          {item.linkType === "url" ? item.url : item.linkType}
        </span>
        {item.group && <span className={`ml-2 ${LABEL_SM}`}>{item.group}</span>}
      </div>

      {canWrite && (
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" disabled={pending || isFirst} onClick={onUp}>
            ↑
          </Button>
          <Button size="sm" variant="ghost" disabled={pending || isLast} onClick={onDown}>
            ↓
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={onEdit}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={onDelete}>
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
