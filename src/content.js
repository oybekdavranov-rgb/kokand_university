'use strict';
/**
 * Kontent qatlami — sahifalar uchun ma'lumotni bir joydan oladi.
 *
 *  - Sozlamalar (settings) + standart qiymatlar
 *  - CMS o'zgartirishlari (overrides)
 *  - To'plamlar (news, programmes, ...) — tanlangan tilga tarjima qilingan holda
 *  - Kontent versiyasi: admin biror narsani o'zgartirsa `bump()` chaqiriladi va
 *    server keshidagi tayyor sahifalar yangilanadi.
 */
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const site = require('./site-profile');
const { config } = require('./config');
const contentI18n = require('./content-i18n');

const { SETTINGS_DEFAULTS, SETTINGS_I18N } = require('./settings-defaults');

let version = 1;
let snap = null;
const TTL_MS = Number(process.env.RENDER_CACHE_TTL_MS || 60 * 1000);

/** Admin kontentni o'zgartirganda chaqiriladi — keshlar yaroqsiz bo'ladi. */
function bump() { version += 1; }
function getVersion() { return version; }

const COLLECTION_ORDER = {
  news: 'sort ASC, id DESC',
  achievements: 'sort ASC, id ASC',
  distinctions: 'sort ASC, id ASC',
  interests: 'sort ASC, id ASC',
  programmes: 'sort ASC, id ASC',
  stories: 'sort ASC, id DESC',
  gallery: 'sort ASC, id ASC',
};

async function loadSnapshot() {
  const tables = Object.keys(COLLECTION_ORDER).filter((t) => site.has(t));
  const [settingsRows, overrideRows, i18nRows, ...lists] = await Promise.all([
    db.all('SELECT key, value FROM settings'),
    db.all('SELECT element_id, payload_json FROM overrides'),
    db.all('SELECT ref_table, ref_id, field, en, ru FROM content_i18n'),
    ...tables.map((t) => db.all(`SELECT * FROM ${t} ORDER BY ${COLLECTION_ORDER[t]}`)),
  ]);
  // Bazada kalit bo'lsa — uning qiymati (bo'sh bo'lsa ham: admin ataylab tozalagan).
  // Kalit umuman yo'q bo'lsa — standart qiymat.
  const settings = { ...SETTINGS_DEFAULTS };
  for (const r of settingsRows) settings[r.key] = r.value == null ? '' : String(r.value);
  const overrides = {};
  for (const r of overrideRows) {
    try { overrides[r.element_id] = JSON.parse(r.payload_json); } catch { overrides[r.element_id] = {}; }
  }
  const i18n = new Map();
  for (const r of i18nRows) i18n.set(`${r.ref_table}:${r.ref_id}:${r.field}`, { en: r.en, ru: r.ru });
  const collections = {};
  for (const key of Object.keys(COLLECTION_ORDER)) collections[key] = [];
  tables.forEach((t, i) => { collections[t] = lists[i]; });
  return { v: version, at: Date.now(), settings, overrides, i18n, collections };
}

/** Joriy kontent "surati" (kesh bilan). */
async function snapshot() {
  if (snap && snap.v === version && Date.now() - snap.at < TTL_MS) return snap;
  snap = await loadSnapshot();
  return snap;
}

/** Bitta yozuvni tanlangan tilga o'giradi (tarjima bo'lmasa — o'zbekcha). */
function localizeRow(table, row, lang, i18n) {
  if (!row || lang === 'uz') return row;
  const out = { ...row };
  for (const f of contentI18n.fieldsFor(table)) {
    out[`${f}_uz`] = row[f]; // asl (o'zbekcha) qiymat — slug va filtrlar uchun
    const tr = i18n.get(`${table}:${row.id}:${f}`);
    if (tr && tr[lang]) out[f] = tr[lang];
  }
  return out;
}

function localizeList(table, rows, lang, i18n) {
  return lang === 'uz' ? rows : rows.map((r) => localizeRow(table, r, lang, i18n));
}

/** Sahifalar va API uchun: tarjima qilingan to'plamlar + sozlamalar. */
async function getContent(lang) {
  const s = await snapshot();
  const data = { settings: localizeSettings(s.settings, lang), overrides: s.overrides, version: s.v };
  for (const [table, rows] of Object.entries(s.collections)) data[table] = localizeList(table, rows, lang, s.i18n);
  return data;
}

function localizeSettings(settings, lang) {
  if (lang === 'uz') return settings;
  const out = { ...settings };
  for (const [k, tr] of Object.entries(SETTINGS_I18N)) {
    const own = String(settings[`${k}_${lang}`] || '').trim();
    if (own) out[k] = own; // admin kiritgan tarjima
    else if (settings[k] === SETTINGS_DEFAULTS[k] && tr[lang]) out[k] = tr[lang]; // o'rnatilgan tarjima
  }
  return out;
}

/** Ochiq API uchun: ichki xizmat kalitlarisiz (content_version va h.k.) */
function publicSettings(settings, lang) {
  const out = {};
  for (const [k, v] of Object.entries(localizeSettings(settings, lang))) {
    if (!/^content_/.test(k)) out[k] = v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Rasmlar manifesti (public/img/ku/photos.json) — srcset uchun          */
/* ------------------------------------------------------------------ */
let photos = null;
function getPhotos() {
  if (photos) return photos;
  try {
    photos = JSON.parse(fs.readFileSync(path.join(config.PUBLIC_DIR, 'img', 'ku', 'photos.json'), 'utf8'));
  } catch { photos = {}; }
  return photos;
}

/** Mahalliy rasm fayli mavjudmi (eski shablon rasmlari o'chirilgan bo'lishi mumkin). */
const existsCache = new Map();
function localImageExists(src) {
  const s = String(src || '');
  if (!s) return false;
  if (/^(https?:)?\/\//i.test(s) || s.startsWith('data:')) return true;
  const clean = s.split(/[?#]/)[0].replace(/^\/+/, '');
  if (existsCache.has(clean)) return existsCache.get(clean);
  let ok = false;
  try {
    const base = clean.startsWith('uploads/') ? config.UPLOADS_DIR : config.PUBLIC_DIR;
    const rel = clean.startsWith('uploads/') ? clean.slice('uploads/'.length) : clean;
    const abs = path.normalize(path.join(base, rel));
    ok = abs.startsWith(base) && fs.statSync(abs).isFile();
  } catch { ok = false; }
  existsCache.set(clean, ok);
  if (existsCache.size > 2000) existsCache.clear();
  return ok;
}
function clearImageCache() { existsCache.clear(); }

module.exports = {
  SETTINGS_DEFAULTS, SETTINGS_I18N, bump, getVersion, snapshot, getContent,
  localizeRow, localizeList, localizeSettings, publicSettings, getPhotos, localImageExists, clearImageCache,
};
