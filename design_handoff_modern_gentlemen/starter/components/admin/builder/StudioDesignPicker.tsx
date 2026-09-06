"use client";

import { AFTER_HOURS_PHOTO } from "@/lib/blocks/afterHours";
import { useState } from "react";
import { Select } from "@/components/admin/ui/Select";
import { Button } from "@/components/admin/ui/Button";
import { COMING_SOON_DESIGNS } from "@/lib/blocks/comingSoon";
import { SECTION_STUDIES } from "@/lib/blocks/sectionStudies";
import { ComingSoonStudio, type ComingSoonProps } from "@/components/sections/ComingSoonStudio";
import { MGDesignStudio, type SectionStudyProps } from "@/components/sections/SectionStudies";
import { studyPreview } from "./studyPreview";

/** Only the selected composition is mounted. Preview copy/media never enter saved settings. */
export function StudioDesignPicker({
  kind,
  value,
  onChange,
  disabled = false,
  allowBlank = false,
}: {
  kind: "comingSoon" | "studies";
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowBlank?: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const designs = kind === "comingSoon" ? COMING_SOON_DESIGNS : SECTION_STUDIES;
  const options = designs.map(([id, name]) => ({
    value: id,
    label: `${kind === "comingSoon" ? "CS" : "MG "}${id} · ${name}`,
  }));
  return (
    <div className="space-y-3">
      <Select
        label={kind === "comingSoon" ? "Coming soon design" : "Studio design"}
        value={value}
        onChange={onChange}
        disabled={disabled}
        options={
          allowBlank ? [{ value: "", label: "Blank — start from scratch" }, ...options] : options
        }
      />
      {value && (
        <Button size="sm" variant="ghost" onClick={() => setPreview(!preview)}>
          {preview ? "Hide design preview" : "Preview design"}
        </Button>
      )}
      {value && preview && (
        <>
          <p className="text-[12px] text-mg-fg/70">
            Illustrative preview. Preview images are examples only. Choosing a design does not
            insert these images.
          </p>
          <div
            className="pointer-events-none relative w-full overflow-hidden border border-mg-bd/20"
            style={{ height: 240 }}
            aria-hidden="true"
            inert
          >
            <div style={{ width: 1440, transform: "scale(0.22)", transformOrigin: "top left" }}>
              {kind === "comingSoon" ? (
                <ComingSoonStudio {...comingSoonPreview(value)} />
              ) : (
                <MGDesignStudio
                  {...(studyPreview("mgDesignStudio", value) as unknown as SectionStudyProps)}
                  variant={value}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function comingSoonPreview(variant: string): ComingSoonProps {
  if (variant === "21")
    return {
      variant,
      image: AFTER_HOURS_PHOTO,
      imageAlt: "After Hours street photograph",
      title: "Coming soon",
      showSignup: true,
      afterHours: { layout: { standalone: false } },
    };
  return {
    variant,
    brand: "Modern Gentlemen",
    title: variant === "14" ? "Style.\nCulture.\nCharacter." : "Coming soon",
    intro:
      variant === "14"
        ? "Coming soon"
        : "Your next chapter starts here. Add your own introduction.",
    ...(!["01", "04", "07", "08", "11", "13", "14", "18", "20"].includes(variant)
      ? { image: "/images/style-mono.jpg" }
      : {}),
    imageAlt: "Illustrative tailoring image",
    images: ["08", "13"].includes(variant)
      ? [
          { image: "/images/style-mono.jpg", alt: "Tailoring" },
          { image: "/images/watch-gear.jpg", alt: "Watch" },
          { image: "/images/film-workshop.jpg", alt: "Workshop" },
        ]
      : [],
    details: ["11", "16", "18"].includes(variant)
      ? [
          { title: "Style", text: "Your editorial note." },
          { title: "Culture", text: "Your editorial note." },
          { title: "Character", text: "Your editorial note." },
        ]
      : [],
    height: "content",
  };
}
