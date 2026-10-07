// Receives Netlify Forms' "Outgoing webhook" notification (configured per
// form in the Netlify dashboard: Site settings → Forms → Form notifications
// → Add notification → Outgoing webhook → this function's URL) and forwards
// a short push notification via Pushover (https://pushover.net) so a phone
// alert fires alongside the email notification whenever someone submits
// register-interest or quote-request.
//
// Requires two Netlify environment variables (same pattern as
// STRIPE_SECRET_KEY in create-checkout-session.js — set via the Netlify
// dashboard, never committed to this repo):
//   PUSHOVER_APP_TOKEN — the "Application" API token from pushover.net
//   PUSHOVER_USER_KEY  — your personal Pushover user key
//
// Netlify's exact outgoing-webhook payload shape wasn't confirmed against a
// real submission at the time this was written (different sources describe
// form fields nested under payload.data vs payload.payload.data). This
// function tries both shapes and logs the raw body on every call, so the
// real shape can be confirmed from this function's logs in the Netlify
// dashboard after the first real test submission — adjust the `data`/
// `formName` extraction below if the logged shape differs.
//
// A failure here never blocks the actual form submission or its email
// notification — those are handled independently by Netlify Forms.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  console.log('notify-push raw body:', event.body);

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid request body' };
  }

  const formName = payload.form_name || (payload.payload && payload.payload.form_name) || 'website form';
  const data = payload.data || (payload.payload && payload.payload.data) || {};

  let message = `New ${formName} submission`;
  if (data.email) message += ` from ${data.email}`;
  if (data.name) message += ` (${data.name})`;
  if (formName === 'quote-request' && data.quote_total) message += ` — ${data.quote_total}`;

  if (!process.env.PUSHOVER_APP_TOKEN || !process.env.PUSHOVER_USER_KEY) {
    console.log('notify-push: Pushover env vars not set yet, skipping push. Message would have been:', message);
    return { statusCode: 200, body: 'No push service configured yet' };
  }

  try {
    const res = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: process.env.PUSHOVER_APP_TOKEN,
        user: process.env.PUSHOVER_USER_KEY,
        title: 'Indo Home Collective',
        message,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.log('notify-push: Pushover error', res.status, text);
      return { statusCode: 502, body: 'Push service error' };
    }
    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    console.log('notify-push: failed to reach push service', e.message);
    return { statusCode: 502, body: 'Push service unreachable' };
  }
};
