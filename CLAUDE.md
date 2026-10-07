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

## 2026-09-13 changes: Timber-only blinds, save/email a quote, push alerts

**1. Bamboo removed — Timber is the only blind type.** In `index.html`:
the `PRODUCTS` blind entry, `BLIND_COLOURS`, `BLIND_DISCOUNT_PCT` all lost
their `Bamboo` key/values; the "Blind type" chip selector was deleted from
`renderBlindDetail()`/`bindBlindDetailEvents()` entirely (nothing to choose
with one option); the add-to-cart variant label dropped its now-redundant
`Timber ·` prefix. Mirrored in `netlify/functions/lib/pricing.js` (same
keys removed) — its `priceCartItem()` now throws "Invalid blind type" if a
stale `Bamboo` spec somehow reaches checkout (e.g. an old cart in someone's
`localStorage` from before this change), which is the correct/safe
behaviour, not a bug.

**2. "Save / email a quote" from the cart** (`#/quote` route). Lets a
customer get a printable copy of their cart and send the same summary to
the business for confirmation. New functions in `index.html`:
`buildQuoteSummaryText()` (plain-text breakdown, reused for the emailed
field), `renderQuotePage()`, `bindQuoteEvents()`. "Save" is a real browser
Print → Save as PDF of the on-page summary (`.quote-summary` block), not a
server-generated PDF — a `@media print` CSS block hides everything else
(`.no-print`, header, bottom nav, footer) so printing produces a clean
document. The emailed side reuses the exact `register-interest` Netlify
Forms pattern: a new static hidden `<form name="quote-request" ...>` sits
next to the existing `register-interest` one right after `<main id="app">`
— **must stay in the raw HTML unmodified**, same reason as
`register-interest` (Netlify only detects forms present in the deployed
markup). Entry point is a "Save / email a quote" button on `#/cart`
alongside "Proceed to checkout".

**3. Phone push alert on form submissions.** New
`netlify/functions/notify-push.js` — a Netlify Function that receives a
Netlify Forms "Outgoing webhook" notification (configured per-form in the
dashboard, not in code — see Known limitations below) and forwards a short
message to Pushover (or a similar push app) using `PUSHOVER_APP_TOKEN` /
`PUSHOVER_USER_KEY` env vars, same secrets-in-env-vars pattern as
`STRIPE_SECRET_KEY`. **Not yet confirmed against a real submission**: the
exact JSON shape Netlify's outgoing webhook sends wasn't pinned down from
the docs, so the function tries a couple of likely shapes and logs the raw
body every call — check this function's logs in the Netlify dashboard after
the first real test submission and adjust the `data`/`form_name`
extraction at the top of the file if the logged shape differs. A failure
here never blocks the actual form submission or its email notification —
those are independent.

An SMS-via-carrier-email-gateway approach was considered and dropped:
Vodafone/TPG's email-to-SMS now requires registering as an account
administrator on their business Messaging Hub, not a free personal gateway
address — not worth the setup for this use case.

## 2026-09-13 (evening): Lakey Peak surf camp brand-extension page

Client got marketing advice from ChatGPT about promoting a surf camp
(Lakey Peak, Sumbawa — a separate build/investor project, see the "Lakey
Peak" area notes outside this repo) on this site "without taking away from
the page." Reviewed that advice, kept the good part (position it as a
lifestyle extension, not a co-equal product line — don't put it in main
nav, don't turn the homepage into a travel site) and deliberately scaled
back the rest (no sitewide announcement banner, no "Indo Experiences" hub
umbrella brand for a single item) to match how conservatively this site
already treats anything without real content yet.

**New standalone page, not a shop product.** `LAKEY_PEAK` is a small
pseudo-product object (`{id, name, category}`) — deliberately **not** added
to the `PRODUCTS` array, so it never appears in the shop grid or category
filters. `renderLakeyPeak()`/`bindLakeyPeakEvents()` are a new, separate
view (styled like `renderAbout()`, not like a product detail page), routed
at `#/lakey-peak`. It reuses `renderInterestForm()`/`bindInterestFormEvents()`
as-is — those functions only ever needed `p.id`/`p.name`/`p.category` — so
submissions land in the exact same `register-interest` Netlify Form/
notifications already configured, no new form or notification setup
required. `renderInterestForm()` gained an optional second `blurb` param
(default preserves the original "ready to order" copy for real products)
so this page could use wording that fits a travel experience instead
("...as soon as Lakey Peak is open for bookings").

**Content is honestly placeholder**, because the camp itself is honestly
placeholder — still under construction (main house, then guest huts, then
pool), no opening date. Copy reflects that directly ("under construction,"
"register your interest") rather than implying it's bookable. No real
photos exist yet, so the page reuses `assets/icon.jpg` (same as About/
Ordering) instead of inventing stock surf imagery.

**Entry points, deliberately minimal**: a quiet `.lifestyle-teaser` card on
the homepage (`renderShop()`, right after `.value-strip`) and one link in
the footer's existing "Shop" column. **Not** added to `#mainNav`/
`#bottomNav` — those stay Shop/Ordering/About/Cart only, matching the
"don't treat it as a product line" positioning. `setActiveNav('')` on this
route clears nav highlighting rather than forcing a false match.

If real content (photos, dates, pricing) arrives later, revisit whether
this stays a single page or needs more structure — don't build that
structure ahead of having something real to put in it.

## 2026-09-13 (later same day): WhatsApp contact, quote-download alert, tray range

**1. Mobile number is now a WhatsApp contact, not a phone-dialer link.**
`initContactLinks()`'s footer phone link now points to
`contactWhatsappUrl()` (`https://wa.me/<digits>`, opens in a new tab) instead
of `tel:...`, and its label reads "WhatsApp: +61 410 495 924". The old
`contactPhoneTel()` helper was removed as dead code. This was the only place
the mobile number was referenced as a contact method.

**2. "Quote downloaded" business notification.** Printing/saving a quote
(the "Print / Save as PDF" button on `#/quote`) now also fires a silent,
best-effort POST to a new `quote-download` Netlify Form (`notifyQuoteDownload()`
in `index.html`, called from `bindQuoteEvents()` right before `window.print()`)
carrying the quote ref, cart summary and total — **no customer identity**,
since a print action doesn't involve the customer entering any contact
details (that's still only captured if they separately use the "Email this
quote to us" form on the same page). The new static hidden
`<form name="quote-download" data-netlify="true" hidden>` sits next to
`quote-request`/`register-interest` after `<main id="app">` — same "don't
remove or rename" rule applies. **Needs its own Netlify Forms email
notification added** (Site configuration → Forms → Form notifications) once
it's visible in the dashboard after the next deploy — see Known limitations.

**3. Floating Pool Trays is now a range, not a single product.** Updated the
`floating-pool-tray` entry in `PRODUCTS`: renamed to "Floating Pool Trays",
`desc` now mentions the expanding range, and a new `meta` array lists
**Shapes** (Circle 500mm / Heart / Rectangle with rounded corners) and
**Colours** (White / Honey Wicker / Cuppacino / Dark Brown) as placeholders —
no real photos or pricing exist yet for anything but the original Circle, so
this is descriptive-only text, not an interactive shape/colour selector (the
product is still `comingSoon:true`, not purchasable, so there's nothing to
actually select yet). While making this change, noticed the `comingSoon`
branch of `renderProductDetail()` was silently dropping `p.meta` entirely
(no meta table in that template) — **fixed**: it now renders the meta table
when present, which also means the four Wooden Bowls & Leather Goods
products (which already had `meta` set) now show their
material/dimensions/care info on their coming-soon pages too, previously
hidden. When real photos/pricing/sizes land for Heart and Rectangle, revisit
whether this stays one product page or splits into per-shape entries with
an actual finish-chip-style selector (see `p.finishOptions` pattern used by
other non-blind products) once there's real data to select between.

## 2026-09-13 (night): Mobile layout bug fix — "Handmade" badge escaping the photo box
CJ asked whether the live site had actually been checked on a phone. It
hadn't (only desktop-width Playwright screenshots had been reviewed
before), so this was verified properly at a 375×812 mobile viewport —
found and fixed a real bug, plus flagged one that needs CJ's decision
(see Known limitations).

**The bug:** on any product detail page (`#/product/...`), at mobile
widths (≤860px) the green "Handmade" ribbon badge rendered as an
oversized bar overlapping the breadcrumb/header instead of sitting neatly
in the corner of the photo. Root cause was two separate CSS issues that
compounded:
1. `.detail-photo` is `position:sticky` on desktop (so the photo follows
   you down the page) and the mobile media query correctly turns that off
   — but it did so with `position:static`, which does **not** establish a
   containing block for the badge's `position:absolute`. With no
   positioned ancestor, the badge positioned itself relative to the
   viewport instead of the photo box. **Fixed** by using
   `position:relative` instead of `static` in that media query
   (`.detail-photo{position:relative; top:auto;}`) — keeps the
   "un-stick on mobile" behaviour while fixing containment.
2. Independently, the `.handmade-badge`'s inline SVG icon (`ARCH_MARK`)
   has no `width`/`height` attributes, so with no CSS constraint it falls
   back to the browser's ~300×150px default replaced-element size,
   ballooning the whole badge. There was already a
   `.handmade-badge img{height:11px}` rule but it only matches `<img>`
   tags, not raw inline `<svg>`. **Fixed** by adding
   `.product-photo .handmade-badge svg, .detail-photo .handmade-badge svg{height:11px; width:11px; flex:none;}`
   (needs to out-specificity the existing `.detail-photo svg{width:42%;
   height:42%}` rule, hence the compound selector) plus a `max-width` /
   `box-sizing:border-box` safety net on `.handmade-badge` itself so it
   can never overflow the photo box even with longer text.

Verified with local Playwright at 375×812 (blind detail, Floating Pool
Trays detail with its `photo-toggle`/`ai-badge`, shop grid cards, cart,
quote) — no horizontal overflow anywhere, badge now a small pill in the
photo's top-left corner on every page that shows it. Committed to the
live file and confirmed the write persisted (re-staged and byte/grep
-checked, per the OneDrive-sync caution noted elsewhere in this file) —
**still needs `netlify deploy --prod --dir=.` to go live**, not deployed
as part of this session (no working terminal access this session — see
Known limitations).

**Found, then fixed a different way — CJ's call.** The free-tier "Powered
by Netlify" badge (bottom-right corner) sits in a fixed iframe
(`#nl-badge-frame`, `z-index:2147483645`, injected by Netlify's hosting —
not in our source, so it can't be resized/removed from here) that, at
mobile widths, lands directly on top of the "About" and "Cart" buttons in
the custom bottom mobile nav bar and actually intercepts the tap
(confirmed via `elementFromPoint` — clicks meant for those buttons hit the
iframe, not the nav). Rather than touch the badge itself (the
officially-supported way to remove it is a Netlify plan/dashboard setting,
possibly paid-plan-only), CJ opted to just move our own nav out of its
way: `.bottom-nav` now stops 200px short of the right edge
(`right:200px` in the `≤860px` media query, badge measured at ~197px
wide) and its 4 links use `flex:1` with `white-space:nowrap;
overflow:hidden; text-overflow:ellipsis` instead of the old
`justify-content:space-around` full-width layout, so "Shop / Ordering /
About / Cart" now sit packed into the left ~55% of the bar, entirely
clear of the badge on any phone ≥360px wide. Verified with a simulated
197×64 badge overlay at 320/375/414px — no overlap at any width; labels
stay fully readable at 375px+, "Ordering" truncates to "Orderin…" at the
rare 320px width (old iPhone SE-class devices) which is an acceptable
trade-off. The badge itself is untouched and still fully visible — this
only repositions our own nav, so it doesn't raise the same
Netlify-plan/ToS question as hiding or obscuring the badge would.

## Category status (updated 2026-09-05)
**Site now launches with Blinds as the only purchasable category.** Wooden
Bowls & Leather Goods (previously real/purchasable) was switched to
`comingSoon:true` on 2026-09-05 — client decided to hold all non-blind
categories until real photos/stock are ready, rather than sell placeholder
products. `price`/`unit`/`meta` were left in place on those four products
(not deleted) so re-enabling one later is just removing its `comingSoon:true`
flag. The category was also added to `CHIP_MUTED_CATEGORIES`. **Server-side**
`netlify/functions/lib/pricing.js` had these four ids removed entirely (not
just hidden client-side) so `priceCartItem()` throws if someone posts a raw
checkout request for one, bypassing the UI.

Every `comingSoon:true` product's detail page now shows a **"Register your
interest"** form (email required, name/phone/message optional) instead of
just static "DM us" copy — see `renderInterestForm()`/`bindInterestFormEvents()`
below. Submissions go via Netlify Forms (POST to `/` with
`form-name=register-interest`), landing in the Netlify dashboard under
Forms — **no backend/secret involved**. The static hidden replica of this
form (`<form name="register-interest" data-netlify="true" ...>`, right after
`<main id="app">` in the body) must stay in the raw HTML unmodified — Netlify
only detects forms present in the deployed markup, not ones injected by JS,
so deleting or renaming that block silently breaks submissions.

**Real photos**: added a `photoMarkup(p)`/`thumbMarkup(p)` helper pair — set
`image:'assets/xxx.jpg'` on any product in `PRODUCTS` and it renders that photo
everywhere (shop grid, detail, cart, checkout, confirmation) instead of the
SVG line-art icon. No template changes needed per product.

### Original 2026-08-10 reorganization (superseded above for Bowls/Leather)
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
  **Timber only as of 2026-09-13** — Bamboo was removed as an option (see
  dated section below); there is no type selector any more, just colour.
  Pricing was sourced from the client's `Blind order form.xlsx`
  (`../Blind order form.xlsx`, one level up from this folder): base price =
  `width_cm × drop_cm / 100`, a bulk discount kicks in once that base price
  hits $400 (25% off), and shipping is a flat $50 per blind unit. Colours
  are Natural Wood/White/Black. See `computeBlindPrice()` in `index.html`
  for the exact formula. **Price check 2026-10-07**: all 66 Timber sizes
  match the workbook's grid (prices, grey-cell discount eligibility,
  shipping, colours) except 50×175, which the supplier grid lists as $86
  (looks like a typo — every other cell is width×drop/100). CJ chose to keep
  the formula's $87.50; don't "fix" it to $86. See also the standalone
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
5. **Email alerts done 2026-10-07; phone push still pending.** Three
   site-wide email hooks (form = any, so they cover all three forms):
   indohomecollective@gmail.com, c.nikhomes@live.com.au,
   clintnic01@hotmail.com — test submission confirmed all three arrive.
   Remaining: the Pushover webhook below. Original notes:
   Submissions
   land in the Netlify dashboard (Forms tab) regardless, but nothing emails
   or pings anyone until notifications are added — do this after the next
   deploy (Netlify only shows a form in that tab once it's seen it in a
   deployed build), for **all three** forms — `register-interest`,
   `quote-request`, and `quote-download`. Repeat the same 3 email
   notifications on each of the three forms (Netlify notifications are
   per-form, not site-wide):
   - Site configuration → Forms → Form notifications → Add notification →
     Email notification → recipient = `indohomecollective@gmail.com`.
   - Add notification → Email notification → recipient =
     `c.nikhomes@live.com.au` (alternate #1).
   - Add notification → Email notification → recipient =
     `clintnic01@hotmail.com` (alternate #2).
   - (A possible 3rd alternate address was mentioned but not confirmed yet —
     add it the same way if/when supplied.)
   - Add notification → Outgoing webhook →
     `https://indo-home-collective.netlify.app/.netlify/functions/notify-push`
     for the phone push alert (see the 2026-09-13 section above) — first
     requires a Pushover account/app set up and its `PUSHOVER_APP_TOKEN` /
     `PUSHOVER_USER_KEY` added as Netlify env vars.
6. ~~The free-tier "Powered by Netlify" badge blocks the mobile bottom
   nav~~ — **fixed 2026-09-13 (night), CJ's call.** Found via
   `elementFromPoint` that the badge iframe was swallowing taps on
   "About"/"Cart" in the bottom mobile nav. Rather than touch the badge
   (dashboard/plan-gated), the bottom nav itself was narrowed to stop
   200px short of the right edge so all 4 items sit clear of it — see the
   2026-09-13 (night) section above for the exact CSS and how it was
   verified. The badge is still there and still fully visible, just no
   longer overlapping our own nav.

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

**Current status (2026-10-07)**: working end-to-end in **test mode** —
`STRIPE_SECRET_KEY` is set in Netlify (an `sk_test_` key; sessions come
back `cs_test_`), and a full 4242 test purchase on the live site reached
"Order confirmed" with the cart cleared. Steps 1–4 below are done; only
step 5 (swap in the live key, then redeploy) remains.

Earlier status: code is deployed and working end-to-end *except* the
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
- [x] Wire up Stripe Checkout (see Stripe integration section) — working
      in test mode; swap in the live key to take real payments
- [x] Form email alerts (3 recipients, all forms) — phone push still to do
- [ ] Swap placeholder icons for real product photography as it becomes
      available
- [ ] Confirm/adjust Decor pricing and dimensions (currently placeholders)
- [ ] Add real domain (currently the default `.netlify.app` subdomain)

## 2026-10-07: v2 "blinds-focus" redesign
v2 is live (deployed to prod 2026-10-07) and is `master` in this repo — this
folder is the only working copy. It was built in a separate
`indo-home-collective-v2-blinds/` folder, now archived (along with the old
plain v1 copy) under `../_archive/` — don't edit those.

v1 (full multi-category shop) is preserved as the git tag `v1-full-shop`
(`git checkout v1-full-shop` to view it). Netlify also keeps the old v1
deploys for one-click rollback (Deploys → pick a pre-2026-10-07 deploy →
Publish deploy).

What changed (all in `index.html`; Netlify functions/pricing untouched):
- `#/shop` now renders `renderHome()` — blinds landing page: split hero
  (real natural-timber photo), colour cards (`BLIND_SWATCHES`, CSS-drawn
  slats, link to `#/product/timber-slat-blinds/<Colour>` which preselects
  the colour chip), gallery (`BLIND_GALLERY`, add photos there), value strip,
  small "also from us" strip (non-muted categories first), Lakey Peak teaser.
- New `#/homewares` (and `#/homewares/<Category>`) route = the old
  `renderShop()` grid minus Blinds (`HOMEWARE_CATEGORIES`), default
  category Floating Pool Trays. Non-blind breadcrumbs/links point here.
- Nav: header = Blinds / Homewares / Ordering / About; mobile bottom nav =
  Blinds / Decor / About / Cart (Ordering dropped from bottom nav to keep
  4 items clear of the Netlify badge — still in header + footer).
- Blind product now has `image:'assets/blinds-natural-web.jpg'`.
- New compressed assets `blinds-natural-web.jpg` (~120KB, real photo) and
  `blinds-white-web.jpg` (~84KB, **AI-generated** — shown with the
  "AI-generated preview" badge; replace with a real photo when available).
  No Black photo yet.

### 2026-10-07 (later): spinning logo, squirrel mascot
- Header logo is now `assets/logo-transparent.png` (white background
  removed) in a `.logo-spin` wrapper: slow 3D Y-axis spin (two faces so it
  reads correctly both sides), pauses on hover, off for reduced-motion.
- "Also from us" on the home page is now just the heading + "View
  homewares →" link (thumbnail cards removed at CJ's request).
- Squirrel mascot: `assets/squirrel-mascot.svg` (~8KB, cartoon of CJ's
  squirrel photo `assets/squirrel.jpg`). Has built-in idle motion (tail,
  blink, nose, ear, head tilt, nibbling) whose timings scale with the CSS
  variable `--spd`. On the home page only, `startSquirrel()` (called from
  `bindHomeEvents()`) fetches the SVG once, then `squirrelPeek()` picks a
  random on-screen target (`SQ_TARGETS`: hero photo, Design your blind
  button, colour cards, gallery photos) and pops the squirrel up over its
  top edge in a clipped `.sq-host` box, at a random speed from
  `SQ_SPEEDS` (0.6 fast / 1 normal / 1.6 slow). `render()` calls
  `stopSquirrel()` on every route change. `pointer-events:none` so it never
  blocks a tap; skipped entirely under prefers-reduced-motion.
