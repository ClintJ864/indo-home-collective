// Server-side pricing — deliberately duplicated from the PRODUCTS/blind
// pricing logic in ../../../index.html (there's no build step to share code
// with the client <script>). The client never sends a price; this is the
// only source of truth Stripe is charged against, so a tampered cart
// payload can't change what a customer actually pays.
// Only Blinds is purchasable — site launched 2026-09-05 with everything else
// (Wooden Bowls & Leather Goods included) switched to "coming soon, register
// your interest" until real stock/pricing is confirmed. The four bowls/
// leather ids are deliberately absent here (not just hidden client-side) so
// priceCartItem() throws "Unknown product" if someone posts a raw request
// for one straight to this function, bypassing the UI. Re-add an entry here
// (mirroring its PRODUCTS.price in ../../../index.html) when a category goes
// back on sale.
const PRODUCTS = {
  'timber-slat-blinds': { name: 'Custom Timber & Bamboo Slat Blinds', customBlind: true },
};

const BLIND_WIDTHS = [50, 100, 150, 200, 250, 300];
const BLIND_DROPS = [50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300];
const BLIND_COLOURS = { Timber: ['Natural Wood', 'White', 'Black'], Bamboo: ['Natural', 'White', 'Black'] };
const BLIND_DISCOUNT_PCT = { Timber: 0.25, Bamboo: 0.30 };
const BLIND_DISCOUNT_THRESHOLD = 400;
const BLIND_SHIPPING_PER_UNIT = 50;

function computeBlindPrice(type, width, drop) {
  const base = (width * drop) / 100;
  const eligible = base >= BLIND_DISCOUNT_THRESHOLD;
  const pct = eligible ? (BLIND_DISCOUNT_PCT[type] || 0) : 0;
  return base * (1 - pct) + BLIND_SHIPPING_PER_UNIT;
}

// Returns {name, unitPrice} for a cart line, or throws on an unknown
// product or an out-of-range blind spec.
function priceCartItem(item) {
  const product = PRODUCTS[item.id];
  if (!product) throw new Error('Unknown product: ' + item.id);

  if (product.customBlind) {
    const spec = item.blindSpec || {};
    const { type, colour, width, drop } = spec;
    if (!BLIND_COLOURS[type]) throw new Error('Invalid blind type');
    if (!BLIND_COLOURS[type].includes(colour)) throw new Error('Invalid blind colour');
    if (!BLIND_WIDTHS.includes(Number(width))) throw new Error('Invalid blind width');
    if (!BLIND_DROPS.includes(Number(drop))) throw new Error('Invalid blind drop');
    return { name: product.name, unitPrice: computeBlindPrice(type, Number(width), Number(drop)) };
  }

  return { name: product.name, unitPrice: product.price };
}

module.exports = { priceCartItem };
