'use strict';
/**
 * Server tomonida sahifa yig'ish (SSR).
 *
 * Shablonlar: views/*.html (+ views/partials/*.html)
 *   <!--#include "partials/header.html"-->   — qism (partial) qo'shish
 *   {{L}}            — til prefiksi ('' | '/ru' | '/en')
 *   {{lang}} {{year}} {{page}} {{path}}
 *   {{set:kalit}}    — sozlama qiymati (HTML-escaped)
 *   {{tel:kalit}}    — sozlamadagi telefon -> tel: uchun raqam
 *   {{t:kalit}}      — lug'atdan tarjima (HTML-escaped)
 *   <!--slot:nom-->  — sahifa kontrolleri chiqaradigan dinamik blok
 *   <!--head-->      — SEO teglari (title, description, hreflang, OG, JSON-LD)
 *   <!--boot-->      — brauzer skriptlari uchun JSON
 *
 * Tarjima va CMS:
 *   data-i18n="kalit"            — ichidagi oddiy matn tarjima qilinadi
 *   data-i18n-attr="attr:kalit;…" — atributlar tarjima qilinadi
 *   data-cms-id="id" data-cms-type="text|link|image|video"
 *        — admin paneldan tahrirlanadigan element (cms-manifest.json)
 *   CMS havolasi ichida matn <span data-cms-text>…</span> da bo'lishi mumkin.
 *
 * Qoida: data-i18n / data-cms-id (text) elementlari ichida faqat oddiy matn bo'ladi.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { config } = require('./config');
const { escapeHtml } = require('./security/sanitize');
const i18n = require('./i18n');

const VIEWS_DIR = path.join(config.ROOT_DIR, 'views');
const IS_PROD = config.IS_PROD;

/* ============================ shablonlar ============================ */
const tplCache = new Map();
function readTemplate(name) {
  const file = path.join(VIEWS_DIR, name);
  if (!file.startsWith(VIEWS_DIR)) throw new Error('Noto‘g‘ri shablon yo‘li');
  const cached = tplCache.get(file);
  if (cached && IS_PROD) return cached.src;
  const st = fs.statSync(file);
  if (cached && cached.mtimeMs === st.mtimeMs) return cached.src;
  const src = fs.readFileSync(file, 'utf8');
  tplCache.set(file, { mtimeMs: st.mtimeMs, src });
  return src;
}

function expandIncludes(src, depth = 0) {
  if (depth > 6) return src;
  return src.replace(/<!--#include\s+"([^"]+)"\s*-->/g, (_, name) => expandIncludes(readTemplate(name), depth + 1));
}

/* ============================ yordamchilar ============================ */
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&#39;': "'", '&nbsp;': '\u00a0' };
function decode(s) { return String(s).replace(/&(?:amp|lt|gt|quot|#0?39|nbsp);/g, (m) => ENT[m] || m); }
const esc = escapeHtml;
function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

const ATTR_RE = /\s*([^\s=/>"']+)(?:\s*=\s*"([^"]*)")?/g;
function parseAttrs(str) {
  const list = [];
  if (!str) return list;
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(str))) {
    if (!m[1]) break;
    list.push([m[1], m[2] === undefined ? null : m[2]]);
    if (ATTR_RE.lastIndex >= str.length) break;
  }
  return list;
}
function getAttr(list, name) { const a = list.find((x) => x[0] === name); return a ? a[1] : undefined; }
function hasAttr(list, name) { return list.some((x) => x[0] === name); }
/** value: string (escape qilinadi) | null (mantiqiy atribut) */
function setAttr(list, name, value) {
  const i = list.findIndex((x) => x[0] === name);
  const v = value === null ? null : esc(value);
  if (i >= 0) list[i] = [name, v]; else list.push([name, v]);
}
function delAttr(list, name) { const i = list.findIndex((x) => x[0] === name); if (i >= 0) list.splice(i, 1); }
function attrsToString(list) { return list.map(([k, v]) => (v === null ? ` ${k}` : ` ${k}="${v}"`)).join(''); }

function telHref(v) { return String(v || '').replace(/[^\d+]/g, ''); }

/* ============================ CMS + i18n ============================ */
function overrideFor(ctx, id) { return (ctx.overrides && ctx.overrides[id]) || null; }

/** CMS matni: admin o'zgartirgan bo'lsa — o'sha (tilga mos), aks holda lug'at/asl. */
function cmsText(ctx, id, originalDecoded) {
  const ov = overrideFor(ctx, id);
  const lang = ctx.lang;
  if (ov && typeof ov.text === 'string' && ov.text.trim() !== '' && norm(ov.text) !== norm(originalDecoded)) {
    if (lang === 'uz') return ov.text;
    return (ov[`text_${lang}`] && String(ov[`text_${lang}`]).trim()) || ov.text;
  }
  if (lang !== 'uz' && ov && ov[`text_${lang}`] && String(ov[`text_${lang}`]).trim()) return ov[`text_${lang}`];
  if (lang === 'uz') return originalDecoded;
  const d = i18n.DICT[id];
  return d && d[lang] != null ? d[lang] : originalDecoded;
}

function i18nText(ctx, key, originalDecoded) {
  if (ctx.lang === 'uz') {
    const d = i18n.DICT[key];
    return d && d.uz != null ? d.uz : originalDecoded;
  }
  const d = i18n.DICT[key];
  return d && d[ctx.lang] != null ? d[ctx.lang] : originalDecoded;
}

/** Matn ichidagi qator uzilishlarini saqlab qolish (admin \n yozsa) — faqat data-cms-multiline elementlarda. */
function textToHtml(s, multiline) {
  const e = esc(s);
  return multiline ? e.replace(/\r?\n/g, '<br>') : e;
}

function processElements(html, ctx) {
  // A) CMS havolalari ichidagi <span data-cms-text>
  html = html.replace(/<a(\s[^<>]*?\bdata-cms-id="([^"]+)"[^<>]*)>([\s\S]*?)<\/a>/g, (m, attrs, id, inner) => {
    if (!inner.includes('data-cms-text')) return m;
    const newInner = inner.replace(/(<span[^<>]*\bdata-cms-text\b[^<>]*>)([^<]*)(<\/span>)/, (mm, open, text, close) =>
      open + esc(cmsText(ctx, id, decode(text))) + close);
    return `<a${attrs}>${newInner}</a>`;
  });

  // B) Oddiy matnli elementlar (data-i18n / data-cms-id)
  html = html.replace(/<([a-zA-Z][\w-]*)(\s[^<>]*?)>([^<]*)<\/\1>/g, (m, tag, attrs, inner) => {
    const isCms = attrs.includes('data-cms-id="');
    const isI18n = attrs.includes('data-i18n="');
    if (!isCms && !isI18n) return m;
    const list = parseAttrs(attrs);
    const original = decode(inner);
    let text;
    if (isCms) {
      const type = getAttr(list, 'data-cms-type') || 'text';
      if (type !== 'text' && type !== 'link') return m;
      text = cmsText(ctx, getAttr(list, 'data-cms-id'), norm(original));
    } else {
      text = i18nText(ctx, getAttr(list, 'data-i18n'), norm(original));
    }
    // asl bo'shliqlarni saqlaymiz
    const lead = (inner.match(/^\s*/) || [''])[0];
    const trail = (inner.match(/\s*$/) || [''])[0];
    return `<${tag}${attrs}>${lead}${textToHtml(text, hasAttr(list, 'data-cms-multiline'))}${trail}</${tag}>`;
  });

  // C) Atributlar (barcha ochuvchi teglar)
  html = html.replace(/<([a-zA-Z][\w-]*)(\s[^<>]*?)?(\s*\/)?>/g, (m, tag, attrs, selfClose) => {
    if (!attrs || (!attrs.includes('data-cms-id="') && !attrs.includes('data-i18n-attr="'))) return m;
    const list = parseAttrs(attrs);
    // i18n atributlari
    const ia = getAttr(list, 'data-i18n-attr');
    if (ia) {
      for (const pair of decode(ia).split(';')) {
        const [attr, key] = pair.split(':').map((s) => s && s.trim());
        if (!attr || !key) continue;
        const cur = getAttr(list, attr);
        setAttr(list, attr, i18nText(ctx, key, cur == null ? '' : decode(cur)));
      }
    }
    const id = getAttr(list, 'data-cms-id');
    if (id) applyCmsAttrs(ctx, tag, list, id);
    return `<${tag}${attrsToString(list)}${selfClose || ''}>`;
  });
  return html;
}

function applyCmsAttrs(ctx, tag, list, id) {
  const ov = overrideFor(ctx, id);
  const type = getAttr(list, 'data-cms-type') || 'text';
  const lang = ctx.lang;
  if (type === 'image') {
    if (ov && ov.src) {
      setAttr(list, 'src', ov.src);
      delAttr(list, 'srcset'); delAttr(list, 'sizes');
    }
    const cur = getAttr(list, 'alt');
    const origAlt = cur == null ? '' : decode(cur);
    // Admin alt matnini o'zgartirgan bo'lsa — o'sha (tilga mos), aks holda lug'at/asl
    const ovAlt = ov && typeof ov.alt === 'string' && ov.alt.trim() && norm(ov.alt) !== norm(origAlt) ? ov.alt : '';
    const ovTr = ov && ov[`alt_${lang}`] && String(ov[`alt_${lang}`]).trim();
    let alt = origAlt;
    if (lang === 'uz') alt = ovAlt || origAlt;
    else if (ovTr) alt = ovTr;
    else if (ovAlt) alt = ovAlt;
    else {
      const d = i18n.DICT[id];
      if (d && d[lang] != null) alt = d[lang];
    }
    setAttr(list, 'alt', alt);
    if (ov && ov.title) setAttr(list, 'title', ov.title);
  } else if (type === 'link') {
    if (ov && ov.href) setAttr(list, 'href', ov.href);
    if (ov && ov.target === '_blank') { setAttr(list, 'target', '_blank'); setAttr(list, 'rel', 'noopener'); }
    else if (ov && ov.target === '_self' && ov.href) { delAttr(list, 'target'); delAttr(list, 'rel'); }
  } else if (type === 'video') {
    if (ov && ov.src) {
      setAttr(list, 'src', ov.src);
      delAttr(list, 'hidden');
      if (ov.mimeType) setAttr(list, 'data-type', ov.mimeType);
      ['autoplay', 'controls', 'muted', 'loop'].forEach((flag) => {
        if (ov[flag]) setAttr(list, flag, null); else delAttr(list, flag);
      });
      if (ov.autoplay) { setAttr(list, 'muted', null); setAttr(list, 'playsinline', null); }
    }
    if (ov && ov.poster) setAttr(list, 'poster', ov.poster);
  }
  if (ov && ov.linkUrl && type !== 'link') {
    setAttr(list, 'data-href', ov.linkUrl);
    if (ov.linkTarget === '_blank') setAttr(list, 'data-href-target', '_blank');
  }
  if (ov && ov.hide) { setAttr(list, 'hidden', null); setAttr(list, 'data-cms-hidden', null); }
}

/* ============================ o'zgaruvchilar ============================ */
function applyVars(html, ctx) {
  return html.replace(/\{\{\s*([a-zA-Z]+)(?::([\w.-]+))?\s*\}\}/g, (m, name, arg) => {
    switch (name) {
      case 'L': return ctx.prefix;
      case 'lang': return ctx.lang;
      case 'htmlLang': return i18n.HTML_LANG[ctx.lang];
      case 'year': return String(new Date().getFullYear());
      case 'page': return esc(ctx.pageKey || '');
      case 'path': return esc(ctx.pathNoLang || '/');
      case 'set': return esc(ctx.settings[arg] == null ? '' : ctx.settings[arg]);
      case 'tel': return esc(telHref(ctx.settings[arg]));
      case 't': return esc(i18n.t(arg, ctx.lang));
      default: return m;
    }
  });
}

/* ============================ asset versiyalari ============================ */
const hashCache = new Map();
function assetHash(urlPath) {
  const abs = path.join(config.PUBLIC_DIR, urlPath.replace(/^\/+/, ''));
  if (!abs.startsWith(config.PUBLIC_DIR)) return '';
  try {
    const st = fs.statSync(abs);
    const c = hashCache.get(abs);
    if (c && c.mtimeMs === st.mtimeMs) return c.hash;
    const hash = crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex').slice(0, 10);
    hashCache.set(abs, { mtimeMs: st.mtimeMs, hash });
    return hash;
  } catch { return ''; }
}
function versionAssets(html) {
  return html.replace(/(href|src)="(\/(?:css|js|img\/brand)\/[^"?#]+)"/g, (m, attr, p) => {
    const h = assetHash(p);
    return h ? `${attr}="${p}?v=${h}"` : m;
  });
}
/** Service worker uchun umumiy versiya (asosiy fayllar xeshi). */
function buildId() {
  return crypto.createHash('sha1')
    .update(['/css/ku.css', '/js/ku.js', '/js/ku-home.js', '/js/ku-pages.js', '/img/brand/ku-brand.svg'].map(assetHash).join('|'))
    .digest('hex').slice(0, 10);
}

/* ============================ SEO ============================ */
function absUrl(base, p) {
  if (!p) return base + '/';
  if (/^https?:\/\//i.test(p)) return p;
  return base + (p.startsWith('/') ? p : '/' + p);
}

function seoHead(ctx, seo) {
  const base = ctx.baseUrl;
  const lang = ctx.lang;
  const title = seo.title;
  const desc = norm(seo.description || '').slice(0, 300);
  const canonical = absUrl(base, i18n.prefix(lang) + (seo.path || ctx.pathNoLang || '/'));
  const out = [];
  out.push(`<title>${esc(title)}</title>`);
  out.push(`<meta name="description" content="${esc(desc)}">`);
  if (seo.noindex) out.push('<meta name="robots" content="noindex, follow">');
  else out.push('<meta name="robots" content="index, follow, max-image-preview:large">');
  out.push(`<link rel="canonical" href="${esc(canonical)}">`);
  if (!seo.noindex) {
    for (const l of i18n.LANGS) {
      out.push(`<link rel="alternate" hreflang="${l}" href="${esc(absUrl(base, i18n.prefix(l) + (seo.path || ctx.pathNoLang || '/')))}">`);
    }
    out.push(`<link rel="alternate" hreflang="x-default" href="${esc(absUrl(base, seo.path || ctx.pathNoLang || '/'))}">`);
  }
  const image = absUrl(base, seo.image || '/img/og/og-image.jpg');
  out.push(`<meta property="og:type" content="${esc(seo.type || 'website')}">`);
  out.push(`<meta property="og:site_name" content="Kokand University">`);
  out.push(`<meta property="og:title" content="${esc(seo.ogTitle || title)}">`);
  out.push(`<meta property="og:description" content="${esc(desc)}">`);
  out.push(`<meta property="og:url" content="${esc(canonical)}">`);
  out.push(`<meta property="og:image" content="${esc(image)}">`);
  if (!seo.image || seo.image.includes('/img/og/')) {
    out.push('<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">');
  }
  out.push(`<meta property="og:image:alt" content="${esc(seo.imageAlt || 'Kokand University')}">`);
  out.push(`<meta property="og:locale" content="${i18n.OG_LOCALE[lang]}">`);
  for (const l of i18n.LANGS) if (l !== lang) out.push(`<meta property="og:locale:alternate" content="${i18n.OG_LOCALE[l]}">`);
  if (seo.published) out.push(`<meta property="article:published_time" content="${esc(seo.published)}">`);
  out.push('<meta name="twitter:card" content="summary_large_image">');
  out.push(`<meta name="twitter:title" content="${esc(seo.ogTitle || title)}">`);
  out.push(`<meta name="twitter:description" content="${esc(desc)}">`);
  out.push(`<meta name="twitter:image" content="${esc(image)}">`);
  for (const block of seo.jsonld || []) {
    out.push(`<script type="application/ld+json">${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`);
  }
  return out.join('\n');
}

/* ============================ yig'ish ============================ */
/**
 * @param {object} page   — { template, slots, seo, boot } (src/pages.js)
 * @param {object} ctx    — { lang, prefix, pageKey, pathNoLang, settings, overrides, baseUrl, data }
 */
/** <!--if:flag-->…<!--/if:flag-->  va  <!--if:!flag-->…<!--/if:!flag--> */
function applyConditionals(html, flags) {
  let prev;
  do {
    prev = html;
    html = html.replace(/<!--if:(!?)([\w-]+)-->([\s\S]*?)<!--\/if:\1\2-->/g, (m, neg, flag, inner) => {
      const on = Boolean(flags[flag]);
      return (neg ? !on : on) ? inner : '';
    });
  } while (html !== prev);
  return html;
}

function renderTemplate(page, ctx) {
  let html = expandIncludes(readTemplate(page.template));
  ctx.flags = ctx.flags || {};
  ctx.flags[`lang_${ctx.lang}`] = true;
  ctx.flags[`page_${ctx.pageKey}`] = true;
  for (const [k, val] of Object.entries(ctx.settings || {})) if (val) ctx.flags[`has_${k}`] = true;
  html = applyConditionals(html, ctx.flags);
  html = applyVars(html, ctx);
  // Slotlar
  html = html.replace(/<!--slot:([\w-]+)-->/g, (m, name) => {
    const fn = page.slots && page.slots[name];
    if (!fn) return '';
    try { return fn(ctx) || ''; } catch (err) {
      ctx.log && ctx.log.error('slot xatosi', { slot: name, err: err.message });
      return IS_PROD ? '' : `<pre class="slot-error">${esc(err.stack || err.message)}</pre>`;
    }
  });
  html = processElements(html, ctx);
  html = versionAssets(html);
  // Izohlarni olib tashlash va chekinishlarni qisqartirish (HTML hajmi kichrayadi)
  html = html.replace(/<!--(?!head-->|boot-->)[\s\S]*?-->/g, '').replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n');
  html = html.replace('<!--head-->', () => seoHead(ctx, page.seo(ctx)));
  const boot = { lang: ctx.lang, prefix: ctx.prefix, page: ctx.pageKey, build: buildId(), ...(page.boot ? page.boot(ctx) : {}) };
  html = html.replace('<!--boot-->', () => `<script id="ku-boot" type="application/json">${JSON.stringify(boot).replace(/</g, '\\u003c')}</script>`);
  return html;
}

module.exports = {
  renderTemplate, processElements, applyVars, applyConditionals, parseAttrs, decode, norm, esc, telHref,
  readTemplate, expandIncludes, versionAssets, assetHash, buildId, absUrl, VIEWS_DIR,
};
