const Stripe = require('stripe');
const { priceCartItem } = require('./lib/pricing');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: 'Server is not configured for payments yet.' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid request body' };
  }

  const { items, customerEmail, orderId } = payload;

  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, body: 'Cart is empty' };
  }
  if (!orderId) {
    return { statusCode: 400, body: 'Missing orderId' };
  }

  // Prices are re-derived server-side from each item's product id (and, for
  // custom blinds, its structured spec) — never taken from the client, so a
  // tampered request can't pay less than the real price.
  let line_items;
  try {
    line_items = items.map((item) => {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error('Invalid quantity');
      }
      const { name, unitPrice } = priceCartItem(item);
      const unitAmount = Math.round(unitPrice * 100);
      return {
        price_data: {
          currency: 'aud',
          product_data: {
            name: item.variant ? `${name} — ${item.variant}` : name,
          },
          unit_amount: unitAmount,
        },
        quantity,
      };
    });
  } catch (e) {
    return { statusCode: 400, body: 'Invalid cart items' };
  }

  const siteUrl = process.env.URL || `https://${event.headers.host}`;
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: customerEmail || undefined,
      success_url: `${siteUrl}/?session_id={CHECKOUT_SESSION_ID}#/order-confirmed/${orderId}`,
      cancel_url: `${siteUrl}/#/checkout`,
      shipping_address_collection: { allowed_countries: ['AU'] },
      metadata: { orderId },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (e) {
    return { statusCode: 502, body: `Stripe error: ${e.message}` };
  }
};
