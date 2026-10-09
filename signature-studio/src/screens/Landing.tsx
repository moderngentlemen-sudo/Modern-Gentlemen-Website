/**
 * Marketing landing page ("/"). Self-contained: every preview on it is a real,
 * scaled signature rendered by <Thumb>, so the page can never drift from what
 * the editor produces.
 */
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Columns3,
  CreditCard,
  Image as ImageIcon,
  LayoutTemplate,
  Mail,
  MousePointerClick,
  Phone,
  QrCode,
  Quote,
  Share2,
  Smartphone,
  Sparkles,
  Star,
  Type,
  Upload,
  UserRound,
  Wand2,
} from "lucide-react";
import { BRAND } from "../brand";
import { go } from "../router";
import { createFromTemplate } from "./Home";
import { DEFAULT_TEMPLATE, TEMPLATES, getTemplate } from "../core/templates";
import { Thumb } from "../ui/SigHtml";
import { sampleDoc } from "../ui/samples";
import "../landing.css";

const BUSINESS_COUNT = TEMPLATES.filter((t) => t.group === "Business").length;
const ARTISTIC_COUNT = TEMPLATES.length - BUSINESS_COUNT;

const SHOWCASE = [
  "corporate-classic",
  "art-swiss",
  "realestate-keys",
  "art-deco",
  "legal-counsel",
  "art-botanical",
  "tech-product",
  "art-neon",
  "beauty-salon",
  "art-editorial",
  "music-tour",
  "art-retro",
];

const NAV = [
  ["features", "Features"],
  ["templates", "Templates"],
  ["canva", "Canva"],
  ["pricing", "Pricing"],
  ["faq", "FAQ"],
] as const;

const openApp = () => go("/app");
const importCanva = () => void createFromTemplate(DEFAULT_TEMPLATE, { canva: "signature" });

function Mark() {
  return (
    <span className="lp-mark" aria-hidden="true">
      {BRAND.name.charAt(0)}
    </span>
  );
}

function SectionHead({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="lp-head">
      <p className="lp-eyebrow">{eyebrow}</p>
      <h2 id={id} className="lp-h2">
        {title}
      </h2>
      {children && <p className="lp-lede">{children}</p>}
    </div>
  );
}

function Preview({ id, width, height }: { id: string; width: number; height: number }) {
  return (
    <div className="lp-preview" style={{ width }}>
      <Thumb doc={sampleDoc(id)} width={width} height={height} />
    </div>
  );
}

const FEATURES = [
  {
    icon: Columns3,
    title: "Drag-and-drop builder",
    text: "Arrange blocks into rows and columns. Every layout becomes Gmail-safe HTML automatically, or use Quick mode's simple forms.",
  },
  {
    icon: LayoutTemplate,
    title: `${TEMPLATES.length} templates`,
    text: `${BUSINESS_COUNT} built for business sectors and ${ARTISTIC_COUNT} artistic styles, from Swiss and Bauhaus to neon and handwritten.`,
  },
  {
    icon: Upload,
    title: "Canva import",
    text: "Upload a PNG of your Canva design, mark the clickable areas, and it lands in Gmail pixel-exact with working links.",
  },
  {
    icon: CreditCard,
    title: "Digital business card",
    text: "A shareable card page with a flip animation, one-tap Save Contact, call, email and book buttons, plus a QR code in your signature.",
  },
  {
    icon: BadgeCheck,
    title: "Images that always show",
    text: "Your images are hosted and checked, so recipients see your photo and logo instead of broken boxes.",
  },
  {
    icon: Mail,
    title: "Install guides & reply signature",
    text: "Step-by-step guides for Gmail, Outlook and Apple Mail, plus a lighter signature for replies. No account needed.",
  },
];

const PALETTE = [
  [UserRound, "Name"],
  [Type, "Title"],
  [Phone, "Contacts"],
  [Share2, "Social icons"],
  [ImageIcon, "Photo & logo"],
  [MousePointerClick, "Button"],
  [Columns3, "Columns"],
  [Quote, "Quote"],
  [Star, "Star rating"],
  [Smartphone, "App badges"],
] as const;

const PLANS = [
  {
    name: "Free",
    soon: false,
    blurb: "Everything you need for one great signature.",
    items: [
      "Drag-and-drop builder & Quick mode",
      `All ${TEMPLATES.length} templates`,
      "Canva import",
      "Gmail, Outlook & Apple Mail guides",
      "Hosted, checked images",
    ],
  },
  {
    name: "Pro",
    soon: true,
    blurb: "For professionals who want more from every email.",
    items: ["Digital cards with analytics", "Multiple signatures", "Remove branding"],
  },
  {
    name: "Teams",
    soon: true,
    blurb: "One consistent look across your whole company.",
    items: ["Company-wide branded signatures", "Central management", "Google Workspace rollout"],
  },
];

const FAQ: [string, ReactNode][] = [
  [
    "Does it work with Gmail?",
    "Yes. Gmail is the main target: every layout is converted to Gmail-safe HTML, and you add it with a single copy-paste into Gmail's signature settings.",
  ],
  [
    "Do recipients see my images?",
    "Your images are hosted and checked before you install, so recipients see your photo, logo and icons rather than attachments or broken images.",
  ],
  [
    "Can I use my Canva design?",
    "Yes. Download it from Canva as a PNG, upload it, and draw clickable areas over your phone, email, website and social icons. It stays pixel-exact and the links work. Full signatures and business cards are both supported.",
  ],
  [
    "Is my data private?",
    `There's no account: your signatures are saved in your browser. Images you choose to publish are hosted at anonymous URLs so they can appear in email.`,
  ],
  [
    "Will it be free?",
    "Everything is free during early access. Later there will be a Free plan for one great signature, with Pro and Teams plans adding more. Prices haven't been set yet.",
  ],
  ["Does it work with Outlook and Apple Mail?", "Yes. There are step-by-step install guides for Outlook and Apple Mail as well as Gmail."],
];

export function Landing() {
  const year = new Date().getFullYear();

  return (
    <div className="lp">
      <a className="lp-skip" href="#lp-main">
        Skip to content
      </a>
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <a className="lp-logo" href="#top" aria-label={`${BRAND.name} home`}>
            <Mark />
            <span>{BRAND.name}</span>
          </a>
          <nav aria-label="Sections" className="lp-links">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
          <button className="btn primary sm" onClick={openApp}>
            Open the app
          </button>
        </div>
      </header>

      <main id="lp-main">
        <section className="lp-hero" id="top" aria-labelledby="lp-hero-title">
          <div className="lp-wrap lp-hero-in">
            <div className="lp-hero-copy">
              <span className="lp-pill">
                <Sparkles size={14} aria-hidden="true" /> Free during early access
              </span>
              <h1 id="lp-hero-title" className="lp-h1">
                Email signatures that make an <em>impression.</em>
              </h1>
              <p className="lp-sub">
                Design a signature or digital business card in minutes, from a template, from scratch, or from your own Canva design. Then add it to Gmail with
                one copy-paste.
              </p>
              <div className="lp-ctas">
                <button className="btn accent lp-big" onClick={openApp}>
                  Start free <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button className="btn lp-big" onClick={importCanva}>
                  <Upload size={16} aria-hidden="true" /> Import from Canva
                </button>
              </div>
              <p className="lp-note">No account needed · Works with Gmail, Outlook &amp; Apple Mail</p>
            </div>
            <div className="lp-hero-art" aria-hidden="true">
              <div className="lp-blob" />
              <div className="lp-stack lp-s1">
                <Preview id="art-editorial" width={380} height={140} />
              </div>
              <div className="lp-stack lp-s2">
                <Preview id="corporate-classic" width={440} height={176} />
              </div>
              <div className="lp-stack lp-s3">
                <Preview id="art-botanical" width={360} height={136} />
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="lp-how">
          <div className="lp-wrap">
            <SectionHead
              id="lp-how"
              eyebrow="How it works"
              title={
                <>
                  From blank to inbox in <em>three steps.</em>
                </>
              }
            />
            <ol className="lp-steps">
              {[
                ["Pick or import", `Start from one of ${TEMPLATES.length} templates, a blank canvas, or a design you made in Canva.`],
                ["Make it yours", "Add your details, photo, logo and links. Drag blocks around until it feels right."],
                ["Paste into Gmail", "Copy it with one click and paste it into Gmail's settings. Guides cover Outlook and Apple Mail too."],
              ].map(([title, text], i) => (
                <li key={title} className="lp-step">
                  <span className="lp-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-sec lp-alt" id="features" aria-labelledby="lp-features">
          <div className="lp-wrap">
            <SectionHead
              id="lp-features"
              eyebrow="Features"
              title={
                <>
                  Everything a signature <em>should</em> do.
                </>
              }
            />
            <div className="lp-grid">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <article key={title} className="lp-card">
                  <span className="lp-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="lp-builder">
          <div className="lp-wrap lp-split">
            <div>
              <SectionHead
                id="lp-builder"
                eyebrow="The builder"
                title={
                  <>
                    Drag, drop, <em>done.</em>
                  </>
                }
              >
                Name, title, contacts, social icons, photo, logo, images, buttons, dividers, columns, quotes, star ratings, video thumbnails, app badges and a
                sign-off. Drop them into rows and columns and {BRAND.name} handles the email-client quirks for you.
              </SectionHead>
              <button className="btn primary" onClick={openApp}>
                Try the builder <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="lp-builder" aria-hidden="true">
              <div className="lp-palette">
                {PALETTE.map(([Icon, label]) => (
                  <span key={label} className="lp-block">
                    <Icon size={14} /> {label}
                  </span>
                ))}
              </div>
              <div className="lp-canvas">
                <div className="lp-canvas-bar">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="lp-drop">
                  <Preview id="tech-product" width={400} height={150} />
                </div>
                <span className="lp-ghost">
                  <Wand2 size={14} /> Button
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec lp-alt" id="templates" aria-labelledby="lp-templates">
          <div className="lp-wrap">
            <SectionHead
              id="lp-templates"
              eyebrow="Templates"
              title={
                <>
                  {TEMPLATES.length} templates, <em>two moods.</em>
                </>
              }
            >
              {BUSINESS_COUNT} designed for real sectors, from law and finance to fitness and photography, and {ARTISTIC_COUNT} artistic styles for when you
              want to be remembered.
            </SectionHead>
          </div>
          <ul className="lp-strip" aria-label="Template examples">
            {SHOWCASE.map((id) => {
              const t = getTemplate(id);
              return (
                <li key={id} className="lp-tile">
                  <Preview id={id} width={300} height={130} />
                  <div className="lp-tile-meta">
                    <strong>{t.name}</strong>
                    <span className={`lp-tag${t.group === "Artistic" ? " lp-tag-art" : ""}`}>{t.group}</span>
                  </div>
                  <span className="lp-tile-cat">{t.category}</span>
                </li>
              );
            })}
          </ul>
          <div className="lp-wrap lp-center">
            <button className="btn" onClick={() => go("/app#templates")}>
              Browse all templates <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="lp-sec" id="canva" aria-labelledby="lp-canva">
          <div className="lp-wrap">
            <SectionHead
              id="lp-canva"
              eyebrow="Canva import"
              title={
                <>
                  Designed in Canva? <em>Bring it.</em>
                </>
              }
            >
              Signatures and business cards both work. Your design stays pixel-exact, and the areas you mark become real, clickable links.
            </SectionHead>
            <ol className="lp-steps lp-canva-steps">
              {[
                ["Download as PNG", "Export your design from Canva as a PNG and upload it. Empty margins are trimmed for you."],
                ["Draw clickable areas", "Drag boxes over your phone, email, website and social icons and give each one its link."],
                ["Paste into Gmail", "It goes in as the exact image you designed, with links that actually work."],
              ].map(([title, text], i) => (
                <li key={title} className="lp-step">
                  <span className="lp-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
            <div className="lp-center">
              <button className="btn accent" onClick={importCanva}>
                <Upload size={16} aria-hidden="true" /> Import from Canva
              </button>
            </div>
          </div>
        </section>

        <section className="lp-sec lp-dark" aria-labelledby="lp-card">
          <div className="lp-wrap lp-split">
            <div className="lp-phone" aria-hidden="true">
              <div className="lp-dcard">
                <span className="lp-avatar">AM</span>
                <strong>Alex Morgan</strong>
                <span>Founder, Studio North</span>
                <span className="lp-save">
                  <UserRound size={14} /> Save contact
                </span>
                <div className="lp-dacts">
                  <span>
                    <Phone size={14} /> Call
                  </span>
                  <span>
                    <Mail size={14} /> Email
                  </span>
                  <span>
                    <MousePointerClick size={14} /> Book
                  </span>
                </div>
              </div>
              <span className="lp-qr">
                <QrCode size={34} />
              </span>
            </div>
            <div>
              <SectionHead
                id="lp-card"
                eyebrow="Digital business card"
                title={
                  <>
                    A card they can <em>keep.</em>
                  </>
                }
              >
                Share a page with a flip animation and one-tap Save Contact. Call, email and booking buttons are right there, and a QR code in your signature
                leads straight to it.
              </SectionHead>
              <button className="btn accent" onClick={openApp}>
                Make your card <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="pricing" aria-labelledby="lp-pricing">
          <div className="lp-wrap">
            <SectionHead
              id="lp-pricing"
              eyebrow="Pricing"
              title={
                <>
                  Simple plans, <em>coming soon.</em>
                </>
              }
            >
              <strong>Everything is free during early access.</strong> Paid plans are planned, and prices haven't been decided.
            </SectionHead>
            <div className="lp-plans">
              {PLANS.map((p) => (
                <article key={p.name} className={`lp-plan${p.soon ? "" : " lp-plan-main"}`}>
                  <div className="lp-plan-top">
                    <h3>{p.name}</h3>
                    {p.soon ? <span className="badge">Coming soon</span> : <span className="badge lp-badge-live">Available now</span>}
                  </div>
                  <p>{p.blurb}</p>
                  <ul>
                    {p.items.map((it) => (
                      <li key={it}>{p.soon ? `Planned: ${it.charAt(0).toLowerCase()}${it.slice(1)}` : it}</li>
                    ))}
                  </ul>
                  {!p.soon && (
                    <button className="btn primary block" onClick={openApp}>
                      Start free
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec lp-alt" id="faq" aria-labelledby="lp-faq">
          <div className="lp-wrap lp-narrow">
            <SectionHead
              id="lp-faq"
              eyebrow="FAQ"
              title={
                <>
                  Good <em>questions.</em>
                </>
              }
            />
            <div className="lp-faq">
              {FAQ.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec" aria-labelledby="lp-final">
          <div className="lp-wrap">
            <div className="lp-band">
              <h2 id="lp-final" className="lp-h2">
                Your next email could <em>look this good.</em>
              </h2>
              <p>{BRAND.tagline}</p>
              <div className="lp-ctas">
                <button className="btn accent lp-big" onClick={openApp}>
                  Start free <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button className="btn lp-big" onClick={importCanva}>
                  <Upload size={16} aria-hidden="true" /> Import from Canva
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-in">
          <span className="lp-logo">
            <Mark />
            <span>{BRAND.name}</span>
          </span>
          <nav aria-label="Footer" className="lp-foot-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a
              href="/app"
              onClick={(e) => {
                e.preventDefault();
                openApp();
              }}
            >
              Open the app
            </a>
          </nav>
          <small>
            © {year} {BRAND.name}
          </small>
        </div>
      </footer>
    </div>
  );
}
