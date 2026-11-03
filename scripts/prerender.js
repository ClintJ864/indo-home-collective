#!/usr/bin/env node
/*
 * Writes the static, search-engine-friendly copy of each indexable page.
 *
 *   node scripts/prerender.js
 *
 * For every page in PAGES it runs index.html's own render functions (no
 * browser, no dependencies) and writes prerender/<file>.html: index.html with
 * the page's <title>/description/canonical/Open Graph/JSON-LD in <head> and the
 * page content already inside <main id="app">. netlify.toml serves these
 * files at the real URLs; the site's JS then re-renders the same content, so
 * visitors see no difference. It also rewrites sitemap.xml from the same list.
 *
 * Re-run after changing page copy, prices, or routeMeta() in index.html, then
 * redeploy. To add a page: add it to PAGES here and a matching rewrite in
 * netlify.toml.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'prerender');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const PAGES = [
  { path: '/',                            file: 'home.html',                    render: c => c.renderHome() },
  { path: '/product/timber-slat-blinds',  file: 'product-timber-slat-blinds.html', render: c => c.renderProductDetail('timber-slat-blinds', null) },
  { path: '/homewares',                   file: 'homewares.html',               render: c => c.renderShop() },
  { path: '/ordering',                    file: 'ordering.html',                render: c => c.renderOrdering() },
  { path: '/about',                       file: 'about.html',                   render: c => c.renderAbout() },
  { path: '/contact',                     file: 'contact.html',                 render: c => c.renderContactPage() },
  { path: '/lakey-peak',                  file: 'lakey-peak.html',              render: c => c.renderLakeyPeak() },
];

// ---- load index.html's inline <script> into a sandbox with a stubbed browser
const scriptStart = indexHtml.indexOf('<script>\n') + '<script>\n'.length;
const scriptSrc = indexHtml.slice(scriptStart, indexHtml.lastIndexOf('</script>'));
const noop = () => {};
const sandbox = {
  window: { addEventListener: noop, scrollTo: noop },
  document: { addEventListener: noop, getElementById: () => null, querySelectorAll: () => [], documentElement: { style: {} } },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  location: { pathname: '/', search: '', hash: '' },
  history: { replaceState: noop, pushState: noop },
  fetch: noop, URLSearchParams, console,
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
const api = vm.runInContext(`${scriptSrc}
// Contact details are built at runtime on purpose (anti-scraping); never bake them into static HTML.
contactEmail = () => '';
({ renderHome, renderProductDetail, renderShop, renderOrdering, renderAbout, renderContactPage, renderLakeyPeak, routeMeta, pathParts });`, sandbox);

// ---- helpers
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function seoBlock(m, pagePath) {
  const lines = [
    `<!-- SEO:START (generated for ${pagePath} by scripts/prerender.js — do not edit) -->`,
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}">`,
    `<link rel="canonical" href="${esc(m.url)}">`,
    ...(m.noindex ? ['<meta name="robots" content="noindex,follow">'] : []),
    `<meta property="og:type" content="${esc(m.ogType)}">`,
    `<meta property="og:site_name" content="Indo Home Collective">`,
    `<meta property="og:locale" content="en_AU">`,
    `<meta property="og:url" content="${esc(m.url)}">`,
    `<meta property="og:title" content="${esc(m.title)}">`,
    `<meta property="og:description" content="${esc(m.description)}">`,
    `<meta property="og:image" content="${esc(m.image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="Indo Home Collective logo beside a natural timber slat blind">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    ...(m.jsonld ? [`<script type="application/ld+json" id="ld-page">${JSON.stringify(m.jsonld).replace(/</g, '\\u003c')}</script>`] : []),
    `<!-- SEO:END -->`,
  ];
  return lines.join('\n');
}

const seoRe = /<!-- SEO:START[\s\S]*?<!-- SEO:END -->/;
if (!seoRe.test(indexHtml) || !indexHtml.includes('<main id="app"></main>')) {
  throw new Error('index.html is missing the SEO:START/SEO:END markers or an empty <main id="app"></main>');
}

// ---- previous sitemap dates, so unchanged pages keep their lastmod
const sitemapPath = path.join(root, 'sitemap.xml');
const oldLastmod = {};
if (fs.existsSync(sitemapPath)) {
  for (const m of fs.readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) oldLastmod[m[1]] = m[2];
}
const today = new Date().toISOString().slice(0, 10);

fs.mkdirSync(outDir, { recursive: true });
const urls = [];
for (const page of PAGES) {
  const meta = api.routeMeta(api.pathParts(page.path));
  if (meta.noindex) throw new Error(`${page.path} is marked noindex but listed for prerendering`);

  // The ordering page links to the email address; point static copies at the contact page instead.
  const content = page.render(api).replace(/<a href="mailto:"><\/a>/g, '<a href="/contact">our contact page</a>');
  if (/[\w.+-]+@(?!example\.com)[\w-]+\.[\w.-]+/.test(content)) throw new Error(`${page.path}: an email address would be baked into static HTML`);

  const html = indexHtml.replace(seoRe, () => seoBlock(meta, page.path)).replace('<main id="app"></main>', () => `<main id="app">${content}</main>`);

  const file = path.join(outDir, page.file);
  const changed = !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== html;
  if (changed) fs.writeFileSync(file, html);
  urls.push({ loc: meta.url, lastmod: changed ? today : (oldLastmod[meta.url] || today) });
  console.log(`${changed ? 'wrote    ' : 'unchanged'} prerender/${page.file}  ←  ${meta.url}`);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/prerender.js — edit PAGES there, not this file. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(sitemapPath, sitemap);
console.log(`wrote sitemap.xml (${urls.length} URLs)`);
