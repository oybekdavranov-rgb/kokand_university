'use strict';
/**
 * SAYT SOZLAMALARI — standart qiymatlar (bog'liqliksiz modul).
 *
 * config.js (ruxsat etilgan kalitlar ro'yxati) va content.js (sahifalar uchun)
 * shu yerdan oladi. Bazada kalit bo'lmasa shu qiymatlar ishlatiladi; admin
 * paneldan o'zgartirilgan qiymat bazaga yoziladi va ustun turadi.
 */

/* ------------------------------------------------------------------ */
/* Sozlamalar: bazada bo'lmasa shu qiymatlar ishlatiladi                 */
/* Manba: kokanduni.uz (2026-yil oktabr holati)                          */
/* ------------------------------------------------------------------ */
const SETTINGS_DEFAULTS = {
  site_url: '',
  official_url: 'https://www.kokanduni.uz',
  admission_url: 'https://qabul.kokanduni.uz',
  structure_url: 'https://qoqon-universiteti-tuzilma--stingerpubgm77.replit.app/',
  hemis_student_url: 'https://student.kokanduni.uz',
  hemis_teacher_url: 'https://hemis.kokanduni.uz',
  library_url: 'https://library.kokanduni.uz',
  webmail_url: 'https://webmail.kokanduni.uz',
  rector_bot_url: 'https://t.me/direktorkokandunibot',
  admission_tg_url: 'https://t.me/kuqabul2025',
  vacancies_url: 'https://hrd.kokanduni.uz',
  journal_url: 'https://herald.kokanduni.uz/index.php/public_html',
  scholar_url: 'https://scholar.kokanduni.uz/index.php/rb',
  license_url: 'https://www.kokanduni.uz/uz/static/license',
  campus_url: '',
  phone_1: '+998 73 545-55-55',
  phone_2: '+998 73 545-44-44',
  email: 'info@kokanduni.uz',
  press_email: 'press@kokanduni.uz',
  address: 'Farg‘ona viloyati, Qo‘qon shahri, Turkiston ko‘chasi, 28-A uy',
  address_branch: 'Andijon viloyati, Andijon shahri, Bobur shoh ko‘chasi, 2-b uy',
  postal_code: '150700',
  map_url: 'https://maps.app.goo.gl/ZZyjxu1bQYcoTXGb8',
  telegram_url: 'https://t.me/kokanduniversity',
  instagram_url: 'https://www.instagram.com/kokanduniversity.official/',
  facebook_url: 'https://www.facebook.com/kokanduniversity/',
  youtube_url: 'https://www.youtube.com/@KokandUniversity',
  legal_name: '“Qo‘qon universiteti” MCHJ',
};

/**
 * Til bilan bog'liq sozlamalar — o'rnatilgan RU/EN tarjimasi.
 * Admin o'zbekcha qiymatni o'zgartirsa, `<kalit>_ru` / `<kalit>_en` maydonlarini
 * ham to'ldirishi mumkin (aks holda o'zbekcha qiymat ko'rsatiladi).
 */
const SETTINGS_I18N = {
  address: { ru: 'Ферганская область, г. Коканд, ул. Туркистон, дом 28-А', en: '28-A Turkiston Street, Kokand, Fergana Region, Uzbekistan' },
  address_branch: { ru: 'Андижанская область, г. Андижан, ул. Бобур шох, дом 2-б', en: '2-b Bobur Shoh Street, Andijan, Andijan Region, Uzbekistan' },
  legal_name: { ru: 'ООО «Qo‘qon universiteti»', en: '“Qo‘qon universiteti” LLC' },
};

/** Shaharcha (castle) profili sahifasi foydalanadigan sozlamalar */
const CASTLE_SETTINGS = ['castle_title', 'castle_intro', 'castle_phone', 'castle_email', 'university_url'];

/** Admin paneldan yozish mumkin bo'lgan barcha kalitlar */
const ALLOWED_KEYS = [
  ...Object.keys(SETTINGS_DEFAULTS),
  ...Object.keys(SETTINGS_I18N).flatMap((k) => [`${k}_ru`, `${k}_en`]),
  ...CASTLE_SETTINGS,
];

module.exports = { SETTINGS_DEFAULTS, SETTINGS_I18N, CASTLE_SETTINGS, ALLOWED_KEYS };
