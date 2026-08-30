# Indo Home Collective — Project Brief

Bali-inspired homewares and custom timber slat blinds. This is a single-file
HTML/CSS/JS e-commerce demo, built and iterated in Claude.ai chat, now handed
off here for backend/payment integration and deployment.

## Files
- `index.html` — the entire site (HTML + CSS + JS, no build step)
- `assets/logo.jpg`, `assets/icon.jpg`, `assets/hero-bg.jpg` — brand images
  (these were originally saved with a `.png` extension but are actually JPEG
  data; they've been renamed correctly here — if you re-export from the
  original Gemini-generated source files, keep them as JPEG or convert to a
  real transparent PNG if you want the logo/icon to sit on non-white
  backgrounds without a visible white box)

## Stack
Plain HTML/CSS/JS. No framework, no build step, no dependencies. Routing is a
minimal hash-based router (`#/shop`, `#/product/:id`, `#/cart`, `#/checkout`,
`#/order-confirmed/:id`, `#/about`, `#/ordering`) implemented in the inline
`<script>` at the bottom of `index.html`.

## Brand system
- Colors: Moss Green `#3D5C3B`, Sandy Beige `#EAE0D3`, Charcoal `#333333`,
  Aqua Blue `#72D3D8`, Warm Tan `#C7B194`, cream page background `#FBF9F5`
- Fonts: system fonts only, no Google Fonts (switched for data efficiency —
  Google Fonts added an external DNS lookup + render-blocking webfont
  downloads, working against the "minimize mobile data" goal in the project
  brief). Headings/`.brand-font`/`.serif`/`.eyebrow` use `Georgia, 'Times New
  Roman', serif`; body/UI uses the system sans stack (`-apple-system,
  BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`).
- Hand-drawn line icons (moss green SVG, defined inline in the `icon()`
  function) stand in for product photography until real photos are ready

## Product data model
All products live in the `PRODUCTS` array near the top of the `<script>`
block. Each product has `id`, `name`, `category`, `icon`, `desc`, and either:
- `price` + `unit` (+ optional `priceLabel` like "From") for purchasable items
- `comingSoon: true` for placeholder categories (see below)

Other products use `price` + `unit` directly. **Blinds is the exception**:
it has `customBlind:true` instead of `finishOptions`, and is priced live from
`BLIND_WIDTHS` / `BLIND_DROPS` / `BLIND_COLOURS` / `BLIND_DISCOUNT_PCT` /
`computeBlindPrice()` (defined just above the `STATE` section in the
`<script>` block). Its detail page is a separate `renderBlindDetail()` /
`bindBlindDetailEvents()` pair, not the generic finish-chip flow. Cart lines
for blinds carry an explicit `price` field (see `lineUnitPrice()`) that
overrides the product's flat `price` — this is what lets one product have a
different price per cart line depending on type/colour/size.

## Category status (updated 2026-08-10)
Categories were reorganized so it's visually obvious what's actually for
sale — the "All" filter chip was removed (default filter is now `Blinds`,
the primary sellable category) and every `comingSoon:true` product now
renders greyscale with a diagonal "Not yet for sale" watermark (`.watermark`
CSS class, applied via `is-coming-soon` on `.product-photo`/`.detail-photo`
and `.product-card`) instead of just a small badge — see `renderShop()` and
the `comingSoon` branch of `renderProductDetail()` in `index.html`. Watermark
opacity was tuned down (`rgba(51,51,51,0.28)`) after initial feedback that it
read too heavy/bold.

The filter chips themselves are also muted grey (`.chip-coming-soon`) for
categories with **no near-term sale plans** — this is a deliberate,
hand-maintained list (`CHIP_MUTED_CATEGORIES` in `index.html`, currently
`['Lighting', 'Mirrors', 'Furniture']`), not automatically derived from
`comingSoon`. **Floating Pool Trays is intentionally excluded** even though
its one product is still `comingSoon:true` — the client is actively adding
a real item to sell there, so the chip stays normal/active-colored while the
product card still shows the coming-soon watermark until that item lands.
When adding the real Floating Pool Trays product, just clear its
`comingSoon` flag — no chip-list change needed.

- **Blinds** — the one real, purchasable product, and fully priced.
  Pricing was sourced from the client's `Blind order form.xlsx`
  (`../Blind order form.xlsx`, one level up from this folder): base price =
  `width_cm × drop_cm / 100`, a bulk discount kicks in once that base price
  hits $400 (25% off Timber, 30% off Bamboo), and shipping is a flat $50 per
  blind unit. Colours are Natural Wood/White/Black (Timber) or
  Natural/White/Black (Bamboo). See `computeBlindPrice()` in `index.html`
  for the exact formula, and the standalone
  [Blind Order Calculator artifact](https://claude.ai/code/artifact/a51dc46d-63e9-47df-833f-38c6fcb0ace0)
  for a share-able version of the same calculator outside the site.
- **Wooden Bowls & Leather Goods** (renamed from "Decor") — four real
  placeholder products: Wooden Bowl Small (150mm diameter), Wooden Bowl
  Large (250mm diameter), Leather Notebook, Leather Coasters (pack of 4).
  **Prices and dimensions are placeholders** the client invented for demo
  purposes — confirm real numbers before launch. Renamed because these are
  the actual sellable items in this category, not generic "decor."
- **Lighting, Mirrors, Furniture** — each has exactly one `comingSoon: true`
  placeholder product, now shown greyed-out/watermarked (see above). Detail
  page shows a message + link back to shop instead of cart controls.
- **Floating Pool Trays** (renamed from "Textiles") — one `comingSoon: true`
  placeholder product (`floating-pool-tray`, new `pooltray` icon in the
  `icon()` function), same greyed-out treatment as Lighting/Mirrors/
  Furniture. Renamed because the client's actual planned product for this
  slot is floating pool trays, not textiles/linens.

## Pages — status
| Page | Route | Notes |
|---|---|---|
| Shop / product grid | `#/shop` | Category filter chips, hero, value strip |
| Product detail | `#/product/:id` | Finish selector (blinds only), live subtotal, "already in cart" note, related products, coming-soon variant |
| Cart | `#/cart` | Per-line remove/qty, sticky order summary, empty state |
| Checkout | `#/checkout` | Inline field validation, order notes field, payment step is a **visual placeholder only** |
| Order confirmation | `#/order-confirmed/:id` | Shows real order snapshot (captured in `lastOrder` before cart clears) — custom-blind lead-time callout if applicable |
| About | `#/about` | Static copy, no changes pending |
| Ordering | `#/ordering` | 4-step DM/quote/invoice/build explainer |

## Currency
All prices are AUD, shown via `money()` (`index.html`) as `A$`-prefixed
(e.g. `A$75`), not a bare `$`. Keep this prefix — it matches the project
brief's "pricing defaults strictly to AUD" requirement and will matter once
real Stripe Checkout needs an explicit currency code.

## Responsive navigation
Top header nav (`nav.main-nav`) is desktop-only, hidden below 860px. Below
that width, `<nav class="bottom-nav" id="bottomNav">` (fixed to the viewport
bottom, right after `</header>` in the markup) takes over with four tabs:
Shop, Ordering, About, Cart — each with an inline SVG icon matching the
site's line-icon style. `setActiveNav()` drives the active-state highlight
on both `#mainNav a` and `#bottomNav a` by `data-route`; `updateCartCount()`
writes the cart badge to both `#cartCount` (header) and `#cartCountMobile`
(bottom nav). If you add a new top-level route, wire it into both navs and
into the `render()` route table's `setActiveNav(...)` calls.

## Known limitations / next steps
1. **Cart and `lastOrder` are in-memory only** — everything resets on page
   refresh. No `localStorage`/`sessionStorage` is used anywhere (this was a
   constraint of the chat preview environment, not a deliberate design
   choice — feel free to add persistence here in Claude Code).
2. **Checkout payment step is a placeholder.** No real card processing yet —
   Stripe integration is in progress (see below). Fields map cleanly onto
   what Stripe Checkout expects. The `payment-note` div in `renderCheckout()`
   explicitly tells the user this is demo mode.
3. **No backend at all.** Placing an order just clears the cart and shows a
   confirmation — nothing is persisted, emailed, or sent anywhere.
4. **Contact info is obfuscated in JS on purpose** (see below) — don't
   "simplify" this back to a static `mailto:`/`tel:` link without
   understanding why.

## Stripe integration (in progress)
Business context: `indohomecollective@gmail.com`, needs **Payments** and
**Invoicing** products. Setup so far, done from the project root (one level
up from this folder):
- Stripe Claude Code plugin installed (`stripe@claude-plugins-official`,
  required adding the `anthropics/claude-plugins-official` marketplace first
  — it wasn't pre-registered in this environment).
- Stripe MCP server added: `claude mcp add --transport http stripe
  https://mcp.stripe.com`.
- **Blocked on**: `claude mcp login stripe` — this needs an interactive
  terminal with browser access to complete the OAuth consent flow, so it
  can't be run from an agent's non-interactive shell. The user needs to run
  this themselves, then the `stripe_implementation_planner` tool becomes
  available to generate a tailored integration plan.
- Once connected: generate the plan via `stripe_implementation_planner`,
  then wire real Stripe Checkout/Payment Intents into `renderCheckout()`
  and `bindCheckoutEvents()`, replacing the fake-card-row placeholder. This
  will need a small backend (or a hosted Stripe Checkout redirect) since a
  static-HTML site can't hold a secret key.

## Contact info handling (intentional — read before touching)
Email, phone, and social links are NOT present as plain text anywhere in the
static HTML (search `index.html` for the address and you won't find it). They
are built at runtime by `initContactLinks()` (JS, near the top of the
`<script>` block) and injected into empty `<p id="footerEmail">` /
`<p id="footerPhone">` placeholders in the footer. This is a lightweight
anti-scraping measure — it stops naive bots that regex raw page source for
`mailto:`/`tel:` patterns, without hiding anything from real visitors. Current
values:
- Email: `indohomecollective@gmail.com`
- Phone: `+61 410 495 924` (E.164 `+61410495924` for the `tel:` link)
- Instagram: `https://www.instagram.com/indohomecollective`
- Facebook: `https://www.facebook.com/profile.php?id=61589068032578`

If you add more contact touchpoints elsewhere on the site, route them through
the same `contactEmail()` / `contactPhoneDisplay()` / `contactPhoneTel()`
helpers rather than hardcoding the address again.

## Suggested next steps in Claude Code
- [x] Bring in the blind order form Excel sheet and wire up real
      per-size/type/colour pricing for the Blinds product
- [ ] Finish Stripe integration — user needs to run `claude mcp login stripe`
      in their own interactive terminal, then resume with
      `stripe_implementation_planner` and wire up `renderCheckout()`
- [ ] Swap placeholder icons for real product photography as it becomes
      available
- [ ] Confirm/adjust Decor pricing and dimensions (currently placeholders)
- [ ] Decide on a persistence layer (backend, or at minimum cart
      persistence across refresh)
- [ ] Add real domain + hosting once tested
