"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionResult } from "@/app/(admin)/admin/_lib/action-result";
import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { TextInput } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { useToast } from "@/components/admin/ui/Toast";
import type { BlockTree } from "@/lib/blocks/types";

import { useBuilder } from "./StoreContext";
import { selectionAsPatternBlocks, topmostSelectedKeys } from "./selection";

type SyncMode = "detachable" | "synced";

const SYNC_OPTIONS = [
  { value: "detachable", label: "Detachable — insert a copy" },
  { value: "synced", label: "Synced — update every linked use" },
] as const;

const SYNC_HELP: Record<SyncMode, string> = {
  detachable:
    "Each insertion becomes independent content. Later edits to the pattern do not change pages already using it.",
  synced:
    "Pages keep a live reference. Publishing a later pattern edit updates every linked use; the pattern must be published before it appears live.",
};

function patternKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface SaveSelectionAsPatternProps {
  action: (input: {
    name: string;
    key: string;
    syncMode: SyncMode;
    blocks: BlockTree;
  }) => Promise<ActionResult<{ id: string }>>;
}

export function SaveSelectionAsPattern({ action }: SaveSelectionAsPatternProps) {
  const router = useRouter();
  const toast = useToast();
  const tree = useBuilder((state) => state.tree);
  const selectedKeys = useBuilder((state) => state.selectedKeys);
  const selectedCount = topmostSelectedKeys(tree, new Set(selectedKeys)).length;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>("detachable");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function close() {
    if (!pending) setOpen(false);
  }

  function create() {
    setError(undefined);
    const blocks = selectionAsPatternBlocks(tree, selectedKeys);
    startTransition(async () => {
      const result = await action({ name, key: key || patternKey(name), syncMode, blocks });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setName("");
      setKey("");
      setKeyTouched(false);
      setSyncMode("detachable");
      toast.push("Selection saved as a reusable pattern", "success");
      router.refresh();
    });
  }

  return (
    <>
      <div className="border-t border-mg-bd/15 p-3">
        <Button
          className="w-full"
          size="sm"
          onClick={() => {
            setError(undefined);
            setOpen(true);
          }}
          disabled={selectedCount === 0}
          title={selectedCount === 0 ? "Select one or more canvas elements first" : undefined}
        >
          Save selection as pattern
        </Button>
        <p className="mt-2 text-[10px] leading-relaxed text-mg-fg/50">
          {selectedCount === 0
            ? "Select one or more elements to make a reusable layout."
            : `${selectedCount} selected ${selectedCount === 1 ? "branch" : "branches"} will be saved in canvas order.`}
        </p>
      </div>

      <Dialog
        open={open}
        onClose={close}
        title="Save selection as pattern"
        description="Turn the selected canvas content into a reusable layout in the section library."
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant="solid" onClick={create} loading={pending} disabled={!name.trim()}>
              Create pattern
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput
            label="Name"
            value={name}
            onChange={(next) => {
              setName(next);
              if (!keyTouched) setKey(patternKey(next));
            }}
            placeholder="Editorial feature stack"
            required
          />
          <TextInput
            label="Key"
            value={key}
            onChange={(next) => {
              setKeyTouched(true);
              setKey(patternKey(next));
            }}
            help="Lower-case identifier used by the content system."
            required
          />
          <Select
            label="Behavior"
            value={syncMode}
            onChange={(value) => setSyncMode(value as SyncMode)}
            options={SYNC_OPTIONS}
            help={SYNC_HELP[syncMode]}
          />
          {error && <p className="text-[12px] text-mg-accentSerif">{error}</p>}
        </div>
      </Dialog>
    </>
  );
}
