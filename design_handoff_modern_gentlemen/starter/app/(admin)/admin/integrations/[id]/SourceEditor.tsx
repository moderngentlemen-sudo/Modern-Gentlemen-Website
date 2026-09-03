"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { TextInput } from "@/components/admin/ui/Input";
import { Panel, PanelSection } from "@/components/admin/ui/Panel";
import { Select } from "@/components/admin/ui/Select";
import { Table, Td, Th } from "@/components/admin/ui/Table";
import { Checkbox, Toggle } from "@/components/admin/ui/Toggle";
import { useToast } from "@/components/admin/ui/Toast";
import {
  DEFAULT_SHOPIFY_API_VERSION,
  FEED_TARGET_FIELDS,
  FEED_TARGET_FIELD_NAMES,
  FEED_TRANSFORMS,
  missingRequiredTargets,
  SYNC_SCHEDULES,
  SYNC_SCHEDULE_LABEL,
  type FeedTransform,
  type SyncSchedule,
} from "@/lib/domain/ingestion";
import { PRODUCT_FULFILMENTS } from "@/lib/domain/products";

import { runImportAction, saveMappingsAction, saveSourceAction, type RunSummary } from "./actions";

export interface SourceView {
  id: string;
  name: string;
  kind: string;
  enabled: boolean;
  credentialsRef: string | null;
  /** `null` is "off" — the absence of a schedule. See `SYNC_SCHEDULES`. */
  syncSchedule: SyncSchedule | null;
  configValid: boolean;
  fulfilment: "direct" | "affiliate";
  currency: string;
  /** `xml_feed` only; empty for other kinds. */
  url: string;
  itemPath: string;
  /** `shopify` only; the schema defaults for other kinds. */
  shopDomain: string;
  apiVersion: string;
  pageSize: number;
  maxPages: number;
  status: string;
  transport: "rest" | "graphql";
  collectionLimit: number;
}

export interface MappingView {
  target_field: string;
  source_path: string;
  transform: string | null;
  fallback: string | null;
  is_required: boolean;
}

export interface JobView {
  id: string;
  status: string;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  errorSummary: string | null;
  createdAt: string;
}

const FULFILMENT_OPTIONS = [
  { value: PRODUCT_FULFILMENTS[0], label: "Direct — we sell and ship it" },
  { value: PRODUCT_FULFILMENTS[1], label: "Affiliate — we link out to a merchant" },
];

const SHOPIFY_STATUS_OPTIONS = [
  { value: "active", label: "Active only" },
  { value: "draft", label: "Drafts only" },
  { value: "archived", label: "Archived only" },
  { value: "any", label: "Any status" },
];

const SHOPIFY_TRANSPORT_OPTIONS = [
  { value: "rest", label: "REST — compatibility mode" },
  { value: "graphql", label: "GraphQL — includes collections" },
];

const TRANSFORM_OPTIONS = FEED_TRANSFORMS.map((transform) => ({
  value: transform,
  label: transform,
}));

const TARGET_OPTIONS = FEED_TARGET_FIELD_NAMES.map((field) => ({
  value: field,
  label: `${FEED_TARGET_FIELDS[field].label} — ${field}`,
}));

function formatWhen(value: string): string {
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function SourceEditor({
  source,
  mappings: initialMappings,
  jobs,
  canWrite,
  canRun,
}: {
  source: SourceView;
  mappings: MappingView[];
  jobs: JobView[];
  canWrite: boolean;
  canRun: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, startSaving] = useTransition();
  const [running, startRunning] = useTransition();

  const isShopify = source.kind === "shopify";

  const [name, setName] = useState(source.name);
  const [enabled, setEnabled] = useState(source.enabled);
  const [url, setUrl] = useState(source.url);
  const [itemPath, setItemPath] = useState(source.itemPath);
  const [shopDomain, setShopDomain] = useState(source.shopDomain);
  const [apiVersion, setApiVersion] = useState(source.apiVersion);
  const [pageSize, setPageSize] = useState(String(source.pageSize));
  const [maxPages, setMaxPages] = useState(String(source.maxPages));
  const [status, setStatus] = useState(source.status);
  const [transport, setTransport] = useState(source.transport);
  const [collectionLimit, setCollectionLimit] = useState(String(source.collectionLimit));
  const [fulfilment, setFulfilment] = useState<string>(source.fulfilment);
  const [currency, setCurrency] = useState(source.currency);
  const [credentialsRef, setCredentialsRef] = useState(source.credentialsRef ?? "");
  // `""` is the select's representation of "off"; `null` is the column's. The
  // translation happens once, at the boundary, rather than a magic string
  // travelling through the form.
  const [syncSchedule, setSyncSchedule] = useState<string>(source.syncSchedule ?? "");

  const [mappings, setMappings] = useState<MappingView[]>(initialMappings);
  const [lastRun, setLastRun] = useState<RunSummary | null>(null);

  const missing = missingRequiredTargets(mappings);
  const unmapped = FEED_TARGET_FIELD_NAMES.filter(
    (field) => !mappings.some((mapping) => mapping.target_field === field)
  );

  function saveConfig() {
    startSaving(async () => {
      const shared = {
        id: source.id,
        name,
        enabled,
        fulfilment,
        currency,
        credentialsRef: credentialsRef.trim() || null,
        syncSchedule: syncSchedule === "" ? null : syncSchedule,
      };
      const result = await saveSourceAction(
        isShopify
          ? {
              ...shared,
              kind: "shopify",
              shopDomain,
              apiVersion,
              // The controls hold strings; the schema wants integers. NaN from a
              // cleared field fails the action rather than silently becoming 0.
              pageSize: Number(pageSize),
              maxPages: Number(maxPages),
              status,
              transport,
              collectionLimit: Number(collectionLimit),
            }
          : { ...shared, kind: "xml_feed", url, itemPath }
      );
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push("Source saved", "success");
        router.refresh();
      }
    });
  }

  function saveTheMappings() {
    startSaving(async () => {
      const result = await saveMappingsAction({
        id: source.id,
        mappings: mappings.map((mapping) => ({
          target_field: mapping.target_field,
          source_path: mapping.source_path.trim(),
          transform: mapping.transform,
          fallback: mapping.fallback?.trim() || null,
          is_required: mapping.is_required,
        })),
      });
      if (!result.ok) toast.push(result.error, "error");
      else {
        toast.push("Mappings saved", "success");
        router.refresh();
      }
    });
  }

  function run() {
    startRunning(async () => {
      const result = await runImportAction({ id: source.id });
      if (!result.ok) {
        toast.push(result.error, "error");
        return;
      }
      setLastRun(result.data);
      router.refresh();
      if (result.data.status === "failed") toast.push("The run failed", "error");
      else if (result.data.status === "review") toast.push("Run staged for review", "success");
      else toast.push("Nothing to import — the feed matches the catalogue", "info");
    });
  }

  function addMapping(field: string) {
    setMappings((current) => [
      ...current,
      { target_field: field, source_path: "", transform: null, fallback: null, is_required: false },
    ]);
  }

  function patchMapping(index: number, patch: Partial<MappingView>) {
    setMappings((current) =>
      current.map((mapping, position) => (position === index ? { ...mapping, ...patch } : mapping))
    );
  }

  function removeMapping(index: number) {
    setMappings((current) => current.filter((_, position) => position !== index));
  }

  return (
    <div className="space-y-6">
      {!source.configValid && (
        <p
          role="alert"
          className="border border-mg-accentSerif/40 px-4 py-3 text-[13px] text-mg-accentSerif"
        >
          This source&rsquo;s stored configuration could not be read. The fields below show defaults
          — check them and save.
        </p>
      )}

      <Panel>
        <PanelSection title={isShopify ? "Store" : "Feed"}>
          <div className="space-y-4">
            <TextInput label="Name" value={name} onChange={setName} disabled={!canWrite} required />
            {isShopify ? (
              <>
                <TextInput
                  label="Shop domain"
                  value={shopDomain}
                  onChange={setShopDomain}
                  disabled={!canWrite}
                  placeholder="modern-gentlemen.myshopify.com"
                  help="The shop's myshopify.com domain — not a custom storefront domain, and not a URL."
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <TextInput
                    label="API version"
                    value={apiVersion}
                    onChange={setApiVersion}
                    disabled={!canWrite}
                    placeholder={DEFAULT_SHOPIFY_API_VERSION}
                    help="Shopify versions quarterly and retires a version after a year."
                    required
                  />
                  <Select
                    label="Product status"
                    value={status}
                    onChange={setStatus}
                    options={SHOPIFY_STATUS_OPTIONS}
                    disabled={!canWrite}
                    help="Which of the store's products a run asks for."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="API transport"
                    value={transport}
                    onChange={(value) => setTransport(value as "rest" | "graphql")}
                    options={SHOPIFY_TRANSPORT_OPTIONS}
                    disabled={!canWrite}
                    help="GraphQL keeps REST-compatible product fields and adds direct collection memberships."
                  />
                  <TextInput
                    label="Collections per product"
                    value={collectionLimit}
                    onChange={setCollectionLimit}
                    disabled={!canWrite || transport !== "graphql"}
                    help="1–100. Bounds collection graph expansion for each product."
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <TextInput
                    label="Page size"
                    value={pageSize}
                    onChange={setPageSize}
                    disabled={!canWrite}
                    help="Products per request. Shopify's maximum is 250."
                    required
                  />
                  <TextInput
                    label="Page limit"
                    value={maxPages}
                    onChange={setMaxPages}
                    disabled={!canWrite}
                    help="How many pages one run may walk. A run holds a request open for its whole duration, so this is what bounds it."
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <TextInput
                  label="Feed URL"
                  value={url}
                  onChange={setUrl}
                  disabled={!canWrite}
                  required
                />
                <TextInput
                  label="Item path"
                  value={itemPath}
                  onChange={setItemPath}
                  disabled={!canWrite}
                  help="The repeating element, slash-separated from the document root."
                  required
                />
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Fulfilment"
                value={fulfilment}
                onChange={setFulfilment}
                options={FULFILMENT_OPTIONS}
                disabled={!canWrite}
                help="Applied to every product this feed creates."
              />
              <TextInput
                label="Currency"
                value={currency}
                onChange={setCurrency}
                disabled={!canWrite}
                help="ISO 4217. Prices are stored in the minor unit."
              />
            </div>
            <TextInput
              label="Credential variable"
              value={credentialsRef}
              onChange={setCredentialsRef}
              disabled={!canWrite}
              placeholder={isShopify ? "FEED_SHOPIFY_TOKEN" : "FEED_MERCHANT_TOKEN"}
              help={
                isShopify
                  ? "Required. Names an environment variable holding the Admin API access token — the value is never stored here. Must begin with FEED_."
                  : "Optional. Names an environment variable on the deployment — the value is never stored here. Must begin with FEED_, and is sent as a bearer token."
              }
              required={isShopify}
            />
            <Toggle
              label="Enabled"
              checked={enabled}
              onChange={setEnabled}
              disabled={!canWrite}
              help="A disabled source refuses to run, and keeps its schedule."
            />
            {/*
              ⚠️ The column has existed since `0005` and was read by nothing for
              three phases. It is a coarse vocabulary rather than a cron field on
              purpose — the runner is GitHub Actions, which this repo has
              measured drifting over ninety minutes, and a cron field would let
              an operator write a precision the platform cannot deliver.
            */}
            <Select
              label="Sync schedule"
              value={syncSchedule}
              onChange={setSyncSchedule}
              disabled={!canWrite}
              help="A scheduled run stages proposals for review — it never writes to the catalogue on its own."
              options={[
                { value: "", label: "Off — run by hand only" },
                ...SYNC_SCHEDULES.map((value) => ({
                  value,
                  label: SYNC_SCHEDULE_LABEL[value],
                })),
              ]}
            />
            {canWrite && (
              <div className="flex justify-end">
                <Button variant="solid" onClick={saveConfig} loading={saving}>
                  {isShopify ? "Save store" : "Save feed"}
                </Button>
              </div>
            )}
          </div>
        </PanelSection>
      </Panel>

      <Panel>
        <PanelSection title="Field mapping">
          <p className="mb-4 text-[13px] text-mg-fg/60">
            Each row reads one path out of a source record and writes one of our fields. Paths are
            slash-separated and relative to one product.{" "}
            {isShopify ? (
              <>
                A number selects one entry of a list, so{" "}
                <code className="font-mono">variants/0/price</code> is the first variant&rsquo;s
                price; without one, <code className="font-mono">variants/sku</code> matches every
                variant. To merchandise by Shopify tags, map <code className="font-mono">tags</code>
                to <code className="font-mono">collections</code> with the
                <code className="font-mono"> split_commas</code> transform;
                <code className="font-mono"> product_type</code> can map one collection directly. In
                GraphQL mode, map <code className="font-mono">collections/title</code> to
                <code className="font-mono"> collections</code> to mirror direct Shopify memberships
                without an extra request per product.
              </>
            ) : (
              <>
                They are relative to the item element; an attribute is{" "}
                <code className="font-mono">@_name</code>.
              </>
            )}
          </p>

          {missing.length > 0 && (
            <p role="alert" className="mb-4 text-[12px] text-mg-accentSerif">
              {missing.join(" and ")} {missing.length === 1 ? "is" : "are"} not mapped, so this
              source cannot run yet.
            </p>
          )}

          {mappings.length === 0 ? (
            <p className="text-[13px] text-mg-fg/60">No fields mapped yet.</p>
          ) : (
            <Table caption="Field mappings">
              <thead>
                <tr>
                  <Th>Our field</Th>
                  <Th>Feed path</Th>
                  <Th>Transform</Th>
                  <Th>Fallback</Th>
                  <Th>Required</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping, index) => (
                  <tr key={`${mapping.target_field}-${index}`}>
                    <Td className="font-mono text-[12px]">{mapping.target_field}</Td>
                    <Td>
                      <input
                        aria-label={`Feed path for ${mapping.target_field}`}
                        value={mapping.source_path}
                        onChange={(event) =>
                          patchMapping(index, { source_path: event.target.value })
                        }
                        disabled={!canWrite}
                        placeholder="title"
                        className="w-full border border-mg-bd/25 bg-transparent px-2 py-1 font-mono text-[12px]"
                      />
                    </Td>
                    <Td>
                      <select
                        aria-label={`Transform for ${mapping.target_field}`}
                        value={mapping.transform ?? ""}
                        onChange={(event) =>
                          patchMapping(index, {
                            transform: (event.target.value || null) as FeedTransform | null,
                          })
                        }
                        disabled={!canWrite}
                        className="border border-mg-bd/25 bg-transparent px-2 py-1 font-mono text-[12px]"
                      >
                        <option value="">none</option>
                        {TRANSFORM_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      <input
                        aria-label={`Fallback for ${mapping.target_field}`}
                        value={mapping.fallback ?? ""}
                        onChange={(event) =>
                          patchMapping(index, { fallback: event.target.value || null })
                        }
                        disabled={!canWrite}
                        className="w-full border border-mg-bd/25 bg-transparent px-2 py-1 font-mono text-[12px]"
                      />
                    </Td>
                    <Td>
                      <Checkbox
                        label=""
                        ariaLabel={`Require ${mapping.target_field}`}
                        checked={mapping.is_required}
                        onChange={(next) => patchMapping(index, { is_required: next })}
                        disabled={!canWrite}
                      />
                    </Td>
                    <Td className="text-right">
                      {canWrite && (
                        <Button size="sm" variant="ghost" onClick={() => removeMapping(index)}>
                          Remove
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {canWrite && (
            <div className="mt-4 flex items-end justify-between gap-4">
              <div className="w-[320px]">
                <Select
                  label="Add a field"
                  value=""
                  onChange={(field) => field && addMapping(field)}
                  options={TARGET_OPTIONS.filter((option) => unmapped.includes(option.value))}
                  placeholder="Choose a field…"
                />
              </div>
              <Button variant="solid" onClick={saveTheMappings} loading={saving}>
                Save mappings
              </Button>
            </div>
          )}
        </PanelSection>
      </Panel>

      <Panel>
        <PanelSection title="Runs">
          <p className="mb-4 text-[13px] text-mg-fg/60">
            A run fetches the feed and stages what it finds. Nothing reaches the catalogue until it
            is approved and applied.
          </p>

          {canRun && (
            <div className="mb-4 flex items-center gap-3">
              <Button
                variant="solid"
                onClick={run}
                loading={running}
                disabled={!enabled || missing.length > 0}
              >
                Run now
              </Button>
              {(!enabled || missing.length > 0) && (
                <span className="text-[12px] text-mg-fg/60">
                  {!enabled ? "Enable the source first." : "Map the required fields first."}
                </span>
              )}
            </div>
          )}

          {lastRun && (
            <p className="mb-4 text-[13px] text-mg-fg/70">
              {lastRun.status === "failed" ? (
                <>Run failed: {lastRun.error}</>
              ) : (
                <>
                  {lastRun.total} records — {lastRun.created} new, {lastRun.updated} changed,{" "}
                  {lastRun.unchanged} unchanged, {lastRun.failed} failed.{" "}
                  {lastRun.status === "review" && (
                    <Link
                      href={`/admin/integrations/jobs/${lastRun.jobId}`}
                      className="text-mg-accentInk hover:underline"
                    >
                      Review
                    </Link>
                  )}
                </>
              )}
            </p>
          )}

          {jobs.length === 0 ? (
            <p className="text-[13px] text-mg-fg/60">This source has never run.</p>
          ) : (
            <Table caption="Recent runs">
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Status</Th>
                  <Th>Found</Th>
                  <Th>New</Th>
                  <Th>Changed</Th>
                  <Th>Unchanged</Th>
                  <Th>Failed</Th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-mg-fg/[0.02]">
                    <Td>
                      <Link
                        href={`/admin/integrations/jobs/${job.id}`}
                        className="hover:text-mg-accentInk"
                      >
                        {formatWhen(job.createdAt)}
                      </Link>
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          job.status === "failed"
                            ? "danger"
                            : job.status === "review"
                              ? "accent"
                              : "neutral"
                        }
                      >
                        {job.status}
                      </Badge>
                    </Td>
                    <Td className="font-mono text-[12px]">{job.total}</Td>
                    <Td className="font-mono text-[12px]">{job.created}</Td>
                    <Td className="font-mono text-[12px]">{job.updated}</Td>
                    <Td className="font-mono text-[12px] text-mg-fg/60">{job.unchanged}</Td>
                    <Td className="font-mono text-[12px]">{job.failed}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </PanelSection>
      </Panel>
    </div>
  );
}
