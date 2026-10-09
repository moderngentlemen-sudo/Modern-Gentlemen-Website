# Canva → Gmail

Signature Studio turns a design made in Canva into a Gmail signature that looks
**exactly** like the design and has working links.

## How the conversion works

1. **Export from Canva** — *Share → Download → PNG* (tick *size ×2* if offered).
   For a full email signature, design at **1200 × 400 px**; it is shown at
   600 × 200 in email, so it stays sharp on high-resolution screens.
2. **Upload** in the *Canva* tab (choose *Email signature* or *Business card*).
   - Canva exports the whole page. Empty margins (transparent, or the flat colour
     of the corners) are **trimmed automatically**; *Undo* restores them.
   - The display width is set to half the export width (max 600 px), so a 2×
     export maps pixel-for-pixel onto retina screens. A badge says whether the
     export is sharp enough.
3. **Draw clickable areas** over the phone, email, website and social icons.
   Each area links to the details you enter (website, email, phone, mobile,
   booking link, social profiles, digital card, or any custom link).
4. **Add to Gmail.** The design is cut into slices along the edges of the
   clickable areas. Each slice is a 2× image hosted on the image Worker; slices
   that sit under an area are wrapped in that link. The slices are laid out in a
   table with no gaps, so the result is visually identical to the export.
   JPEG exports stay JPEG (smaller for photographic designs); PNG keeps text and
   transparency crisp.

The copied HTML is plain tables and inline styles — the same markup the
template signatures use — so Gmail, Outlook and Apple Mail all paste it as-is.
It stays well under Gmail's 10,000-character limit (a typical design with
three links uses about a quarter).

## Options

- **Use it in replies too** — on by default for a Canva signature; off gives
  replies a short text signature instead.
- **Business card** mode adds a *front* and optional *back*, can sit under the
  text signature or replace it, and can publish an **interactive digital card**
  (flip animation, Save Contact, call/email/book buttons, QR code in the
  signature).

## What it can't do (and why)

- **Email can't run interactive code.** Gmail strips scripts and most CSS, so
  "interactive" in an email means clickable areas. Animation and Save Contact
  live on the digital card page instead.
- **Text in the design is part of the image.** That is what makes it exact.
  Recipients who block images see the alt text.
- **No direct "Connect to Canva" button yet.** Pulling designs straight from a
  Canva account needs the Canva Connect API: a Canva developer integration
  (client ID and secret, an OAuth redirect URL) and a small server to keep the
  secret. That is a planned phase 2 (D25); today it is one Download → Upload.
