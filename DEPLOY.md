# 🚀 Deploy yo'riqnomasi — Railway va Replit

Loyiha ikki bazada ishlaydi: **SQLite** (oddiy) va **PostgreSQL** (production).
Quyida ikkala platforma uchun eng oson yo'l.

---

## 🟣 REPLIT

Replit diski **doimiy** (Reserved VM deploy’da), shuning uchun SQLite bilan ham ma'lumot saqlanadi.

### A) Ishlab turgan Replit saytini yangi versiyaga o'tkazish (tavsiya)

1. **Zaxira oling**: Repl'dagi `data/` papkasini (yoki PostgreSQL ulangan bo'lsa — dump)
   va `public/uploads/` ni yuklab oling.
2. Yangi kod fayllarini Repl'ga yuklang va eskilari ustidan yozing. **`data/`,
   `public/uploads/` va `.replit` faylingizni o'chirmang.**
3. **▶ Run** (yoki Deploy → Redeploy). Birinchi ishga tushishda eski shablon kontenti
   avtomatik arxivlanadi va haqiqiy kontent qo'shiladi (logda: `Kontent 3-versiyaga yangilandi`).
4. `/admin` → **Sayt sozlamalari** → “Sayt manzili (SEO)” ga saytingiz manzilini yozing
   va **Tizim holati**ni tekshiring.

> Node.js **22.13+** kerak (`node:sqlite`). Repl'da `node -v` bilan tekshiring.

### B) Yangi Repl

1. [replit.com](https://replit.com) → **Create Repl** → **Import** → zip'ni yuklang.
2. Shell'da: `node server.js` (yoki Run buyrug'ini `node server.js` qilib sozlang).
3. Konsolga chiqqan **avtomatik parollarni** saqlab qo'ying (yoki Secrets'da o'zingiz bering).

### Admin panel
- `https://<sayt-manzili>/admin`
- Login: `staff@kokandu.uz` / `admin@kokandu.uz`, parol — Secrets'dagi
  `DEFAULT_STAFF_PASSWORD` / `DEFAULT_EDITOR_PASSWORD` (berilmasa — birinchi ishga
  tushishda konsolga chiqqan tasodifiy parol).
- Birinchi kirgach **Mening hisobim**dan parolni almashtiring.

### Replit'da xavfsiz production
1. **🔒 Secrets** (Tools → Secrets) ga qo'shing:
   - `NODE_ENV` = `production`
   - `ALLOW_SQLITE` = `true` (Reserved VM + SQLite bo'lsa; PostgreSQL ulansa kerak emas)
   - `DEFAULT_STAFF_PASSWORD`, `DEFAULT_EDITOR_PASSWORD` = kuchli parollar
   - `SITE_URL` = `https://sizning-domeningiz` (ixtiyoriy, admin sozlamasidan ham beriladi)
   - `TRANSLATE_PROVIDER` = `google` va `GOOGLE_TRANSLATE_KEY` (sifatli avto-tarjima uchun)
2. (Tavsiya) **Tools → PostgreSQL** — `DATABASE_URL` avtomatik qo'shiladi.
3. **Deploy**: SQLite bilan — **Reserved VM**; PostgreSQL bilan — Autoscale ham bo'ladi.
   > Autoscale/Cloud Run diski vaqtinchalik — u yerda SQLite ishlatilsa ma'lumot yo'qoladi.
4. Admin → Sozlamalar → **Tizim holati**: agar “Proxy zanjiri” to'lib, TRUST_PROXY_HOPS=0
   bo'lsa, Secrets'ga `TRUST_PROXY_HOPS=1` qo'shing (so'rov limiti har bir tashrifchiga
   alohida hisoblanishi uchun).

---

## 🚂 RAILWAY (production, PostgreSQL bilan)

Railway konteyneri **ephemeral** — shuning uchun **PostgreSQL + Volume** kerak.

### Qadamlar
1. Kodni GitHub repongizga yuklang (yoki Railway CLI: `npm i -g @railway/cli` → `railway up`).
2. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → repongizni tanlang.
3. **New → Database → PostgreSQL** qo'shing. `DATABASE_URL` avtomatik **Variables**ga tushadi.
4. **New → Volume** → Web service'ga ulang → **Mount path: `/data`**.
5. Web service → **Variables** ga qo'shing:
   ```
   NODE_ENV=production
   UPLOAD_DIR=/data/uploads
   DEFAULT_STAFF_EMAIL=staff@sizning-domen.uz
   DEFAULT_STAFF_PASSWORD=<kuchli-parol>
   DEFAULT_EDITOR_EMAIL=admin@sizning-domen.uz
   DEFAULT_EDITOR_PASSWORD=<kuchli-parol>
   SITE_URL=https://sizning-domen.uz
   TRANSLATE_PROVIDER=google
   GOOGLE_TRANSLATE_KEY=<kalit>
   ```
6. **Settings → Healthcheck Path**: `/api/health` (`railway.json`da ham bor).
7. **Deploy**. Birinchi ishga tushishda sxema + standart kontent avtomatik yaratiladi.
8. **Settings → Networking → Generate Domain** → saytingiz tayyor.
9. `<domen>/admin/login` → kiring → parolni almashtiring.

> ⚠️ Agar `DATABASE_URL` va parollar o'rnatilmasa, server **ataylab ishga tushmaydi**
> (secrets guard xatolikni logда ko'rsatadi). Bu — ma'lumot yo'qolishining oldini oladi.

### Railway CLI (GitHubsiz)
```bash
npm i -g @railway/cli
railway login
railway init
railway add --database postgres     # DATABASE_URL beradi
railway up                          # kodni yuklaydi
railway variables set NODE_ENV=production DEFAULT_STAFF_PASSWORD=... DEFAULT_EDITOR_PASSWORD=...
```

---

## ✅ Qaysi birini tanlash?

| | Replit | Railway |
|---|--------|---------|
| Osonlik | ⭐⭐⭐ (ZIP yuklab Run) | ⭐⭐ (Postgres sozlash) |
| Bepul | Bor (cheklangan) | $5 kredit/oy |
| Baza | SQLite (doimiy disk) | PostgreSQL (managed backup) |
| Real foydalanuvchi uchun | Reserved VM / Postgres bilan | ✅ Eng mos |

**Tavsiya:** tez sinash uchun **Replit**, doimiy "real users" sayti uchun **Railway + PostgreSQL**.
