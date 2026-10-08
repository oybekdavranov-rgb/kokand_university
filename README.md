# Kokand University — sayt va boshqaruv paneli (2027 tahriri)

Qo‘qon universitetining rasmiy sayti va uning CMS’i: uch tilda (o‘zbek, rus, ingliz)
server tomonida yig‘iladigan sahifalar, ta’lim yo‘nalishlari katalogi, yangiliklar,
qidiruv, manbali yordamchi va to‘liq admin panel.

> Nima o‘zgardi va nima uchun — **`KELAJAK.md`** faylida.

---

## Tez ishga tushirish

1. **Node.js 22.13 yoki yangisi** kerak (https://nodejs.org). `npm install` shart emas —
   baza (SQLite) Node.js ichida keladi.
2. Windows: `ISHGA-TUSHIRISH.bat` ni ikki marta bosing.
   Mac/Linux: `./ishga-tushirish.sh`
3. Sayt: http://localhost:3000 · Admin panel: http://localhost:3000/admin

Birinchi ishga tushirishda parol berilmagan bo‘lsa, konsolga **tasodifiy parol** chiqadi —
saqlab qo‘ying. O‘zingiz belgilash uchun `.env.example` ni `.env` deb nusxalang
(server `.env` ni o‘zi o‘qiydi; muhit o‘zgaruvchilari undan ustun turadi).

| Rol | Login | Nima qila oladi |
|---|---|---|
| **staff** | `staff@kokandu.uz` | Hammasi: sozlamalar, adminlar, video fon, arizalar, tizim holati |
| **editor** | `admin@kokandu.uz` | Sahifa matnlari, rasmlar, yangiliklar, yo‘nalishlar, galereya, tarjimalar |

Birinchi kirgandan so‘ng **Mening hisobim** bo‘limida parolni almashtiring.

---

## Sahifalar va manzillar

| Sahifa | UZ | RU | EN |
|---|---|---|---|
| Bosh sahifa | `/` | `/ru/` | `/en/` |
| Universitet haqida | `/universitet` | `/ru/universitet` | `/en/universitet` |
| Yo‘nalishlar katalogi | `/yonalishlar` | `/ru/yonalishlar` | `/en/yonalishlar` |
| Yo‘nalish sahifasi | `/yonalishlar/kompyuter-injiniringi` | … | … |
| Yangiliklar / yangilik | `/yangiliklar`, `/yangiliklar/12-sarlavha` | … | … |
| Hikoyalar | `/hikoyalar` | … | … |
| Galereya | `/galereya` | … | … |

Eski manzillar (`/index.html`, `/news.html`, `/stories.html`, `/galereya.html` …)
yangilariga **301** bilan yo‘naltiriladi — tashqi havolalar va Google indeksi buzilmaydi.

Texnik: `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/sw.js` (oflayn rejim),
`/api/health`, `/api/public/search?q=…`, `POST /api/public/assistant`.

---

## Admin panel (qisqacha)

- **Bosh panel** — ko‘rsatkichlar, tezkor tugmalar, so‘nggi o‘zgarishlar.
- **Sahifa matnlari** — saytdagi tayyor sarlavha/matn/rasmlar (201 ta element).
  Sahifa bo‘yicha filtr, qidiruv; har bir element uchun **UZ / RU / EN** yorliqlari.
  RU/EN bo‘sh qolsa — avtomatik tarjima qilinadi; qo‘lda yozilgani hech qachon ustidan yozilmaydi.
- **Yo‘nalishlar** — bosqich, shifr, soha, ta’lim shakllari, kontrakt narxlari
  (`Kunduzgi :: 18411520` har qatorda), asosiy fanlar, savol-javoblar.
- **Yangiliklar, Hikoyalar, Startaplar, “Nega aynan KU”, Foydali havolalar, Galereya** —
  “+ Yangi” bilan qo‘shiladi; har bir yozuvning **RU/EN tarjimasini ko‘rish va tuzatish** mumkin.
- **Fayllar** — rasm/videoni sudrab tashlab yuklash, URL’ni nusxalash.
- **Sayt sozlamalari** (staff) — telefonlar, manzil (3 tilda), ijtimoiy tarmoqlar,
  universitet xizmatlari havolalari (qabul, HEMIS, kutubxona…), SEO manzili, **Tizim holati**.
- Klaviatura: **Ctrl/⌘ + S** — joriy formani saqlash.

---

## Loyiha tuzilishi

```
server.js               kirish nuqtasi (migratsiya → adminlar → kontentni yangilash → seed → server)
src/
  app.js                HTTP marshrutlari, admin/ochiq API
  site.js, pages.js     sahifalar (SSR), marshrutlar, SEO ma’lumotlari, kesh
  render.js, views.js   shablon dvigateli va komponentlar (karta, narx, sana…)
  content.js            kontent qatlami: sozlamalar + to‘plamlar + tarjimalar (kesh bilan)
  settings-defaults.js  sayt sozlamalari standart qiymatlari (kokanduni.uz’dan)
  i18n/ui.js            interfeys lug‘ati (RU/EN)
  search.js, assistant.js  ⌘K qidiruv va manbali yordamchi (LLM’siz, faqat rasmiy ma’lumot)
  seo.js                sitemap.xml, robots.txt, service worker
  translate.js, content-i18n.js  avto-tarjima (Google / gtx / none)
  db/                   SQLite va PostgreSQL adapterlari, sxema, seed, 3-versiyaga yangilash
  security/             CSRF, parollar (scrypt), rate-limit, sanitizatsiya
views/                  sahifa shablonlari (+ partials: head, header, footer)
public/
  css/ku.css, js/ku*.js dizayn tizimi va skriptlar (ES modullar)
  img/                  KU brendi, ikonkalar, haqiqiy KU suratlari (WebP/AVIF srcset)
  fonts/2027/           Unbounded, Onest, Instrument Serif (o‘z serverimizda, OFL)
  shaharcha.html, shaharcha/   Talabalar shaharchasi sahifasi (castle profili)
  cms-manifest.json     admin "Sahifa matnlari" ro‘yxati (tools/build-manifest.js yaratadi)
admin-static/           admin panel (HTML/CSS/JS)
tools/                  build-manifest.js, build-sites.js
test/                   avtomatik testlar (node --test)
```

---

## Buyruqlar

```bash
npm start                 # universitet sayti (SITE_PROFILE=university)
npm test                  # 67 ta avtomatik test
npm run check             # manifest + lint + testlar (CI bilan bir xil)
npm run manifest          # views/ o‘zgarsa: public/cms-manifest.json ni yangilash
npm run build:sites       # 3 ta alohida loyiha: universitet / shaharcha / birlashgan
```

Shablon (`views/*.html`) ga yangi tahrirlanadigan matn qo‘shsangiz:
`data-cms-id="sahifa.blok.nom" data-cms-type="text"` bering, RU/EN tarjimasini
`src/i18n/ui.js` ga yozing va `npm run manifest` ni ishga tushiring.
`npm run check` tarjimasi yo‘q kalitlarni topib beradi.

---

## Muhit o‘zgaruvchilari

| Nomi | Izoh |
|---|---|
| `SITE_PROFILE` | `university` (asosiy) · `castle` (shaharcha) · `all` (ikkalasi) |
| `PORT` | Port (standart 3000) |
| `NODE_ENV` | `production` — xavfsiz cookie, HSTS, parol tekshiruvi |
| `DATABASE_URL` | PostgreSQL. Bo‘lmasa — SQLite (`data/app.db`) |
| `ALLOW_SQLITE` | Production’da SQLite’ga ruxsat (doimiy disk bo‘lsa: Replit Reserved VM, VPS) |
| `DEFAULT_STAFF_EMAIL/PASSWORD`, `DEFAULT_EDITOR_EMAIL/PASSWORD` | Birinchi adminlar |
| `SITE_URL` | Kanonik manzil, masalan `https://www.kokanduni.uz` (admin sozlamasi ustun) |
| `TRANSLATE_PROVIDER` | `google` (tavsiya) · `gtx` · `none` · `mock` |
| `GOOGLE_TRANSLATE_KEY` | Google Cloud Translation API kaliti |
| `UPLOAD_DIR` | Yuklamalar papkasi (Railway Volume: `/data/uploads`) |
| `TRUST_PROXY_HOPS` | Proxy ortida haqiqiy IP uchun (Admin → Sozlamalar → Tizim holati yordam beradi) |
| `CONTENT_UPGRADE` | `off` — eski kontentni 3-versiyaga avtomatik yangilashni o‘chirish |
| `RENDER_CACHE_TTL_MS` | Tayyor sahifa keshi (standart 60 000 ms) |
| `LOG_LEVEL` | `debug` · `info` · `warn` · `error` |

Deploy: **`DEPLOY.md`** (Replit va Railway), **`RAILWAY.md`**, **`PRODUCTION.md`** (Docker/VPS).

---

## Ma’lumotlar va zaxira

SQLite rejimida hamma narsa `data/` papkasida (`app.db`, `app.db-wal`, `app.db-shm`) —
zaxira olayotganda **butun papkani** nusxalang. Yuklangan fayllar `public/uploads/`
(yoki `UPLOAD_DIR`) da. Yangilashdan oldin ikkalasining nusxasini oling.
