# Meridian Pharmacy — demo

A Foxquart demo property. Domain: `pharmacy-demo.foxquart.com`.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Zustand.
**No database for the product.** All pharmacy state is mock data in a Zustand store
persisted to `localStorage`. The only real backend call is the contact form.

## What this site is

Two audiences, two surfaces, and they must not blur into each other:

- **`/` (marketing)** is **the shop's own storefront** — Meridian Pharmacy, Indiranagar,
  Bengaluru. What it stocks, where it is, when it opens, why people trust it. It is
  written for a customer looking for a chemist near them. It is **not** a pitch for
  billing software.
- **`/pos`, `/inventory`, `/payments`, `/reports`, `/settings`** are the **counter tool**
  the shop runs behind that storefront. Dense, keyboard-first, motion near zero.
- **`/contact`** reaches **Foxquart**, not the pharmacy. It is for a business owner who
  sees the demo and wants one built. The pharmacy's own contact details (phone, address,
  hours) sit inline on the storefront, with no form in the way.

## Non-negotiable conventions

### Money
- Every monetary value is an **integer count of paise**. Field names end in `Paise`. `₹485.00 === 48500`.
- Floats are banned for money. `0.1 + 0.2 !== 0.3`, and a pharmacy losing a paise per line loses real money by close of day.
- Every rate is **basis points**. `1200 === 12.00%`. Field names end in `Bps`.
- Indian retail MRP is **tax-inclusive**. Extract GST from the gross with `extractInclusiveTax` — never add it on top.
- All arithmetic goes through `lib/domain/money.ts`. Do not hand-roll it at a call site.

### Stock
- Stock lives on `Batch`, never on `Medicine`. Two lots of the same medicine legitimately differ in MRP, cost and expiry.
- `StockMovement` is an append-only ledger. `Batch.quantity` is a cache of it and the two must always agree.
- Sales pick batches **FEFO** (first-expiry-first-out), never FIFO.
- Expired batches are never sellable, and are excluded from on-hand totals.

### Payments
- The settlement path is idempotent. `Bill.stockCommitted` is checked **before** any stock moves; a replayed event is recorded and ignored.
- The gateway takes its cut from what it **captures**, not from what the shop wants to receive. Naively adding 2% leaves the shop short. Solve `C = T / (1 − R)`. See `computeFees`.
- `buildUpiUri` emits a real NPCI-spec `upi://pay` deep link. Only the settlement confirmation is simulated.

### Typography
- **Lexend** for everything readable, **JetBrains Mono** for numerals only.
- Lexend ships no tabular figures, so every number that sits in a column — money,
  quantity, batch code, phone, date — takes the global `.numeric` class, which switches
  it to the mono face with tabular figures.
- **Banned: the `font-mono` + `uppercase` + wide-`tracking` micro-label treatment.**
  No small-caps mono eyebrows, no wide-tracked uppercase notes. Plain Lexend, sentence
  case, normal tracking.

### Styling
- **Only semantic token classes.** `bg-surface`, `text-text-secondary`, `border-border`, `bg-danger-subtle`, `text-success-text`.
- Raw palette colours are banned: no `bg-white`, `text-gray-900`, `border-slate-200`, `bg-blue-600`. One of them breaks dark mode.
- Tokens are defined once in `app/globals.css`. Light is the primary state; `.dark` remaps the same names.
- Semantic colours are reserved and never decorative: `success` = money in / in stock, `warning` = expiring / low, `danger` = expired / out, `brand` = navigation and primary actions.
- One radius scale (`--radius-sm|md|lg|xl`). No gradients, no glows, no `transition-all`, no emoji.
- Numbers use tabular figures. They sit in columns and must not jitter as they tick.

### Motion — two budgets, by surface

**App surfaces** (`/pos`, `/inventory`, …) run at a deliberately tiny budget: 120–200ms,
`transform`/`opacity`/`color` only, custom easing tokens only. Motion is feedback, never
decoration. Someone is billing a queue.

**The marketing page runs at a much larger budget, on purpose.** It is the showpiece and
the craft bar is Awwwards-level. It gets:
- Lenis weighted smooth scroll (`components/motion/smooth-scroll.tsx`)
- GSAP + ScrollTrigger for pinning, scrubbing and parallax
- A once-per-session intro loader carrying the Foxquart lockup
- Soft brand-toned atmospheric auras and depth

Rules that still bind on BOTH surfaces:
- Animate only `transform`, `opacity`, `clip-path`. Never `width`/`height`/`top`/`left`.
- Every GSAP timeline goes through `useGsap` so it is scoped and reverted. A bare
  `gsap.to` in `useEffect` double-fires under StrictMode and leaks ScrollTriggers.
- `window.addEventListener("scroll")` is banned. Use ScrollTrigger or IntersectionObserver.
- Custom easing only. `ease`, `ease-in`, `ease-out`, `linear` are banned, except
  `ease: "none"` on scrub-driven tweens, where it is required.
- **Everything degrades under `prefers-reduced-motion`**: no loader, no smooth scroll,
  no pin, no scrub. Content resolves to its final state and stays reachable.
- 60fps is the bar. If an effect cannot hold it, cut it.

### Gradients and auras — surface-scoped exception
The no-gradient / no-glow rule holds absolutely on **app surfaces**. On the **marketing
page** soft brand-toned auras and atmospheric depth are permitted and wanted. They must
stay ink-teal / warm neutral: no purple-to-blue AI gradient, no neon, no rainbow. Grain
belongs on a `fixed`, `pointer-events-none` overlay, never on a scrolling container.

### Interaction
- The app is **keyboard-first**. A pharmacist billing a queue should never need the mouse. Shortcuts are shown with `<Kbd>`, never hidden.
- Hardware barcode scanners are HID keyboards. `useBarcodeScanner` captures them globally by keystroke cadence, so a scan works without clicking into a field first.
- Icon-only buttons require `aria-label`. Focus is global in `globals.css` and must not be overridden.

## Layout
```
app/(marketing)/     the shop's storefront — art-directed, higher motion budget
app/(marketing)/contact/  Foxquart enquiry form -> Neon `contact_submissions`
app/(app)/           the counter tool — dense, calm, keyboard-first
app/api/contact/     the only real backend route in the project
components/ui/       design-system primitives (tokens only)
components/marketing/
lib/domain/          types, money math, selectors, seed data
lib/store/           Zustand store — the single source of truth
lib/hooks/           barcode scanner, hotkeys
lib/foxquart/        Neon client + contact schema, shared with foxquart.com
scripts/db/          optional additive migration for lead attribution
```

## Branding
- Favicon and app icons are the **Foxquart** mark.
- `--foxquart` tokens exist for attribution chrome **only** (the "Built by Foxquart"
  lockup). Foxquart orange is never a product accent: it sits in the same hue band as
  the `warning` token, and in a pharmacy "expiring soon" must never be confusable with
  brand furniture.

## Commands
```
pnpm dev       # http://localhost:3000
pnpm build
npx tsc --noEmit
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
