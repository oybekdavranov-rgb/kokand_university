# Kokand University — “Kelajak” versiyasi (3.0, 2027 tahriri)

Bu hujjat ishlab turgan saytning kodi qanday qilib yangi holatga olib chiqilgani,
nima o‘zgargani va qaysi qarorlar nima uchun qabul qilinganini tushuntiradi.

---

## 1. Qisqacha

| | Oldin | Endi |
|---|---|---|
| Sahifalar | Greene’s College (Oksford) WordPress sahifalarining nusxasi, matnlar brauzerda JS bilan almashtirilardi | Server tomonida yig‘iladigan (SSR) o‘z sahifalari, KU brendida |
| Kontent | Oksford suratlari “KU binosi” sifatida, o‘ylab topilgan talabalar, KU’da yo‘q dasturlar (GCSE, Gap Year…) | kokanduni.uz’dagi haqiqiy ma’lumot: 17 yo‘nalish, 2026/27 narxlari, aloqa, yangiliklar, startaplar |
| Tillar | Matnni brauzerda “so‘zma-so‘z” almashtirish | Har bir til o‘z manzilida: `/`, `/ru/`, `/en/` — Google uchun alohida indekslanadi |
| SEO | Yo‘q darajada | Kanonik havola, hreflang, Open Graph, JSON-LD (Universitet, Kurs, Yangilik), sitemap.xml |
| Tezlik | ~25 MB statik fayl, jQuery + o‘nlab plaginlar | Sahifa 150–440 KB; LCP: kompyuterda ~0,7 s, sekin telefonda ~1,7 s; CLS ≈ 0 |
| Admin panel | Element ID’lari (`cms-0138`) bilan ishlash | Sahifa/turi bo‘yicha filtr, UZ/RU/EN yorliqlari, tarjimani tuzatish, sudrab yuklash, tizim holati |
| Testlar | 36 ta | 67 ta (API, xavfsizlik, SSR/SEO, yangilash, tarjima) + ESLint toza |

---

## 2. Dizayn — “Rishton sirlari”

- **Ranglar**: Rishton sopol sirlari (feruza, kobalt, oltin) + KU qirmizisi `#9C1447`.
- **Shriftlar** (o‘z serverimizda, OFL litsenziya): Unbounded — sarlavhalar, Onest — matn
  (kirill va o‘zbek lotini to‘liq), Instrument Serif — urg‘u so‘zlar.
- **Logotip**: KU belgisi vektorga o‘tkazildi (`public/img/brand/`), favicon va PWA ikonkalari.
- **Jonli elementlar**: WebGL “sir” foni, girih naqshi, KU medalyoni, scroll bilan paydo
  bo‘lish, raqamlar hisoblagichi, sahifalar orasida silliq o‘tish (View Transitions).
- **Rejimlar**: yorug‘ / tungi / yuqori kontrast / “tinch” (animatsiyasiz), shrift kattaligi.
  `prefers-reduced-motion` hurmat qilinadi.
- **Imkoniyatlar**: ⌘K qidiruv, “Yo‘nalish tanlash” testi, yo‘nalishlarni solishtirish,
  narx/soha/shakl filtrlari, galereya lightbox, manbali yordamchi (javob faqat rasmiy
  ma’lumotdan, manba havolasi bilan), oflayn rejim (PWA).

## 3. Kontent qayerdan olindi

Hammasi **kokanduni.uz** (2026-yil oktabr holati) dan: bosh sahifa, yo‘nalishlar
(`/static/specializations`), universitet haqida, tashkiliy tuzilma, aloqa, qo‘shma
dasturlar, startaplar va yangiliklar. Suratlar — faqat KU’ning o‘z suratlari.

**Universitet tomonidan tasdiqlanishi kerak** (vaqt o‘tishi bilan o‘zgaradi):
kontrakt narxlari (har o‘quv yili), talabalar soni, hamkor universitetlar ro‘yxati,
startaplarning mukofotlari. Hammasi admin paneldan tahrirlanadi.

## 4. Muhim qarorlar

1. **Greene’s shablon kontenti o‘chirilmadi — arxivlandi.** Server birinchi ishga
   tushganda (`src/db/upgrade.js`) admin teginmagan eski yozuvlarni `content_archive`
   jadvaliga ko‘chiradi, admin tahrirlagan yoki qo‘shgan yozuvlar **joyida qoladi**,
   so‘ng haqiqiy kontent qo‘shiladi. Bir marta ishlaydi; `CONTENT_UPGRADE=off` bilan o‘chiriladi.
2. **Begona mualliflik materiallari olib tashlandi**: Greene’s College suratlari,
   videosi, WordPress CSS/JS (≈16 MB). Ular boshqa muassasaning mulki edi.
3. **Nusxa olishni taqiqlovchi skript** (o‘ng tugma, matn belgilash bloki) universitet
   saytidan olib tashlandi: u foydalanish qulayligi va ekran o‘quvchilarga zarar berardi,
   himoya esa bermasdi (sahifa kodi baribir ochiq).
4. **Menyu havolalari** endi “Sayt sozlamalari”da (qabul, HEMIS, kutubxona…), chunki
   ular faqat staff tomonidan o‘zgartirilishi kerak (fishing xavfi).
5. **Talabalar shaharchasi sahifasi** (`castle` profili) dizayni o‘zgartirilmadi —
   faqat favicon va eski havolalar tuzatildi. Undagi suratlar illyustrativ; haqiqiy
   suratlarga almashtirish tavsiya etiladi.
6. **Avto-tarjima xatoga chidamli**: xizmat ishlamasa tarjima bo‘sh qoladi (asl matn
   bilan “yopib” qo‘yilmaydi) va keyingi urinishda to‘ldiriladi. Qo‘lda tuzatilgan
   tarjima hech qachon ustidan yozilmaydi.

## 5. Xavfsizlik va ishonchlilik (tuzatilgan muammolar)

- Buzilgan URL yoki noto‘g‘ri `Host` sarlavhasi bilan kelgan so‘rov serverni
  “osiltirib” qo‘yardi (javob qaytmasdi) — endi darhol `400`.
- `.env` fayli umuman o‘qilmasdi (README’da aytilgan bo‘lsa ham) — endi o‘qiladi.
- Admin yo‘nalishni saqlaganda yangi maydonlar (shifr, narx…) o‘chib ketishi mumkin edi —
  endi qisman yangilash: yuborilmagan maydon o‘zgarmaydi.
- Sozlamalardagi havolalar `javascript:`/`data:` dan tozalanadi, email tekshiriladi;
  bitta maydon xato bo‘lsa hech narsa yozilmaydi.
- Yo‘nalish manzili (kalit) takrorlanmaydi va nomidan avtomatik yasaladi.
- Kanonik havola `Host` sarlavhasi orqali soxtalashtirilmaydi; kesh har bir manzil uchun alohida.
- Mavjud himoyalar saqlandi: CSRF, scrypt parollar, rate-limit, rollar (RBAC), fayl
  imzosini tekshirish, CSP va boshqa xavfsizlik sarlavhalari, audit jurnali.

## 6. Qulaylik (accessibility)

axe-core (WCAG 2.1 AA avtomatik tekshiruvlari) — asosiy sahifalarda **0 ta xato**.
Klaviatura bilan to‘liq boshqariladi, “asosiy kontentga o‘tish” havolasi, ARIA belgilar,
kontrast rejimi, shrift kattaligi, animatsiyani o‘chirish.

## 7. Yangi saytga o‘tish (mavjud bazali server)

1. **Zaxira oling**: `data/` papkasi (SQLite) yoki PostgreSQL dump + `public/uploads/`.
2. Yangi kodni joylang (`data/` va `uploads/` ni o‘chirmang).
3. Serverni qayta ishga tushiring — logda
   `Kontent 3-versiyaga yangilandi {"arxivlandi": N, ...}` chiqadi.
4. Admin → **Sayt sozlamalari**: “Sayt manzili (SEO)” ni kiriting, **Tizim holati**ni
   tekshiring (tarjima xizmati, proxy).
5. Saytni uch tilda ko‘rib chiqing; kerak bo‘lsa “Sahifa matnlari”da tuzating.

## 8. Keyingi qadamlar (tavsiya)

- **Google Cloud Translation kaliti** (`GOOGLE_TRANSLATE_KEY`) — bepul `gtx` beqaror;
  kalit bilan tarjima sifati va barqarorligi yuqori bo‘ladi.
- Kampus, fakultetlar va tadbirlarning **yangi professional suratlari** (1600 px+),
  ixtiyoriy ravishda bosh sahifa uchun qisqa ovozsiz video (admin → Sahifa matnlari → Video).
- Har o‘quv yili boshida **kontrakt narxlarini** yangilash.
- Talabalar shaharchasi sahifasini ham shu dizayn tizimiga o‘tkazish.
- Maxfiylikni hurmat qiluvchi statistika (masalan, Plausible yoki o‘z serverida Umami).
