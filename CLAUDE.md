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
1. ~~Cart and `lastOrder` are in-memory only~~ — **fixed 2026-08-30.** Cart
   is now persisted to `localStorage` (`ihc_cart` key, via `saveCart()` /
   `loadCart()`), and the in-flight order draft is stashed as
   `ihc_pendingOrder` around the Stripe redirect round-trip (see below) —
   necessary because leaving for Stripe's hosted page and coming back is a
   real navigation that wipes all in-memory JS state.
2. ~~Checkout payment step is a placeholder~~ — **replaced 2026-08-30** with
   a real Stripe Checkout (hosted, redirect) integration. See below.
3. **No backend beyond the two Netlify Functions below.** No order
   database, no confirmation emails sent by us (Stripe's own receipt email
   still fires). Order details live only in the Stripe Dashboard (via
   Checkout Session `metadata`/`customer_details`) and in the browser's
   `localStorage` until the confirmation page consumes them.
4. **Contact info is obfuscated in JS on purpose** (see below) — don't
   "simplify" this back to a static `mailto:`/`tel:` link without
   understanding why.

## Stripe integration (live as of 2026-08-30)
Business context: `indohomecollective@gmail.com`. Stripe account
`acct_1U1Kdk7RWQCVcHzg` ("indo home collective"), connected via the Stripe
MCP server (`claude mcp login stripe` — previously blocked, now done).

**Integration shape** (per `stripe_implementation_planner`): Stripe Checkout,
hosted/redirect — the simplest fit for a physical-goods, one-time-payment
store with no need for a custom in-page payment UI.

**Architecture** — since a static site can't hold a secret key, the repo now
has a small serverless backend via Netlify Functions
(`netlify/functions/`, configured in `netlify.toml`, dependency on the
`stripe` npm package declared in the root `package.json`):
- `lib/pricing.js` — **server-side pricing**, deliberately duplicated from
  the `PRODUCTS`/`computeBlindPrice()` logic in `index.html` (no build step
  to share code with the client `<script>`). `priceCartItem({id,
  blindSpec})` looks up the real price and throws on an unknown product id
  or an out-of-range blind spec. This exists so a tampered client request
  (e.g. editing the POST body in devtools) can't pay less than the real
  price — the client never sends a price, only `id` + `variant` (display
  string) + `blindSpec` (structured `{type, colour, width, drop}`, stashed
  on the cart line by `addToCart()`'s 5th param). **Known tradeoff**: two
  copies of pricing data (here and `index.html`) must be kept in sync by
  hand if prices ever change — acceptable for this catalog's size.
- `create-checkout-session.js` — `POST`, takes `{orderId, customerEmail,
  items:[{id, variant, blindSpec, quantity}]}` from `bindCheckoutEvents()`
  in `index.html`, prices each line via `lib/pricing.js`, builds AUD
  `price_data` line items, and returns `{url}` — the Checkout Session's
  hosted-page URL — which the client redirects to via
  `window.location.href`. `success_url` routes back to
  `/?session_id={CHECKOUT_SESSION_ID}#/order-confirmed/<orderId>` (the
  `session_id` has to sit in the real query string *before* the `#`, not
  inside the hash, since the app's router only looks at `location.hash`).
  `cancel_url` routes back to `#/checkout`.
- `verify-checkout-session.js` — `GET ?session_id=...`, retrieves the
  session server-side and returns `{paid, orderId, email, amountTotal}`.
  The confirmation page (`bindConfirmationEvents()`) calls this before
  showing "order confirmed" — this stops someone from faking a confirmed
  order just by visiting the URL with a made-up `session_id`.

**Checkout flow in `index.html`**: `bindCheckoutEvents()`'s place-order
handler no longer clears the cart or navigates directly to
`#/order-confirmed`. It builds the order draft, saves it to
`localStorage` (`savePendingOrder`) so it survives the trip to Stripe and
back, POSTs to `create-checkout-session`, and redirects. The cart is only
actually cleared once `bindConfirmationEvents()` has verified the returned
session as paid — if the customer cancels on Stripe's page, `cancel_url`
sends them back to `#/checkout` with their cart still intact.

**Current status**: code is deployed and working end-to-end *except* the
`STRIPE_SECRET_KEY` env var isn't set in Netlify yet, so
`create-checkout-session` currently 500s (verified this fails gracefully —
the "Place order" button shows an inline error and re-enables, cart is
preserved). To finish:
1. Get a **test-mode** secret key from
   https://dashboard.stripe.com/test/apikeys (decided to build against test
   mode first, not the live key, since this MCP session only exposed the
   account's live context).
2. Set it — from the user's own terminal, not relayed through chat —
   either via `netlify env:set STRIPE_SECRET_KEY sk_test_...` (run from
   `indo-home-collective-handoff/`, already linked to the
   `indo-home-collective` Netlify site) or via the Netlify dashboard
   (Site settings → Environment variables).
3. Redeploy (`netlify deploy --prod --dir=.`) so functions pick it up.
4. Test a full purchase with Stripe's `4242 4242 4242 4242` test card.
5. When ready to actually launch, swap in the **live** secret key the same
   way — Stripe's hosted Checkout page shows its own "test mode" banner
   automatically based on which key was used, no code change needed.

**Local testing**: the existing `indo-home-collective` launch.json config
(`python -m http.server`) only serves static files — it can't exercise the
Netlify Functions, so the checkout flow will always show the graceful
error under it. To test the full flow locally, run `netlify dev` by hand
from inside `indo-home-collective-handoff/` (it's already linked to the
Netlify site and will pick up env vars from there).

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

## Deployment
- GitHub: https://github.com/ClintJ864/indo-home-collective (public), this
  folder is its repo root (has its own `.git`, separate from the parent
  project folder which is not a git repo).
- Netlify: site `indo-home-collective`, live at
  https://indo-home-collective.netlify.app. Created and deployed via
  Netlify CLI (`netlify sites:create` + `netlify deploy --prod --dir=.`),
  **not** yet connected to GitHub for auto-deploy-on-push — pushes to
  GitHub currently do nothing to the live site; redeploy manually with
  `netlify deploy --prod --dir=.` from this folder after pushing, or wire
  up continuous deployment later via the Netlify dashboard (Site
  configuration → Build & deploy → Link repository) if that's wanted.
- Netlify's account-wide "Team protection" login wall was on by default
  and was turned off for this specific site only (`sso_login: false` via
  `netlify api updateSite`) so the shop is publicly visible — other sites
  on the team are unaffected.

## Suggested next steps in Claude Code
- [x] Bring in the blind order form Excel sheet and wire up real
      per-size/type/colour pricing for the Blinds product
- [x] Cart persistence across refresh (`localStorage`, see above)
- [x] Deploy to GitHub + Netlify (see above)
- [x] Wire up Stripe Checkout (see Stripe integration section) — just
      needs `STRIPE_SECRET_KEY` set in Netlify to go live, see steps above
- [ ] Swap placeholder icons for real product photography as it becomes
      available
- [ ] Confirm/adjust Decor pricing and dimensions (currently placeholders)
- [ ] Add real domain (currently the default `.netlify.app` subdomain)
