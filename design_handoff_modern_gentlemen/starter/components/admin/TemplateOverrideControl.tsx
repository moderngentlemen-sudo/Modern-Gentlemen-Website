"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionResult } from "@/app/(admin)/admin/_lib/action-result";
import type { EntryTemplateContentType, TemplateOverrideState } from "@/lib/services/templates";
import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { Select } from "@/components/admin/ui/Select";
import { useToast } from "@/components/admin/ui/Toast";

export interface TemplateOverrideAction {
  (input: { id: string; templateId: string | null }): Promise<ActionResult>;
}

/**
 * Entry-level template inheritance, shared by document editors.
 *
 * The blank value is an explicit authoring choice — inherit the content-type
 * default — and the current inherited template is named in the option. This is
 * deliberately separate from an article's legacy twenty-layout selector: that
 * selects its content composition, while this selects an optional builder
 * frame around the record.
 */
export function TemplateOverrideControl({
  id,
  noun,
  state,
  action,
}: {
  id: string;
  noun: EntryTemplateContentType;
  state: TemplateOverrideState;
  action: TemplateOverrideAction;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(state.explicitTemplateId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const inherited = state.inheritedTemplate?.name ?? "no site-wide template";
  const selectedTemplate = state.options.find((template) => template.id === selected);
  const selectedIsDraft = selectedTemplate !== undefined && selectedTemplate.status !== "published";
  const title = noun === "category" ? "Category" : `${noun[0].toUpperCase()}${noun.slice(1)}`;

  function save() {
    setError(undefined);
    startTransition(async () => {
      const result = await action({ id, templateId: selected || null });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.push(selected ? "Template override saved" : "Template inheritance restored", "success");
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Layout
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`${title} layout`}
        description={`Choose a template for only this ${noun}, or inherit the site-wide ${noun} layout.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="solid" onClick={save} loading={pending} disabled={selectedIsDraft}>
              Save
            </Button>
          </>
        }
      >
        <Select
          label="Template override"
          value={selected}
          onChange={setSelected}
          error={error}
          help={
            selectedIsDraft
              ? "Publish this template before assigning it. Choose another template or return to inherit."
              : "An entry override takes priority over the site-wide template. Returning to inherit preserves the default rather than copying it."
          }
          options={[
            { value: "", label: `Inherit — ${inherited}` },
            ...state.options.map((template) => ({
              value: template.id,
              label: `${template.name}${template.status === "published" ? "" : " — draft"}`,
            })),
          ]}
        />
      </Dialog>
    </>
  );
}
