"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  DEFAULT_THEME_COLORS,
  THEME_CONTEXTS,
  THEME_CONTEXT_LABELS,
  THEME_TOKEN_LABELS,
  TOKENS_BY_CONTEXT,
  type ThemeColors,
  type ThemeContext,
  type ThemeToken,
} from "@/lib/domain/theme";
import { Panel, PanelSection } from "@/components/admin/ui/Panel";
import { ColorInput } from "@/components/admin/ui/Input";
import { Button } from "@/components/admin/ui/Button";
import { useToast } from "@/components/admin/ui/Toast";
import { publishThemeAction, saveThemeDraftAction, unpublishThemeAction } from "./actions";

interface ThemeEditorProps {
  initial: {
    status: string;
    version: number;
    draft: ThemeColors;
    published: ThemeColors | null;
  };
  canWrite: boolean;
  canPublish: boolean;
}

/**
 * Three sections of colour fields, driven by `TOKENS_BY_CONTEXT`.
 *
 * That table is the reason this component has no special cases: the Light
 * section has no Accent control and the Dark bands section has no Band hairline
 * control because those tokens are not in their lists, not because anything here
 * knows why. The reasons live beside the table in `lib/domain/theme.ts`, which is
 * also what the emitter reads — so the form and the stylesheet cannot disagree
 * about which tokens exist.
 *
 * Validation is not re-run here. The form posts a plain object and reads
 * `result.error` back, like `MenuEditor` — one schema, on the server, named in
 * one place.
 */
export function ThemeEditor({ initial, canWrite, canPublish }: ThemeEditorProps) {
  const [draft, setDraft] = useState<ThemeColors>(initial.draft);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function setToken(context: ThemeContext, token: ThemeToken, value: string) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({
      ...current,
      [context]: { ...current[context], [token]: value },
    }));
  }

  function resetContext(context: ThemeContext) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({ ...current, [context]: { ...DEFAULT_THEME_COLORS[context] } }));
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      setError(null);
      setDirty(false);
      toast.push(success, "success");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Panel>
        {THEME_CONTEXTS.map((context) => (
          <PanelSection
            key={context}
            title={THEME_CONTEXT_LABELS[context]}
            actions={
              canWrite ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => resetContext(context)}
                >
                  Reset to defaults
                </Button>
              ) : undefined
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {TOKENS_BY_CONTEXT[context].map((token) => (
                <ColorInput
                  key={token}
                  label={THEME_TOKEN_LABELS[token]}
                  value={draft[context]?.[token] ?? ""}
                  fallback={DEFAULT_THEME_COLORS[context]?.[token]}
                  disabled={!canWrite || pending}
                  onChange={(value) => setToken(context, token, value)}
                  help={
                    token === "accent" ? "Hex only — it also drives an rgb() triple." : undefined
                  }
                />
              ))}
            </div>
          </PanelSection>
        ))}
      </Panel>

      {/*
        `role="alert"` and not `status`: this is a rejected save an editor must
        act on before anything is written, where `Toast` is deliberately
        `role="status"` because it follows work that already succeeded. It also
        gives the message a unique accessible role, which is what the e2e spec
        locates it by — the label text alone is not unique, since "Accent" is a
        substring of "Serif accent" three times over.
      */}
      {error && (
        <p
          role="alert"
          className="border border-mg-accentSerif/40 bg-mg-accent/5 px-4 py-3 text-[13px] text-mg-fg"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!canWrite || pending || !dirty}
          loading={pending}
          onClick={() => run(() => saveThemeDraftAction({ colors: draft }), "Draft saved")}
        >
          Save draft
        </Button>

        {canPublish && (
          <Button
            variant="solid"
            disabled={pending}
            onClick={() => run(() => publishThemeAction({}), "Theme published")}
          >
            Publish
          </Button>
        )}

        {canPublish && initial.status === "published" && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => unpublishThemeAction({}), "Theme unpublished")}
          >
            Unpublish
          </Button>
        )}

        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-mg-fg/60">
          v{initial.version}
          {dirty && " · unsaved"}
        </span>
      </div>

      {/*
        Said here rather than left to be discovered. The tokens reach everything
        drawn with an `mg-*` utility, which is most of the site — but 62 literal
        hex values across 24 components are outside their reach, and they are
        exactly the surfaces someone changing a background would expect to move.
      */}
      <div className="border-t border-mg-bd/15 pt-5 text-[12px] leading-relaxed text-mg-fg/60">
        <p>
          <strong className="font-medium text-mg-fg/60">What these reach.</strong> Every surface
          drawn with a theme token, across the public site and this admin. The footer, the hero
          scrims and the red CTA bands are deliberately fixed in code and will not follow a change
          made here.
        </p>
        <p className="mt-2">
          Type, spacing, radii and motion are not editable yet — they are not CSS variables in this
          codebase, so they have to be made variable before they can be made editable.
        </p>
        {initial.published === null && (
          <p className="mt-2 text-mg-accentSerif">
            Nothing is published yet, so the site is serving the built-in defaults.
          </p>
        )}
      </div>
    </div>
  );
}
