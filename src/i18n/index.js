'use strict';
/**
 * Interfeys tarjimalari (UZ / RU / EN).
 *
 * Manba tili — o'zbekcha. Shablonlardagi (views/*.html) o'zbekcha matn asl
 * nusxa hisoblanadi; bu yerda faqat RU va EN tarjimalari saqlanadi.
 * Serverdagi komponentlar va brauzer skriptlari uchun kerakli satrlarda
 * `uz` ham beriladi.
 */
const DICT = require('./ui');

const LANGS = ['uz', 'ru', 'en'];
const DEFAULT_LANG = 'uz';
const HTML_LANG = { uz: 'uz', ru: 'ru', en: 'en' };
const OG_LOCALE = { uz: 'uz_UZ', ru: 'ru_RU', en: 'en_US' };
const LANG_LABEL = { uz: 'O‘zbekcha', ru: 'Русский', en: 'English' };

function normalizeLang(value) {
  const v = String(value || '').toLowerCase().slice(0, 2);
  return LANGS.includes(v) ? v : DEFAULT_LANG;
}

/** URL prefiksi: uz -> '', ru -> '/ru', en -> '/en' */
function prefix(lang) {
  return lang === DEFAULT_LANG ? '' : `/${lang}`;
}

/**
 * Kalit bo'yicha tarjima. Topilmasa — `fallback` (odatda o'zbekcha matn).
 * `vars` — {name} ko'rinishidagi o'rinbosarlar uchun.
 */
function t(key, lang, fallback, vars) {
  const entry = DICT[key];
  let out;
  if (entry && entry[lang] != null) out = entry[lang];
  else if (entry && entry.uz != null) out = entry.uz;
  else out = fallback != null ? fallback : key;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return out;
}

/** Bir nechta kalitni bitta obyektga — brauzer skriptlari uchun. */
function pick(keys, lang) {
  const out = {};
  for (const k of keys) out[k] = t(k, lang);
  return out;
}

/** O'zbekcha raqam formati: 13475 -> "13 475" */
function num(n, lang) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n == null ? '' : n);
  const s = Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return lang === 'en' ? s.replace(/ /g, ',') : s;
}

module.exports = { DICT, LANGS, DEFAULT_LANG, HTML_LANG, OG_LOCALE, LANG_LABEL, normalizeLang, prefix, t, pick, num };
