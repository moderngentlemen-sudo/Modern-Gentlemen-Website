# Modern Gentlemen — Website Build

This repository is a **build-ready handoff**. The goal is a **1:1, pixel-perfect replica** of the Modern Gentlemen design (a men's editorial + lifestyle brand: style, grooming, watches, culture, film, plus a store), built as a real website and **hosted on Railway**.

If you are the engineer (or the next Claude Code session) picking this up: **read this file, then `EXECUTION_PLAN.md`, then start building.** Everything you need is in this repo.

> **📍 Current status (Milestones 1–2 done, live on Railway).** The homepage + shared chrome and the full store flow (Shop → Product → Bag → Checkout) are built to pixel fidelity and deployed on demo data. **If you're resuming in a new session, start from the "Current Status & Session Handoff" section at the very top of [`PROGRESS.md`](PROGRESS.md)** — it lists exactly what's done, the patterns/files to reuse, the setup/deploy gotchas already fixed, and the next steps. Work continues on branch `claude/project-setup-docs-xfx8td`.

---

## The one rule

> **Match the design exactly. No reinterpretation, no "improvements," no simplification.**
> If something looks non-standard (unusual spacing, sharp corners, a specific font size), it is intentional — build it as designed. When in doubt, the design files and screenshots win.

---

## What's in this repo

```
README.md                          ← you are here (start)
EXECUTION_PLAN.md                  ← the step-by-step build plan (read this next)
PROGRESS.md                        ← living checklist — update it as you build
RAILWAY_DEPLOYMENT.md              ← how to host it on Railway

design_handoff_modern_gentlemen/   ← the complete design handoff bundle
├── CLAUDE.md                      ← authoritative design baseline (tokens, rules) — read every session
├── IMPLEMENTATION_BRIEF.md        ← the "build exactly this" brief + screenshot manifest
├── VERIFICATION_REPORT.md         ← what's fully specified vs. ambiguous, and how to handle it
├── 01_ARCHITECTURE.md … 05_SECTION_BUILDER.md   ← detailed specs
├── 06_SUPABASE.md                 ← DATA LAYER: Supabase (everything) + Stripe — the authoritative backend spec
├── MODULE_MAP.md                  ← Section Library module → React block mapping
├── design-tokens.json             ← machine-readable colors/fonts/spacing
├── design_files/                  ← the HIGH-FIDELITY PROTOTYPES (*.dc.html) = structure/copy source of truth
│                                     + mg-catalog.js, mg-bag.js (reusable data/logic)
│                                     + mg-logo.svg, mg-logo-wide.svg (brand marks)
├── handoff/screenshots/           ← 28 RENDERED SCREENSHOTS = visual ground truth (never delete)
├── starter/                       ← the runnable Next.js + React + Tailwind app — BUILD HERE
└── reference_chats/               ← the original design conversations ("where the intent lives")
```

**The app you build/extend lives in `design_handoff_modern_gentlemen/starter/`.** It is already scaffolded (design tokens, chrome components, section blocks, all page routes, the product catalog, and a working local cart). Your job is to bring every page up to pixel-perfect fidelity against the screenshots and prototypes.

---

## Source of truth — in priority order

When two sources disagree, the higher one wins:

1. **`design_handoff_modern_gentlemen/handoff/screenshots/*.png`** — the rendered look. This is ground truth.
2. **`design_handoff_modern_gentlemen/design_files/*.dc.html`** — the prototypes. Recreate structure, layout, and **exact copy** from the code here (not by eyeballing the PNG).
3. **`CLAUDE.md` + `design-tokens.json`** — the exact colors, fonts, spacing, motion.
4. **`01`–`05` + `MODULE_MAP.md`** — architecture, per-page specs, chrome, section builder.
5. **`starter/`** — the scaffold that already wires 1–4 together.

> ⚠️ The `.dc.html` files run on a small prototype engine (`support.js`, `image-slot.js`, `dc-import`, `sc-if`). That engine is a **design tool only — do NOT port it.** Reproduce the *visible result*, not the prototype's internal plumbing. Only `mg-catalog.js` and `mg-bag.js` carry real logic worth porting (already done in `starter/lib/`).

---

## Run it locally (2 minutes)

```bash
cd design_handoff_modern_gentlemen/starter
npm install
npm run dev          # → http://localhost:3000
```
It boots immediately on built-in demo data — no CMS, no accounts, no keys needed.

## Deploy it

See **`RAILWAY_DEPLOYMENT.md`**. Short version: point a Railway service at this repo, set the **Root Directory** to `design_handoff_modern_gentlemen/starter`, and Railway builds and runs it. No environment variables are required for v1.

---

## Stack (decided)

- **Next.js (App Router) + React + TypeScript + Tailwind CSS** — already set up in `starter/`.
- **Backend: Supabase (everything)** — content, products, users/members, orders, newsletter, cart sync, and image storage all live in one Supabase (Postgres) project. **This replaces Sanity and Shopify.** Full spec: **`design_handoff_modern_gentlemen/06_SUPABASE.md`** (schema + seed + client stubs already scaffolded in `starter/supabase/` and `starter/lib/supabase/`).
- **Payments: Stripe** — real checkout; a Stripe webhook writes paid orders into Supabase.
- **Hosting: Railway** (the Next.js app). Supabase is a separate managed service the app connects to.

**Build order still matters:** get every page **pixel-perfect on demo data first** (no backend needed — it runs today), then swap the data source to Supabase behind the seams already in the code (`SectionRenderer` `Block[]`, `lib/cart` `CartApi`, `lib/queries.ts`). The two tracks don't block each other.

---

## How to know you're done

For **every** screen: build it from the `.dc.html`, run it, screenshot your output, and compare side-by-side to the matching file in `handoff/screenshots/`. Fix every visible difference (spacing, alignment, color, type, proportion) before moving on. Track it in `PROGRESS.md`. Full checklist and per-page acceptance criteria are in `EXECUTION_PLAN.md`.
