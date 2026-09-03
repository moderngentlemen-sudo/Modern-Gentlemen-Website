"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "@/components/ui/clsx";
import type { ActionResult } from "@/app/(admin)/admin/_lib/action-result";
import { MEDIA_KINDS } from "@/lib/domain/media";
import type { MediaTag } from "@/lib/domain/media";
import type { AssetUsageView, AssetView } from "@/lib/services/media";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { useToast } from "../ui/Toast";
import { CONTROL, FOCUS_RING, LABEL_SM } from "../ui/styles";
import { AssetDetails } from "./AssetDetails";
import { MediaGrid } from "./MediaGrid";
import { UploadZone, type UploadAction } from "./UploadZone";

export interface MediaFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface MediaLibraryActions {
  upload: UploadAction;
  list: (input: unknown) => Promise<ActionResult<{ assets: AssetView[]; total: number }>>;
  update: (input: unknown) => Promise<ActionResult<AssetView>>;
  remove: (input: unknown) => Promise<ActionResult>;
  usages: (input: unknown) => Promise<ActionResult<AssetUsageView[]>>;
  createFolder: (input: unknown) => Promise<ActionResult>;
}

/**
 * The media library screen.
 *
 * Server actions arrive as props rather than being imported here. Two reasons,
 * and the second is the one that bites: `components/**` importing from `app/**`
 * inverts the dependency direction the rest of the repo holds to, and Phase 4
 * already recorded what happens when a route hands a Client Component
 * *closures* over its actions instead of the action references — every builder
 * page load threw, and neither `next build` nor the unit tests could see it.
 * These are references, passed straight through.
 */
export function MediaLibrary({
  initialAssets,
  initialTotal,
  initialFolders,
  initialTags,
  actions,
  canWrite,
  canDelete,
}: {
  initialAssets: AssetView[];
  initialTotal: number;
  initialFolders: MediaFolder[];
  initialTags: MediaTag[];
  actions: MediaLibraryActions;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const toast = useToast();

  const [assets, setAssets] = useState(initialAssets);
  const [total, setTotal] = useState(initialTotal);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [folderId, setFolderId] = useState<string | null | undefined>(undefined);
  const [tagSlug, setTagSlug] = useState("");
  const [tags, setTags] = useState(initialTags);
  const [loading, setLoading] = useState(false);

  const selected = useMemo(
    () => assets.find((asset) => asset.id === selectedId) ?? null,
    [assets, selectedId]
  );

  // A request in flight when the filters change again must not be allowed to
  // land after the newer one. The counter is the cheapest correct answer:
  // whichever request was started last is the only one permitted to write state.
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;

    const handle = setTimeout(async () => {
      setLoading(true);
      const result = await actions.list({
        search: search.trim() || undefined,
        kind: kind || undefined,
        folderId,
        tagSlug: tagSlug || undefined,
        limit: 60,
      });
      if (id !== requestId.current) return;

      setLoading(false);
      if (result.ok) {
        setAssets(result.data.assets);
        setTotal(result.data.total);
      } else {
        toast.push(result.error, "error");
      }
    }, 250);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `actions` and `toast` are stable
  }, [search, kind, folderId, tagSlug]);

  function onUploaded(asset: AssetView) {
    let added = false;
    setAssets((current) => {
      // An upload of bytes already in the library returns the *existing* asset
      // rather than a new one. Selecting it and leaving the count alone is the
      // honest response: nothing was added.
      if (current.some((a) => a.id === asset.id)) return current;
      added = true;
      return [asset, ...current];
    });
    if (added) setTotal((n) => n + 1);
    setSelectedId(asset.id);
  }

  const filtered = search !== "" || kind !== "" || folderId !== undefined || tagSlug !== "";

  return (
    <div className="grid gap-6 px-8 py-8 lg:grid-cols-[180px_minmax(0,1fr)_320px]">
      <FolderRail
        folders={initialFolders}
        selected={folderId}
        onSelect={setFolderId}
        canWrite={canWrite}
        create={actions.createFolder}
        onMessage={(message, tone) => toast.push(message, tone)}
      />

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, filename, alt text, caption"
            aria-label="Search the media library"
            className={clsx(CONTROL, "min-w-0 flex-1")}
          />
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            aria-label="Filter by kind"
            className={clsx(CONTROL, "w-auto")}
          >
            <option value="">All kinds</option>
            {MEDIA_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select
            value={tagSlug}
            onChange={(event) => setTagSlug(event.target.value)}
            aria-label="Filter by tag"
            className={clsx(CONTROL, "w-auto")}
          >
            <option value="">All tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.slug}>
                {tag.label}
              </option>
            ))}
          </select>
        </div>

        {canWrite && (
          <div className="mb-5">
            <UploadZone
              upload={actions.upload}
              folderId={folderId ?? null}
              onUploaded={onUploaded}
              onError={(message) => toast.push(message, "error")}
            />
          </div>
        )}

        <p className={clsx(LABEL_SM, "mb-3")}>
          {loading ? "Searching…" : `${total} ${total === 1 ? "asset" : "assets"}`}
        </p>

        {assets.length === 0 && !loading && !filtered ? (
          <EmptyState eyebrow="Media" title="The library is empty">
            {canWrite
              ? "Drop a file above to add the first asset. Images placed on pages from here are tracked, so the library can tell you what is using one before you delete it."
              : "Nothing has been uploaded yet."}
          </EmptyState>
        ) : (
          <MediaGrid
            assets={assets}
            selectedId={selectedId}
            onSelect={(a) => setSelectedId(a.id)}
          />
        )}
      </div>

      <div className="min-w-0">
        {selected ? (
          <AssetDetails
            asset={selected}
            actions={actions}
            canWrite={canWrite}
            canDelete={canDelete}
            onUpdated={(updated) => {
              setAssets((current) => current.map((a) => (a.id === updated.id ? updated : a)));
              setTags((current) => {
                const bySlug = new Map(current.map((tag) => [tag.slug, tag]));
                for (const tag of updated.tags) bySlug.set(tag.slug, tag);
                return [...bySlug.values()].sort((a, b) => a.label.localeCompare(b.label));
              });
            }}
            onDeleted={(id) => {
              setAssets((current) => current.filter((a) => a.id !== id));
              setTotal((n) => Math.max(0, n - 1));
              setSelectedId(null);
            }}
            onMessage={(message, tone) => toast.push(message, tone)}
          />
        ) : (
          <p className="border border-dashed border-mg-bd/20 px-4 py-8 text-center text-[12px] text-mg-fg/60">
            Select an asset to see its details, alt text and where it is used.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Folders are a filing device, not a route — nothing links to one, and an asset
 * that loses its folder falls back to the root (`on delete set null` in 0002).
 * That is why the rail creates them from a name alone and the slug is derived
 * in the action.
 */
function FolderRail({
  folders,
  selected,
  onSelect,
  canWrite,
  create,
  onMessage,
}: {
  folders: MediaFolder[];
  selected: string | null | undefined;
  onSelect: (id: string | null | undefined) => void;
  canWrite: boolean;
  create: (input: unknown) => Promise<ActionResult>;
  onMessage: (message: string, tone?: "info" | "success" | "error") => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const result = await create({ name });
    setBusy(false);

    if (result.ok) {
      setName("");
      setAdding(false);
      // The list is server-rendered, so the new folder appears on the
      // revalidation the action triggered rather than being spliced in here.
      onMessage(`Created "${name}"`, "success");
    } else {
      onMessage(result.error, "error");
    }
  }

  return (
    <nav aria-label="Folders" className="hidden lg:block">
      <p className={clsx(LABEL_SM, "mb-2")}>Folders</p>
      <ul className="space-y-0.5">
        <FolderLink
          label="All"
          active={selected === undefined}
          onClick={() => onSelect(undefined)}
        />
        <FolderLink label="Unfiled" active={selected === null} onClick={() => onSelect(null)} />
        {folders.map((folder) => (
          <FolderLink
            key={folder.id}
            label={folder.name}
            nested={folder.parent_id !== null}
            active={selected === folder.id}
            onClick={() => onSelect(folder.id)}
          />
        ))}
      </ul>

      {canWrite && (
        <div className="mt-3">
          {adding ? (
            <div className="space-y-2">
              <input
                value={name}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && name.trim() !== "") void submit();
                  if (event.key === "Escape") setAdding(false);
                }}
                placeholder="Folder name"
                aria-label="New folder name"
                className={clsx(CONTROL, "py-1 text-[12px]")}
              />
              <div className="flex gap-1">
                <Button size="sm" onClick={submit} loading={busy} disabled={name.trim() === ""}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
              New folder
            </Button>
          )}
        </div>
      )}
    </nav>
  );
}

function FolderLink({
  label,
  active,
  nested,
  onClick,
}: {
  label: string;
  active: boolean;
  nested?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={clsx(
          "block w-full border-l-2 py-1 pr-2 text-left text-[13px] transition-colors",
          nested ? "pl-6" : "pl-3",
          active
            ? "border-mg-accent bg-mg-fg/5 text-mg-fg"
            : "border-transparent text-mg-fg/60 hover:text-mg-fg",
          FOCUS_RING
        )}
      >
        {label}
      </button>
    </li>
  );
}
