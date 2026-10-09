import { Plus, Trash2 } from "lucide-react";
import type { DetailKey } from "../core/types";
import { uid } from "../lib/id";
import { edit, useStudio } from "../store/editor";
import { SectionTitle, TextField } from "../ui/kit";

const FIELDS: { key: DetailKey; label: string; placeholder: string; type?: string; half?: boolean }[] = [
  { key: "name", label: "Full name", placeholder: "Jordan Ellis" },
  { key: "title", label: "Job title", placeholder: "Creative Director", half: true },
  { key: "pronouns", label: "Pronouns", placeholder: "they/them", half: true },
  { key: "company", label: "Company", placeholder: "Modern Gentlemen", half: true },
  { key: "department", label: "Department", placeholder: "Brand studio", half: true },
];

const CONTACT: typeof FIELDS = [
  { key: "phone", label: "Phone", placeholder: "+1 416 555 0182", type: "tel", half: true },
  { key: "mobile", label: "Mobile", placeholder: "+1 647 555 0119", type: "tel", half: true },
  { key: "email", label: "Email", placeholder: "you@company.com", type: "email" },
  { key: "website", label: "Website", placeholder: "company.com" },
  { key: "address", label: "Address", placeholder: "88 Yorkville Ave, Toronto" },
];

function Fields({ list }: { list: typeof FIELDS }) {
  const details = useStudio((s) => s.doc!.details);
  const rows: (typeof FIELDS)[] = [];
  for (const f of list) {
    const last = rows[rows.length - 1];
    if (f.half && last && last.length === 1 && last[0].half) last.push(f);
    else rows.push([f]);
  }
  return (
    <>
      {rows.map((r) => (
        <div key={r[0].key} className={r.length > 1 ? "grid2" : undefined}>
          {r.map((f) => (
            <TextField
              key={f.key}
              label={f.label}
              type={f.type}
              placeholder={f.placeholder}
              value={details[f.key]}
              onChange={(v) => edit((d) => void (d.details[f.key] = v), `details.${f.key}`)}
              testId={`field-${f.key}`}
            />
          ))}
        </div>
      ))}
    </>
  );
}

export function DetailsPanel() {
  const custom = useStudio((s) => s.doc!.details.custom);
  return (
    <>
      <h2>Your details</h2>
      <p className="lede">Leave anything blank and it simply won't appear.</p>
      <Fields list={FIELDS} />
      <SectionTitle>Contact</SectionTitle>
      <Fields list={CONTACT} />
      <SectionTitle>Extra lines</SectionTitle>
      <p className="hint" style={{ marginTop: -4 }}>
        Licence numbers, office hours, a second location — anything else you want to show.
      </p>
      {custom.map((f, i) => (
        <div key={f.id} className="card" style={{ marginBottom: 10, padding: 12 }}>
          <div className="grid2">
            <TextField
              label="Label"
              placeholder="Licence"
              value={f.label}
              onChange={(v) => edit((d) => void (d.details.custom[i].label = v), `custom.${f.id}.label`)}
            />
            <TextField
              label="Text"
              placeholder="#12345"
              value={f.value}
              onChange={(v) => edit((d) => void (d.details.custom[i].value = v), `custom.${f.id}.value`)}
            />
          </div>
          <div className="row">
            <div style={{ flex: 1 }}>
              <TextField
                label="Link (optional)"
                placeholder="https://…"
                value={f.link ?? ""}
                onChange={(v) => edit((d) => void (d.details.custom[i].link = v || undefined), `custom.${f.id}.link`)}
              />
            </div>
            <button className="icon-btn" aria-label="Remove line" onClick={() => edit((d) => void d.details.custom.splice(i, 1))}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
      <button className="btn sm" onClick={() => edit((d) => void d.details.custom.push({ id: uid("f"), label: "", value: "" }))}>
        <Plus size={15} /> Add a line
      </button>
    </>
  );
}
