const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: 'Server is not configured for payments yet.' };
  }

  const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;
  if (!sessionId) {
    return { statusCode: 400, body: 'Missing session_id' };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      statusCode: 200,
      body: JSON.stringify({
        paid: session.payment_status === 'paid',
        orderId: (session.metadata && session.metadata.orderId) || null,
        email: (session.customer_details && session.customer_details.email) || session.customer_email || null,
        amountTotal: session.amount_total,
      }),
    };
  } catch (e) {
    return { statusCode: 502, body: `Stripe error: ${e.message}` };
  }
};
