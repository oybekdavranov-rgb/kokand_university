'use strict';
// Avto-tarjima pipeline testi (mock provayder — tarmoqsiz, deterministik).
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;
process.env.TRANSLATE_PROVIDER = 'mock';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kutr-'));
process.env.SQLITE_PATH = path.join(TMP, 'test.db');

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const db = require('../src/db');
const translateMod = require('../src/translate');
const contentI18n = require('../src/content-i18n');

before(async () => {
  await db.init();
  translateMod._setProvider('mock');
});
after(async () => { try { await db.close(); } catch { /* noop */ } });

test('translate: mock provayder en/ru qaytaradi', async () => {
  assert.strictEqual(await translateMod.translate('Salom', 'en'), '[EN] Salom');
  assert.strictEqual(await translateMod.translate('Salom', 'ru'), '[RU] Salom');
  assert.strictEqual(await translateMod.translate('Salom', 'uz'), 'Salom'); // manba tili o'zgarmaydi
});

test('translateRow + buildDictionary: uz -> {en, ru} lug‘at', async () => {
  await contentI18n.translateRow('news', { id: 1, title: 'Assalomu alaykum', excerpt: 'Qisqa', body: '' });
  const dict = await contentI18n.buildDictionary();
  assert.deepStrictEqual(dict['Assalomu alaykum'], { en: '[EN] Assalomu alaykum', ru: '[RU] Assalomu alaykum' });
  assert.deepStrictEqual(dict['Qisqa'], { en: '[EN] Qisqa', ru: '[RU] Qisqa' });
});

test('translateRow: bo‘sh maydon lug‘atga tushmaydi', async () => {
  await contentI18n.translateRow('news', { id: 2, title: 'Faqat sarlavha', excerpt: '', body: '' });
  const dict = await contentI18n.buildDictionary();
  assert.ok(dict['Faqat sarlavha']);
  // id:2 ning bo'sh excerpt'i yozilmaydi
  const rows = await db.all("SELECT field FROM content_i18n WHERE ref_table='news' AND ref_id=2");
  assert.ok(!rows.some((r) => r.field === 'excerpt'));
});

test('buildDictionary: ko‘p qatorli maydon qatorma-qator ham qo‘shiladi', async () => {
  await contentI18n.translateRow('programmes', { id: 3, title: 'Dastur', highlights: 'Birinchi\nIkkinchi', subtitle: '', intro: '', faq: '' });
  const dict = await contentI18n.buildDictionary();
  assert.ok(dict['Birinchi'] && /\[EN\] Birinchi/.test(dict['Birinchi'].en), 'qator entry');
});

test('tarjima xizmati ishlamasa — bo‘sh qoladi va keyingi urinishda to‘ldiriladi', async () => {
  translateMod._setProvider('none');
  assert.strictEqual(await translateMod.translateStrict('Yangi bino', 'en'), null);
  assert.strictEqual(await translateMod.translate('Yangi bino', 'en'), 'Yangi bino', 'sayt uchun asl matn qaytadi');
  await contentI18n.translateRow('news', { id: 7, title: 'Yangi bino' });
  let row = await db.get("SELECT en, ru FROM content_i18n WHERE ref_table='news' AND ref_id=7 AND field='title'");
  assert.strictEqual(row.en, null, 'xato tarjima asl matn bilan "yopib" qo‘yilmaydi');
  translateMod._setProvider('mock');
  await contentI18n.translateRow('news', { id: 7, title: 'Yangi bino' });
  row = await db.get("SELECT en, ru FROM content_i18n WHERE ref_table='news' AND ref_id=7 AND field='title'");
  assert.strictEqual(row.en, '[EN] Yangi bino');
  assert.strictEqual(row.ru, '[RU] Yangi bino');
});

test('qo‘lda tuzatilgan tarjima qayta tarjimada o‘zgarmaydi', async () => {
  await db.run("UPDATE content_i18n SET ru = 'Новое здание' WHERE ref_table='news' AND ref_id=7 AND field='title'");
  await contentI18n.translateRow('news', { id: 7, title: 'Yangi bino' });
  const row = await db.get("SELECT ru FROM content_i18n WHERE ref_table='news' AND ref_id=7 AND field='title'");
  assert.strictEqual(row.ru, 'Новое здание');
});
