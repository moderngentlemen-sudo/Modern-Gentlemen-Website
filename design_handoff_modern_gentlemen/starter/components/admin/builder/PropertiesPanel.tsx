"use client";

import { useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { manifestFor } from "@/lib/blocks/manifests";
import { blockProps } from "@/lib/blocks/normalize";
import { hasBindingShape } from "@/lib/blocks/bindingDescriptor";
import type { BindingQuery } from "@/lib/blocks/binding";
import type { BlockIssue } from "@/lib/blocks/validate";
import type { BlockNode } from "@/lib/blocks/types";

import { Panel, PanelSection } from "@/components/admin/ui/Panel";
import { Badge } from "@/components/admin/ui/Badge";
import { Toggle, Checkbox } from "@/components/admin/ui/Toggle";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { HELP_TEXT, LABEL_SM } from "@/components/admin/ui/styles";
import { BindingEditor, BindingModeSwitch } from "@/components/admin/fields/BindingEditor";
import { FieldControl, type ControlContext } from "@/components/admin/fields/FieldControl";
import { countIssuesAtOrBelow, issuesFor } from "@/components/admin/fields/issues";

import { useBuilder } from "./StoreContext";

const DEVICES = ["mobile", "tablet", "desktop"] as const;

/**
 * The properties panel: one control per field, driven entirely by the selected
 * block's manifest.
 *
 * Values are *read* through `blockProps`, which merges a node's legacy top-level
 * props with its `settings` (settings winning), so blocks seeded from the demo
 * modules show their real values. Values are *written* only into `settings` —
 * `BlockNode`'s own comment says the builder always writes that shape.
 */
export function PropertiesPanel() {
  const selectedKey = useBuilder((s) => s.selectedKey);
  const node = useBuilder((s) => s.tree.find((n) => n._key === selectedKey) ?? null);
  const issues = useBuilder(useShallow((s) => [...s.issues, ...s.serverIssues]));

  if (!node) {
    return (
      <Panel className="h-full">
        <EmptyState eyebrow="Properties" title="No block selected">
          Choose a section on the canvas to edit its content.
        </EmptyState>
      </Panel>
    );
  }

  return <BlockProperties key={node._key} node={node} allIssues={issues} />;
}

function BlockProperties({ node, allIssues }: { node: BlockNode; allIssues: BlockIssue[] }) {
  const setSetting = useBuilder((s) => s.setSetting);
  const unsetSetting = useBuilder((s) => s.unsetSetting);
  const listAdd = useBuilder((s) => s.listAdd);
  const listRemove = useBuilder((s) => s.listRemove);
  const listMove = useBuilder((s) => s.listMove);
  const setVisibility = useBuilder((s) => s.setVisibility);
  const setLocked = useBuilder((s) => s.setLocked);

  const manifest = manifestFor(node._type);
  const key = node._key;
  const locked = node.locked === true;

  const issues = useMemo(() => allIssues.filter((issue) => issue.key === key), [allIssues, key]);

  const props = useMemo(() => blockProps(node), [node]);

  const read = useCallback(
    (path: (string | number)[]) => {
      let current: unknown = props;
      for (const segment of path) {
        if (current === null || typeof current !== "object") return undefined;
        current = (current as Record<string | number, unknown>)[segment];
      }
      return current;
    },
    [props]
  );

  const ctx: ControlContext = useMemo(
    () => ({
      issues,
      read,
      write: (path, value) => setSetting(key, path, value),
      clear: (path) => unsetSetting(key, path),
      listAdd: (path, item) => listAdd(key, path, item),
      listRemove: (path, index) => listRemove(key, path, index),
      listMove: (path, from, to) => listMove(key, path, from, to),
      disabled: locked,
    }),
    [issues, read, key, locked, setSetting, unsetSetting, listAdd, listRemove, listMove]
  );

  if (!manifest) {
    return (
      <Panel className="h-full">
        <EmptyState eyebrow="Unknown block" title={node._type}>
          No manifest is registered for this block type, so its fields cannot be described. It will
          not publish until the type is removed or a manifest is added.
        </EmptyState>
      </Panel>
    );
  }

  const blockLevelIssues = issuesFor(issues, []);

  return (
    <Panel className="h-full overflow-y-auto">
      <header className="border-b border-mg-bd/15 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={LABEL_SM}>{manifest.category}</span>
          {issues.length > 0 && <Badge tone="danger">{issues.length}</Badge>}
        </div>
        <h2 className="mt-1 font-grotesk text-[15px] font-semibold tracking-[-0.02em]">
          {manifest.label}
        </h2>
        <p className={HELP_TEXT}>{manifest.description}</p>
      </header>

      {blockLevelIssues.length > 0 && (
        <div className="border-b border-mg-accentSerif/30 bg-mg-accent/5 px-4 py-2">
          {blockLevelIssues.map((issue, i) => (
            <p key={i} className="font-mono text-[10px] text-mg-accentSerif">
              {issue.message}
            </p>
          ))}
        </div>
      )}

      <PanelSection title="Content" issueCount={issues.filter((i) => i.path !== "").length}>
        {Object.entries(manifest.fields).map(([name, field]) =>
          manifest.bindable.includes(name) ? (
            <BindableField key={name} name={name} field={field} ctx={ctx} />
          ) : (
            <FieldControl key={name} name={name} field={field} path={[name]} ctx={ctx} />
          )
        )}
      </PanelSection>

      <PanelSection title="Display" defaultOpen={false}>
        <Toggle
          label="Hidden"
          checked={node.visibility?.hidden === true}
          disabled={locked}
          help="Excluded from the canvas preview. Device targeting is not yet applied at render."
          onChange={(hidden) => setVisibility(key, { hidden })}
        />

        <div>
          <span className={LABEL_SM}>Show on</span>
          <div className="mt-1.5 flex gap-4">
            {DEVICES.map((device) => {
              const current = node.visibility?.devices ?? [...DEVICES];
              return (
                <Checkbox
                  key={device}
                  label={device}
                  disabled={locked}
                  checked={current.includes(device)}
                  onChange={(on) =>
                    setVisibility(key, {
                      devices: on
                        ? [...current, device].filter((d, i, a) => a.indexOf(d) === i)
                        : current.filter((d) => d !== device),
                    })
                  }
                />
              );
            })}
          </div>
        </div>

        <Toggle
          label="Locked"
          checked={locked}
          help="Prevents edits, dragging and deletion until unlocked."
          onChange={(next) => setLocked(key, next)}
        />
      </PanelSection>
    </Panel>
  );
}

/**
 * A field that may hold either a literal or a `$bind` descriptor.
 *
 * The last literal is remembered in component state, so flipping to Dynamic and
 * back does not destroy hand-authored content — an editor experimenting with a
 * query should not lose six cards for it.
 */
function BindableField({
  name,
  field,
  ctx,
}: {
  name: string;
  field: Parameters<typeof FieldControl>[0]["field"];
  ctx: ControlContext;
}) {
  const path = [name];
  const value = ctx.read(path);
  const bound = hasBindingShape(value);

  const [lastLiteral, setLastLiteral] = useState<unknown>(bound ? undefined : value);
  const [lastQuery, setLastQuery] = useState<Partial<BindingQuery>>(
    bound ? ((value as { $bind: Partial<BindingQuery> }).$bind ?? {}) : {}
  );

  const queryIssues: Record<string, string> = {};
  for (const issue of ctx.issues) {
    const prefix = `${name}.$bind.`;
    if (issue.path.startsWith(prefix)) queryIssues[issue.path.slice(prefix.length)] = issue.message;
  }

  function toBound(next: boolean) {
    if (next) {
      setLastLiteral(value);
      ctx.write(path, {
        $bind: lastQuery.source ? lastQuery : { ...lastQuery, source: "articles" },
      });
    } else if (lastLiteral === undefined) {
      ctx.clear(path);
    } else {
      ctx.write(path, lastLiteral);
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={LABEL_SM}>{field.label}</span>
        <BindingModeSwitch bound={bound} onChange={toBound} disabled={ctx.disabled} />
      </div>

      {bound ? (
        <BindingEditor
          query={(value as { $bind: Partial<BindingQuery> }).$bind ?? {}}
          issues={queryIssues}
          disabled={ctx.disabled}
          onChange={(query) => {
            setLastQuery(query);
            ctx.write(path, { $bind: query });
          }}
        />
      ) : (
        <FieldControl name={name} field={field} path={path} ctx={ctx} />
      )}

      {countIssuesAtOrBelow(ctx.issues, path) > 0 && bound && (
        <span className="mt-1 block font-mono text-[10px] text-mg-accentSerif">
          {issuesFor(ctx.issues, path)[0]?.message}
        </span>
      )}
    </div>
  );
}
