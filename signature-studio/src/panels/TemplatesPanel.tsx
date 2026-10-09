import { useMemo, useState } from "react";
import { applyTemplate } from "../core/apply";
import { getTemplate, TEMPLATES, type TemplateGroup } from "../core/templates";
import type { SignatureDoc } from "../core/types";
import { edit, toast, undo, useStudio } from "../store/editor";
import { blocksFromDoc } from "../core/blocks";
import { Segmented, Toggle } from "../ui/kit";
import { Thumb } from "../ui/SigHtml";
import { AiSuggest } from "./AiSuggest";

function withTemplate(doc: SignatureDoc, id: string, keepColors: boolean): SignatureDoc {
  const copy = structuredClone(doc);
  applyTemplate(copy, id, { keepColors });
  return copy;
}

export function TemplatesPanel() {
  const doc = useStudio((s) => s.doc!);
  const [group, setGroup] = useState<TemplateGroup>(() => getTemplate(doc.templateId).group);
  const [keepColors, setKeepColors] = useState(false);
  // Thumbnails show *your* content in each template.
  const content = useMemo(() => doc, [doc.details, doc.images, doc.socials, doc.assets, doc.design.accent, doc.design.text, keepColors]);
  const list = useMemo(
    () => TEMPLATES.filter((t) => t.group === group).map((t) => ({ t, preview: withTemplate(content, t.id, keepColors) })),
    [content, group, keepColors],
  );
  return (
    <>
      <h2>Templates</h2>
      <p className="lede">
        {doc.mode === "builder"
          ? "Pick a starting layout. It replaces your current blocks (you can undo); your details and images come with you."
          : "Switch any time — your details, images and add-ons always come with you."}
      </p>
      <AiSuggest />
      <Segmented
        label="Template group"
        value={group}
        onChange={setGroup}
        options={[
          { value: "Business", label: "Business" },
          { value: "Artistic", label: "Artistic" },
          { value: "Modern", label: "Modern" },
          { value: "Modern Gentlemen", label: "MG", title: "Modern Gentlemen" },
        ]}
      />
      <div style={{ height: 10 }} />
      <Toggle label="Keep my colours" hint="Apply only the layout and type of a template" checked={keepColors} onChange={setKeepColors} />
      <div style={{ display: "grid", gap: 12 }}>
        {list.map(({ t, preview }) => (
          <button
            key={t.id}
            className="sig-tile"
            aria-current={doc.templateId === t.id}
            onClick={() => {
              edit((d) => {
                applyTemplate(d, t.id, { keepColors });
                // In the builder a template is a starting layout.
                if (d.mode === "builder") d.blocks = blocksFromDoc(d);
              });
              toast(doc.mode === "builder" ? `Layout replaced with ${t.name}` : `Template: ${t.name}`, "success", { label: "Undo", run: undo });
            }}
            data-testid={`apply-${t.id}`}
          >
            <Thumb doc={preview} width={350} height={130} />
            <div className="tile-meta">
              <div>
                <strong>{t.name}</strong>
                <div className="muted">{t.description}</div>
              </div>
              <span className="badge">{t.category}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
