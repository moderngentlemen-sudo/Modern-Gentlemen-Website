# Product plan

The owner decided on 2026-10-09 to take Signature Studio towards a product. These are the choices they made:

- **Build first:** the drag-and-drop builder and a redesign.
- **Backend for accounts:** a **new** Supabase project, kept separate from the Modern Gentlemen website's database.
- **Business model:** **Free + Pro + Teams**.
- **Name:** a new one, picked from the shortlist below.

## Name shortlist

`Signet` is the working title in `src/brand.ts`. Renaming the product means changing that file and the `<title>` in `index.html`.

| Name | Why it fits | Watch out for |
|---|---|---|
| **Signet** | A signet ring sealed and signed letters. Short and premium. | A common word, used by other companies (e.g. jewellery, banking), so the plain .com is unlikely to be free. |
| **Endmark** | The mark at the end of a piece of writing, just as your signature closes an email. | Less self-explanatory. |
| **Cachet** | A seal of approval, and prestige. | Hard to spell and pronounce for some. |
| **Sendoff** | Friendly, and close to "sign-off". | Feels more casual than premium. |
| **Inkline** | Ink plus a signature line. Easy to say. | Generic-sounding. |

None of these names has been checked for trademarks or domains. Do that before you choose (USPTO/CIPO/EUIPO searches and a registrar).

## Roadmap

### Phase 1 — Builder and redesign (this release)

- **Drag-and-drop builder.**
  - Layouts are rows of columns of blocks. That is what email tables can express, so whatever you build stays Gmail-safe.
  - 25 kinds of block are available from a palette: drag them in, or tap to add.
  - Editing tools: layers, an inspector with per-block style and panels, visibility per version (new emails, replies or both), keyboard shortcuts and undo.
  - Pointer events make it work with touch on an iPad.
  - Any template opens in the builder as a starting layout. Quick mode is kept for people who prefer forms.
- **New visual identity.** Warm paper, ink and a signal-coral accent, with Instrument Serif and Geist fonts.
- **Marketing site at `/`.** The app lives at `/app`, and the editor at `/app/s/<id>`.
- **Brand kit.** Colours, fonts, logo, company and website. It applies to new signatures, and template previews can be shown in your brand.
- **60 templates.** 30 for business sectors and 30 artistic (82 since Phase 1c).

### Phase 1b — Quality of life (built)

- Canvas tools:
  - Resize handles that snap to matching sizes. Hold Alt to resize freely.
  - Column edges you drag, snapping to even splits and to the neighbouring column.
  - A drag grip, canvas zoom, and text you edit right on the canvas (double-click).
  - Copy and paste, and layers with hide/show and move up/down.
- New blocks: QR code, logo row, icon line and tag, plus six ready-made combinations.
- Zoom & crop with frame shapes for the photo, the logo and image blocks.
- An overall-size control for the whole signature.
- A saved profile shared by linked signatures.
- **Live checks** for email typos, numbers phones can't dial, broken links, unreadable colours, small text, missing image descriptions and logos that vanish in dark mode. Each one has a "Fix" button, and a size meter shows the Gmail character budget.
- **Quick start**: three questions, then three designs made with your details. You can paste your old signature or import a contact card (.vcf).
- **My templates**: save any design without your personal details, and reuse it.
- **Exports**: a PNG image, and a print sheet for business cards with crop marks (save it as a PDF). HTML is in the install dialog.

### Phase 1c — Power features (built)

- **Text links and hover text:**
  - Link selected words with ⌘K. Text, name, title and detail blocks can also link as a whole.
  - Tooltips on links and images. Gmail strips hover styles, so real hover effects live on the digital card page.
- **Multi-select** with group styling, plus drop-beside with a vertical guide.
- **Version history:** named snapshots per signature. Restore is undoable and keeps an automatic copy of what it replaced.
- **Reply layouts:** compact, same design, or a separate builder layout.
- **Installable offline app (PWA).**
- **Seasonal library:** 14 banners and ready-made sign-offs.
- **Right-to-left signatures.**
- **22 new templates:** 12 Modern and 10 inspired by the Modern Gentlemen website (82 in total).

### Ideas not yet built (no accounts needed)

- Smart alignment guides between blocks in different columns (today: snapping on resize, column edges, and drop indicators).
- Template previews in right-to-left.
- More banner artwork (photo-based), and per-banner date reminders ("swap your holiday banner on Jan 2").

### Phase 2 — Accounts and cloud (in progress)

**Built (code, tested; goes live once the Signet Supabase project exists — see `supabase/README.md`):**

- Sign-in with an emailed link or Google. Accounts are optional; without them the app is local-only.
- Cloud sync of signatures, their images, saved profile, brand kit, my templates and favourites, with conflict-safe merging.
- Per-user image hosting, which replaces the shared upload key for signed-in users.
- Short digital-card links (`/c/<slug>`) that update when the signature does.
- Delete account.
- The database schema with row-level security, tested on a local Postgres in CI.

**Still to do in Phase 2:** one-click Gmail install (needs Google verification), "Send me a test", wallet passes and lead capture. Live banners (scheduled or rotating) and opt-in click counts shipped in audit Batch 5, along with in-browser background removal, text styles, brand fonts and AI design suggestions (the last needs an Anthropic API key set on the server).

**Original plan:**

- **A separate Supabase project.** It never touches the website's production database.
  - Auth: magic link, plus Google sign-in.
  - Tables: `profiles`, `signatures` (the document as JSON), `brand_kits`, `cards`.
  - A storage bucket for images, protected by row-level security.
- **Per-user image hosting.** This replaces the single shared upload key, and is the main blocker to opening the product to the public.
- **Cloud sync** across devices. Today's browser storage stays as an offline cache.
- **Short digital-card links** (`/c/<slug>`) that update when the user edits the card, unlike today's links, which carry the data inside them.
- **One-click "Install to Gmail".**
  - Uses Gmail API `users.settings.sendAs.update` with the `gmail.settings.basic` scope.
  - That is a *sensitive* scope, so Google requires OAuth app verification: a privacy policy, a demo video and a security review. Plan on weeks.
- **Live banners**: the image's link stays the same while you change the picture behind it, so one change updates every installed signature. A strong Pro feature.
- **"Send me a test"**: emails the signature to yourself, to check it in a real inbox.
- **Digital-card extras**: Apple Wallet and Google Wallet, a "share your contact back" form that collects leads, and writing the card to an NFC tag on Android.
- **Optional click analytics** through redirect links. Off by default and disclosed.

### Phase 3 — Teams and paid plans

- **Team workspaces.** Admins lock brand templates, invite members, and bulk-create signatures from a CSV.
- **Google Workspace rollout.** Domain-wide delegation, so admins can set everyone's signature.
- **Canva Connect API.** Import designs straight from a Canva account. Needs a Canva developer integration and a server to hold its secret.
- **Billing through Stripe.** Built only after the owner explicitly authorises it. The plan entitlements below decide what each tier unlocks.

## Plans (no prices yet)

| | Free | Pro | Teams |
|---|---|---|---|
| Builder, templates, Canva import, Gmail install | ✓ | ✓ | ✓ |
| Signatures | 1 (planned) | Unlimited | Unlimited |
| Digital card, analytics, remove "Made with" link | — | ✓ | ✓ |
| Shared brand templates, admin rollout, bulk create | — | — | ✓ |

The "Made with Signet" link is already built (D34).

- **Where it appears:** a small, muted line under new-email signatures, never in replies. It links to `BRAND.url` with `?ref=signature`, so visits it brings in can be counted.
- **Turning it off:** a switch in Design (and in the builder's signature settings). During early access anyone can use it. Once billing exists, `src/core/plans.ts` makes it a Pro feature.
- **Gmail's limit:** the renderer drops the link rather than push a signature past 10,000 characters.

Ads were considered and rejected. Ads in signatures would hurt users' professional image and email deliverability, and in-app ads would earn little because people visit rarely.

Everything is free during early access. The landing page says so, and it shows Pro and Teams as "Coming soon" with no prices.

## Before a public launch

- Privacy policy and terms.
- A custom domain.
- Error monitoring.
- Rate limits and abuse protection on image uploads.
- A security review of the Worker and the Supabase policies.
- Accessibility pass. The landing page is already keyboard- and screen-reader-labelled.
