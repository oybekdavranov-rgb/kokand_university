'use strict';
// Admin va ochiq API — birlashgan ("all") profilda, vaqtinchalik baza bilan.
const h = require('./harness');

h.env(); // SITE_PROFILE berilmagan -> "all"

const { test, before, after } = require('node:test');
const assert = require('node:assert');

let app;
before(async () => { app = await h.start(); });
after(async () => { await app.close(); });

// Login rate-limit (8 urinish / 15 daqiqa) — har rol uchun bitta sessiya qayta ishlatiladi
const sessions = {};
function as(role) {
  if (!sessions[role]) {
    const c = h.client(app.base);
    sessions[role] = (role === 'staff' ? c.login('staff@kokandu.uz', h.STAFF_PW) : c.login('admin@kokandu.uz', h.EDITOR_PW)).then(() => c);
  }
  return sessions[role];
}
const staff = () => as('staff');
const editor = () => as('editor');

test('health endpoint', async () => {
  const r = await h.client(app.base).get('/api/health');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.status, 'healthy');
});

test('ochiq API: haqiqiy KU kontenti (seed) va xizmat kalitlarisiz sozlamalar', async () => {
  const { data } = await h.client(app.base).get('/api/public/site');
  assert.strictEqual(data.programmes.length, 17);
  assert.ok(data.programmes.every((p) => p.key && p.title && p.level), 'har bir yo‘nalishda kalit/nom/bosqich');
  assert.ok(data.news.length >= 6);
  assert.ok(data.distinctions.length >= 6);
  assert.ok(data.gallery.length >= 6);
  assert.ok(data.residences.length >= 5, 'shaharcha ham birlashgan profilda');
  assert.strictEqual(data.settings.phone_1, '+998 73 545-55-55');
  assert.ok(!('content_version' in data.settings), 'ichki kalit ochiq API’da ko‘rinmaydi');
  // Greene's shablonidan qolgan narsa yo'q
  const all = JSON.stringify(data);
  assert.ok(!/Greene|Oxford|GCSE/i.test(all), 'eski shablon matnlari yo‘q');
});

test('ochiq API: ?lang=ru tarjima qilingan kontent qaytaradi', async () => {
  const { data } = await h.client(app.base).get('/api/public/site?lang=ru');
  const p = data.programmes.find((x) => x.key === 'kompyuter-injiniringi');
  assert.strictEqual(p.title, 'Компьютерная инженерия');
  assert.strictEqual(p.title_uz, 'Kompyuter injiniringi');
  assert.match(data.settings.address, /Коканд/);
});

test('CSRF token siz login rad etiladi', async () => {
  const c = h.client(app.base);
  await c.get('/api/admin/session');
  assert.ok(c.jar.ku_csrf);
  const r = await c.post('/api/admin/login', { email: 'staff@kokandu.uz', password: h.STAFF_PW }, { csrf: false });
  assert.strictEqual(r.status, 403);
});

test('staff login + noto‘g‘ri parol', async () => {
  const c = h.client(app.base);
  assert.strictEqual((await c.login('staff@kokandu.uz', 'wrong')).status, 401);
  const ok = await c.login('staff@kokandu.uz', h.STAFF_PW);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.data.user.role, 'staff');
});

test('CRUD + javascript: havola tozalanadi', async () => {
  const c = await staff();
  const created = await c.post('/api/admin/news', { title: 'Test', link: 'javascript:alert(1)' });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.data.item.link, '');
  assert.strictEqual((await c.del(`/api/admin/news/${created.data.item.id}`)).status, 200);
});

test('qisman yangilash: yuborilmagan maydonlar o‘chib ketmaydi', async () => {
  const c = await staff();
  const list = (await c.get('/api/admin/programmes')).data.items;
  const p = list.find((x) => x.key === 'kompyuter-injiniringi');
  const r = await c.put(`/api/admin/programmes/${p.id}`, { title: 'Kompyuter injiniringi' }); // faqat nom
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.item.code, p.code);
  assert.strictEqual(r.data.item.price, p.price);
  assert.strictEqual(r.data.item.forms, p.forms);
  assert.strictEqual(r.data.item.level, p.level);
});

test('yo‘nalish kaliti: nomidan avtomatik va takrorlanmas', async () => {
  const c = await staff();
  const a = await c.post('/api/admin/programmes', { title: 'Sun’iy intellekt va robototexnika', level: 'bakalavr' });
  assert.strictEqual(a.status, 201);
  assert.strictEqual(a.data.item.key, 'suniy-intellekt-va-robototexnika');
  const dup = await c.post('/api/admin/programmes', { title: 'Boshqa', key: 'kompyuter-injiniringi' });
  assert.strictEqual(dup.status, 400);
  assert.match(dup.data.error, /band/);
  await c.del(`/api/admin/programmes/${a.data.item.id}`);
});

test('sozlamalar: ruxsat etilgan kalitlar, URL/email tekshiruvi (hammasi yoki hech narsa)', async () => {
  const c = await staff();
  const ok = await c.put('/api/admin/settings', { phone_2: '+998 73 545-00-00', address_ru: 'г. Коканд (тест)', evil: 'x' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.data.settings.phone_2, '+998 73 545-00-00');
  assert.ok(!('evil' in ok.data.settings));
  const bad = await c.put('/api/admin/settings', { phone_1: '+998 00 000-00-00', library_url: 'javascript:alert(1)', email: 'notanemail' });
  assert.strictEqual(bad.status, 400);
  assert.deepStrictEqual(bad.data.fields.sort(), ['email', 'library_url']);
  const now = (await c.get('/api/admin/settings')).data;
  assert.strictEqual(now.settings.phone_1, '+998 73 545-55-55', 'yaroqsiz so‘rovda hech narsa yozilmaydi');
  assert.ok(now.defaults && now.translations && now.translations.address.ru);
  // admin kiritgan ruscha manzil RU sahifada ko'rinadi
  const ru = await h.client(app.base).get('/ru/');
  assert.match(ru.text, /г\. Коканд \(тест\)/);
  await c.put('/api/admin/settings', { address_ru: '' });
});

test('editor RBAC: adminlar/sozlamalar/video taqiqlangan, matn ruxsat', async () => {
  const c = await editor();
  assert.strictEqual((await c.get('/api/admin/users')).status, 403);
  assert.strictEqual((await c.put('/api/admin/settings', { phone_1: 'x' })).status, 403);
  assert.strictEqual((await c.put('/api/admin/elements/home.hero.video', { src: '/uploads/x.mp4' })).status, 403);
  assert.strictEqual((await c.put('/api/admin/elements/home.hero.t1', { text: 'Salom' })).status, 200);
  assert.strictEqual((await c.del('/api/admin/elements/home.hero.t1')).status, 200);
  assert.strictEqual((await c.post('/api/admin/interests', { title: 'E' })).status, 201);
});

test('CMS elementi: qo‘lda RU + avtomatik EN, sahifada uch tilda', async () => {
  const c = await staff();
  const id = 'home.hero.badge';
  const put = await c.put(`/api/admin/elements/${id}`, { text: 'Qabul ochiq', text_ru: 'Приём открыт' });
  assert.strictEqual(put.status, 200);
  await h.tick(120); // fon tarjimasi (mock)
  const el = (await c.get('/api/admin/elements')).data.elements.find((e) => e.id === id);
  assert.strictEqual(el.override.text_ru, 'Приём открыт');
  assert.strictEqual(el.override.text_en, '[EN] Qabul ochiq');
  assert.strictEqual(el.override.auto_en, true);
  assert.ok(!el.override.auto_ru, 'qo‘lda kiritilgan tarjima avto deb belgilanmaydi');
  const pub = h.client(app.base);
  assert.match((await pub.get('/')).text, />Qabul ochiq</);
  assert.match((await pub.get('/ru/')).text, />Приём открыт</);
  assert.match((await pub.get('/en/')).text, />\[EN\] Qabul ochiq</);

  // O'zbekcha matn o'zgarsa — eskirgan avto-tarjima (EN) yangilanadi, qo'lda RU saqlanadi
  await c.put(`/api/admin/elements/${id}`, { text: 'Qabul davom etmoqda', text_ru: 'Приём открыт', text_en: el.override.text_en });
  await h.tick(120);
  const el2 = (await c.get('/api/admin/elements')).data.elements.find((e) => e.id === id);
  assert.strictEqual(el2.override.text_en, '[EN] Qabul davom etmoqda');
  assert.strictEqual(el2.override.text_ru, 'Приём открыт');
  assert.strictEqual((await c.del(`/api/admin/elements/${id}`)).status, 200);
  assert.match((await pub.get('/ru/')).text, /Приём 2026\/2027/);
});

test('to‘plam yozuvi tarjimasi: ko‘rish va qo‘lda tuzatish', async () => {
  const c = await editor();
  const news = (await c.get('/api/admin/news')).data.items[0];
  const g = await c.get(`/api/admin/i18n/news/${news.id}`);
  assert.strictEqual(g.status, 200);
  const title = g.data.fields.find((f) => f.field === 'title');
  assert.ok(title && title.uz === news.title && title.ru);
  const p = await c.put(`/api/admin/i18n/news/${news.id}`, { fields: { title: { ru: 'Заголовок (правка)', en: 'Title (edited)' } } });
  assert.strictEqual(p.status, 200);
  const page = await h.client(app.base).get(`/ru/yangiliklar/${news.id}`);
  assert.strictEqual(page.status, 301);
  const ru = await h.client(app.base).get(page.headers.get('location'));
  assert.match(ru.text, /Заголовок \(правка\)/);
  // shaxsiy ma'lumot (arizalar) uchun tarjima API yo'q
  assert.strictEqual((await c.get('/api/admin/i18n/applications/1')).status, 404);
});

test('so‘nggi amallar: staff hammasini, editor faqat o‘zinikini ko‘radi', async () => {
  const s = await staff();
  const all = await s.get('/api/admin/activity?limit=20');
  assert.strictEqual(all.status, 200);
  assert.ok(all.data.items.some((a) => a.email === 'admin@kokandu.uz'));
  assert.ok(all.data.items.every((a) => !('ip' in a)), 'IP manzil qaytarilmaydi');
  const e = await editor();
  const own = await e.get('/api/admin/activity?limit=50');
  assert.ok(own.data.items.length > 0);
  assert.ok(own.data.items.every((a) => a.email === 'admin@kokandu.uz'));
});

test('ochiq ariza: validatsiya + honeypot + saqlash', async () => {
  const c = h.client(app.base);
  await c.get('/api/admin/session');
  assert.strictEqual((await c.post('/api/public/apply', { name: 'Al', phone: '+998901234567' })).status, 400);
  assert.strictEqual((await c.post('/api/public/apply', { name: 'Alisher Karimov', phone: '12' })).status, 400);
  const bot = await c.post('/api/public/apply', { name: 'Bot Bot', phone: '+998901111111', website: 'spam' });
  assert.strictEqual(bot.status, 200);
  assert.ok(!bot.data.id);
  const ok = await c.post('/api/public/apply', { name: 'Nodira Yusupova', phone: '+998 91 234 56 78', email: 'n@example.com' });
  assert.strictEqual(ok.status, 201);
  assert.ok(ok.data.id);
});

test('PII himoyasi: arizalar faqat staff uchun', async () => {
  const e = await editor();
  assert.strictEqual((await e.get('/api/admin/applications')).status, 403);
  assert.strictEqual((await e.del('/api/admin/applications/1')).status, 403);
  assert.strictEqual((await e.get('/api/admin/news')).status, 200);
  const s = await staff();
  const list = await s.get('/api/admin/applications');
  assert.strictEqual(list.status, 200);
  assert.ok(Array.isArray(list.data.items));
});

test('sayt profili: birlashgan rejimda barcha to‘plamlar ochiq', async () => {
  const { profile, PROFILES, has } = require('../src/site-profile');
  assert.strictEqual(profile.name, 'all');
  assert.ok(has('news') && has('residences') && has('applications'));
  assert.ok(PROFILES.university.collections.includes('gallery'));
  assert.ok(!PROFILES.university.collections.includes('applications'));
  assert.ok(PROFILES.castle.collections.includes('applications'));
  assert.ok(!PROFILES.castle.collections.includes('news'));
  const s = await h.client(app.base).get('/api/admin/session');
  assert.ok(s.data.collections.includes('news'));
});

test('tizim holati: faqat staff, maxfiy ma’lumotsiz', async () => {
  const e = await editor();
  assert.strictEqual((await e.get('/api/admin/diagnostics')).status, 403);
  const s = await staff();
  const d = await s.get('/api/admin/diagnostics');
  assert.strictEqual(d.status, 200);
  assert.strictEqual(d.data.db, 'sqlite');
  assert.strictEqual(d.data.translate.provider, 'mock');
  assert.ok('clientIp' in d.data.proxy);
  const txt = JSON.stringify(d.data);
  assert.ok(!/password|DATABASE_URL|postgres:\/\//i.test(txt), 'parol yoki ulanish satri yo‘q');
});
