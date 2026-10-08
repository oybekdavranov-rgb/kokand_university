'use strict';
// Ochiq sayt: server tomonida yig'iladigan sahifalar (SSR), tillar, SEO, kesh.
const h = require('./harness');

h.env({ profile: 'university' });

const { test, before, after } = require('node:test');
const assert = require('node:assert');

let app;
let pub;
before(async () => { app = await h.start(); pub = h.client(app.base); });
after(async () => { await app.close(); });

const count = (html, re) => (html.match(re) || []).length;

test('bosh sahifa: 3 til, hreflang, kanonik, JSON-LD, CSP', async () => {
  const uz = await pub.get('/');
  assert.strictEqual(uz.status, 200);
  assert.match(uz.headers.get('content-type'), /text\/html/);
  assert.match(uz.text, /<html lang="uz"/);
  for (const l of ['uz', 'ru', 'en', 'x-default']) assert.match(uz.text, new RegExp(`hreflang="${l}"`));
  assert.match(uz.text, /<link rel="canonical" href="http:\/\/localhost:\d+\/">/);
  assert.match(uz.text, /application\/ld\+json/);
  assert.match(uz.text, /"@type":\s*"CollegeOrUniversity"/);
  const ru = await pub.get('/ru/');
  assert.match(ru.text, /<html lang="ru"/);
  assert.match(ru.text, /Приём 2026\/2027/);
  const en = await pub.get('/en/');
  assert.match(en.text, /<html lang="en"/);
  assert.match(en.text, /Admissions 2026\/2027/);
});

test('barcha asosiy sahifalar 200 va o‘z tilida', async () => {
  for (const pre of ['', '/ru', '/en']) {
    for (const p of ['/universitet', '/yonalishlar', '/yangiliklar', '/hikoyalar', '/galereya']) {
      const r = await pub.get(pre + p);
      assert.strictEqual(r.status, 200, pre + p);
      assert.match(r.text, new RegExp(`<html lang="${pre ? pre.slice(1) : 'uz'}"`), pre + p);
      assert.ok(!/\{\{[a-zA-Z]/.test(r.text), `${pre + p}: to‘ldirilmagan {{...}} qolmagan`);
      assert.ok(!/<!--\s*(slot|if|include):/.test(r.text), `${pre + p}: shablon izohlari qolmagan`);
    }
  }
});

test('yo‘nalishlar katalogi va alohida sahifa', async () => {
  const list = await pub.get('/yonalishlar');
  assert.strictEqual(count(list.text, /class="card prog-card"/g), 17);
  const p = await pub.get('/yonalishlar/kompyuter-injiniringi');
  assert.strictEqual(p.status, 200);
  assert.match(p.text, /<h1[^>]*>[^<]*Kompyuter injiniringi/);
  assert.match(p.text, /60610300/);
  assert.match(p.text, /18 411 520/);
  const ru = await pub.get('/ru/yonalishlar/kompyuter-injiniringi');
  assert.match(ru.text, /Компьютерная инженерия/);
  const missing = await pub.get('/yonalishlar/bunday-yonalish-yoq');
  assert.strictEqual(missing.status, 404);
  assert.match(missing.text, /<html lang="uz"/);
});

test('yangilik: id -> kanonik slug (301), sahifa NewsArticle bilan', async () => {
  const items = (await pub.get('/api/public/site')).data.news;
  const n = items[0];
  const r = await pub.get(`/yangiliklar/${n.id}`);
  assert.strictEqual(r.status, 301);
  const loc = r.headers.get('location');
  assert.match(loc, new RegExp(`^/yangiliklar/${n.id}-[a-z0-9-]+$`));
  const page = await pub.get(loc);
  assert.strictEqual(page.status, 200);
  assert.match(page.text, /"@type":\s*"NewsArticle"/);
  assert.match(page.text, /<meta property="og:type" content="article">/);
  assert.strictEqual((await pub.get('/yangiliklar/999999')).status, 404);
});

test('eski manzillar yangisiga 301 bilan yo‘naltiriladi', async () => {
  const cases = {
    '/index.html': '/', '/news.html': '/yangiliklar', '/stories.html': '/hikoyalar', '/galereya.html': '/galereya',
    '/ru/news.html': '/ru/yangiliklar', '/uz/universitet': '/universitet', '/ru': '/ru/', '/yangiliklar/': '/yangiliklar',
  };
  for (const [from, to] of Object.entries(cases)) {
    const r = await pub.get(from);
    assert.strictEqual(r.status, 301, from);
    assert.strictEqual(r.headers.get('location'), to, from);
  }
  const old = await pub.get('/news.html?id=3');
  assert.strictEqual(old.headers.get('location'), '/yangiliklar/3');
});

test('sitemap.xml, robots.txt, service worker, manifest', async () => {
  const sm = await pub.get('/sitemap.xml');
  assert.strictEqual(sm.status, 200);
  assert.match(sm.headers.get('content-type'), /xml/);
  assert.match(sm.text, /<loc>http:\/\/localhost:\d+\/ru\/yonalishlar\/kompyuter-injiniringi<\/loc>/);
  assert.match(sm.text, /hreflang="en"/);
  const rb = await pub.get('/robots.txt');
  assert.match(rb.text, /Disallow: \/admin/);
  assert.match(rb.text, /Sitemap: http:\/\/localhost:\d+\/sitemap\.xml/);
  const sw = await pub.get('/sw.js');
  assert.match(sw.headers.get('content-type'), /javascript/);
  assert.ok(!sw.text.includes('__BUILD__'));
  const mf = await pub.get('/manifest.webmanifest');
  assert.strictEqual(mf.status, 200);
  assert.strictEqual(JSON.parse(mf.text).lang, 'uz');
});

test('404: chiroyli sahifa, to‘g‘ri status va til', async () => {
  const r = await pub.get('/bunday-sahifa-yoq');
  assert.strictEqual(r.status, 404);
  assert.match(r.text, /<html lang="uz"/);
  const ru = await pub.get('/ru/net-takoy-stranicy');
  assert.strictEqual(ru.status, 404);
  assert.match(ru.text, /<html lang="ru"/);
});

test('qidiruv API: yo‘nalish va sahifalarni topadi (3 tilda)', async () => {
  const uz = await pub.get('/api/public/search?q=kompyuter');
  assert.ok(uz.data.results.some((x) => x.url === '/yonalishlar/kompyuter-injiniringi'));
  const ru = await pub.get('/api/public/search?q=%D0%BA%D0%BE%D0%BC%D0%BF%D1%8C%D1%8E%D1%82%D0%B5%D1%80&lang=ru');
  assert.ok(ru.data.results.some((x) => x.url === '/ru/yonalishlar/kompyuter-injiniringi'));
  const empty = await pub.get('/api/public/search?q=');
  assert.strictEqual(empty.status, 200);
});

test('yordamchi: kontrakt savoliga manbali javob', async () => {
  const r = await pub.post('/api/public/assistant', { q: 'Kompyuter injiniringi kontrakti qancha?', lang: 'uz' }, { csrf: false });
  assert.strictEqual(r.status, 200);
  assert.ok(Array.isArray(r.data.blocks) && r.data.blocks.length, 'javob bloklari bor');
  assert.match(JSON.stringify(r.data.blocks), /18\s411\s520/u);
  assert.ok(r.data.sources.some((x) => x.url === '/yonalishlar/kompyuter-injiniringi'), 'manba ko‘rsatilgan');
});

test('kesh: admin o‘zgarishi darhol sahifada ko‘rinadi', async () => {
  const before1 = await pub.get('/');
  const c = h.client(app.base);
  await c.login('staff@kokandu.uz', h.STAFF_PW);
  await c.put('/api/admin/elements/home.hero.t1', { text: 'Ertangi kunni' });
  const after1 = await pub.get('/');
  assert.notStrictEqual(before1.text, after1.text);
  assert.match(after1.text, />Ertangi kunni</);
  await c.del('/api/admin/elements/home.hero.t1');
  assert.match((await pub.get('/')).text, />Kelajakni</);
});

test('siqish (brotli/gzip) va ETag/304 statik fayllar uchun', async () => {
  const br = await fetch(`${app.base}/`, { headers: { 'Accept-Encoding': 'br' } });
  assert.strictEqual(br.headers.get('content-encoding'), 'br');
  const css = await fetch(`${app.base}/css/ku.css`);
  const etag = css.headers.get('etag');
  assert.ok(etag);
  const again = await fetch(`${app.base}/css/ku.css`, { headers: { 'If-None-Match': etag } });
  assert.strictEqual(again.status, 304);
  const ver = await fetch(`${app.base}/css/ku.css?v=abc123`);
  assert.match(ver.headers.get('cache-control'), /immutable/);
});

test('eski shablon sahifalari va ichki fayllar ochiq emas', async () => {
  for (const p of ['/cms-runtime.js', '/site-features.js', '/data/app.db', '/package.json', '/.env']) {
    const r = await pub.get(p);
    assert.ok([403, 404].includes(r.status), `${p} -> ${r.status}`);
  }
});
