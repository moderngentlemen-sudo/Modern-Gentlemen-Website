"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge, type BadgeTone } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { TextInput } from "@/components/admin/ui/Input";
import { Panel } from "@/components/admin/ui/Panel";
import { Select } from "@/components/admin/ui/Select";
import { Table, Td, Th } from "@/components/admin/ui/Table";
import { useToast } from "@/components/admin/ui/Toast";
import type { SourceSyncStatus } from "@/lib/domain/ingestion";

import { createSourceAction, deleteSourceAction } from "./actions";

export interface SourceRow {
  id: string;
  name: string;
  kind: string;
  enabled: boolean;
  lastStatus: SourceSyncStatus | null;
  lastSyncedAt: string | null;
}

/**
 * 'partial' earns the danger tone alongside 'failed'.
 *
 * A run that imported most of a feed and dropped the rest is the failure mode
 * worth being loud about: it looks like it worked, and the missing products are
 * only visible to someone who opens the run.
 */
const STATUS_TONES: Record<SourceSyncStatus, BadgeTone> = {
  ok: "accent",
  partial: "danger",
  failed: "danger",
};

/**
 * The kinds a person may create. `native` is absent on purpose — `0005` seeds
 * the one native source and a second would mean nothing.
 */
const KIND_OPTIONS = [
  { value: "xml_feed", label: "XML feed" },
  { value: "shopify", label: "Shopify" },
] as const;

type CreatableKind = (typeof KIND_OPTIONS)[number]["value"];

function formatWhen(value: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function SourcesList({ sources, canWrite }: { sources: SourceRow[]; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<CreatableKind>("xml_feed");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [itemPath, setItemPath] = useState("rss/channel/item");
  const [shopDomain, setShopDomain] = useState("");
  const [credentialsRef, setCredentialsRef] = useState("");
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState<SourceRow | null>(null);

  const complete =
    name.trim() !== "" &&
    (kind === "xml_feed"
      ? url.trim() !== "" && itemPath.trim() !== ""
      : shopDomain.trim() !== "" && credentialsRef.trim() !== "");

  function create() {
    setError(undefined);
    startTransition(async () => {
      const result = await createSourceAction(
        kind === "xml_feed"
          ? { name, kind, url, itemPath }
          : { name, kind, shopDomain, credentialsRef }
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreating(false);
      setName("");
      setUrl("");
      setShopDomain("");
      setCredentialsRef("");
      toast.push("Source created", "success");
      router.push(`/admin/integrations/${result.data.id}`);
    });
  }

  function remove(source: SourceRow) {
    startTransition(async () => {
      const result = await deleteSourceAction({ id: source.id });
      setConfirmDelete(null);
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push(`Deleted “${source.name}”`, "success");
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="px-8 py-8">
        {canWrite && (
          <div className="mb-4 flex justify-end">
            <Button variant="solid" onClick={() => setCreating(true)}>
              New source
            </Button>
          </div>
        )}

        <Panel>
          {sources.length === 0 ? (
            <EmptyState
              eyebrow="Integrations"
              title="No sources yet"
              action={
                canWrite ? (
                  <Button variant="solid" onClick={() => setCreating(true)}>
                    Connect the first source
                  </Button>
                ) : undefined
              }
            >
              A source is somewhere the catalogue can import from — an XML feed or a Shopify store.
              Map its fields onto ours once, then every run stages what changed for review.
            </EmptyState>
          ) : (
            <Table caption="Product sources">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Kind</Th>
                  <Th>Last run</Th>
                  <Th>Outcome</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id} className="hover:bg-mg-fg/[0.02]">
                    <Td>
                      <Link
                        href={`/admin/integrations/${source.id}`}
                        className="font-medium hover:text-mg-accent"
                      >
                        {source.name}
                      </Link>
                      {!source.enabled && (
                        <span className="ml-2">
                          <Badge tone="muted">disabled</Badge>
                        </span>
                      )}
                    </Td>
                    <Td className="font-mono text-[12px] text-mg-fg/50">{source.kind}</Td>
                    <Td className="text-[12px] text-mg-fg/50">{formatWhen(source.lastSyncedAt)}</Td>
                    <Td>
                      {source.lastStatus ? (
                        <Badge tone={STATUS_TONES[source.lastStatus]}>{source.lastStatus}</Badge>
                      ) : (
                        <span className="text-[12px] text-mg-fg/35">—</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      {canWrite && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(source)}
                          disabled={pending}
                        >
                          Delete
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New source"
        description="Where the products come from. Everything a run finds is staged for review before it reaches the catalogue."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="solid" onClick={create} loading={pending} disabled={!complete}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Kind"
            value={kind}
            onChange={(value) => setKind(value as CreatableKind)}
            options={KIND_OPTIONS}
          />
          <TextInput
            label="Name"
            value={name}
            onChange={setName}
            placeholder={
              kind === "xml_feed" ? "Merchant XYZ affiliate feed" : "Modern Gentlemen Shopify"
            }
            required
          />
          {kind === "xml_feed" ? (
            <>
              <TextInput
                label="Feed URL"
                value={url}
                onChange={setUrl}
                placeholder="https://example.com/products.xml"
                required
              />
              <TextInput
                label="Item path"
                value={itemPath}
                onChange={setItemPath}
                help="The repeating element, slash-separated from the document root — rss/channel/item for an RSS feed, products/product for a plain one."
                required
              />
            </>
          ) : (
            <>
              <TextInput
                label="Shop domain"
                value={shopDomain}
                onChange={setShopDomain}
                placeholder="modern-gentlemen.myshopify.com"
                help="The shop's myshopify.com domain — not a custom storefront domain, and not a URL."
                required
              />
              <TextInput
                label="Credential variable"
                value={credentialsRef}
                onChange={setCredentialsRef}
                placeholder="FEED_SHOPIFY_TOKEN"
                help="The name of an environment variable holding the Admin API access token. It must begin with FEED_, and the token itself is never stored in the database."
                required
              />
            </>
          )}
          {error && (
            <p role="alert" className="text-[12px] text-mg-accentSerif">
              {error}
            </p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this source?"
        description="Its mappings and run history go with it. Products it imported stay in the catalogue and simply stop being attached to a feed."
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
        <p className="text-[13px] text-mg-fg/60">
          {confirmDelete ? `“${confirmDelete.name}” will be removed.` : null}
        </p>
      </Dialog>
    </>
  );
}
