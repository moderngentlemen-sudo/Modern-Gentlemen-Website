import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { detectPlatform, PLATFORM_MAP, PLATFORMS } from "../core/social";
import type { IconColorMode, IconShape, SocialPlatform } from "../core/types";
import { uid } from "../lib/id";
import { socialSvg, svgDataUrl } from "../render/icons";
import { edit, toast, useStudio } from "../store/editor";
import { Segmented, SectionTitle, Slider } from "../ui/kit";

export function PlatformIcon({ platform, size = 22, shape = "circle", color }: { platform: SocialPlatform; size?: number; shape?: IconShape; color?: string }) {
  return <img src={svgDataUrl(socialSvg(platform, shape, size * 2, color ?? PLATFORM_MAP[platform].brand))} width={size} height={size} alt="" />;
}

export function SocialPanel() {
  const socials = useStudio((s) => s.doc!.socials);
  const style = useStudio((s) => s.doc!.design.social);
  const [paste, setPaste] = useState("");

  const add = (platform: SocialPlatform, url = "") => edit((d) => void d.socials.push({ id: uid("s"), platform, url }));
  const addPasted = () => {
    const v = paste.trim();
    if (!v) return;
    const p = detectPlatform(v);
    add(p, v);
    setPaste("");
    toast(p === "custom" ? "Added as a custom link" : `Added ${PLATFORM_MAP[p].label}`, "success");
  };
  const move = (i: number, by: number) =>
    edit((d) => {
      const [it] = d.socials.splice(i, 1);
      d.socials.splice(i + by, 0, it);
    });

  return (
    <>
      <h2>Social links</h2>
      <p className="lede">Paste any profile link and we'll recognise the network.</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <input
          className="input"
          placeholder="Paste a link, e.g. instagram.com/you"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPasted()}
          aria-label="Paste a profile link"
          data-testid="social-paste"
        />
        <button className="btn" onClick={addPasted} disabled={!paste.trim()}>
          Add
        </button>
      </div>
      {socials.map((s, i) => (
        <div key={s.id} className="list-item">
          <PlatformIcon platform={s.platform} />
          <div className="grow">
            <input
              className="input sm"
              value={s.url}
              placeholder={PLATFORM_MAP[s.platform].placeholder}
              aria-label={`${PLATFORM_MAP[s.platform].label} link`}
              onChange={(e) => {
                const url = e.target.value;
                edit((d) => {
                  d.socials[i].url = url;
                  const p = detectPlatform(url);
                  if (p !== "custom") d.socials[i].platform = p;
                }, `social.${s.id}`);
              }}
            />
          </div>
          <button className="icon-btn sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
            <ArrowUp size={15} />
          </button>
          <button className="icon-btn sm" aria-label="Move down" disabled={i === socials.length - 1} onClick={() => move(i, 1)}>
            <ArrowDown size={15} />
          </button>
          <button className="icon-btn sm" aria-label="Remove" onClick={() => edit((d) => void d.socials.splice(i, 1))}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <SectionTitle>Add a network</SectionTitle>
      <div className="platform-grid">
        {PLATFORMS.map((p) => (
          <button key={p.id} className="platform-btn" onClick={() => add(p.id)}>
            {p.id === "custom" ? <Plus size={22} /> : <PlatformIcon platform={p.id} />}
            {p.label}
          </button>
        ))}
      </div>
      <SectionTitle>Icon style</SectionTitle>
      <div className="field">
        <span className="label">Shape</span>
        <Segmented<IconShape>
          label="Icon shape"
          value={style.shape}
          onChange={(v) => edit((d) => void (d.design.social.shape = v))}
          options={[
            { value: "circle", label: "Circle" },
            { value: "rounded", label: "Rounded" },
            { value: "square", label: "Square" },
            { value: "outline", label: "Outline" },
            { value: "plain", label: "Plain" },
          ]}
        />
      </div>
      <div className="field">
        <span className="label">Colour</span>
        <Segmented<IconColorMode>
          label="Icon colour"
          value={style.colorMode}
          onChange={(v) => edit((d) => void (d.design.social.colorMode = v))}
          options={[
            { value: "brand", label: "Network colours" },
            { value: "accent", label: "My accent" },
            { value: "mono", label: "Mono" },
          ]}
        />
      </div>
      <Slider label="Size" unit="px" min={16} max={36} value={style.size} onChange={(v) => edit((d) => void (d.design.social.size = v), "social.size")} />
      <Slider label="Spacing" unit="px" min={2} max={16} value={style.gap} onChange={(v) => edit((d) => void (d.design.social.gap = v), "social.gap")} />
    </>
  );
}
