"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  DEFAULT_THEME_COLORS,
  DEFAULT_THEME_HEADER,
  DEFAULT_THEME_TYPOGRAPHY,
  FONT_PRESET_OPTIONS,
  HEADER_BACKGROUNDS,
  HEADER_CART_VISIBILITY,
  HEADER_SCROLL_BEHAVIORS,
  THEME_CONTEXTS,
  THEME_CONTEXT_LABELS,
  THEME_TOKEN_LABELS,
  TOKENS_BY_CONTEXT,
  type FontPreset,
  type HeaderBackground,
  type HeaderCartVisibility,
  type HeaderScrollBehavior,
  type ThemeHeader,
  type ThemeContext,
  type ThemeSettings,
  type ThemeToken,
  type ThemeTypography,
} from "@/lib/domain/theme";
import { Panel, PanelSection } from "@/components/admin/ui/Panel";
import { ColorInput } from "@/components/admin/ui/Input";
import { Button } from "@/components/admin/ui/Button";
import { Select } from "@/components/admin/ui/Select";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { Toggle } from "@/components/admin/ui/Toggle";
import { useToast } from "@/components/admin/ui/Toast";
import { publishThemeAction, saveThemeDraftAction, unpublishThemeAction } from "./actions";

interface ThemeEditorProps {
  initial: {
    status: string;
    version: number;
    draft: ThemeSettings;
    published: ThemeSettings | null;
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
  const [draft, setDraft] = useState<ThemeSettings>(initial.draft);
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
      colors: {
        ...current.colors,
        [context]: { ...current.colors[context], [token]: value },
      },
    }));
  }

  function resetContext(context: ThemeContext) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({
      ...current,
      colors: {
        ...current.colors,
        [context]: { ...DEFAULT_THEME_COLORS[context] },
      },
    }));
  }

  function setTypography<K extends keyof ThemeTypography>(key: K, value: ThemeTypography[K]) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({
      ...current,
      typography: { ...current.typography, [key]: value },
    }));
  }

  function setHeader<K extends keyof ThemeHeader>(key: K, value: ThemeHeader[K]) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({ ...current, header: { ...current.header, [key]: value } }));
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
                  value={draft.colors[context]?.[token] ?? ""}
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

        <PanelSection
          title="Typography"
          actions={
            canWrite ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setDirty(true);
                  setDraft((current) => ({
                    ...current,
                    typography: { ...DEFAULT_THEME_TYPOGRAPHY },
                  }));
                }}
              >
                Reset to defaults
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FontSelect
              label="Body"
              value={draft.typography.body}
              disabled={!canWrite || pending}
              onChange={(value) => setTypography("body", value)}
            />
            <FontSelect
              label="Headings"
              value={draft.typography.heading}
              disabled={!canWrite || pending}
              onChange={(value) => setTypography("heading", value)}
            />
            <FontSelect
              label="Editorial accents"
              value={draft.typography.editorial}
              disabled={!canWrite || pending}
              onChange={(value) => setTypography("editorial", value)}
            />
            <FontSelect
              label="Labels and metadata"
              value={draft.typography.label}
              disabled={!canWrite || pending}
              onChange={(value) => setTypography("label", value)}
            />
            <FontSelect
              label="Navigation"
              value={draft.typography.navigation}
              disabled={!canWrite || pending}
              onChange={(value) => setTypography("navigation", value)}
            />
            <NumberInput
              label="Base text size"
              help="14–20px. Explicit component sizes remain unchanged."
              min={14}
              max={20}
              integer
              value={draft.typography.baseSize}
              disabled={!canWrite || pending}
              onChange={(value) => value !== undefined && setTypography("baseSize", value)}
            />
          </div>
        </PanelSection>

        <PanelSection
          title="Header"
          actions={
            canWrite ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setDirty(true);
                  setDraft((current) => ({
                    ...current,
                    header: { ...DEFAULT_THEME_HEADER },
                  }));
                }}
              >
                Reset to defaults
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Select
              label="Scroll behavior"
              value={draft.header.scrollBehavior}
              disabled={!canWrite || pending}
              options={HEADER_SCROLL_BEHAVIORS.map((value) => ({
                value,
                label: value === "hide-on-scroll" ? "Hide on scroll" : "Always visible",
              }))}
              onChange={(value) => setHeader("scrollBehavior", value as HeaderScrollBehavior)}
            />
            <Select
              label="Background"
              value={draft.header.background}
              disabled={!canWrite || pending}
              options={HEADER_BACKGROUNDS.map((value) => ({
                value,
                label:
                  value === "dynamic"
                    ? "Transparent → frosted"
                    : value === "solid"
                      ? "Always frosted"
                      : "Always transparent",
              }))}
              onChange={(value) => setHeader("background", value as HeaderBackground)}
            />
            <Select
              label="Bag icon"
              value={draft.header.cartVisibility}
              disabled={!canWrite || pending}
              options={HEADER_CART_VISIBILITY.map((value) => ({
                value,
                label:
                  value === "store-only"
                    ? "Store pages only"
                    : value === "always"
                      ? "All pages"
                      : "Hidden",
              }))}
              onChange={(value) => setHeader("cartVisibility", value as HeaderCartVisibility)}
            />
            <NumberInput
              label="Header height"
              help="56–96px. The page offset follows automatically."
              min={56}
              max={96}
              integer
              value={draft.header.height}
              disabled={!canWrite || pending}
              onChange={(value) => value !== undefined && setHeader("height", value)}
            />
            <Toggle
              label="Show search"
              checked={draft.header.showSearch}
              disabled={!canWrite || pending}
              onChange={(value) => setHeader("showSearch", value)}
            />
            <Toggle
              label="Show theme toggle"
              checked={draft.header.showThemeToggle}
              disabled={!canWrite || pending}
              onChange={(value) => setHeader("showThemeToggle", value)}
            />
          </div>
        </PanelSection>
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
          onClick={() => run(() => saveThemeDraftAction(draft), "Draft saved")}
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
          Typography and header behavior are role-based settings, so existing sections inherit them
          without losing their individual layout. Spacing, radii and motion remain section-level
          follow-up controls.
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

function FontSelect({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: FontPreset;
  disabled: boolean;
  onChange: (value: FontPreset) => void;
}) {
  return (
    <Select
      label={label}
      value={value}
      disabled={disabled}
      options={FONT_PRESET_OPTIONS}
      onChange={(next) => onChange(next as FontPreset)}
    />
  );
}
