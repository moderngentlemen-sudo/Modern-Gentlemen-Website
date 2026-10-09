/**
 * The public digital business card. Everything comes from the link itself
 * (`?card=…`), so it works without a server or an account.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { CalendarDays, Globe, Mail, MapPin, Phone, RotateCw, Share2, Smartphone, UserPlus } from "lucide-react";
import { decodeCard, vcard, type CardData } from "../core/digitalCard";
import { PLATFORM_MAP } from "../core/social";
import { downloadFile, safeFileName } from "../lib/download";
import { mailtoHref, safeHref, telHref } from "../lib/url";
import { socialSvg, svgDataUrl } from "../render/icons";

function Action({ href, icon, label }: { href: string | null; icon: ReactNode; label: string }) {
  if (!href) return null;
  return (
    <a className="dc-action" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      {icon}
      {label}
    </a>
  );
}

export function DigitalCard({ token }: { token: string }) {
  const [data, setData] = useState<CardData | null>(null);
  const [error, setError] = useState(false);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    decodeCard(token)
      .then((d) => {
        setData(d);
        document.title = `${d.n}${d.c ? ` · ${d.c}` : ""}`;
      })
      .catch(() => setError(true));
  }, [token]);

  if (error)
    return (
      <div className="dc" style={{ "--dc-accent": "#5b4cf0" } as CSSProperties}>
        <div className="dc-inner" style={{ textAlign: "center" }}>
          <h1 className="dc-name">This card link is incomplete</h1>
          <p className="dc-title">Ask the sender for a fresh link.</p>
        </div>
      </div>
    );
  if (!data) return <div className="dc" style={{ "--dc-accent": "#5b4cf0" } as CSSProperties} />;

  const accent = /^#[0-9a-f]{6}$/i.test(data.ac ?? "") ? data.ac! : "#5b4cf0";
  const web = safeHref(data.w);
  const img = (u?: string) => (u && safeHref(u)?.startsWith("http") ? u : undefined);
  const front = img(data.f);
  const back = img(data.b);
  const photo = img(data.ph);
  const save = () => downloadFile(`${safeFileName(data.n)}.vcf`, vcard(data), "text/vcard");
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: data.n, url: location.href });
      else await navigator.clipboard.writeText(location.href);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="dc" style={{ "--dc-accent": accent } as CSSProperties}>
      <main className="dc-inner">
        {front ? (
          <div
            className={`dc-flip${flipped ? " flipped" : ""}`}
            onClick={() => setFlipped(!flipped)}
            role="button"
            tabIndex={0}
            aria-label="Flip card"
            onKeyDown={(e) => e.key === "Enter" && setFlipped(!flipped)}
          >
            <div className="dc-flip-inner">
              <div className="dc-face">
                <img src={front} alt={`${data.n}'s business card`} />
              </div>
              <div className="dc-face dc-back">
                {back ? (
                  <img src={back} alt="Back of the card" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div>
                    {photo && <img src={photo} alt="" style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto 10px" }} />}
                    <p className="dc-name" style={{ fontSize: 22 }}>
                      {data.n}
                    </p>
                    {data.t && <p className="dc-title">{data.t}</p>}
                    {data.c && <p className="dc-title">{data.c}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
        {front && (
          <p className="dc-foot" style={{ marginTop: -8 }}>
            <RotateCw size={12} style={{ verticalAlign: -2 }} /> Tap the card to flip it
          </p>
        )}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {photo && <img src={photo} alt="" width={64} height={64} style={{ borderRadius: "50%", border: `3px solid ${accent}` }} />}
          <div>
            <h1 className="dc-name">{data.n}</h1>
            {(data.t || data.c) && <p className="dc-title">{[data.t, data.c].filter(Boolean).join(" · ")}</p>}
          </div>
        </div>
        <button className="dc-save" onClick={save} data-testid="save-contact">
          <UserPlus size={18} style={{ verticalAlign: -3, marginRight: 8 }} />
          Save contact
        </button>
        <div className="dc-actions">
          <Action href={data.p ? telHref(data.p) : null} icon={<Phone size={20} />} label="Call" />
          <Action href={data.m ? telHref(data.m) : null} icon={<Smartphone size={20} />} label="Mobile" />
          <Action href={data.e ? mailtoHref(data.e) : null} icon={<Mail size={20} />} label="Email" />
          <Action href={web} icon={<Globe size={20} />} label="Website" />
          <Action href={safeHref(data.bk)} icon={<CalendarDays size={20} />} label="Book" />
          <Action
            href={data.a ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.a)}` : null}
            icon={<MapPin size={20} />}
            label="Directions"
          />
          <button className="dc-action" onClick={() => void share()}>
            <Share2 size={20} />
            Share
          </button>
        </div>
        {!!data.s?.length && (
          <div className="dc-socials">
            {data.s.map(([p, url]) => {
              const href = safeHref(url);
              const def = PLATFORM_MAP[p];
              if (!href || !def) return null;
              return (
                <a key={url} href={href} target="_blank" rel="noreferrer" aria-label={def.label} title={def.label}>
                  <img src={svgDataUrl(socialSvg(p, "plain", 40, "#ffffff"))} width={20} height={20} alt="" />
                </a>
              );
            })}
          </div>
        )}
        <p className="dc-foot">Made with Signature Studio</p>
      </main>
    </div>
  );
}
