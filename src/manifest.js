'use strict';
const fs = require('node:fs');
const db = require('./db');
const { config } = require('./config');
const site = require('./site-profile');
const { sanitizeString, sanitizeUrl } = require('./security/sanitize');

let manifest = [];
let manifestMap = new Map();

let manifestLoaded = false;

function loadManifest() {
  // Manifest bo'lmasligi ham mumkin (masalan, kontenti to'liq bazadan keladigan
  // sayt) — bunda "Kontent" bo'limi bo'sh bo'ladi, server esa ishlayveradi.
  // Shaharcha (castle) profilida universitet sahifalari yo'q — elementlar ham yo'q.
  if (site.profile.homepage !== 'index.html') {
    manifest = [];
  } else if (fs.existsSync(config.MANIFEST_PATH)) {
    manifest = JSON.parse(fs.readFileSync(config.MANIFEST_PATH, 'utf8'));
  } else {
    manifest = [];
  }
  manifestMap = new Map(manifest.map((item) => [item.id, item]));
  manifestLoaded = true;
  return manifest;
}

function getManifest() {
  if (!manifestLoaded) loadManifest();
  return { manifest, manifestMap };
}

async function getOverridesMap() {
  const rows = await db.all('SELECT element_id, payload_json, updated_at FROM overrides');
  const map = new Map();
  for (const row of rows) {
    try {
      map.set(row.element_id, { ...JSON.parse(row.payload_json), updatedAt: row.updated_at });
    } catch {
      map.set(row.element_id, { updatedAt: row.updated_at });
    }
  }
  return map;
}

async function getOverride(elementId) {
  const row = await db.get('SELECT payload_json, updated_at FROM overrides WHERE element_id = ?', [elementId]);
  if (!row) return null;
  try { return { ...JSON.parse(row.payload_json), updatedAt: row.updated_at }; } catch { return { updatedAt: row.updated_at }; }
}

function mergeElement(element, override) {
  const ov = override ? { ...override } : null;
  if (ov) delete ov.updatedAt;
  return {
    ...element,
    hasOverride: Boolean(override),
    updatedAt: override?.updatedAt || null,
    override: ov, // admin panel: faqat admin kiritgan qiymatlar (standart tarjimadan farqlash uchun)
    current: { ...element.original, ...(ov || {}) },
  };
}

async function saveOverride(elementId, payload) {
  await db.run(
    `INSERT INTO overrides (element_id, payload_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(element_id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    [elementId, JSON.stringify(payload), Date.now()]
  );
}

async function deleteOverride(elementId) {
  await db.run('DELETE FROM overrides WHERE element_id = ?', [elementId]);
}

const LANGS = ['ru', 'en'];

/**
 * Admin yuborgan ma'lumotni tozalaydi va saqlanadigan "override" ga aylantiradi.
 *
 * Tarjimalar: `text_ru`/`text_en` (matn, havola) va `alt_ru`/`alt_en` (rasm).
 * Avtomatik tarjima (`auto_<til>`) admin o'zbekcha matnni o'zgartirganda eskiradi —
 * agar admin RU/EN maydoniga tegmagan bo'lsa, u olib tashlanadi va fon rejimida
 * qayta tarjima qilinadi. Admin qo'lda yozgan tarjima hech qachon ustidan yozilmaydi.
 *
 * @param {object} element  manifest elementi
 * @param {object} body     so'rov tanasi
 * @param {object} [existing] bazadagi joriy override (bo'lsa)
 */
function normalizeOverridePayload(element, body, existing) {
  body = body && typeof body === 'object' ? body : {};
  const prev = existing && typeof existing === 'object' ? existing : {};
  const payload = {};
  payload.hide = Boolean(body.hide);
  payload.linkUrl = sanitizeUrl(body.linkUrl || '');
  payload.linkTarget = body.linkTarget === '_blank' ? '_blank' : '_self';
  let trField = null;
  let baseField = null;
  if (element.type === 'text') {
    payload.text = sanitizeString(body.text, 20000);
    trField = 'text'; baseField = 'text';
  } else if (element.type === 'link') {
    if (element.editableText) { payload.text = sanitizeString(body.text, 5000); trField = 'text'; baseField = 'text'; }
    payload.href = sanitizeUrl(body.href || '');
    payload.target = body.target === '_blank' ? '_blank' : '_self';
  } else if (element.type === 'image') {
    payload.src = sanitizeUrl(body.src || '');
    payload.alt = sanitizeString(body.alt, 1000);
    payload.title = sanitizeString(body.title, 1000);
    trField = 'alt'; baseField = 'alt';
  } else if (element.type === 'video') {
    payload.src = sanitizeUrl(body.src || '');
    payload.mimeType = sanitizeString(body.mimeType, 255);
    payload.poster = sanitizeUrl(body.poster || '');
    payload.autoplay = Boolean(body.autoplay);
    payload.controls = Boolean(body.controls);
    payload.muted = Boolean(body.muted);
    payload.loop = Boolean(body.loop);
  }
  if (trField) {
    const baseChanged = String(prev[baseField] || '') !== String(payload[baseField] || '');
    for (const l of LANGS) {
      const key = `${trField}_${l}`;
      const val = sanitizeString(body[key], trField === 'text' ? 20000 : 1000);
      if (!val) continue;
      const untouchedAuto = prev[`auto_${l}`] && val === String(prev[key] || '');
      if (untouchedAuto && baseChanged) continue; // eskirgan avto-tarjima — qayta tarjima qilinadi
      payload[key] = val;
      if (untouchedAuto) payload[`auto_${l}`] = true;
    }
  }
  return payload;
}

module.exports = {
  loadManifest, getManifest, getOverridesMap, getOverride, mergeElement,
  saveOverride, deleteOverride, normalizeOverridePayload,
};
