#!/usr/bin/env node
'use strict';
/**
 * CMS MANIFESTINI YIG'ISH
 *
 *   node tools/build-manifest.js           — public/cms-manifest.json ni yangilaydi
 *   node tools/build-manifest.js --check   — faqat tekshiradi (CI uchun): manifest
 *                                            eskirgan bo'lsa yoki RU/EN tarjimasi
 *                                            yo'q kalitlar bo'lsa — xato kodi bilan chiqadi
 *
 * Manba: views/*.html dagi `data-cms-id` elementlari (admin paneldagi "Kontent").
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const VIEWS = path.join(ROOT, 'views');
const OUT = path.join(ROOT, 'public', 'cms-manifest.json');
const CHECK = process.argv.includes('--check');

process.env.SITE_PROFILE = process.env.SITE_PROFILE || 'university';
const DICT = require('../src/i18n/ui');
const { SETTINGS_DEFAULTS } = require('../src/content');

const PAGE_NAMES = {
  'index.html': 'Bosh sahifa',
  'universitet.html': 'Universitet',
  'dasturlar.html': 'Yo‘nalishlar',
  'news.html': 'Yangiliklar',
  'stories.html': 'Hikoyalar',
  'galereya.html': 'Galereya',
  '404.html': '404 sahifa',
  'offline.html': 'Oflayn sahifa',
  'partials/footer.html': 'Barcha sahifalar (pastki qism)',
  'partials/header.html': 'Barcha sahifalar (menyu)',
  'partials/head.html': 'Barcha sahifalar',
};

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&#39;': "'", '&nbsp;': ' ' };
const decode = (s) => String(s).replace(/&(?:amp|lt|gt|quot|#0?39|nbsp);/g, (m) => ENT[m] || m);
const norm = (s) => decode(s).replace(/\s+/g, ' ').trim();
function attrs(str) {
  const out = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*"([^"]*)")?/g;
  let m;
  while ((m = re.exec(str))) out[m[1]] = m[2] === undefined ? true : decode(m[2]);
  return out;
}
function resolveVars(s) {
  return String(s || '')
    .replace(/\{\{\s*L\s*\}\}/g, '')
    .replace(/\{\{\s*set:([\w.-]+)\s*\}\}/g, (m, k) => SETTINGS_DEFAULTS[k] || '');
}

function listTemplates() {
  const files = [];
  const walk = (dir, rel = '') => {
    for (const f of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, f);
      const r = rel ? `${rel}/${f}` : f;
      if (fs.statSync(abs).isDirectory()) walk(abs, r);
      else if (f.endsWith('.html')) files.push(r);
    }
  };
  walk(VIEWS);
  // Avval sahifalar, keyin qismlar (partials) — kontekst uchun
  return files.sort((a, b) => (a.startsWith('partials') ? 1 : 0) - (b.startsWith('partials') ? 1 : 0) || (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));
}

function sectionAt(src, pos) {
  const before = src.slice(0, pos);
  const re = /data-cms-section="([^"]+)"/g;
  let m; let last = null;
  while ((m = re.exec(before))) last = m[1];
  return last;
}

function build() {
  const items = new Map();
  const problems = [];
  for (const file of listTemplates()) {
    const src = fs.readFileSync(path.join(VIEWS, file), 'utf8');
    const page = PAGE_NAMES[file] || file;
    const re = /<([a-zA-Z][\w-]*)(\s[^<>]*?\bdata-cms-id="[^"]+"[^<>]*?)(\/?)>/g;
    let m;
    while ((m = re.exec(src))) {
      const tag = m[1].toLowerCase();
      const a = attrs(m[2]);
      const id = a['data-cms-id'];
      const type = a['data-cms-type'] || (tag === 'img' ? 'image' : tag === 'video' ? 'video' : tag === 'a' ? 'link' : 'text');
      const after = src.slice(m.index + m[0].length);
      let inner = '';
      if (type === 'text' || type === 'link') {
        const close = after.indexOf(`</${tag}>`);
        inner = close >= 0 ? after.slice(0, close) : '';
        if (type === 'text' && /</.test(inner)) problems.push(`${file}: ${id} — matnli elementda ichki teg bor (ruxsat etilmaydi)`);
        const span = inner.match(/<span[^>]*data-cms-text[^>]*>([^<]*)<\/span>/);
        inner = span ? span[1] : inner.replace(/<[^>]+>/g, '');
      }
      const section = sectionAt(src, m.index);
      const context = [page, section && section.split(' · ').slice(1).join(' · ')].filter(Boolean).join(' · ');
      if (items.has(id)) {
        const ex = items.get(id);
        if (!ex.pages.includes(page)) ex.pages.push(page);
        continue;
      }
      const text = norm(inner);
      let original;
      if (type === 'text') original = { text };
      else if (type === 'link') original = { text, href: resolveVars(a.href || ''), target: a.target || '' };
      else if (type === 'image') original = { src: resolveVars(a.src || ''), alt: a.alt || '', title: a.title || '' };
      else original = { src: resolveVars(a.src || ''), mimeType: a['data-type'] || '', poster: a.poster || '', autoplay: Boolean(a.autoplay), controls: Boolean(a.controls), muted: Boolean(a.muted), loop: Boolean(a.loop) };
      // Lug'atdagi tayyor RU/EN tarjima — admin panelda "standart tarjima" sifatida ko'rinadi
      const dict = DICT[id];
      if (dict && (type === 'text' || type === 'link') && original.text) { original.text_ru = dict.ru; original.text_en = dict.en; }
      if (dict && type === 'image' && original.alt) { original.alt_ru = dict.ru; original.alt_en = dict.en; }
      const label = type === 'image' ? (original.alt || original.src || id)
        : type === 'video' ? (id === 'home.hero.video' ? 'Hero orqa fon videosi (bo‘sh — WebGL fon ko‘rinadi)' : id)
          : (text || id);
      if (/\{\{/.test(text)) problems.push(`${file}: ${id} — CMS matni ichida {{...}} bo'lmasligi kerak`);
      items.set(id, { id, type, tag, label: label.slice(0, 120), context, page, pages: [page], ...(type === 'link' ? { editableText: Boolean(text) } : {}), original });
      // Tarjima tekshiruvi (matn va rasm alt)
      if ((type === 'text' || type === 'link' || type === 'image') && (original.text || original.alt)) {
        const d = DICT[id];
        if (!d || d.ru == null || d.en == null) problems.push(`${file}: ${id} — RU/EN tarjimasi lug'atda yo'q (src/i18n/ui.js)`);
      }
    }
    // data-i18n kalitlari
    const keyRe = /data-i18n="([^"]+)"|data-i18n-attr="([^"]+)"/g;
    while ((m = keyRe.exec(src))) {
      const keys = m[1] ? [m[1]] : m[2].split(';').map((p) => p.split(':')[1]).filter(Boolean);
      for (const k of keys) {
        const d = DICT[k.trim()];
        if (!d || d.ru == null || d.en == null) problems.push(`${file}: ${k} — data-i18n kaliti lug'atda to'liq emas`);
      }
    }
  }
  const list = [...items.values()].map((it) => {
    const { pages, ...rest } = it;
    if (pages.length > 1) rest.context = `${rest.context} (+ ${pages.slice(1).join(', ')})`;
    return rest;
  });
  return { list, problems: [...new Set(problems)] };
}

const { list, problems } = build();
const json = JSON.stringify(list, null, 1) + '\n';
if (CHECK) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== json) problems.push('public/cms-manifest.json eskirgan — `node tools/build-manifest.js` ni ishga tushiring');
  if (problems.length) { console.error(problems.map((p) => ' - ' + p).join('\n')); process.exit(1); }
  console.log(`OK: ${list.length} ta CMS elementi, tarjimalar to'liq.`);
} else {
  fs.writeFileSync(OUT, json);
  console.log(`cms-manifest.json: ${list.length} ta element yozildi.`);
  if (problems.length) console.warn('Ogohlantirishlar:\n' + problems.map((p) => ' - ' + p).join('\n'));
}
