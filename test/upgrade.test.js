'use strict';
// Eski bazani (Greene's shablon kontenti bilan) 3-versiyaga xavfsiz yangilash.
const h = require('./harness');

h.env({ profile: 'university' });

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const db = require('../src/db');

before(async () => {
  await db.init();
  // "Eski" baza: admin tegmagan shablon yozuvlari, admin tahrirlagan yozuv,
  // eski sahifa elementi o'zgarishi va eskirgan sozlamalar
  const now = Date.now();
  const ins = (sql, args) => db.run(sql, args);
  await ins('INSERT INTO programmes (key, title, sort, created_at, updated_at) VALUES (?, ?, 0, ?, ?)', ['gcse-qayta', 'GCSE qayta topshirish', now, now]);
  await ins('INSERT INTO programmes (key, title, sort, created_at, updated_at) VALUES (?, ?, 0, ?, ?)', ['bakalavr', 'Bakalavriat (admin tahrirlagan)', now, now + 5000]);
  await ins('INSERT INTO achievements (name, subtitle, sort, created_at, updated_at) VALUES (?, ?, 0, ?, ?)', ['Shahlo Mansurova', 'Oxford', now, now]);
  await ins('INSERT INTO news (title, sort, created_at, updated_at) VALUES (?, 0, ?, ?)', ['Admin o‘zi qo‘shgan yangilik', now, now]);
  await ins('INSERT INTO overrides (element_id, payload_json, updated_at) VALUES (?, ?, ?)', ['cms-0138', '{"text":"eski"}', now]);
  await ins('INSERT INTO overrides (element_id, payload_json, updated_at) VALUES (?, ?, ?)', ['home.hero.t1', '{"text":"Yangi"}', now]);
  await ins('INSERT INTO settings (key, value) VALUES (?, ?)', ['stories_url', '/stories.html']);
  await ins('INSERT INTO settings (key, value) VALUES (?, ?)', ['results_title', 'Admin o‘zgartirgan sarlavha']);
});
after(async () => { try { await db.close(); } catch { /* noop */ } });

test('yangilash: shablon yozuvlari arxivga, admin ishi saqlanadi, yangi kontent qo‘shiladi', async () => {
  const { upgradeContent, TARGET_VERSION } = require('../src/db/upgrade');
  const { seedContent } = require('../src/db/seed');
  const up = await upgradeContent();
  assert.strictEqual(up.ran, true);
  assert.strictEqual(up.fresh, false);
  await seedContent({ merge: true });

  const keys = (await db.all('SELECT key FROM programmes')).map((r) => r.key);
  assert.ok(!keys.includes('gcse-qayta'), 'tegilmagan shablon yozuvi olib tashlandi');
  assert.ok(keys.includes('bakalavr'), 'admin tahrirlagan yozuv saqlandi');
  assert.ok(keys.includes('kompyuter-injiniringi'), 'haqiqiy yo‘nalishlar qo‘shildi');
  assert.strictEqual(keys.length, 18);

  const news = (await db.all('SELECT title FROM news')).map((r) => r.title);
  assert.ok(news.includes('Admin o‘zi qo‘shgan yangilik'), 'admin qo‘shgan yangilik o‘chmaydi');

  const arch = await db.all('SELECT ref_table, reason FROM content_archive');
  assert.ok(arch.some((a) => a.ref_table === 'programmes'));
  assert.ok(arch.some((a) => a.ref_table === 'achievements'));
  assert.ok(arch.some((a) => a.ref_table === 'overrides'), 'eski cms-xxxx o‘zgarishi arxivlandi');
  assert.ok(arch.some((a) => a.ref_table === 'settings'), 'eskirgan sozlama arxivlandi');

  const ov = (await db.all('SELECT element_id FROM overrides')).map((r) => r.element_id);
  assert.deepStrictEqual(ov, ['home.hero.t1'], 'yangi shablon elementlari tegilmaydi');
  const settings = Object.fromEntries((await db.all('SELECT key, value FROM settings')).map((r) => [r.key, r.value]));
  assert.ok(!('stories_url' in settings));
  assert.strictEqual(settings.results_title, 'Admin o‘zgartirgan sarlavha', 'admin qiymati saqlanadi');
  assert.strictEqual(Number(settings.content_version), TARGET_VERSION);
});

test('yangilash ikkinchi marta ishga tushmaydi (idempotent)', async () => {
  const { upgradeContent } = require('../src/db/upgrade');
  const again = await upgradeContent();
  assert.strictEqual(again.ran, false);
  const n = (await db.get('SELECT COUNT(*) AS c FROM content_archive')).c;
  await upgradeContent();
  assert.strictEqual((await db.get('SELECT COUNT(*) AS c FROM content_archive')).c, n);
});

test('CONTENT_UPGRADE=off — yangilash o‘chiriladi', async () => {
  process.env.CONTENT_UPGRADE = 'off';
  const { upgradeContent } = require('../src/db/upgrade');
  const r = await upgradeContent();
  assert.strictEqual(r.ran, false);
  delete process.env.CONTENT_UPGRADE;
});
