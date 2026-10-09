import type { ReactNode } from "react";
import { CalendarDays, Leaf, MousePointerClick, PenLine, Play, Quote, ScrollText, Smartphone, Star, Image as ImageIcon } from "lucide-react";
import type { AddOns } from "../core/types";
import { edit, useStudio } from "../store/editor";
import { ImageDrop } from "../ui/ImageDrop";
import { Segmented, Slider, Switch, TextField, Toggle } from "../ui/kit";

type Key = keyof AddOns;

function AddOn({ k, icon, title, desc, children }: { k: Key; icon: ReactNode; title: string; desc: string; children: ReactNode }) {
  const on = useStudio((s) => s.doc!.addons[k].enabled);
  return (
    <div className="addon" data-on={on}>
      <div className="addon-head">
        <span className="ico">{icon}</span>
        <div className="t">
          <strong>{title}</strong>
          <span>{desc}</span>
        </div>
        <Switch checked={on} onChange={(v) => edit((d) => void (d.addons[k].enabled = v))} label={title} testId={`addon-${k}`} />
      </div>
      {on && <div className="addon-body">{children}</div>}
    </div>
  );
}

export function AddOnsPanel() {
  const a = useStudio((s) => s.doc!.addons);
  const set = <K extends Key>(k: K, patch: Partial<AddOns[K]>, key?: string) =>
    edit((d) => void Object.assign(d.addons[k], patch), key && `addons.${k}.${key}`);
  return (
    <>
      <h2>Add-ons</h2>
      <p className="lede">Turn your signature into a marketing tool. Every add-on works in Gmail.</p>

      <AddOn k="signOff" icon={<PenLine size={18} />} title="Sign-off" desc="A handwritten-style closing line">
        <TextField label="Text" value={a.signOff.text} onChange={(v) => set("signOff", { text: v }, "text")} />
        <Toggle
          label="Handwritten script"
          hint="Rendered as an image so it looks the same everywhere"
          checked={a.signOff.script}
          onChange={(v) => set("signOff", { script: v })}
        />
      </AddOn>

      <AddOn k="cta" icon={<MousePointerClick size={18} />} title="Call-to-action button" desc="Drive clicks to a page that matters">
        <TextField label="Button text" value={a.cta.text} onChange={(v) => set("cta", { text: v }, "text")} />
        <TextField label="Link" placeholder="Your website if left blank" value={a.cta.url} onChange={(v) => set("cta", { url: v }, "url")} />
        <Segmented
          label="Button style"
          value={a.cta.style}
          onChange={(v) => set("cta", { style: v })}
          options={[
            { value: "solid", label: "Solid" },
            { value: "pill", label: "Pill" },
            { value: "outline", label: "Outline" },
            { value: "link", label: "Link" },
          ]}
        />
      </AddOn>

      <AddOn k="meeting" icon={<CalendarDays size={18} />} title="Book a meeting" desc="Calendly, Cal.com, Google Calendar…">
        <TextField label="Button text" value={a.meeting.text} onChange={(v) => set("meeting", { text: v }, "text")} />
        <TextField label="Booking link" placeholder="calendly.com/you" value={a.meeting.url} onChange={(v) => set("meeting", { url: v }, "url")} />
      </AddOn>

      <AddOn k="banner" icon={<ImageIcon size={18} />} title="Banner" desc="Promote an event, launch or offer">
        <div className="image-slot">
          <ImageDrop
            assetId={a.banner.assetId}
            label="banner"
            style={{ width: 160, height: 70 }}
            onFile={(m) =>
              edit((d) => {
                d.assets[m.id] = m;
                d.addons.banner.assetId = m.id;
              })
            }
          />
          <span className="hint">Wide images work best (about 600 × 150).</span>
        </div>
        <TextField label="Link" placeholder="https://…" value={a.banner.url} onChange={(v) => set("banner", { url: v }, "url")} />
        <TextField label="Description" hint="for screen readers" value={a.banner.alt} onChange={(v) => set("banner", { alt: v }, "alt")} />
        <Slider label="Width" unit="px" min={200} max={600} step={10} value={a.banner.width} onChange={(v) => set("banner", { width: v }, "width")} />
      </AddOn>

      <AddOn k="video" icon={<Play size={18} />} title="Video" desc="A thumbnail with a play button">
        <div className="image-slot">
          <ImageDrop
            assetId={a.video.assetId}
            label="video thumbnail"
            style={{ width: 128, height: 72 }}
            onFile={(m) =>
              edit((d) => {
                d.assets[m.id] = m;
                d.addons.video.assetId = m.id;
              })
            }
          />
          <span className="hint">Upload a still from your video. Email can't play video, so it opens in the browser.</span>
        </div>
        <TextField label="Video link" placeholder="youtube.com/watch?v=…" value={a.video.url} onChange={(v) => set("video", { url: v }, "url")} />
        <TextField label="Title" value={a.video.title} onChange={(v) => set("video", { title: v }, "title")} />
      </AddOn>

      <AddOn k="reviews" icon={<Star size={18} />} title="Star rating" desc="Show off your reviews">
        <Slider label="Stars" min={1} max={5} value={a.reviews.rating} onChange={(v) => set("reviews", { rating: v }, "rating")} />
        <TextField label="Text" value={a.reviews.text} onChange={(v) => set("reviews", { text: v }, "text")} />
        <TextField label="Reviews link" placeholder="g.page/your-business/review" value={a.reviews.url} onChange={(v) => set("reviews", { url: v }, "url")} />
      </AddOn>

      <AddOn k="quote" icon={<Quote size={18} />} title="Quote" desc="A favourite line or your motto">
        <TextField label="Quote" multiline value={a.quote.text} onChange={(v) => set("quote", { text: v }, "text")} />
        <TextField label="Author" value={a.quote.author} onChange={(v) => set("quote", { author: v }, "author")} />
      </AddOn>

      <AddOn k="apps" icon={<Smartphone size={18} />} title="App badges" desc="App Store and Google Play">
        <TextField
          label="App Store link"
          placeholder="apps.apple.com/app/…"
          value={a.apps.appStore}
          onChange={(v) => set("apps", { appStore: v }, "appStore")}
        />
        <TextField
          label="Google Play link"
          placeholder="play.google.com/store/apps/…"
          value={a.apps.googlePlay}
          onChange={(v) => set("apps", { googlePlay: v }, "googlePlay")}
        />
      </AddOn>

      <AddOn k="disclaimer" icon={<ScrollText size={18} />} title="Disclaimer" desc="Confidentiality or legal notice">
        <TextField label="Text" multiline value={a.disclaimer.text} onChange={(v) => set("disclaimer", { text: v }, "text")} />
      </AddOn>

      <AddOn k="green" icon={<Leaf size={18} />} title="Green message" desc="A gentle eco reminder">
        <TextField label="Text" value={a.green.text} onChange={(v) => set("green", { text: v }, "text")} />
      </AddOn>
    </>
  );
}
