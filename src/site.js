'use strict';
/**
 * Ochiq sayt sahifalarini server tomonida yig'ib beradi (SSR) va keshlaydi.
 */
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const log = require('./logger');
const i18n = require('./i18n');
const content = require('./content');
const { PAGES, resolve } = require('./pages');
const { renderTemplate } = require('./render');

const cache = new Map();
const MAX_CACHE = 400;

function baseUrlFor(req, settings) {
  const fromSettings = String(settings.site_url || process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(fromSettings)) return fromSettings;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (req.socket && req.socket.encrypted ? 'https' : 'http');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').split(',')[0].trim();
  // Host sarlavhasi orqali inyeksiyaning oldini olamiz
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(host) ? host : 'localhost';
  return `${proto === 'https' ? 'https' : 'http'}://${safeHost}`;
}

async function buildCtx(req, route) {
  const lang = route.lang || 'uz';
  const data = await content.getContent(lang);
  const ctx = {
    lang, prefix: i18n.prefix(lang), pageKey: route.pageKey, param: route.param || null,
    pathNoLang: route.pathNoLang || '/', flags: {}, data, settings: data.settings, overrides: data.overrides,
    baseUrl: baseUrlFor(req, data.settings), log,
  };
  return ctx;
}

function renderPage(pageKey, ctx) {
  const page = PAGES[pageKey];
  ctx.pageKey = pageKey;
  return renderTemplate(page, ctx);
}

function compressFor(req, entry) {
  const ae = String(req.headers['accept-encoding'] || '');
  if (/\bbr\b/.test(ae)) {
    if (!entry.br) entry.br = zlib.brotliCompressSync(Buffer.from(entry.html), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
    return ['br', entry.br];
  }
  if (/\bgzip\b/.test(ae)) {
    if (!entry.gz) entry.gz = zlib.gzipSync(Buffer.from(entry.html), { level: 8 });
    return ['gzip', entry.gz];
  }
  return [null, Buffer.from(entry.html)];
}

function send(req, res, status, entry, lang) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Content-Language': i18n.HTML_LANG[lang] || 'uz',
    Vary: 'Accept-Encoding',
    ETag: entry.etag,
  };
  if (status === 200 && req.headers['if-none-match'] === entry.etag) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  const [enc, body] = compressFor(req, entry);
  if (enc) headers['Content-Encoding'] = enc;
  headers['Content-Length'] = body.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function cacheGet(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (e.v !== content.getVersion() || Date.now() - e.at > (Number(process.env.RENDER_CACHE_TTL_MS) || 60000)) { cache.delete(key); return null; }
  return e;
}
function cacheSet(key, html) {
  if (cache.size > MAX_CACHE) cache.clear();
  const entry = { v: content.getVersion(), at: Date.now(), html, etag: `"${crypto.createHash('sha1').update(html).digest('base64url').slice(0, 20)}"` };
  cache.set(key, entry);
  return entry;
}

/**
 * Sahifa so'rovini qayta ishlaydi. Tegishli bo'lmasa `false` qaytaradi
 * (keyin statik fayllar xizmati ishlaydi).
 */
async function handlePage(req, res, pathname, query) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const route = resolve(pathname, query);
  if (!route) return false;
  if (route.redirect) {
    const qs = query && [...query.keys()].filter((k) => k !== 'id').length
      ? '?' + new URLSearchParams([...query.entries()].filter(([k]) => k !== 'id')).toString() : '';
    res.writeHead(301, { Location: route.redirect + qs, 'Cache-Control': 'public, max-age=3600' });
    res.end();
    return true;
  }
  const ctx = await buildCtx(req, route);
  const page = PAGES[route.pageKey];
  const key = `${ctx.baseUrl}|${ctx.lang}|${route.pageKey}|${route.param || ''}`;
  let entry = cacheGet(key);
  let status = 200;
  if (!entry) {
    const prep = page.prepare ? page.prepare(ctx) : {};
    if (prep.redirect) {
      res.writeHead(301, { Location: prep.redirect, 'Cache-Control': 'public, max-age=600' });
      res.end();
      return true;
    }
    if (prep.notFound) return renderNotFound(req, res, ctx.lang);
    entry = cacheSet(key, renderPage(route.pageKey, ctx));
  }
  send(req, res, status, entry, ctx.lang);
  return true;
}

/** Chiroyli 404 sahifa (til yo'ldan aniqlanadi). */
async function renderNotFound(req, res, langHint) {
  const lang = langHint || ((String(req.url || '').match(/^\/(ru|en)(\/|$)/) || [])[1]) || 'uz';
  const ctx = await buildCtx(req, { lang, pageKey: 'notFound', pathNoLang: '/404' });
  const key = `${ctx.baseUrl}|${lang}|notFound|`;
  const entry = cacheGet(key) || cacheSet(key, renderPage('notFound', ctx));
  send(req, res, 404, entry, lang);
  return true;
}

function clearCache() { cache.clear(); }

module.exports = { handlePage, renderNotFound, clearCache, baseUrlFor, buildCtx, renderPage };
