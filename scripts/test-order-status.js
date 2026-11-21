// Logic test for netlify/functions/order-status.js against a faked Stripe (no network, no keys).
//   node scripts/test-order-status.js
const Module = require('module');
const path = require('path');

let fake; // set per test
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'stripe') return () => fake;
  return realLoad.call(this, request, ...rest);
};
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
const { handler } = require(path.join(__dirname, '..', 'netlify', 'functions', 'order-status.js'));

const now = Math.floor(Date.parse('2026-11-21T00:00:00Z') / 1000);
const pi = (over = {}) => ({ id: 'pi_1', status: 'succeeded', created: now, latest_charge: 'ch_1', receipt_email: null,
  metadata: { orderId: 'IHC-123456', status: 'confirmed', email: 'jane@example.com' }, ...over });
const stripeWith = ({ search = [], sessions = [], retrieve = null, charge = { billing_details: { email: 'jane@example.com' } }, boom = false } = {}) => ({
  paymentIntents: { search: async () => { if (boom) throw new Error('boom'); return { data: search }; }, retrieve: async () => retrieve },
  checkout: { sessions: { list: async () => ({ data: sessions }) } },
  charges: { retrieve: async () => charge },
});
const call = (body, method = 'POST') => handler({ httpMethod: method, body: JSON.stringify(body) }).then((r) => ({ code: r.statusCode, data: r.body && r.body[0] === '{' ? JSON.parse(r.body) : r.body }));

let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name, extra || ''); } };

(async () => {
  fake = stripeWith({ search: [pi()] });
  let r = await call({ order: 'ihc-123456', email: ' JANE@Example.com ' });
  check('matching order + email (case/space-insensitive) is found', r.data.found === true && r.data.order === 'IHC-123456', r);
  check('new order starts at stage 0 (confirmed)', r.data.stage === 0);
  check('returns an 8–12 week window from the order date',
    new Date(r.data.windowFrom).toISOString().slice(0, 10) === '2027-01-16' && new Date(r.data.windowTo).toISOString().slice(0, 10) === '2027-02-13', r.data);

  fake = stripeWith({ search: [pi({ metadata: { orderId: 'IHC-123456', status: 'In Production', status_note: 'Slats are being finished', email: 'jane@example.com' } })] });
  r = await call({ order: 'IHC-123456', email: 'jane@example.com' });
  check('"In Production" (any case/spacing) maps to stage 1', r.data.stage === 1, r.data);
  check('status note is passed through', r.data.note === 'Slats are being finished');

  fake = stripeWith({ search: [pi({ metadata: { orderId: 'IHC-123456', status: 'shipped', email: 'jane@example.com' } })] });
  check('shipped → stage 2', (await call({ order: 'IHC-123456', email: 'jane@example.com' })).data.stage === 2);
  fake = stripeWith({ search: [pi({ metadata: { orderId: 'IHC-123456', status: 'whatever', email: 'jane@example.com' } })] });
  check('unknown status falls back to stage 0', (await call({ order: 'IHC-123456', email: 'jane@example.com' })).data.stage === 0);

  fake = stripeWith({ search: [pi()] });
  r = await call({ order: 'IHC-123456', email: 'someone.else@example.com' });
  check('wrong email → not found (no detail leaked)', r.data.found === false && Object.keys(r.data).length === 1, r.data);

  fake = stripeWith({ search: [] });
  r = await call({ order: 'IHC-999999', email: 'jane@example.com' });
  check('unknown order → not found', r.data.found === false, r.data);

  fake = stripeWith({ search: [pi({ status: 'requires_payment_method' })] });
  r = await call({ order: 'IHC-123456', email: 'jane@example.com' });
  check('unpaid payment → not found', r.data.found === false, r.data);

  fake = stripeWith({ search: [], sessions: [{ metadata: { orderId: 'IHC-123456' }, payment_status: 'paid', payment_intent: 'pi_old', customer_details: { email: 'jane@example.com' } }],
    retrieve: pi({ metadata: {}, latest_charge: null }) });
  r = await call({ order: 'IHC-123456', email: 'jane@example.com' });
  check('older order (no metadata on payment) is found via its checkout session', r.data.found === true && r.data.stage === 0, r.data);

  fake = stripeWith();
  for (const bad of [{}, { order: 'IHC-12', email: 'jane@example.com' }, { order: 'IHC-123456', email: 'nope' }, { order: "x' OR 1=1", email: 'jane@example.com' }]) {
    r = await call(bad);
    check('bad input rejected quietly: ' + JSON.stringify(bad).slice(0, 44), r.code === 200 && r.data.found === false, r);
  }
  r = await call({}, 'GET');
  check('GET is refused', r.code === 405);

  fake = stripeWith({ boom: true });
  r = await call({ order: 'IHC-123456', email: 'jane@example.com' });
  check('Stripe failure → friendly 502', r.code === 502 && /try again/i.test(r.data.error), r);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
