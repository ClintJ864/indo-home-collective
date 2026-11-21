// The delivery estimate shown to customers: 8–12 weeks from the order date.
// Duplicated in index.html (deliveryWindow) — keep LEAD_WEEKS the same in both.
const LEAD_WEEKS = [8, 12];

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function deliveryWindow(from) {
  const start = from instanceof Date ? from : new Date(from);
  return { from: addDays(start, LEAD_WEEKS[0] * 7), to: addDays(start, LEAD_WEEKS[1] * 7) };
}

// "12 February and 12 March 2027" (Australian date order; year added when it isn't this year)
function formatWindow(w, now = new Date()) {
  const opts = { day: 'numeric', month: 'long', timeZone: 'Australia/Brisbane' };
  const first = w.from.toLocaleDateString('en-AU', opts);
  const lastOpts = w.to.getFullYear() !== now.getFullYear() ? { ...opts, year: 'numeric' } : opts;
  const last = w.to.toLocaleDateString('en-AU', lastOpts);
  return `between ${first} and ${last}`;
}

module.exports = { LEAD_WEEKS, deliveryWindow, formatWindow };
