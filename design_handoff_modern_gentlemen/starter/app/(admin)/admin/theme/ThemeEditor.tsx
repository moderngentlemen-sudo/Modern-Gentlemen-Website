"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  DEFAULT_THEME_COLORS,
  DEFAULT_THEME_COMPONENTS,
  DEFAULT_THEME_FOOTER,
  DEFAULT_THEME_HEADER,
  DEFAULT_THEME_LAYOUT,
  DEFAULT_THEME_MOBILE_HEADER,
  DEFAULT_THEME_TYPOGRAPHY,
  FONT_PRESET_OPTIONS,
  FOOTER_LAYOUTS,
  HEADER_BACKGROUNDS,
  HEADER_CART_VISIBILITY,
  HEADER_COMPOSITIONS,
  HEADER_ICON_HOVERS,
  HEADER_SCROLL_BEHAVIORS,
  MOBILE_HEADER_ACTIONS,
  MOBILE_HEADER_COMPOSITIONS,
  MOBILE_HEADER_CTA_PLACEMENTS,
  THEME_BUTTON_CASES,
  THEME_BUTTON_INTERACTIONS,
  THEME_BUTTON_SHADOWS,
  THEME_BUTTON_SHAPES,
  THEME_CARD_BORDERS,
  THEME_CARD_MEDIA_HOVERS,
  THEME_CARD_SHADOWS,
  THEME_CARD_SHAPES,
  THEME_CONTEXTS,
  THEME_CONTEXT_LABELS,
  THEME_TOKEN_LABELS,
  TOKENS_BY_CONTEXT,
  THEME_FORM_BORDERS,
  THEME_FORM_FILLS,
  THEME_FORM_FOCUS,
  THEME_FORM_SHAPES,
  WEBFONT_FALLBACKS,
  WEBFONT_SOURCES,
  WEBFONT_STYLES,
  type FontSelection,
  type FooterLayout,
  type HeaderBackground,
  type HeaderCartVisibility,
  type HeaderComposition,
  type HeaderIconHover,
  type HeaderScrollBehavior,
  type MobileHeaderAction,
  type MobileHeaderComposition,
  type MobileHeaderCtaPlacement,
  type ThemeHeader,
  type ThemeMobileHeader,
  type ThemeLayout,
  type ThemeContext,
  type ThemeComponentDefaults,
  type ThemeFooter,
  type ThemeSettings,
  type ThemeStyleClass,
  type ThemeToken,
  type ThemeTokenAlias,
  type ThemeTypography,
  type ThemeWebfont,
} from "@/lib/domain/theme";
import { Panel, PanelSection } from "@/components/admin/ui/Panel";
import { ColorInput, TextArea, TextInput } from "@/components/admin/ui/Input";
import { Button } from "@/components/admin/ui/Button";
import { Select } from "@/components/admin/ui/Select";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { Toggle } from "@/components/admin/ui/Toggle";
import { useToast } from "@/components/admin/ui/Toast";
import { publishThemeAction, saveThemeDraftAction, unpublishThemeAction } from "./actions";
import { StyleClassEditor } from "./StyleClassEditor";

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

function optionLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/-/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
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

  function addWebfont() {
    if (draft.typography.webfonts.length >= 12) return;
    const id = `custom-${Date.now().toString(36)}`;
    setTypography("webfonts", [
      ...draft.typography.webfonts,
      {
        id,
        label: "Custom font",
        family: "Custom Font",
        source: "stylesheet",
        url: "",
        fallback: "sans",
        weight: "400",
        style: "normal",
      },
    ]);
  }

  function updateWebfont(id: string, patch: Partial<ThemeWebfont>) {
    setTypography(
      "webfonts",
      draft.typography.webfonts.map((font) => (font.id === id ? { ...font, ...patch } : font))
    );
  }

  function removeWebfont(id: string) {
    const selection = `webfont:${id}`;
    setDirty(true);
    setError(null);
    setDraft((current) => {
      const typography = {
        ...current.typography,
        webfonts: current.typography.webfonts.filter((font) => font.id !== id),
      };
      for (const role of ["body", "heading", "editorial", "label", "navigation"] as const) {
        if (typography[role] === selection) typography[role] = DEFAULT_THEME_TYPOGRAPHY[role];
      }
      return { ...current, typography };
    });
  }

  function setHeader<K extends keyof ThemeHeader>(key: K, value: ThemeHeader[K]) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({ ...current, header: { ...current.header, [key]: value } }));
  }

  function setMobileHeader<K extends keyof ThemeMobileHeader>(key: K, value: ThemeMobileHeader[K]) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({
      ...current,
      header: {
        ...current.header,
        mobile: { ...current.header.mobile, [key]: value },
      },
    }));
  }

  function setMobileHeaderEnabled(enabled: boolean) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({
      ...current,
      header: {
        ...current.header,
        mobile:
          enabled && !current.header.mobile.enabled
            ? {
                ...current.header.mobile,
                enabled: true,
                composition:
                  current.header.composition === "centered-logo" ? "brand-centered" : "brand-left",
                scrollBehavior: current.header.scrollBehavior,
                background: current.header.background,
                height: current.header.height,
                shrinkOnScroll: current.header.shrinkOnScroll,
                shrunkHeight: current.header.shrunkHeight,
                divider: current.header.divider,
                scale: current.header.scale,
                iconBubbles: current.header.iconBubbles,
                iconHover: current.header.iconHover,
                showSearch: current.header.showSearch,
                showThemeToggle: current.header.showThemeToggle,
                showAccount: current.header.showAccount,
                cartVisibility: current.header.cartVisibility,
              }
            : { ...current.header.mobile, enabled },
      },
    }));
  }

  function moveMobileAction(action: MobileHeaderAction, direction: -1 | 1) {
    const order = [...draft.header.mobile.actionOrder];
    const from = order.indexOf(action);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    setMobileHeader("actionOrder", order);
  }

  function setFooter<K extends keyof ThemeFooter>(key: K, value: ThemeFooter[K]) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({ ...current, footer: { ...current.footer, [key]: value } }));
  }

  function setLayout<K extends keyof ThemeLayout>(key: K, value: ThemeLayout[K]) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({ ...current, layout: { ...current.layout, [key]: value } }));
  }

  function setButtonDefault<K extends keyof ThemeComponentDefaults["button"]>(
    key: K,
    value: ThemeComponentDefaults["button"][K]
  ) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({
      ...current,
      components: {
        ...current.components,
        button: { ...current.components.button, [key]: value },
      },
    }));
  }

  function setCardDefault<K extends keyof ThemeComponentDefaults["card"]>(
    key: K,
    value: ThemeComponentDefaults["card"][K]
  ) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({
      ...current,
      components: {
        ...current.components,
        card: { ...current.components.card, [key]: value },
      },
    }));
  }

  function setFormDefault<K extends keyof ThemeComponentDefaults["form"]>(
    key: K,
    value: ThemeComponentDefaults["form"][K]
  ) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({
      ...current,
      components: {
        ...current.components,
        form: { ...current.components.form, [key]: value },
      },
    }));
  }

  function setStyleClasses(styleClasses: ThemeStyleClass[]) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({ ...current, styleClasses }));
  }

  function setTokenAliases(tokenAliases: ThemeTokenAlias[]) {
    setDirty(true);
    setError(null);
    setDraft((current) => ({ ...current, tokenAliases }));
  }

  function addTokenAlias() {
    if (draft.tokenAliases.length >= 24) return;
    let id = `token-${Date.now().toString(36)}`;
    let suffix = 2;
    while (draft.tokenAliases.some((token) => token.id === id)) id = `${id}-${suffix++}`;
    setTokenAliases([
      ...draft.tokenAliases,
      { id, name: `Color ${draft.tokenAliases.length + 1}`, light: "#0d0d0d", dark: "#f4f4f4" },
    ]);
  }

  function updateTokenAlias(id: string, patch: Partial<ThemeTokenAlias>) {
    setTokenAliases(
      draft.tokenAliases.map((token) => (token.id === id ? { ...token, ...patch } : token))
    );
  }

  function addStyleClass() {
    if (draft.styleClasses.length >= 32) return;
    let id = `style-${Date.now().toString(36)}`;
    let suffix = 2;
    while (draft.styleClasses.some((styleClass) => styleClass.id === id)) {
      id = `style-${Date.now().toString(36)}-${suffix++}`;
    }
    setStyleClasses([
      ...draft.styleClasses,
      { id, name: `Style ${draft.styleClasses.length + 1}`, visual: {} },
    ]);
  }

  function updateStyleClass(id: string, next: ThemeStyleClass) {
    setStyleClasses(
      draft.styleClasses.map((styleClass) => (styleClass.id === id ? next : styleClass))
    );
  }

  function removeStyleClass(id: string) {
    setStyleClasses(draft.styleClasses.filter((styleClass) => styleClass.id !== id));
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
            <Select
              label="Header composition"
              value={draft.header.composition}
              disabled={!canWrite || pending}
              options={HEADER_COMPOSITIONS.map((value) => ({
                value,
                label:
                  value === "balanced"
                    ? "Balanced"
                    : value === "centered-logo"
                      ? "Centered logo"
                      : "Navigation left",
              }))}
              onChange={(value) => setHeader("composition", value as HeaderComposition)}
              help="Balanced preserves the original site header."
            />
            <FontSelect
              label="Body"
              value={draft.typography.body}
              webfonts={draft.typography.webfonts}
              disabled={!canWrite || pending}
              onChange={(value) => setTypography("body", value)}
            />
            <FontSelect
              label="Headings"
              value={draft.typography.heading}
              webfonts={draft.typography.webfonts}
              disabled={!canWrite || pending}
              onChange={(value) => setTypography("heading", value)}
            />
            <FontSelect
              label="Editorial accents"
              value={draft.typography.editorial}
              webfonts={draft.typography.webfonts}
              disabled={!canWrite || pending}
              onChange={(value) => setTypography("editorial", value)}
            />
            <FontSelect
              label="Labels and metadata"
              value={draft.typography.label}
              webfonts={draft.typography.webfonts}
              disabled={!canWrite || pending}
              onChange={(value) => setTypography("label", value)}
            />
            <FontSelect
              label="Navigation"
              value={draft.typography.navigation}
              webfonts={draft.typography.webfonts}
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
          title="Webfonts"
          actions={
            canWrite ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending || draft.typography.webfonts.length >= 12}
                onClick={addWebfont}
              >
                Add webfont
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-5">
            {draft.typography.webfonts.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-mg-fg/60">
                Add up to 12 fonts from an HTTPS provider stylesheet or a direct WOFF, WOFF2, TTF or
                OTF file. Added fonts become available in every typography role above.
              </p>
            ) : (
              draft.typography.webfonts.map((font) => (
                <div key={font.id} className="border border-mg-bd/15 p-4">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{font.label || "Untitled webfont"}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-mg-fg/60">
                        {font.source === "stylesheet" ? "Provider stylesheet" : "Direct font file"}
                      </p>
                    </div>
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => removeWebfont(font.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <TextInput
                      label="Display name"
                      value={font.label}
                      disabled={!canWrite || pending}
                      onChange={(value) => updateWebfont(font.id, { label: value })}
                    />
                    <TextInput
                      label="CSS font family"
                      value={font.family}
                      help="Use the exact family name supplied by the provider."
                      disabled={!canWrite || pending}
                      onChange={(value) => updateWebfont(font.id, { family: value })}
                    />
                    <Select
                      label="Source type"
                      value={font.source}
                      options={WEBFONT_SOURCES.map((value) => ({
                        value,
                        label: value === "stylesheet" ? "Provider stylesheet" : "Direct font file",
                      }))}
                      disabled={!canWrite || pending}
                      onChange={(value) =>
                        updateWebfont(font.id, { source: value as ThemeWebfont["source"] })
                      }
                    />
                    <TextInput
                      label={font.source === "stylesheet" ? "Stylesheet URL" : "Font file URL"}
                      type="url"
                      value={font.url}
                      placeholder={
                        font.source === "stylesheet"
                          ? "https://fonts.googleapis.com/css2?..."
                          : "https://cdn.example.com/font.woff2"
                      }
                      help="HTTPS only. Provider CSS is loaded as supplied by that provider."
                      disabled={!canWrite || pending}
                      onChange={(value) => updateWebfont(font.id, { url: value })}
                    />
                    <Select
                      label="Fallback category"
                      value={font.fallback}
                      options={WEBFONT_FALLBACKS.map((value) => ({
                        value,
                        label:
                          value === "sans"
                            ? "Sans serif"
                            : value === "serif"
                              ? "Serif"
                              : "Monospace",
                      }))}
                      disabled={!canWrite || pending}
                      onChange={(value) =>
                        updateWebfont(font.id, { fallback: value as ThemeWebfont["fallback"] })
                      }
                    />
                    {font.source === "file" && (
                      <>
                        <TextInput
                          label="Font weight"
                          value={font.weight}
                          placeholder="400 or 100 900"
                          help="Use a single weight or a variable-font range."
                          disabled={!canWrite || pending}
                          onChange={(value) => updateWebfont(font.id, { weight: value })}
                        />
                        <Select
                          label="Font style"
                          value={font.style}
                          options={WEBFONT_STYLES.map((value) => ({
                            value,
                            label: value === "normal" ? "Normal" : "Italic",
                          }))}
                          disabled={!canWrite || pending}
                          onChange={(value) =>
                            updateWebfont(font.id, { style: value as ThemeWebfont["style"] })
                          }
                        />
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </PanelSection>

        <PanelSection
          title="Component defaults"
          actions={
            canWrite ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setDirty(true);
                  setError(null);
                  setDraft((current) => ({
                    ...current,
                    components: {
                      button: { ...DEFAULT_THEME_COMPONENTS.button },
                      card: { ...DEFAULT_THEME_COMPONENTS.card },
                      form: { ...DEFAULT_THEME_COMPONENTS.form },
                    },
                  }));
                }}
              >
                Reset to defaults
              </Button>
            ) : undefined
          }
        >
          <p className="mb-5 max-w-3xl text-[13px] leading-relaxed text-mg-fg/60">
            Set the site-wide character of public buttons, cards and form fields. These semantic
            defaults cascade across existing storefront components; reusable style classes and
            element-level builder settings remain available for intentional exceptions.
          </p>
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-mg-fg/70">
                Buttons
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Select
                  label="Shape"
                  value={draft.components.button.shape}
                  options={THEME_BUTTON_SHAPES.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  disabled={!canWrite || pending}
                  onChange={(value) =>
                    setButtonDefault("shape", value as ThemeComponentDefaults["button"]["shape"])
                  }
                />
                <Select
                  label="Letter case"
                  value={draft.components.button.casing}
                  options={THEME_BUTTON_CASES.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  disabled={!canWrite || pending}
                  onChange={(value) =>
                    setButtonDefault("casing", value as ThemeComponentDefaults["button"]["casing"])
                  }
                />
                <Select
                  label="Shadow"
                  value={draft.components.button.shadow}
                  options={THEME_BUTTON_SHADOWS.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  disabled={!canWrite || pending}
                  onChange={(value) =>
                    setButtonDefault("shadow", value as ThemeComponentDefaults["button"]["shadow"])
                  }
                />
                <Select
                  label="Hover interaction"
                  value={draft.components.button.interaction}
                  options={THEME_BUTTON_INTERACTIONS.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  disabled={!canWrite || pending}
                  onChange={(value) =>
                    setButtonDefault(
                      "interaction",
                      value as ThemeComponentDefaults["button"]["interaction"]
                    )
                  }
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-mg-fg/70">
                Cards
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Select
                  label="Shape"
                  value={draft.components.card.shape}
                  options={THEME_CARD_SHAPES.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  disabled={!canWrite || pending}
                  onChange={(value) =>
                    setCardDefault("shape", value as ThemeComponentDefaults["card"]["shape"])
                  }
                />
                <Select
                  label="Border"
                  value={draft.components.card.border}
                  options={THEME_CARD_BORDERS.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  disabled={!canWrite || pending}
                  onChange={(value) =>
                    setCardDefault("border", value as ThemeComponentDefaults["card"]["border"])
                  }
                />
                <Select
                  label="Shadow"
                  value={draft.components.card.shadow}
                  options={THEME_CARD_SHADOWS.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  disabled={!canWrite || pending}
                  onChange={(value) =>
                    setCardDefault("shadow", value as ThemeComponentDefaults["card"]["shadow"])
                  }
                />
                <Select
                  label="Media hover"
                  value={draft.components.card.mediaHover}
                  options={THEME_CARD_MEDIA_HOVERS.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  disabled={!canWrite || pending}
                  onChange={(value) =>
                    setCardDefault(
                      "mediaHover",
                      value as ThemeComponentDefaults["card"]["mediaHover"]
                    )
                  }
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-mg-fg/70">
                Form fields
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Select
                  label="Shape"
                  value={draft.components.form.shape}
                  options={THEME_FORM_SHAPES.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  disabled={!canWrite || pending}
                  onChange={(value) =>
                    setFormDefault("shape", value as ThemeComponentDefaults["form"]["shape"])
                  }
                />
                <Select
                  label="Border"
                  value={draft.components.form.border}
                  options={THEME_FORM_BORDERS.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  disabled={!canWrite || pending}
                  onChange={(value) =>
                    setFormDefault("border", value as ThemeComponentDefaults["form"]["border"])
                  }
                />
                <Select
                  label="Fill"
                  value={draft.components.form.fill}
                  options={THEME_FORM_FILLS.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  disabled={!canWrite || pending}
                  onChange={(value) =>
                    setFormDefault("fill", value as ThemeComponentDefaults["form"]["fill"])
                  }
                />
                <Select
                  label="Focus color"
                  value={draft.components.form.focus}
                  options={THEME_FORM_FOCUS.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  disabled={!canWrite || pending}
                  onChange={(value) =>
                    setFormDefault("focus", value as ThemeComponentDefaults["form"]["focus"])
                  }
                />
              </div>
            </div>
          </div>
        </PanelSection>

        <PanelSection
          title="Shared color tokens"
          actions={
            canWrite ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending || draft.tokenAliases.length >= 24}
                onClick={addTokenAlias}
              >
                Add token
              </Button>
            ) : undefined
          }
        >
          <p className="mb-5 max-w-3xl text-[13px] leading-relaxed text-mg-fg/60">
            Name a light/dark color once, then use it in local element styles, component states or
            reusable classes. Existing theme roles remain unchanged.
          </p>
          <div className="space-y-4">
            {draft.tokenAliases.length === 0 ? (
              <p className="border border-dashed border-mg-bd/20 px-4 py-6 text-[13px] text-mg-fg/60">
                No shared local tokens yet.
              </p>
            ) : (
              draft.tokenAliases.map((token) => (
                <div
                  key={token.id}
                  className="grid gap-4 border border-mg-bd/15 p-4 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <TextInput
                    label="Token name"
                    value={token.name}
                    help={`Stable id: ${token.id}`}
                    disabled={!canWrite || pending}
                    onChange={(name) => updateTokenAlias(token.id, { name })}
                  />
                  <ColorInput
                    label="Light value"
                    value={token.light}
                    disabled={!canWrite || pending}
                    onChange={(light) => updateTokenAlias(token.id, { light })}
                  />
                  <ColorInput
                    label="Dark value"
                    value={token.dark}
                    disabled={!canWrite || pending}
                    onChange={(dark) => updateTokenAlias(token.id, { dark })}
                  />
                  {canWrite && (
                    <div className="flex items-end">
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={pending}
                        onClick={() =>
                          setTokenAliases(draft.tokenAliases.filter((item) => item.id !== token.id))
                        }
                      >
                        Remove token
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </PanelSection>

        <PanelSection
          title="Reusable style classes"
          actions={
            canWrite ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending || draft.styleClasses.length >= 32}
                onClick={addStyleClass}
              >
                Add style class
              </Button>
            ) : undefined
          }
        >
          <p className="mb-5 max-w-3xl text-[13px] leading-relaxed text-mg-fg/60">
            Define a responsive visual recipe once, publish the theme, then apply it from any
            builder element&apos;s Visual layout panel. Per-element settings remain available and
            override the class without changing it everywhere else.
          </p>
          <div className="space-y-5">
            {draft.styleClasses.length === 0 ? (
              <p className="border border-dashed border-mg-bd/20 px-4 py-6 text-[13px] text-mg-fg/60">
                No reusable styles yet. Add one for cards, content bands, buttons, feature grids or
                any other treatment you want to keep consistent.
              </p>
            ) : (
              draft.styleClasses.map((styleClass) => (
                <StyleClassEditor
                  key={styleClass.id}
                  value={styleClass}
                  disabled={!canWrite || pending}
                  tokenAliases={draft.tokenAliases}
                  onChange={(next) => updateStyleClass(styleClass.id, next)}
                  onRemove={() => removeStyleClass(styleClass.id)}
                />
              ))
            )}
          </div>
        </PanelSection>

        <PanelSection
          title="Site layout"
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
                    layout: { ...DEFAULT_THEME_LAYOUT },
                  }));
                }}
              >
                Reset to defaults
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <NumberInput
              label="Content width"
              help="960–1600px. Controls the standard centered site column."
              min={960}
              max={1600}
              integer
              value={draft.layout.contentWidth}
              disabled={!canWrite || pending}
              onChange={(value) => value !== undefined && setLayout("contentWidth", value)}
            />
            <NumberInput
              label="Desktop gutter"
              help="24–96px. The minimum inset around the content column."
              min={24}
              max={96}
              integer
              value={draft.layout.desktopGutter}
              disabled={!canWrite || pending}
              onChange={(value) => value !== undefined && setLayout("desktopGutter", value)}
            />
            <NumberInput
              label="Mobile gutter"
              help="12–40px at 680px and below."
              min={12}
              max={40}
              integer
              value={draft.layout.mobileGutter}
              disabled={!canWrite || pending}
              onChange={(value) => value !== undefined && setLayout("mobileGutter", value)}
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
            <NumberInput
              label="Header scale"
              help="0.8–1.4× scales the header content without changing its hit areas."
              min={0.8}
              max={1.4}
              value={draft.header.scale}
              disabled={!canWrite || pending}
              onChange={(value) => value !== undefined && setHeader("scale", value)}
            />
            <Select
              label="Icon hover"
              value={draft.header.iconHover}
              disabled={!canWrite || pending}
              options={HEADER_ICON_HOVERS.map((value) => ({
                value,
                label: value.charAt(0).toUpperCase() + value.slice(1),
              }))}
              onChange={(value) => setHeader("iconHover", value as HeaderIconHover)}
            />
            <Toggle
              label="Shrink on scroll"
              checked={draft.header.shrinkOnScroll}
              disabled={!canWrite || pending}
              help="Compacts the header after scrolling; off reproduces the original fixed-height behavior."
              onChange={(value) => setHeader("shrinkOnScroll", value)}
            />
            <NumberInput
              label="Shrunk height"
              help="44–90px. Used only when shrink on scroll is enabled."
              min={44}
              max={90}
              integer
              value={draft.header.shrunkHeight}
              disabled={!canWrite || pending || !draft.header.shrinkOnScroll}
              onChange={(value) => value !== undefined && setHeader("shrunkHeight", value)}
            />
            <Toggle
              label="Header divider"
              checked={draft.header.divider}
              disabled={!canWrite || pending}
              onChange={(value) => setHeader("divider", value)}
            />
            <Toggle
              label="Icon bubbles"
              checked={draft.header.iconBubbles}
              disabled={!canWrite || pending}
              help="Adds a subtle circular surface behind header actions."
              onChange={(value) => setHeader("iconBubbles", value)}
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
            <TextInput
              label="Header CTA label"
              value={draft.header.ctaLabel}
              disabled={!canWrite || pending}
              onChange={(value) => setHeader("ctaLabel", value)}
              placeholder="Subscribe"
              help="Shown only when both label and destination are set."
            />
            <TextInput
              label="Header CTA destination"
              value={draft.header.ctaHref}
              disabled={!canWrite || pending}
              onChange={(value) => setHeader("ctaHref", value)}
              placeholder="/newsletter"
              help="Internal path or HTTPS URL."
            />
            <TextInput
              label="Announcement"
              value={draft.header.announcementText}
              disabled={!canWrite || pending}
              onChange={(value) => setHeader("announcementText", value)}
              placeholder="Complimentary shipping this week"
              help="Leave empty to preserve the original single-row header."
            />
            <TextInput
              label="Announcement destination"
              value={draft.header.announcementHref}
              disabled={!canWrite || pending || !draft.header.announcementText}
              onChange={(value) => setHeader("announcementHref", value)}
              placeholder="/shop"
              help="Optional internal path or HTTPS URL."
            />
            <Toggle
              label="Show account"
              checked={draft.header.showAccount}
              disabled={!canWrite || pending}
              onChange={(value) => setHeader("showAccount", value)}
            />
            <TextInput
              label="Account destination"
              value={draft.header.accountHref}
              disabled={!canWrite || pending || !draft.header.showAccount}
              onChange={(value) => setHeader("accountHref", value)}
              placeholder="/account"
              help="Internal path or HTTPS URL."
            />
            <Toggle
              label="Show header socials"
              checked={draft.header.showSocials}
              disabled={!canWrite || pending}
              help="Compact Instagram and X links appear on wide screens when destinations are set."
              onChange={(value) => setHeader("showSocials", value)}
            />
            <TextInput
              label="Header Instagram URL"
              type="url"
              value={draft.header.instagramHref}
              disabled={!canWrite || pending || !draft.header.showSocials}
              onChange={(value) => setHeader("instagramHref", value)}
              placeholder="https://instagram.com/..."
              help="HTTPS only."
            />
            <TextInput
              label="Header X URL"
              type="url"
              value={draft.header.xHref}
              disabled={!canWrite || pending || !draft.header.showSocials}
              onChange={(value) => setHeader("xHref", value)}
              placeholder="https://x.com/..."
              help="HTTPS only."
            />
          </div>

          <div className="mt-6 border-t border-admin-border pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <Toggle
                label="Customize mobile independently"
                checked={draft.header.mobile.enabled}
                disabled={!canWrite || pending}
                help="Uses dedicated settings at 820px and below. Turning this on starts from the current header design."
                onChange={setMobileHeaderEnabled}
              />
              {canWrite && draft.header.mobile.enabled && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    setHeader("mobile", {
                      ...DEFAULT_THEME_MOBILE_HEADER,
                      actionOrder: [...DEFAULT_THEME_MOBILE_HEADER.actionOrder],
                    })
                  }
                >
                  Disable and reset mobile
                </Button>
              )}
            </div>

            {draft.header.mobile.enabled && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Select
                  label="Mobile composition"
                  value={draft.header.mobile.composition}
                  disabled={!canWrite || pending}
                  options={MOBILE_HEADER_COMPOSITIONS.map((value) => ({
                    value,
                    label: value === "brand-left" ? "Brand left" : "Brand centered",
                  }))}
                  onChange={(value) =>
                    setMobileHeader("composition", value as MobileHeaderComposition)
                  }
                />
                <Select
                  label="Mobile scroll behavior"
                  value={draft.header.mobile.scrollBehavior}
                  disabled={!canWrite || pending}
                  options={HEADER_SCROLL_BEHAVIORS.map((value) => ({
                    value,
                    label: value === "hide-on-scroll" ? "Hide on scroll" : "Always visible",
                  }))}
                  onChange={(value) =>
                    setMobileHeader("scrollBehavior", value as HeaderScrollBehavior)
                  }
                />
                <Select
                  label="Mobile background"
                  value={draft.header.mobile.background}
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
                  onChange={(value) => setMobileHeader("background", value as HeaderBackground)}
                />
                <NumberInput
                  label="Mobile height"
                  help="56–96px, with safe-area inset support."
                  min={56}
                  max={96}
                  integer
                  value={draft.header.mobile.height}
                  disabled={!canWrite || pending}
                  onChange={(value) => value !== undefined && setMobileHeader("height", value)}
                />
                <NumberInput
                  label="Mobile scale"
                  min={0.8}
                  max={1.4}
                  value={draft.header.mobile.scale}
                  disabled={!canWrite || pending}
                  onChange={(value) => value !== undefined && setMobileHeader("scale", value)}
                />
                <Select
                  label="Mobile icon hover"
                  value={draft.header.mobile.iconHover}
                  disabled={!canWrite || pending}
                  options={HEADER_ICON_HOVERS.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  onChange={(value) => setMobileHeader("iconHover", value as HeaderIconHover)}
                />
                <Toggle
                  label="Shrink mobile header on scroll"
                  checked={draft.header.mobile.shrinkOnScroll}
                  disabled={!canWrite || pending}
                  onChange={(value) => setMobileHeader("shrinkOnScroll", value)}
                />
                <NumberInput
                  label="Mobile shrunk height"
                  min={44}
                  max={90}
                  integer
                  value={draft.header.mobile.shrunkHeight}
                  disabled={!canWrite || pending || !draft.header.mobile.shrinkOnScroll}
                  onChange={(value) =>
                    value !== undefined && setMobileHeader("shrunkHeight", value)
                  }
                />
                <Toggle
                  label="Mobile divider"
                  checked={draft.header.mobile.divider}
                  disabled={!canWrite || pending}
                  onChange={(value) => setMobileHeader("divider", value)}
                />
                <Toggle
                  label="Mobile icon bubbles"
                  checked={draft.header.mobile.iconBubbles}
                  disabled={!canWrite || pending}
                  onChange={(value) => setMobileHeader("iconBubbles", value)}
                />
                <Toggle
                  label="Show mobile announcement"
                  checked={draft.header.mobile.showAnnouncement}
                  disabled={!canWrite || pending}
                  help="Uses the desktop announcement unless mobile copy is supplied."
                  onChange={(value) => setMobileHeader("showAnnouncement", value)}
                />
                <TextInput
                  label="Mobile announcement copy"
                  value={draft.header.mobile.announcementText}
                  disabled={!canWrite || pending || !draft.header.mobile.showAnnouncement}
                  placeholder="Leave empty to inherit desktop copy"
                  onChange={(value) => setMobileHeader("announcementText", value)}
                />
                <Toggle
                  label="Show mobile search"
                  checked={draft.header.mobile.showSearch}
                  disabled={!canWrite || pending}
                  onChange={(value) => setMobileHeader("showSearch", value)}
                />
                <Toggle
                  label="Show mobile theme toggle"
                  checked={draft.header.mobile.showThemeToggle}
                  disabled={!canWrite || pending}
                  onChange={(value) => setMobileHeader("showThemeToggle", value)}
                />
                <Toggle
                  label="Show mobile account"
                  checked={draft.header.mobile.showAccount}
                  disabled={!canWrite || pending}
                  onChange={(value) => setMobileHeader("showAccount", value)}
                />
                <Select
                  label="Mobile bag icon"
                  value={draft.header.mobile.cartVisibility}
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
                  onChange={(value) =>
                    setMobileHeader("cartVisibility", value as HeaderCartVisibility)
                  }
                />
                <Select
                  label="Mobile CTA placement"
                  value={draft.header.mobile.ctaPlacement}
                  disabled={!canWrite || pending || !draft.header.ctaLabel || !draft.header.ctaHref}
                  options={MOBILE_HEADER_CTA_PLACEMENTS.map((value) => ({
                    value,
                    label: optionLabel(value),
                  }))}
                  onChange={(value) =>
                    setMobileHeader("ctaPlacement", value as MobileHeaderCtaPlacement)
                  }
                />
                <NumberInput
                  label="Maximum mobile actions"
                  help="0–4. Applies after hidden and store-only actions are removed."
                  min={0}
                  max={MOBILE_HEADER_ACTIONS.length}
                  integer
                  value={draft.header.mobile.maxActions}
                  disabled={!canWrite || pending}
                  onChange={(value) => value !== undefined && setMobileHeader("maxActions", value)}
                />
                <div className="sm:col-span-2 xl:col-span-3">
                  <div className="mb-2 text-xs font-medium text-admin-text">
                    Mobile action order
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {draft.header.mobile.actionOrder.map((action, index) => (
                      <div
                        key={action}
                        className="flex items-center justify-between gap-2 border border-admin-border bg-admin-surface px-3 py-2"
                      >
                        <span className="text-sm text-admin-text">{optionLabel(action)}</span>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Move ${action} earlier`}
                            disabled={!canWrite || pending || index === 0}
                            onClick={() => moveMobileAction(action, -1)}
                          >
                            ↑
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Move ${action} later`}
                            disabled={
                              !canWrite ||
                              pending ||
                              index === draft.header.mobile.actionOrder.length - 1
                            }
                            onClick={() => moveMobileAction(action, 1)}
                          >
                            ↓
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </PanelSection>

        <PanelSection
          title="Footer"
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
                    footer: { ...DEFAULT_THEME_FOOTER },
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
              label="Footer layout"
              value={draft.footer.layout}
              disabled={!canWrite || pending}
              options={FOOTER_LAYOUTS.map((value) => ({
                value,
                label:
                  value === "responsive"
                    ? "Responsive columns"
                    : value === "stacked"
                      ? "Always stacked"
                      : "Centered stack",
              }))}
              onChange={(value) => setFooter("layout", value as FooterLayout)}
            />
            <Toggle
              label="Show tagline"
              checked={draft.footer.showTagline}
              disabled={!canWrite || pending}
              onChange={(value) => setFooter("showTagline", value)}
            />
            <Toggle
              label="Show social row"
              checked={draft.footer.showSocials}
              disabled={!canWrite || pending}
              onChange={(value) => setFooter("showSocials", value)}
            />
            <div className="sm:col-span-2 xl:col-span-3">
              <TextArea
                label="Footer tagline"
                value={draft.footer.tagline}
                rows={2}
                disabled={!canWrite || pending || !draft.footer.showTagline}
                onChange={(value) => setFooter("tagline", value)}
                help="Up to 240 characters. Navigation and legal links remain menu-managed."
              />
            </div>
            <TextInput
              label="Social row label"
              value={draft.footer.followLabel}
              disabled={!canWrite || pending || !draft.footer.showSocials}
              onChange={(value) => setFooter("followLabel", value)}
            />
            {(
              [
                ["instagramHref", "Instagram URL"],
                ["xHref", "X URL"],
                ["youtubeHref", "YouTube URL"],
                ["linkedinHref", "LinkedIn URL"],
              ] as const
            ).map(([key, label]) => (
              <TextInput
                key={key}
                label={label}
                type="url"
                value={draft.footer[key]}
                disabled={!canWrite || pending || !draft.footer.showSocials}
                onChange={(value) => setFooter(key, value)}
                placeholder="https://"
                help="HTTPS only. Leave blank to hide this destination."
              />
            ))}
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
          Typography, site width, header behavior and reusable style classes are global settings.
          Classes are published with the theme; local builder controls override them so a page can
          diverge without duplicating or rewriting the shared recipe.
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
  webfonts,
  disabled,
  onChange,
}: {
  label: string;
  value: FontSelection;
  webfonts: readonly ThemeWebfont[];
  disabled: boolean;
  onChange: (value: FontSelection) => void;
}) {
  return (
    <Select
      label={label}
      value={value}
      disabled={disabled}
      options={[
        ...FONT_PRESET_OPTIONS,
        ...webfonts.map((font) => ({
          value: `webfont:${font.id}`,
          label: `${font.label} — webfont`,
        })),
      ]}
      onChange={(next) => onChange(next as FontSelection)}
    />
  );
}
