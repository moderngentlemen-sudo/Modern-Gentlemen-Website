/**
 * Live banner settings on an image block: more pictures that take over on
 * set dates, or take turns daily, after the signature is installed — and,
 * if wanted, a count of clicks (no personal data).
 */
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Block, LiveBannerItem, LiveBannerSettings } from "../core/types";
import { uid } from "../lib/id";
import { cloud } from "../cloud";
import { useAccount } from "../cloud/account";
import { edit, tree, ui } from "../store/editor";
import { findBlock } from "../core/blocks";
import { ImageDrop } from "../ui/ImageDrop";
import { Field, Segmented, Toggle } from "../ui/kit";
import { updateBlock } from "./actions";

type ImageBlock = Extract<Block, { type: "image" }>;

function setLive(id: string, fn: (l: LiveBannerSettings) => void, key?: string) {
  updateBlock(id, (x) => x.type === "image" && x.live && fn(x.live), key);
}

function ClickCounts({ slug, items }: { slug: string; items: LiveBannerItem[] }) {
  const [counts, setCounts] = useState<Record<number, number> | null>(null);
  useEffect(() => {
    let live = true;
    cloud
      ?.bannerClicks(slug, 30)
      .then((c) => live && setCounts(c))
      .catch(() => live && setCounts(null));
    return () => {
      live = false;
    };
  }, [slug]);
  if (!counts) return null;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <p className="hint" data-testid="live-clicks">
      Clicks in the last 30 days: <b>{total}</b>
      {total > 0 && ` (main picture ${counts[-1] ?? 0}${items.map((_, i) => ` · banner ${i + 1}: ${counts[i] ?? 0}`).join("")})`}
    </p>
  );
}

export function LiveBannerEditor({ b }: { b: ImageBlock }) {
  const user = useAccount((s) => s.user);
  const live = b.live;
  if (!b.assetId) return null;
  const addItem = () => setLive(b.id, (l) => void l.items.push({ id: uid("li") }));
  return (
    <div className="live-banner" data-testid="live-banner">
      <Toggle
        label="Live banner"
        hint="Swap the picture on set dates, or rotate it daily — even after your signature is installed."
        checked={!!live}
        onChange={(v) => updateBlock(b.id, (x) => x.type === "image" && void (x.live = v ? (x.live ?? { mode: "schedule", items: [] }) : undefined))}
        testId="live-toggle"
      />
      {live && (
        <>
          {cloud && !user && (
            <p className="callout" style={{ display: "block" }}>
              Live banners need an account, because they are served from it.{" "}
              <button className="btn sm" onClick={() => ui({ dialog: "account" })}>
                Sign in
              </button>{" "}
              Until then, your main picture goes out.
            </p>
          )}
          {!cloud && <p className="hint">Live banners need accounts, which aren't set up in this copy of the app. Your main picture goes out.</p>}
          <Field label="Change">
            <Segmented<LiveBannerSettings["mode"]>
              label="Live banner mode"
              value={live.mode}
              onChange={(v) => setLive(b.id, (l) => void (l.mode = v))}
              options={[
                { value: "schedule", label: "On dates" },
                { value: "rotate", label: "Rotate daily" },
              ]}
            />
          </Field>
          <p className="hint">
            {live.mode === "schedule"
              ? "Each banner shows between its dates (UTC); the newest running campaign wins. Your main picture shows the rest of the time."
              : "Banners take turns, one per day (within their dates, if set). Your main picture shows when none are running."}
          </p>
          {live.items.map((it, i) => (
            <div key={it.id} className="list-item live-item">
              <ImageDrop
                assetId={it.assetId}
                label={`banner ${i + 1}`}
                style={{ width: 84, height: 48 }}
                onFile={(m) =>
                  edit((d) => {
                    d.assets[m.id] = m;
                    const h = tree(d) && findBlock(tree(d), b.id);
                    if (h && h.block.type === "image" && h.block.live) h.block.live.items[i].assetId = m.id;
                  })
                }
              />
              <div className="live-fields">
                <input
                  className="input sm"
                  placeholder="Link for this banner"
                  aria-label={`Banner ${i + 1} link`}
                  value={it.link ?? ""}
                  onChange={(e) => setLive(b.id, (l) => void (l.items[i].link = e.target.value || undefined), `live.${it.id}.link`)}
                />
                <div className="live-dates">
                  <input
                    type="date"
                    className="input sm"
                    aria-label={`Banner ${i + 1} starts`}
                    value={it.from ?? ""}
                    onChange={(e) => setLive(b.id, (l) => void (l.items[i].from = e.target.value || undefined))}
                  />
                  <input
                    type="date"
                    className="input sm"
                    aria-label={`Banner ${i + 1} ends`}
                    value={it.to ?? ""}
                    onChange={(e) => setLive(b.id, (l) => void (l.items[i].to = e.target.value || undefined))}
                  />
                </div>
              </div>
              <button className="icon-btn sm" aria-label={`Remove banner ${i + 1}`} onClick={() => setLive(b.id, (l) => void l.items.splice(i, 1))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {live.items.length < 12 && (
            <button className="btn sm" onClick={addItem} data-testid="live-add">
              <Plus size={14} /> Add a banner
            </button>
          )}
          <Toggle
            label="Count clicks"
            hint="Counts clicks per banner. Nothing about the person clicking is recorded."
            checked={!!live.track}
            onChange={(v) => setLive(b.id, (l) => void (l.track = v || undefined))}
            testId="live-track"
          />
          {live.slug && live.track && user && <ClickCounts slug={live.slug} items={live.items} />}
          <p className="hint">
            Changes reach sent emails when you publish again (Add to Gmail). Some inboxes, Gmail included, may keep showing a picture for a while.
          </p>
        </>
      )}
    </div>
  );
}
