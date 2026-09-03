"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ActionResult } from "@/app/(admin)/admin/_lib/action-result";
import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { TextInput } from "@/components/admin/ui/Input";
import { useToast } from "@/components/admin/ui/Toast";

export interface DuplicableSummary {
  id: string;
  title: string;
  slug: string;
}

export function DuplicateDocumentDialog({
  source,
  noun,
  slugNoun,
  destination,
  action,
  onClose,
}: {
  source: DuplicableSummary;
  noun: string;
  slugNoun: "slug" | "key";
  destination: (id: string) => string;
  action: (input: {
    id: string;
    title: string;
    slug: string;
  }) => Promise<ActionResult<{ id: string }>>;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(`${source.title} copy`);
  const [slug, setSlug] = useState(`${source.slug}-copy`);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string>();

  function slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[‘’']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function duplicate() {
    setError(undefined);
    startTransition(async () => {
      const result = await action({ id: source.id, title, slug });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.push(`${noun} duplicated as a draft`, "success");
      router.push(destination(result.data.id));
    });
  }

  return (
    <Dialog
      open
      onClose={() => !pending && onClose()}
      title={`Duplicate “${source.title}”`}
      description={`Creates a new draft ${noun} with the source content and design.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="solid" onClick={duplicate} loading={pending} disabled={!title.trim()}>
            Duplicate
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextInput
          label={noun === "page" ? "Title" : "Name"}
          value={title}
          onChange={(next) => {
            setTitle(next);
            if (!slugTouched) setSlug(slugify(next));
          }}
          required
        />
        <TextInput
          label={slugNoun === "slug" ? "Slug" : "Key"}
          value={slug}
          onChange={(next) => {
            setSlugTouched(true);
            setSlug(slugify(next));
          }}
          help={
            slugNoun === "slug"
              ? "The copy needs its own public URL."
              : "The copy needs its own internal key."
          }
          error={error}
          required
        />
        <p className="text-[12px] leading-relaxed text-mg-fg/60">
          Publication state, revision history, assignments and protected system/lock flags are not
          copied.
        </p>
      </div>
    </Dialog>
  );
}
