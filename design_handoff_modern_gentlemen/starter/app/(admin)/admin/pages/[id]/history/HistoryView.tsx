"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { Panel } from "@/components/admin/ui/Panel";
import { Badge } from "@/components/admin/ui/Badge";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Table, Td, Th } from "@/components/admin/ui/Table";
import { useToast } from "@/components/admin/ui/Toast";

import { rollbackAction } from "../actions";

export interface RevisionRow {
  version: number;
  reason: string;
  label: string | null;
  created_at: string;
}

export interface EventRow {
  action: string;
  created_at: string;
  note: string | null;
}

const REASON_TONE: Record<string, "accent" | "neutral" | "muted"> = {
  publish: "accent",
  snapshot: "neutral",
  restore: "neutral",
  autosave: "muted",
};

export function HistoryView({
  pageId,
  revisions,
  events,
  canRestore,
}: {
  pageId: string;
  revisions: RevisionRow[];
  events: EventRow[];
  canRestore: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<RevisionRow | null>(null);

  function restore(revision: RevisionRow) {
    startTransition(async () => {
      const result = await rollbackAction({ id: pageId, version: revision.version });
      setConfirm(null);

      if (!result.ok) {
        toast.push(result.error, "error");
        return;
      }

      // The wording matters. rollback restores into the DRAFT and publishes
      // nothing — the service's own comment says an undo that silently shipped
      // would be a worse mistake than the one it was undoing.
      toast.push(
        `Restored v${revision.version} into the draft — publish to make it live`,
        "success"
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-8 px-8 py-8">
      <section>
        <h2 className="mb-3 font-grotesk text-[16px] font-semibold tracking-[-0.02em]">
          Revisions
        </h2>

        <Panel>
          {revisions.length === 0 ? (
            <EmptyState title="No revisions yet">
              A revision is written whenever this page is published, snapshotted, restored, or
              autosaved after a gap.
            </EmptyState>
          ) : (
            <Table caption="Revision history">
              <thead>
                <tr>
                  <Th>Version</Th>
                  <Th>Reason</Th>
                  <Th>Label</Th>
                  <Th>When</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {revisions.map((revision) => (
                  <tr key={revision.version}>
                    <Td className="font-mono text-[12px]">v{revision.version}</Td>
                    <Td>
                      <Badge tone={REASON_TONE[revision.reason] ?? "neutral"}>
                        {revision.reason}
                      </Badge>
                    </Td>
                    <Td className="text-mg-fg/60">{revision.label ?? "—"}</Td>
                    <Td className="font-mono text-[12px] text-mg-fg/50">
                      {new Date(revision.created_at).toLocaleString()}
                    </Td>
                    <Td className="text-right">
                      {canRestore && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => setConfirm(revision)}
                        >
                          Restore
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </section>

      <section>
        <h2 className="mb-3 font-grotesk text-[16px] font-semibold tracking-[-0.02em]">
          Publish events
        </h2>

        <Panel>
          {events.length === 0 ? (
            <EmptyState title="Never published">
              Publishing this page will record an event here.
            </EmptyState>
          ) : (
            <Table caption="Publish events">
              <thead>
                <tr>
                  <Th>Action</Th>
                  <Th>Note</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={index}>
                    <Td>
                      <Badge tone={event.action === "publish" ? "accent" : "neutral"}>
                        {event.action}
                      </Badge>
                    </Td>
                    <Td className="text-mg-fg/60">{event.note ?? "—"}</Td>
                    <Td className="font-mono text-[12px] text-mg-fg/50">
                      {new Date(event.created_at).toLocaleString()}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </section>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={`Restore version ${confirm?.version ?? ""}?`}
        description="This replaces the current draft. It does not publish anything."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="solid" loading={pending} onClick={() => confirm && restore(confirm)}>
              Restore into draft
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-mg-fg/60">
          The live page is untouched until you publish again, so you can review the restored content
          first. Any unsaved changes in the builder will be lost.
        </p>
      </Dialog>
    </div>
  );
}
