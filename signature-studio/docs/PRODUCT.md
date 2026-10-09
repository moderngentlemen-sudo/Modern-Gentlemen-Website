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
- **60 templates.** 30 for business sectors and 30 artistic.

### Phase 2 — Accounts and cloud (next)

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

Everything is free during early access. The landing page says so, and it shows Pro and Teams as "Coming soon" with no prices.

## Before a public launch

- Privacy policy and terms.
- A custom domain.
- Error monitoring.
- Rate limits and abuse protection on image uploads.
- A security review of the Worker and the Supabase policies.
- Accessibility pass. The landing page is already keyboard- and screen-reader-labelled.
