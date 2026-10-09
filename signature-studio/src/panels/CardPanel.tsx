import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { ExternalLink, MousePointerClick, Plus, Scissors, Trash2, Wand2 } from "lucide-react";
import { PLATFORM_MAP } from "../core/social";
import type { Hotspot, HotspotAction, SignatureDoc } from "../core/types";
import { uid } from "../lib/id";
import { designDisplayWidth, trimImage } from "../store/assets";
import { edit, toast, undo, useStudio } from "../store/editor";
import { ImageDrop } from "../ui/ImageDrop";
import { Field, SectionTitle, Segmented, Slider, TextField, Toggle } from "../ui/kit";
import { previewSource } from "../ui/samples";
import { useSourcesVersion } from "../ui/SigHtml";

const BASE_ACTIONS: { value: HotspotAction; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "email", label: "Email me" },
  { value: "phone", label: "Call (phone)" },
  { value: "mobile", label: "Call (mobile)" },
  { value: "meeting", label: "Book a meeting" },
  { value: "digital-card", label: "Digital card" },
  { value: "url", label: "Custom link…" },
];

export const actionLabel = (a: HotspotAction) => BASE_ACTIONS.find((x) => x.value === a)?.label ?? PLATFORM_MAP[a as keyof typeof PLATFORM_MAP]?.label ?? a;

function actionsFor(doc: SignatureDoc) {
  const socials = [...new Set(doc.socials.map((s) => s.platform).filter((p) => p !== "custom"))].map((p) => ({
    value: p as HotspotAction,
    label: PLATFORM_MAP[p].label,
  }));
  return [...BASE_ACTIONS, ...socials];
}

/** What a hotspot will link to, or why it won't work yet. */
function problem(doc: SignatureDoc, h: Hotspot): string | null {
  const d = doc.details;
  switch (h.action) {
    case "website":
      return d.website.trim() ? null : "Add your website in Details.";
    case "email":
      return d.email.trim() ? null : "Add your email in Details.";
    case "phone":
      return d.phone.trim() ? null : "Add a phone number in Details.";
    case "mobile":
      return d.mobile.trim() ? null : "Add a mobile number in Details.";
    case "meeting":
      return doc.addons.meeting.url.trim() ? null : "Add a booking link in Add-ons → Book a meeting.";
    case "digital-card":
      return null;
    case "url":
      return h.url?.trim() ? null : "Enter the link below.";
    default:
      return doc.socials.some((s) => s.platform === h.action && s.url.trim()) ? null : "Add this network in Social.";
  }
}

type Drag = { mode: "move" | "resize" | "draw"; id: string; x0: number; y0: number; start: Hotspot };

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

function Stage({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  useSourcesVersion();
  const card = useStudio((s) => s.doc!.card);
  const doc = useStudio((s) => s.doc!);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [draft, setDraft] = useState<Hotspot | null>(null);
  const meta = card.assetId ? doc.assets[card.assetId] : null;
  const src = card.assetId ? previewSource(card.assetId) : null;
  if (!meta || !src) return null;

  const pos = (e: RPointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };

  const down = (e: RPointerEvent, mode: Drag["mode"], h?: Hotspot) => {
    e.preventDefault();
    e.stopPropagation();
    ref.current!.setPointerCapture(e.pointerId);
    const p = pos(e);
    if (mode === "draw") {
      const fresh: Hotspot = { id: uid("h"), x: p.x, y: p.y, w: 0, h: 0, action: nextAction(doc), label: "" };
      drag.current = { mode, id: fresh.id, x0: p.x, y0: p.y, start: fresh };
      setDraft(fresh);
    } else if (h) {
      onSelect(h.id);
      drag.current = { mode, id: h.id, x0: p.x, y0: p.y, start: { ...h } };
    }
  };

  const move = (e: RPointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const p = pos(e);
    const dx = p.x - g.x0;
    const dy = p.y - g.y0;
    if (g.mode === "draw") {
      setDraft({ ...g.start, x: Math.min(g.x0, p.x), y: Math.min(g.y0, p.y), w: Math.abs(dx), h: Math.abs(dy) });
      return;
    }
    edit((d) => {
      const h = d.card.hotspots.find((x) => x.id === g.id);
      if (!h) return;
      if (g.mode === "move") {
        h.x = clamp(g.start.x + dx, 0, 1 - h.w);
        h.y = clamp(g.start.y + dy, 0, 1 - h.h);
      } else {
        h.w = clamp(g.start.w + dx, 0.03, 1 - h.x);
        h.h = clamp(g.start.h + dy, 0.03, 1 - h.y);
      }
    }, `hotspot.${g.id}.${g.mode}`);
  };

  const up = () => {
    const g = drag.current;
    drag.current = null;
    if (g?.mode === "draw" && draft) {
      setDraft(null);
      if (draft.w > 0.03 && draft.h > 0.03) {
        edit((d) => void d.card.hotspots.push({ ...draft, label: actionLabel(draft.action) }));
        onSelect(draft.id);
      } else onSelect(null);
    }
  };

  const spots = draft ? [...card.hotspots, draft] : card.hotspots;
  return (
    <div
      ref={ref}
      className="card-stage"
      style={{ aspectRatio: `${meta.width} / ${meta.height}`, borderRadius: card.radius, cursor: "crosshair" }}
      onPointerDown={(e) => down(e, "draw")}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      data-testid="card-stage"
    >
      <img src={src} alt="Your business card" />
      {spots.map((h) => (
        <div
          key={h.id}
          className={`hotspot${h.id === selected ? " sel" : ""}`}
          style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` }}
          onPointerDown={(e) => down(e, "move", h)}
          data-testid="hotspot"
        >
          <span>{h.label || actionLabel(h.action)}</span>
          <i className="h" onPointerDown={(e) => down(e, "resize", h)} aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

function nextAction(doc: SignatureDoc): HotspotAction {
  const used = new Set(doc.card.hotspots.map((h) => h.action));
  const order: HotspotAction[] = ["website", "email", "phone", "meeting", ...doc.socials.map((s) => s.platform as HotspotAction), "digital-card"];
  return order.find((a) => !used.has(a) && !problem(doc, { id: "", x: 0, y: 0, w: 0, h: 0, action: a, label: "" })) ?? "url";
}

async function trimDesign(slot: "assetId" | "backAssetId", quiet = false) {
  const doc = useStudio.getState().doc!;
  const id = doc.card[slot];
  if (!id || !doc.assets[id]) return;
  const r = await trimImage(id, doc.assets[id].mime).catch(() => null);
  if (!r) {
    if (!quiet) toast("Nothing to trim — the design already fits.", "info");
    return;
  }
  const { box } = r;
  edit((d) => {
    d.assets[r.meta.id] = r.meta;
    d.card[slot] = r.meta.id;
    if (slot === "assetId") {
      // Keep clickable areas over the same part of the design.
      d.card.hotspots = d.card.hotspots
        .map((h) => {
          const x = (h.x * box.W - box.x) / box.w;
          const y = (h.y * box.H - box.y) / box.h;
          const w = (h.w * box.W) / box.w;
          const hh = (h.h * box.H) / box.h;
          return { ...h, x: clamp(x), y: clamp(y), w: clamp(w, 0, 1 - clamp(x)), h: clamp(hh, 0, 1 - clamp(y)) };
        })
        .filter((h) => h.w > 0.01 && h.h > 0.01);
      if (d.card.kind === "signature") d.card.width = designDisplayWidth(r.meta.width);
    }
  });
  toast(`Trimmed empty edges (${box.W}×${box.H} → ${box.w}×${box.h})`, "success", { label: "Undo", run: undo });
}

function Sharpness({ natural, width }: { natural: number; width: number }) {
  return natural >= width * 2 ? (
    <span className="badge ok">Sharp on every screen</span>
  ) : natural >= width ? (
    <span className="badge warn" title="Download from Canva at 2× size, or design at double the width">
      Sharper with a 2× Canva download
    </span>
  ) : (
    <span className="badge err">Low resolution — re-download larger from Canva</span>
  );
}

const DETAIL_FIELDS = [
  { key: "website", label: "Website", placeholder: "company.com" },
  { key: "email", label: "Email", placeholder: "you@company.com" },
  { key: "phone", label: "Phone", placeholder: "+1 416 555 0182" },
  { key: "mobile", label: "Mobile", placeholder: "+1 647 555 0119" },
] as const;

export function CardPanel() {
  const doc = useStudio((s) => s.doc!);
  const card = doc.card;
  const isSig = card.kind === "signature";
  const [selected, setSelected] = useState<string | null>(null);
  const setCard = (patch: Partial<typeof card>, key?: string) => edit((d) => void Object.assign(d.card, patch), key && `card.${key}`);
  const addSpot = () => {
    const action = nextAction(doc);
    const h: Hotspot = { id: uid("h"), x: 0.35, y: 0.4, w: 0.3, h: 0.18, action, label: actionLabel(action) };
    edit((d) => void d.card.hotspots.push(h));
    setSelected(h.id);
  };
  const actions = actionsFor(doc);
  const front = card.assetId ? doc.assets[card.assetId] : null;
  const displayWidth = front ? (isSig ? card.width : Math.min(card.width, doc.design.width)) : 0;

  return (
    <>
      <h2>Canva design</h2>
      <p className="lede">Bring in a design exactly as you made it in Canva, make it clickable, and add it to Gmail.</p>
      <div className="field">
        <span className="label">What did you design?</span>
        <Segmented
          label="Design type"
          value={card.kind}
          onChange={(kind) => setCard(kind === "signature" ? { kind, cardOnly: true, enabled: true } : { kind, cardOnly: false, enabled: true })}
          options={[
            { value: "signature", label: "Email signature" },
            { value: "card", label: "Business card" },
          ]}
        />
      </div>
      <Toggle
        label={isSig ? "Use my Canva design" : "Show my business card"}
        checked={card.enabled}
        onChange={(v) => setCard({ enabled: v })}
        testId="card-enabled"
      />

      {!card.assetId && (
        <div className="card" style={{ marginBottom: 14 }}>
          <strong style={{ display: "block", marginBottom: 10 }}>From Canva in 4 steps</strong>
          <ol className="steps-list">
            {isSig ? (
              <li>
                <span>
                  In Canva, create a design with <b>custom size 1200 × 400 px</b> (it shows at 600 × 200 in email, razor-sharp on retina screens), or start from{" "}
                  <a href="https://www.canva.com/email-signatures/templates/" target="_blank" rel="noreferrer">
                    Canva's email signature templates <ExternalLink size={12} />
                  </a>
                  .
                </span>
              </li>
            ) : (
              <li>
                <span>
                  Design your card in Canva.{" "}
                  <a href="https://www.canva.com/business-cards/templates/" target="_blank" rel="noreferrer">
                    Browse Canva business cards <ExternalLink size={12} />
                  </a>
                </span>
              </li>
            )}
            <li>
              <span>
                Choose <b>Share → Download</b>, file type <b>PNG</b>
                {isSig ? "" : " (each side you want)"}. If you have the option, pick <b>size ×2</b>.
              </span>
            </li>
            <li>
              <span>Upload it below. We trim empty edges and size it for email automatically.</span>
            </li>
            <li>
              <span>Draw boxes over your phone, email, website and social icons to make them clickable in Gmail.</span>
            </li>
          </ol>
        </div>
      )}

      <div className={isSig ? undefined : "grid2"} style={{ alignItems: "start" }}>
        <Field label={isSig ? "Your design" : "Front"} hint={front ? `${front.width}×${front.height}px` : undefined}>
          <ImageDrop
            assetId={card.assetId}
            label={isSig ? "Canva design" : "card front"}
            style={{ width: "100%", height: isSig ? 120 : 96 }}
            testId="upload-card-front"
            onFile={(m) => {
              edit((d) => {
                d.assets[m.id] = m;
                d.card.assetId = m.id;
                d.card.enabled = true;
                if (d.card.kind === "signature") d.card.width = designDisplayWidth(m.width);
              });
              void trimDesign("assetId", true);
            }}
          />
        </Field>
        {!isSig && (
          <Field label="Back" hint="optional">
            <ImageDrop
              assetId={card.backAssetId}
              label="card back"
              style={{ width: "100%", height: 96 }}
              onFile={(m) =>
                edit((d) => {
                  d.assets[m.id] = m;
                  d.card.backAssetId = m.id;
                })
              }
            />
          </Field>
        )}
      </div>
      {front && (
        <div className="row" style={{ flexWrap: "wrap", marginTop: -6, marginBottom: 10 }}>
          <Sharpness natural={front.width} width={displayWidth} />
          <button className="btn sm ghost" onClick={() => void trimDesign("assetId")}>
            <Scissors size={14} /> Trim edges
          </button>
          {card.backAssetId && !isSig && (
            <button className="btn sm ghost danger" onClick={() => setCard({ backAssetId: undefined })}>
              <Trash2 size={14} /> Remove back
            </button>
          )}
        </div>
      )}

      {card.assetId && (
        <>
          <SectionTitle>Clickable areas</SectionTitle>
          <p className="hint" style={{ marginTop: -4 }}>
            <MousePointerClick size={13} style={{ verticalAlign: -2 }} /> Drag on the design to draw an area. Drag an area to move it, its corner to resize.
          </p>
          <Stage selected={selected} onSelect={setSelected} />
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="btn sm" onClick={addSpot} data-testid="add-hotspot">
              <Plus size={14} /> Add area
            </button>
            {!card.hotspots.length && (
              <span className="hint">
                <Wand2 size={12} /> Tip: start with your website and email.
              </span>
            )}
          </div>
          {card.hotspots.map((h, i) => {
            const issue = problem(doc, h);
            return (
              <div
                key={h.id}
                className="list-item"
                style={{ display: "grid", gap: 8, borderColor: h.id === selected ? "var(--pink)" : undefined }}
                onFocus={() => setSelected(h.id)}
                onClick={() => setSelected(h.id)}
              >
                <div className="row">
                  <select
                    className="select sm"
                    value={h.action}
                    aria-label="When clicked"
                    onChange={(e) => {
                      const action = e.target.value as HotspotAction;
                      edit((d) => {
                        const x = d.card.hotspots[i];
                        if (!x.label || x.label === actionLabel(x.action)) x.label = actionLabel(action);
                        x.action = action;
                      });
                    }}
                  >
                    {actions.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input sm"
                    value={h.label}
                    placeholder="Label"
                    aria-label="Label (shown on hover)"
                    onChange={(e) => edit((d) => void (d.card.hotspots[i].label = e.target.value), `hotspot.${h.id}.label`)}
                  />
                  <button className="icon-btn sm" aria-label="Remove area" onClick={() => edit((d) => void d.card.hotspots.splice(i, 1))}>
                    <Trash2 size={15} />
                  </button>
                </div>
                {h.action === "url" && (
                  <input
                    className="input sm"
                    placeholder="https://…"
                    value={h.url ?? ""}
                    aria-label="Custom link"
                    onChange={(e) => edit((d) => void (d.card.hotspots[i].url = e.target.value), `hotspot.${h.id}.url`)}
                  />
                )}
                {issue && <span className="badge warn">{issue}</span>}
              </div>
            );
          })}

          <SectionTitle>Where the links go</SectionTitle>
          <div className="grid2">
            {DETAIL_FIELDS.map((f) => (
              <TextField
                key={f.key}
                label={f.label}
                placeholder={f.placeholder}
                value={doc.details[f.key]}
                onChange={(v) => edit((d) => void (d.details[f.key] = v), `details.${f.key}`)}
                testId={`canva-${f.key}`}
              />
            ))}
          </div>
          <p className="hint" style={{ marginTop: -6 }}>
            Social areas use the links in the Social tab.
          </p>

          <SectionTitle>In Gmail</SectionTitle>
          {!isSig && (
            <Toggle
              label="Card only"
              hint="Use the card instead of the text signature"
              checked={card.cardOnly}
              onChange={(v) => setCard({ cardOnly: v })}
              testId="card-only"
            />
          )}
          <Toggle
            label="Use it in replies too"
            hint={isSig ? "Off: replies get a short text signature" : "Off: replies stay text-only"}
            checked={card.inReplies}
            onChange={(v) => setCard({ inReplies: v })}
          />
          <Slider
            label="Width in email"
            unit="px"
            min={200}
            max={isSig ? 700 : 600}
            step={10}
            value={card.width}
            onChange={(v) => setCard({ width: v }, "width")}
            hint={isSig ? "600px or less fits every inbox" : undefined}
          />
          <Slider label="Corner radius" unit="px" min={0} max={32} value={card.radius} onChange={(v) => setCard({ radius: v }, "radius")} />

          {!isSig && (
            <>
              <SectionTitle>Digital business card</SectionTitle>
              <Toggle
                label="Interactive digital card"
                hint="A shareable page with a flip animation, one-tap Save Contact, and a QR code in your signature"
                checked={card.digitalLink}
                onChange={(v) => setCard({ digitalLink: v })}
              />
              {doc.digitalCardUrl ? (
                <p className="hint">
                  Your digital card:{" "}
                  <a href={doc.digitalCardUrl} target="_blank" rel="noreferrer">
                    open it <ExternalLink size={12} />
                  </a>
                </p>
              ) : (
                <p className="hint">Your digital card link is created when you add the signature to Gmail.</p>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
