'use strict';
/**
 * robots.txt, sitemap.xml va service worker (versiyalangan) javoblari.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { config } = require('./config');
const content = require('./content');
const i18n = require('./i18n');
const v = require('./views');
const { baseUrlFor } = require('./site');
const { buildId } = require('./render');

function sendText(req, res, type, body, cache) {
  const buf = Buffer.from(body);
  const headers = { 'Content-Type': type, 'Cache-Control': cache || 'public, max-age=3600', Vary: 'Accept-Encoding' };
  const ae = String(req.headers['accept-encoding'] || '');
  let out = buf;
  if (buf.length > 1024 && /\bgzip\b/.test(ae)) { out = zlib.gzipSync(buf); headers['Content-Encoding'] = 'gzip'; }
  headers['Content-Length'] = out.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : out);
}

async function robots(req, res) {
  const s = (await content.snapshot()).settings;
  const base = baseUrlFor(req, s);
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n');
  sendText(req, res, 'text/plain; charset=utf-8', body);
}

function xmlEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

async function sitemap(req, res) {
  const snap = await content.snapshot();
  const base = baseUrlFor(req, snap.settings);
  const urls = [];
  const day = (ms) => new Date(Number(ms) || Date.now()).toISOString().slice(0, 10);
  const push = (p, lastmod, priority) => urls.push({ p, lastmod, priority });
  push('/', null, '1.0');
  push('/universitet', null, '0.8');
  push('/yonalishlar', null, '0.9');
  push('/yangiliklar', null, '0.8');
  push('/hikoyalar', null, '0.6');
  push('/galereya', null, '0.5');
  for (const p of snap.collections.programmes) push(v.programmeUrl({ prefix: '' }, p), p.updated_at, '0.8');
  for (const n of snap.collections.news) push(v.newsUrl({ prefix: '' }, n), n.updated_at, '0.6');
  for (const st of snap.collections.stories) push(v.storyUrl({ prefix: '' }, st), st.updated_at, '0.5');
  const body = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
  for (const u of urls) {
    for (const lang of i18n.LANGS) {
      body.push('  <url>');
      body.push(`    <loc>${xmlEsc(base + i18n.prefix(lang) + u.p)}</loc>`);
      for (const alt of i18n.LANGS) body.push(`    <xhtml:link rel="alternate" hreflang="${alt}" href="${xmlEsc(base + i18n.prefix(alt) + u.p)}"/>`);
      body.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEsc(base + u.p)}"/>`);
      if (u.lastmod) body.push(`    <lastmod>${day(u.lastmod)}</lastmod>`);
      body.push(`    <priority>${u.priority}</priority>`);
      body.push('  </url>');
    }
  }
  body.push('</urlset>');
  sendText(req, res, 'application/xml; charset=utf-8', body.join('\n'));
}

let swSrc = null;
function serviceWorker(req, res) {
  if (!swSrc || !config.IS_PROD) swSrc = fs.readFileSync(path.join(config.PUBLIC_DIR, 'sw.js'), 'utf8');
  const body = swSrc.replace(/__BUILD__/g, buildId());
  sendText(req, res, 'application/javascript; charset=utf-8', body, 'no-cache');
}

module.exports = { robots, sitemap, serviceWorker };
