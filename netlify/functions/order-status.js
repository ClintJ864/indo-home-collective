// "Where's my order?" — POST { order: "IHC-123456", email: "name@example.com" }
//
// The order lives in Stripe: create-checkout-session.js copies orderId, email and a
// `status` onto the PaymentIntent. To move an order along, open the payment in the
// Stripe Dashboard (Payments → the payment → Metadata → Edit) and set
//     status       confirmed | in_production | shipped | delivered
//     status_note  (optional) a short message shown to the customer
// Nothing is returned unless the order number AND the email match, so order numbers
// can't be browsed. A wrong guess looks identical to "not found".
const Stripe = require('stripe');
const { deliveryWindow } = require('./lib/delivery');

const STAGES = ['confirmed', 'in_production', 'shipped', 'delivered'];
const ORDER_RE = /^IHC-\d{6}$/;
const json = (statusCode, obj) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
const NOT_FOUND = { found: false };

function emailsOf(pi, charge) {
  return [
    pi.metadata && pi.metadata.email,
    pi.receipt_email,
    charge && charge.billing_details && charge.billing_details.email,
    charge && charge.receipt_email,
  ].filter(Boolean).map((e) => String(e).trim().toLowerCase());
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!process.env.STRIPE_SECRET_KEY) return json(500, { error: 'Not configured' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Invalid request' }); }
  const order = String(body.order || '').trim().toUpperCase();
  const email = String(body.email || '').trim().toLowerCase();
  if (!ORDER_RE.test(order) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(200, NOT_FOUND);

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    // 1) payments made since the status feature went in carry the order id in their metadata
    let pi = null;
    const found = await stripe.paymentIntents.search({ query: `metadata['orderId']:'${order}'`, limit: 5 });
    pi = (found.data || []).find((p) => p.status === 'succeeded') || null;

    // 2) older payments: only the Checkout Session had the id, so look through recent sessions
    if (!pi) {
      const sessions = await stripe.checkout.sessions.list({ limit: 100 });
      const s = (sessions.data || []).find((x) => x.metadata && x.metadata.orderId === order && x.payment_status === 'paid');
      if (s && s.payment_intent) {
        const p = await stripe.paymentIntents.retrieve(typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent.id);
        if (p.status === 'succeeded') {
          pi = p;
          if (!pi.metadata.email && s.customer_details && s.customer_details.email) {
            pi = { ...pi, metadata: { ...pi.metadata, email: s.customer_details.email } };
          }
        }
      }
    }
    if (!pi) return json(200, NOT_FOUND);

    let charge = null;
    if (pi.latest_charge) {
      const id = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge.id;
      charge = await stripe.charges.retrieve(id).catch(() => null);
    }
    if (!emailsOf(pi, charge).includes(email)) return json(200, NOT_FOUND);

    const raw = String((pi.metadata && pi.metadata.status) || 'confirmed').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const stage = Math.max(0, STAGES.indexOf(raw));
    const orderedAt = new Date(pi.created * 1000);
    const w = deliveryWindow(orderedAt);
    return json(200, {
      found: true,
      order,
      stage,                                   // 0 confirmed · 1 in production · 2 on its way · 3 delivered
      note: (pi.metadata && pi.metadata.status_note) ? String(pi.metadata.status_note).slice(0, 300) : '',
      orderedAt: orderedAt.toISOString(),
      windowFrom: w.from.toISOString(),
      windowTo: w.to.toISOString(),
    });
  } catch (e) {
    return json(502, { error: 'Could not look that up just now. Please try again in a minute.' });
  }
};
