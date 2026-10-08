'use strict';
/**
 * KONTENTNI 3-VERSIYAGA YANGILASH (bir martalik, xavfsiz).
 *
 * Eski versiyada bazaga Greene's College (Angliya) shablonidan qolgan yozuvlar
 * tushgan edi: Oxford suratlari "universitet binosi" deb berilgan, o'ylab
 * topilgan "talabalar" va hikoyalar, KU'da yo'q dasturlar (GCSE, Gap Year...).
 *
 * Bu modul faqat ADMIN TEGINMAGAN (created_at === updated_at) eski shablon
 * yozuvlarini `content_archive` jadvaliga ko'chiradi va o'chiradi. Admin
 * tahrirlagan yozuvlar saqlanib qoladi. So'ngra yangi (haqiqiy) kontent qo'shiladi.
 *
 * O'chirib qo'yish: CONTENT_UPGRADE=off
 */
const db = require('./index');
const log = require('../logger');
const site = require('../site-profile');

const TARGET_VERSION = 3;

/** Eski seed.js dagi shablon yozuvlari (natural kalit bo'yicha) */
const LEGACY = {
  programmes: { by: 'key', values: [
    "bakalavr",
    "tezlashtirilgan",
    "qayta",
    "tayyorlov",
    "gcse-qayta",
    "takrorlash",
    "gap-yil",
    "shaxsiy",
    "qanday-ariza",
    "kochirish",
    "tolov",
    "grant",
    "imtihonlar",
    "imtihon-tolov",
    "muddatlar",
    "sinov",
    "amaliyot",
    "gcse-amaliyot",
    "natijalar-xizmat",
    "oquv-muddat",
    "akademik",
    "turar-joy",
    "fikrlar",
    "onlayn",
    "vakansiya",
    "tutor-tarmoq",
    "kollej",
    "metod",
    "ustozlar",
    "natija-yonalish",
    "sixth-form",
    "kontakt",
    "yordam",
  ] },
  achievements: { by: 'name', values: [
    "Muhammadali Abbosxonov",
    "Shahlo Mansurova",
    "Behruz Nosirov",
  ] },
  distinctions: { by: 'title', values: [
    "Yangi boshlanish",
    "Amaliyotga yo‘naltirilgan ta’lim",
    "Individual yondashuv",
    "Chegarasiz ta’lim",
    "Hamkorlikda o‘qish",
    "Ekspert yo‘riqnomasi",
  ] },
  interests: { by: 'title', values: [
    "Yo‘nalishlar",
    "Bog‘lanish",
    "O‘quv muddatlari",
  ] },
  stories: { by: 'title', values: [
    "Kokand University talabasi bo‘lish qanday tuyg‘u?",
    "Amaliyotdan ish o‘rniga: bitiruvchi tajribasi",
    "Ilmiy loyiha: g‘oyadan natijagacha",
    "Xalqaro almashinuv dasturida bir semestr",
    "Kichik guruhlarda o‘qishning afzalligi",
    "Talabalar klublari: darsdan tashqari hayot",
    "Ustoz va shogird: mentorlik hikoyasi",
    "Grant sohibi bo‘lgan talabaning yo‘li",
    "Bitiruv kuni: yangi hayotning ostonasida",
    "Zamonaviy kutubxona va raqamli resurslar",
    "Talabamiz milliy miqyosda eng yuqori natijani qo‘lga kiritdi",
  ] },
  news: { by: 'title', values: [
    "Umummilliy AI Hackathon Farg‘ona | 2-kun",
    "Kokand University talabalari xalqaro tanlovda g‘olib bo‘ldi",
    "Yangi o‘quv yili: qabul jarayoni boshlandi",
    "Xalqaro hamkorlik: yangi shartnomalar imzolandi",
  ] },
  gallery: { by: 'image', values: [
    "images/gallery/bino-1.jpg",
    "images/gallery/bino-2.jpg",
    "images/gallery/bino-3.jpg",
    "images/gallery/bino-4.jpg",
    "images/gallery/bino-5.jpg",
    "images/gallery/bino-6.jpg",
    "images/gallery/bino-7.jpg",
    "images/gallery/bino-8.webp",
    "images/gallery/bino-9.webp",
    "images/gallery/bino-10.jpg",
    "images/gallery/ichki-1.jpg",
    "images/gallery/ichki-2.jpg",
    "images/gallery/ichki-3.png",
    "images/gallery/ichki-4.jpg",
    "images/gallery/ichki-5.jpg",
    "images/gallery/ichki-6.png",
    "images/turar-joy/tj-1.jpg",
    "images/turar-joy/tj-2.jpg",
    "images/turar-joy/tj-3.jpg",
    "images/turar-joy/tj-4.jpg",
    "images/turar-joy/tj-5.jpg",
    "images/gallery/tj-g7.jpg",
    "images/gallery/tj-g8.jpg",
    "images/gallery/tj-g9.jpg",
    "images/gallery/tj-g10.jpg",
    "images/turar-joy/tj-6.jpg",
  ] },
};

/** Endi ishlatilmaydigan yoki Greene's shablonidan qolgan sozlamalar */
const LEGACY_SETTINGS = {
  our_tutors_url: null, // istalgan qiymat — eskirgan
  stories_url: '/stories.html',
  results_title: 'Natijaga erishgan yoshlarimiz',
  results_intro: 'Universitetimiz talabalarining tanlov va olimpiadalardagi yutuqlari.',
  distinctions_title: 'Kokand University nimasi bilan ajralib turadi?',
  interests_title: 'Sizni qiziqtirishi mumkin',
  gallery_intro: 'Universitet binolari, zamonaviy auditoriyalar va kampus hayoti — bir joyda.',
  castle_phone: '+998 (00) 000-00-00',
};

async function getVersion() {
  const row = await db.get("SELECT value FROM settings WHERE key = 'content_version'");
  return Number(row && row.value) || 0;
}
async function setVersion(v) {
  await db.run(
    `INSERT INTO settings (key, value) VALUES ('content_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [String(v)]
  );
}

async function archive(table, row, reason) {
  await db.run(
    'INSERT INTO content_archive (ref_table, ref_id, payload_json, reason, archived_at) VALUES (?, ?, ?, ?, ?)',
    [table, row.id == null ? null : row.id, JSON.stringify(row), reason, Date.now()]
  );
}

/**
 * @returns {{ ran: boolean, fresh: boolean, archived: number, kept: number }}
 */
async function upgradeContent() {
  const result = { ran: false, fresh: false, archived: 0, kept: 0 };
  if (process.env.CONTENT_UPGRADE === 'off') return result;
  const ver = await getVersion();
  if (ver >= TARGET_VERSION) return result;

  // Yangi (bo'sh) baza — arxivlaydigan narsa yo'q
  let total = 0;
  for (const table of Object.keys(LEGACY)) {
    if (!site.has(table)) continue;
    const { c } = (await db.get(`SELECT COUNT(*) AS c FROM ${table}`)) || { c: 0 };
    total += Number(c);
  }
  result.ran = true;
  if (total === 0) {
    result.fresh = true;
    await setVersion(TARGET_VERSION);
    return result;
  }

  for (const [table, { by, values }] of Object.entries(LEGACY)) {
    if (!site.has(table)) continue;
    const set = new Set(values.map(String));
    const rows = await db.all(`SELECT * FROM ${table}`);
    for (const row of rows) {
      if (!set.has(String(row[by]))) continue;
      const untouched = Number(row.created_at) === Number(row.updated_at);
      if (!untouched) { result.kept += 1; continue; }
      await archive(table, row, 'v3: eski shablon (Greene\'s) yozuvi');
      await db.run(`DELETE FROM ${table} WHERE id = ?`, [row.id]);
      await db.run('DELETE FROM content_i18n WHERE ref_table = ? AND ref_id = ?', [table, row.id]);
      result.archived += 1;
    }
  }

  for (const [key, oldValue] of Object.entries(LEGACY_SETTINGS)) {
    const row = await db.get('SELECT key, value FROM settings WHERE key = ?', [key]);
    if (!row) continue;
    if (oldValue !== null && row.value !== oldValue) continue; // admin o'zgartirgan — tegmaymiz
    await archive('settings', row, 'v3: eskirgan sozlama');
    await db.run('DELETE FROM settings WHERE key = ?', [key]);
  }

  // Saqlab qolingan (admin tahrirlagan) yozuvlarda eski shablonning o'chirilgan
  // rasmlariga ("images/...") havola qolgan bo'lsa — bo'shatamiz (sayt o'z muqovasini chizadi)
  const fs = require('node:fs');
  const path = require('node:path');
  const { config } = require('../config');
  for (const table of Object.keys(LEGACY)) {
    if (!site.has(table)) continue;
    const rows = await db.all(`SELECT id, image FROM ${table} WHERE image LIKE 'images/%' OR image LIKE '/images/%'`);
    for (const row of rows) {
      const abs = path.join(config.PUBLIC_DIR, String(row.image).replace(/^\/+/, '').split(/[?#]/)[0]);
      if (abs.startsWith(config.PUBLIC_DIR) && fs.existsSync(abs)) continue;
      await archive(table, row, 'v3: eski shablon rasmi (fayl o‘chirilgan)');
      await db.run(`UPDATE ${table} SET image = '' WHERE id = ?`, [row.id]);
    }
  }

  // Eski sahifalarning CMS o'zgartirishlari ("cms-0001" ...) yangi shablonlarda yo'q —
  // ular hech qayerda qo'llanmaydi, shuning uchun arxivga o'tkaziladi.
  const ovs = await db.all('SELECT element_id, payload_json, updated_at FROM overrides');
  for (const o of ovs) {
    if (!/^cms-\d+$/.test(String(o.element_id))) continue;
    await archive('overrides', { id: null, ...o }, 'v3: eski sahifa elementi');
    await db.run('DELETE FROM overrides WHERE element_id = ?', [o.element_id]);
    result.archived += 1;
  }

  await setVersion(TARGET_VERSION);
  log.info('Kontent 3-versiyaga yangilandi', { arxivlandi: result.archived, saqlab_qolindi: result.kept });
  return result;
}

module.exports = { upgradeContent, LEGACY, TARGET_VERSION };
