"use client";

import { useState } from "react";
import { pageSettingsSchema, readPageSettings } from "@/lib/domain/pageSettings";
import { pageTitle } from "@/lib/domain/seo";
import { publicPathForPage } from "@/lib/domain/routes";
import { TextInput, TextArea } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { Toggle } from "@/components/admin/ui/Toggle";
import { Button } from "@/components/admin/ui/Button";
import { PanelSection } from "@/components/admin/ui/Panel";
import { MediaUrlControl } from "@/components/admin/fields/MediaUrlControl";
import { TemplateOverrideControl } from "@/components/admin/TemplateOverrideControl";
import type { BuilderServerActions } from "./Builder";
import type { ComponentProps } from "react";
import { useBuilder } from "./StoreContext";

export function PageSettingsPanel({
  identityAction,
  templateOverride,
}: {
  identityAction?: BuilderServerActions["savePageIdentity"];
  templateOverride?: ComponentProps<typeof TemplateOverrideControl>;
}) {
  const doc = useBuilder((s) => s.doc);
  const update = useBuilder((s) => s.setPageSettings);
  const setDoc = useBuilder((s) => s.setDoc);
  const settings = readPageSettings(doc.rest.pageSettings);
  const raw = (doc.rest.pageSettings ?? {}) as Record<string, unknown>;
  const parsed = pageSettingsSchema.safeParse(raw);
  const [title, setTitle] = useState(doc.title);
  const [slug, setSlug] = useState(doc.slug);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const text = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : "");
  const options = (values: string[]) =>
    values.map((value) => ({
      value,
      label:
        value === "inherit" ? "Use site default" : value === "overlay" ? "Overlay content" : "Hide",
    }));
  return (
    <div className="h-full overflow-y-auto" aria-label="Page settings">
      <PanelSection title="Page identity">
        <TextInput label="Page title" value={title} onChange={setTitle} disabled={busy} />
        <TextInput
          label="URL slug"
          value={slug}
          onChange={setSlug}
          disabled={busy || doc.slug === "home"}
          help={
            doc.slug === "home"
              ? "The homepage remains at /."
              : "Lowercase words separated by hyphens. Changing this moves the public URL; no redirect is created."
          }
        />
        <p className="break-all text-xs">Public path: {publicPathForPage(slug)}</p>
        <p className="text-xs">
          Title and URL changes take effect immediately. Other settings below are drafts until
          published.
        </p>
        <Button
          disabled={!identityAction || busy || (title === doc.title && slug === doc.slug)}
          onClick={async () => {
            if (!identityAction) return;
            setBusy(true);
            setMessage("");
            try {
              const result = await identityAction({ id: doc.id, title, slug });
              if (result.ok) {
                setDoc({ title: title.trim(), slug: slug.trim() });
                setTitle(title.trim());
                setSlug(slug.trim());
                setMessage("Page identity saved.");
              } else setMessage(result.error);
            } catch {
              setMessage("Could not save. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Save title and URL
        </Button>
        <p role="status" className="text-xs">
          {message}
        </p>
      </PanelSection>
      {templateOverride && (
        <PanelSection title="Page template">
          <TemplateOverrideControl {...templateOverride} />
        </PanelSection>
      )}
      <PanelSection title="SEO and sharing">
        <TextInput
          label="SEO title"
          value={text("seoTitle")}
          onChange={(seoTitle) => update({ seoTitle })}
          placeholder={doc.title}
        />
        <TextArea
          label="Meta description"
          value={text("description")}
          onChange={(description) => update({ description })}
        />
        <TextInput
          label="Social title"
          value={text("socialTitle")}
          onChange={(socialTitle) => update({ socialTitle })}
          help="Defaults to the SEO title."
        />
        <TextArea
          label="Social description"
          value={text("socialDescription")}
          onChange={(socialDescription) => update({ socialDescription })}
        />
        <MediaUrlControl
          kind="image"
          label="Social image"
          value={text("socialImage")}
          onChange={(socialImage) => update({ socialImage })}
        />
        <Toggle
          label="Ask search engines not to index this page"
          checked={settings.noIndex ?? false}
          onChange={(noIndex) => update({ noIndex })}
        />
        <div className="border border-mg-bd/20 p-3 text-sm" aria-label="Search preview">
          <p className="text-xs">Search preview · {publicPathForPage(doc.slug)}</p>
          <p className="font-semibold">{pageTitle(settings.seoTitle || doc.title)}</p>
          <p>{settings.description || "Add a meta description."}</p>
        </div>
        <div className="border border-mg-bd/20 p-3 text-sm" aria-label="Social preview">
          <p className="text-xs">Social preview</p>
          <p className="font-semibold">
            {settings.socialTitle || pageTitle(settings.seoTitle || doc.title)}
          </p>
          <p>{settings.socialDescription || settings.description || "Add a social description."}</p>
        </div>
      </PanelSection>
      <PanelSection title="Page background">
        <TextInput
          label="Background color"
          value={text("backgroundColor")}
          onChange={(backgroundColor) => update({ backgroundColor })}
          placeholder="#0d0d0d"
          help="Leave empty to preserve the theme background."
        />
        <MediaUrlControl
          kind="image"
          label="Background image / video poster"
          value={text("backgroundImage")}
          onChange={(backgroundImage) => update({ backgroundImage })}
        />
        <MediaUrlControl
          kind="video"
          label="Background video"
          value={text("backgroundVideo")}
          onChange={(backgroundVideo) => update({ backgroundVideo })}
          help="Direct HTTPS video file, such as MP4. Plays silently in a loop. The image is the fallback."
        />
        <p className="text-xs">
          Page backgrounds appear behind sections. Sections with their own backgrounds cover them;
          clear those backgrounds in element settings when needed.
        </p>
        {(
          [
            ["overlayOpacity", "Dark overlay", 0, 1, 0.05],
            ["focalX", "Horizontal focal point", 0, 100, 1],
            ["focalY", "Vertical focal point", 0, 100, 1],
          ] as const
        ).map(([key, label, min, max, step]) => (
          <label key={key} className="block text-xs">
            {label}: {settings[key] ?? (key === "overlayOpacity" ? 0 : 50)}
            <input
              className="block w-full"
              type="range"
              min={min}
              max={max}
              step={step}
              value={settings[key] ?? (key === "overlayOpacity" ? 0 : 50)}
              onChange={(e) => update({ [key]: Number(e.target.value) })}
            />
          </label>
        ))}
        <Toggle
          label="Play background video on mobile"
          checked={settings.videoOnMobile ?? false}
          onChange={(videoOnMobile) => update({ videoOnMobile })}
        />
        <Toggle
          label="Fill at least one screen height"
          checked={settings.fullHeight ?? false}
          onChange={(fullHeight) => update({ fullHeight })}
        />
        <p className="text-xs">
          Reduced-motion visitors see the still image. A pause control is provided for video.
        </p>
      </PanelSection>
      <PanelSection title="Header and footer">
        <Select
          label="Desktop / tablet header"
          value={settings.header ?? "inherit"}
          onChange={(header) => update({ header })}
          options={options(["inherit", "hidden", "overlay"])}
        />
        <Select
          label="Mobile header"
          value={settings.mobileHeader ?? "inherit"}
          onChange={(mobileHeader) => update({ mobileHeader })}
          options={options(["inherit", "hidden", "overlay"])}
        />
        <Select
          label="Desktop / tablet footer"
          value={settings.footer ?? "inherit"}
          onChange={(footer) => update({ footer })}
          options={options(["inherit", "hidden"])}
        />
        <Select
          label="Mobile footer"
          value={settings.mobileFooter ?? "inherit"}
          onChange={(mobileFooter) => update({ mobileFooter })}
          options={options(["inherit", "hidden"])}
        />
        <p className="text-xs">
          Mobile settings are independent at 680px and below. Use the preview link to check site
          chrome. A section’s standalone mode still hides site chrome.
        </p>
      </PanelSection>
      {!parsed.success && (
        <div role="alert" className="p-4 text-sm">
          {parsed.error.issues.map((issue) => (
            <p key={issue.path.join(".")}>
              {issue.path.join(".")}: {issue.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
