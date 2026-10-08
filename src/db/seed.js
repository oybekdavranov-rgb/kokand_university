'use strict';
const db = require('./index');
const { config } = require('../config');
const log = require('../logger');
const site = require('../site-profile');
const { hashPassword, newSalt } = require('../security/passwords');
const data = require('./seed-data');

async function createUser(email, password, role) {
  const now = Date.now();
  const salt = newSalt();
  await db.run(
    'INSERT INTO users (email, password_hash, salt, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [email.toLowerCase(), hashPassword(password, salt), salt, role, now, now]
  );
}

async function bootstrapUsers() {
  const { c } = (await db.get('SELECT COUNT(*) AS c FROM users')) || { c: 0 };
  if (Number(c) > 0) {
    const staff = await db.get("SELECT COUNT(*) AS c FROM users WHERE role = 'staff'");
    if (Number(staff.c) === 0) {
      await db.run('UPDATE users SET role = ? WHERE id = (SELECT MIN(id) FROM users)', ['staff']);
    }
    return { created: false };
  }
  await createUser(config.DEFAULT_STAFF_EMAIL, config.DEFAULT_STAFF_PASSWORD, 'staff');
  await createUser(config.DEFAULT_EDITOR_EMAIL, config.DEFAULT_EDITOR_PASSWORD, 'editor');
  log.info('Standart adminlar yaratildi (staff + editor)');
  return { created: true };
}

/** Yozuvning tayyor tarjimalarini content_i18n ga yozadi ({ ru: {field}, en: {field} }). */
async function seedI18n(table, id, row) {
  if (!row.i18n) return;
  const fields = new Set([...Object.keys(row.i18n.ru || {}), ...Object.keys(row.i18n.en || {})]);
  const now = Date.now();
  for (const f of fields) {
    const uz = String(row[f] == null ? '' : row[f]).trim();
    if (!uz) continue;
    const ru = (row.i18n.ru && row.i18n.ru[f]) || '';
    const en = (row.i18n.en && row.i18n.en[f]) || '';
    await db.run(
      `INSERT INTO content_i18n (ref_table, ref_id, field, uz, en, ru, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(ref_table, ref_id, field) DO UPDATE SET uz = excluded.uz, en = excluded.en, ru = excluded.ru, updated_at = excluded.updated_at`,
      [table, id, f, uz, en, ru, now]
    );
  }
}

/**
 * Jadval bo'sh bo'lsa — barcha yozuvlarni qo'shadi.
 * `mergeBy` berilsa (kontent yangilanishidan keyin) — faqat shu kalit bo'yicha
 * mavjud bo'lmagan yozuvlarni qo'shadi (admin qo'shgan/tahrirlaganlari saqlanadi).
 */
async function seedTable(table, cols, rows, mergeBy) {
  // Bu profilda jadval yaratilmagan bo'lsa — o'tkazib yuboramiz
  if (!site.has(table)) return 0;
  const { c } = (await db.get(`SELECT COUNT(*) AS c FROM ${table}`)) || { c: 0 };
  let existing = null;
  if (Number(c) > 0) {
    if (!mergeBy) return 0;
    existing = new Set((await db.all(`SELECT ${mergeBy} AS k FROM ${table}`)).map((r) => String(r.k)));
  }
  const now = Date.now();
  const allCols = [...cols, 'created_at', 'updated_at'];
  const ph = allCols.map(() => '?').join(', ');
  let added = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (existing && existing.has(String(r[mergeBy]))) continue;
    const vals = [...cols.map((col) => (col === 'sort' ? (r.sort != null ? r.sort : i) : (r[col] ?? ''))), now, now];
    const { lastId } = await db.run(`INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${ph})`, vals);
    if (lastId) await seedI18n(table, lastId, r);
    added += 1;
  }
  return added;
}

/**
 * @param {object} [opts] { merge: true } — kontent 3-versiyaga yangilangandan keyin
 *   (eski shablon yozuvlari arxivlangach) yangi yozuvlar mavjudlariga qo'shiladi.
 */
async function seedContent(opts = {}) {
  const merge = Boolean(opts.merge);
  await seedTable('news', ['title', 'date', 'image', 'excerpt', 'body', 'link', 'sort'], data.NEWS, merge ? 'title' : null);
  await seedTable('achievements', ['name', 'subtitle', 'image', 'description', 'sort'], data.ACHIEVEMENTS, merge ? 'name' : null);
  await seedTable('distinctions', ['title', 'image', 'summary', 'body', 'sort'], data.DISTINCTIONS, merge ? 'title' : null);
  await seedTable('interests', ['title', 'image', 'body', 'link', 'sort'], data.INTERESTS, merge ? 'title' : null);
  await seedTable('stories', ['title', 'date', 'category', 'image', 'excerpt', 'body', 'link', 'sort'], data.STORIES, merge ? 'title' : null);
  await seedTable('gallery', ['title', 'category', 'image', 'description', 'video', 'sort'], data.GALLERY, merge ? 'image' : null);
  await seedTable('programmes', ['key', 'title', 'subtitle', 'image', 'intro', 'highlights', 'faq', 'link',
    'level', 'code', 'field', 'forms', 'price', 'duration', 'language', 'sort'], data.PROGRAMMES, merge ? 'key' : null);

  // ---- Talabalar shaharchasi (alohida "castle" profili uchun; o'zgartirilmagan) ----
  await seedTable('castle_pages', ['title', 'slug', 'icon', 'image', 'summary', 'body', 'faq', 'sort'], [
    {
      title: 'Joylashuvlar', slug: 'joylashuvlar', icon: 'map-pin', image: 'shaharcha/img/joylar.jpg',
      summary: 'Turar joylarimiz qayerda joylashgan va universitetgacha qancha vaqt ketadi.',
      body: 'Barcha turar joylarimiz Qo‘qon shahrida, universitetga qulay masofada joylashgan. Har bir joyni tanlashda uchta narsaga e’tibor berganmiz: universitetga yaqinlik, xavfsizlik va kundalik hayot qulayligi.\n\n**Kampus hududi** — universitet binolaridan 5 daqiqa piyoda. Eng ommabop variant: darsga kechikmaysiz, kutubxona va oshxona yonginangizda.\n\n**Shahar markazi** — 10–15 daqiqa. Do‘konlar, kafelar va transport shundoq yoningizda. Faol hayot tarzini yoqtiradiganlar uchun.\n\n**Tinch mahallalar** — 15–20 daqiqa. Tinchroq muhit, arzonroq narx, ko‘proq shaxsiy makon.\n\nHar bir joygacha jamoat transporti qatnaydi, velosiped yo‘llari mavjud.',
      faq: 'Universitetga qanday boraman? :: Piyoda (5–20 daqiqa), avtobus yoki velosipedda.\nTransport to‘xtash joyi bormi? :: Ha, ko‘pchilik joylarda velosiped va avtoturargoh bor.\nDo‘kon va oshxona yaqinmi? :: Barcha joylardan 5 daqiqalik masofada do‘konlar mavjud.\nKechqurun xavfsizmi? :: Hududlar yoritilgan va videokuzatuv ostida.',
    },
    {
      title: 'Bizning tariximiz', slug: 'tarix', icon: 'compass', image: 'shaharcha/img/tarix.jpg',
      summary: 'Bir binodan to‘liq talabalar shaharchasigacha — rivojlanish yo‘limiz.',
      body: 'Talabalar shaharchasi bir necha yil ichida kichik yotoqxonadan zamonaviy turar joy tizimiga aylandi.\n\n**Boshlanish** — birinchi yotoqxona binosi ochildi. Maqsad oddiy edi: boshqa shaharlardan kelgan talabalarga arzon va xavfsiz joy berish.\n\n**Kengayish** — talabalar soni ortgani sari yangi binolar qo‘shildi. Studiya xonalar va umumiy kvartiralar paydo bo‘ldi.\n\n**Zamonaviylashtirish** — barcha binolarda internet, o‘quv zonalari va dam olish maydonlari yaratildi. Xavfsizlik tizimi yangilandi.\n\n**Bugun** — 6 dan ortiq turar joy varianti, yuzlab talaba va doimiy rivojlanish. Har yili talabalar fikri asosida sharoitlarni yaxshilab boramiz.',
      faq: 'Necha yildan beri ishlaysiz? :: Bir necha yildan beri; har yili yangi imkoniyatlar qo‘shilmoqda.\nYangi binolar quriladimi? :: Ha, talabalar soni ortishi bilan kengaytirish rejalashtirilgan.\nTalabalar fikri hisobga olinadimi? :: Albatta — har semestr so‘rovnoma o‘tkaziladi.',
    },
    {
      title: 'Xalqaro talabalar', slug: 'xalqaro', icon: 'hands', image: 'shaharcha/img/xalqaro.jpg',
      summary: 'Xorijdan kelayotgan talabalar uchun to‘liq yordam va qulaylik.',
      body: 'Boshqa mamlakatdan kelish katta qadam. Biz bu jarayonni imkon qadar oson qilishga harakat qilamiz.\n\n**Kelishdan oldin** — onlayn ariza va bron. Joyni kelmasdan turib band qilasiz, fotosuratlar va xona tavsifi orqali tanlaysiz.\n\n**Kelganda** — aeroport yoki vokzaldan kutib olish tashkil etiladi. Xonaga joylashish, kalit topshirish va dastlabki ekskursiya.\n\n**Birinchi haftalar** — koordinator hujjatlar, ro‘yxatdan o‘tish, tibbiy sug‘urta va bank kartasi masalalarida yordam beradi.\n\n**Doimiy qo‘llab-quvvatlash** — til qiyinchiliklari, kundalik savollar yoki muammolar bo‘lsa — koordinator doim aloqada.\n\nKichik narsalar ham hisobga olinadi: choyshab va sochiq, oshxona jihozlari, birinchi kunlarda ovqatlanish maslahati.',
      faq: 'Kafil (garantor) kerakmi? :: Xalqaro talabalar uchun moslashuvchan shartlar mavjud.\nKelishdan oldin bron qila olamanmi? :: Ha, onlayn ariza orqali joy band qilinadi.\nAeroportdan kutib olasizmi? :: Ha, oldindan xabar bersangiz — tashkil etiladi.\nTil bilmasam-chi? :: Koordinatorlar yordam beradi; til kurslari ham mavjud.\nHujjatlarda yordam beriladimi? :: Ha, ro‘yxatdan o‘tish va sug‘urta bo‘yicha to‘liq yordam.',
    },
    {
      title: 'Savol-javob', slug: 'savol-javob', icon: 'speech', image: 'shaharcha/img/faq.jpg',
      summary: 'Bron, to‘lov, xona sharoitlari va qoidalar bo‘yicha eng ko‘p beriladigan savollar.',
      body: 'Quyida talabalar va ota-onalar eng ko‘p so‘raydigan savollarga javoblar to‘plangan. Javobini topa olmasangiz — biz bilan bog‘laning.',
      faq: 'Qanday bron qilaman? :: Turar joyni tanlaysiz, ariza qoldirasiz, koordinator siz bilan bog‘lanadi va shartnoma tuziladi.\nTo‘lov qanday amalga oshiriladi? :: Shartnomada ko‘rsatilgan tartibda; bo‘lib to‘lash imkoniyati bor.\nDepozit kerakmi? :: Ba’zi variantlarda kafolat to‘lovi bo‘ladi, u chiqishda qaytariladi.\nShartnomani bekor qilsam-chi? :: Bekor qilish shartlari shartnomada aniq yozilgan.\nXonada nima bor? :: Karavot, shkaf, ish stoli, stul va internet. Ba’zilarida shaxsiy hammom.\nChoyshab va idish-tovoq beriladimi? :: Ko‘p variantlarda asosiy jihozlar beriladi; aniqlashtirib olasiz.\nMehmon chaqirsam bo‘ladimi? :: Ha, belgilangan tartib va vaqt doirasida.\nKommunal to‘lovlar alohidami? :: Ko‘pchilik variantlarda narxga kiritilgan.\nInternet tezligi qanday? :: Onlayn dars va videoqo‘ng‘iroq uchun yetarli.\nKir yuvish qanday? :: Har bir binoda kir yuvish xonasi mavjud.\nUy hayvoni mumkinmi? :: Umumiy turar joylarda ruxsat etilmaydi.\nChekish mumkinmi? :: Binolar ichida chekish taqiqlanadi; maxsus joylar ajratilgan.',
    },
    {
      title: 'Xona turlari', slug: 'xona-turlari', icon: 'bed', image: 'shaharcha/img/xona.jpg',
      summary: 'Standart, komfort va studiya — har bir xona turi va uning jihozlari.',
      body: 'Turar joylarimizda uch xil asosiy xona turi mavjud. Har biri turli byudjet va ehtiyojga mo‘ljallangan.\n\n**Standart xona** — 2–3 kishilik, umumiy hammom va oshxona. Eng qulay narx. Har bir talabaga karavot, shkaf, ish stoli va stul beriladi.\n\n**Komfort xona** — 1–2 kishilik, xonada yuvinish joyi. Kengroq maydon, kattaroq deraza va shaxsiy javon.\n\n**Studiya** — bir kishilik mustaqil xona: shaxsiy hammom, mini-oshxona, ish zonasi va dam olish burchagi. Eng yuqori qulaylik.\n\nBarcha xonalarda: isitish, tez internet, yorug‘lik va tabiiy shamollatish. Xonani ko‘rish uchun oldindan tashrif buyurishingiz mumkin.',
      faq: 'Xonani oldin ko‘rsam bo‘ladimi? :: Ha, oldindan kelishilgan vaqtda ko‘rishga olib boramiz.\nXonani almashtirish mumkinmi? :: Bo‘sh joy bo‘lsa, semestr boshida imkoniyat bor.\nMebel qo‘shsam bo‘ladimi? :: Kichik shaxsiy narsalar mumkin; katta mebel uchun ruxsat kerak.\nXonani kim bilan bo‘lishaman? :: Imkon qadar bir yo‘nalish yoki kurs talabalari bilan.\nXonada muzlatgich bormi? :: Studiyalarda bor; boshqalarida umumiy oshxonada.',
    },
    {
      title: 'Bog‘lanish', slug: 'bogʻlanish', icon: 'phone', image: 'shaharcha/img/aloqa.jpg',
      summary: 'Telefon, email, manzil va ish vaqti — biz bilan qanday bog‘lanish mumkin.',
      body: 'Savollaringiz bo‘lsa yoki joy bron qilmoqchi bo‘lsangiz — bir necha yo‘l bilan bog‘lanishingiz mumkin.\n\n**Telefon** — ish kunlari eng tez javob. Koordinator darhol yordam beradi.\n\n**Email** — batafsil savollar va hujjatlar uchun qulay. Odatda bir ish kuni ichida javob beramiz.\n\n**Telegram** — tezkor savollar uchun. Rasm va hujjat yuborish oson.\n\n**Bevosita tashrif** — universitet qabulxonasiga kelib, turar joy bo‘yicha maslahat olishingiz mumkin. Oldindan xabar bersangiz, xonalarni ham ko‘rsatamiz.\n\nOta-onalar uchun ham alohida maslahat xizmati mavjud.',
      faq: 'Ish vaqti qanday? :: Dushanba–shanba, ish kunlari; aniq vaqt telefon orqali.\nDam olish kunlari javob berasizmi? :: Telegram orqali cheklangan tarzda.\nOta-onam qo‘ng‘iroq qilsa bo‘ladimi? :: Ha, albatta — ular uchun ham maslahat beramiz.\nXonani ko‘rishga qanday boraman? :: Oldindan vaqt belgilanadi, koordinator kutib oladi.',
    },
    {
      title: 'Do‘stingizni taklif qiling', slug: 'dost-taklif', icon: 'hands', image: 'shaharcha/img/dost.jpg',
      summary: 'Do‘stingiz ham joylashsa — ikkingiz uchun ham imtiyoz.',
      body: 'Do‘stingizni talabalar shaharchasiga taklif qilsangiz, ikkingiz ham imtiyozga ega bo‘lasiz.\n\n**Qanday ishlaydi:** do‘stingizga o‘z ismingizni ko‘rsatishni aytasiz. U shartnoma tuzgach, ikkingizga ham imtiyoz qo‘llanadi.\n\n**Nima olasiz:** to‘lovdan chegirma yoki qo‘shimcha xizmat (bu davrga qarab belgilanadi).\n\n**Nechta do‘st taklif qilish mumkin?** Cheklov yo‘q — har bir yangi joylashgan do‘st uchun imtiyoz beriladi.\n\nBu nafaqat tejamkorlik, balki yoningizda tanish odam bo‘lishi ham — moslashish ancha oson kechadi.',
      faq: 'Imtiyoz qancha? :: Davriy aksiyaga qarab; aniq shartlarni koordinatordan bilib olasiz.\nDo‘stim boshqa turar joy tanlasa-chi? :: Muhim emas — shaharchamizning istalgan variantida amal qiladi.\nQachon qo‘llanadi? :: Do‘stingiz shartnoma tuzib, joylashgandan so‘ng.\nO‘zim yangi talaba bo‘lsam ham mumkinmi? :: Ha, birgalikda ariza topshirsangiz ham amal qiladi.',
    },
    {
      title: 'Talaba portali', slug: 'portal', icon: 'lock', image: 'shaharcha/img/oquv.jpg',
      summary: 'To‘lov, xizmat so‘rovi va e’lonlar — hammasi bitta shaxsiy kabinetda.',
      body: 'Joylashgan talabalar uchun shaxsiy portal mavjud. U kundalik masalalarni onlayn hal qilish imkonini beradi.\n\n**To‘lovlar** — to‘lov tarixini ko‘rasiz, keyingi to‘lov sanasini bilasiz va onlayn to‘lash mumkin.\n\n**Xizmat so‘rovi** — biror narsa buzilsa (kran, chiroq, eshik) portal orqali so‘rov qoldirasiz, texnik xizmat keladi.\n\n**E’lonlar** — turar joy bo‘yicha muhim xabarlar, tadbirlar va eslatmalar shu yerda.\n\n**Hujjatlar** — shartnoma va boshqa hujjatlaringizning nusxasi doim qo‘l ostida.\n\nPortalga kirish ma’lumotlari joylashgandan so‘ng beriladi.',
      faq: 'Portalga qanday kiraman? :: Joylashgach login va parol beriladi.\nParolni yo‘qotsam-chi? :: Koordinatorga murojaat qilasiz, tiklanadi.\nTelefondan kirsam bo‘ladimi? :: Ha, portal mobil qurilmalarga moslashgan.\nXizmat so‘rovi qancha vaqtda bajariladi? :: Shoshilinch masalalar shu kuni; qolganlari navbat bilan.',
    },
    {
      title: 'Yozgi turar joy', slug: 'yozgi', icon: 'compass', image: 'shaharcha/img/yozgi.jpg',
      summary: 'Yozgi ta\u2019tilda qisqa muddatga joy \u2014 kurs, amaliyot yoki loyiha uchun.',
      body: 'Yoz oylarida qisqa muddatli turar joy taklif etamiz. Bu yozgi kurslarda o\u2018qiyotgan, amaliyot o\u2018tayotgan yoki loyiha ustida ishlayotgan talabalar uchun qulay.\n\n**Muddat** \u2014 bir haftadan uch oygacha. O\u2018zingizga kerakli kunlarni tanlaysiz.\n\n**Narx** \u2014 o\u2018quv yili davomidagi narxdan qulayroq, chunki muddat qisqa va talab kamroq.\n\n**Xonalar** \u2014 to\u2018liq jihozlangan: choyshab, sochiq, oshxona jihozlari. Faqat jomadoningiz bilan kelasiz.\n\n**Kimlar uchun** \u2014 yozgi kurs talabalari, amaliyotchilar, ilmiy loyiha ustida ishlayotganlar va boshqa shahardan kelgan mehmon talabalar.\n\nJoylar cheklangan, shuning uchun oldindan bron qilish tavsiya etiladi.',
      faq: 'Eng qisqa muddat qancha? :: Bir hafta.\nNarx qanday hisoblanadi? :: Haftalik yoki oylik \u2014 muddatga qarab.\nJihozlar beriladimi? :: Ha, choyshab, sochiq va oshxona jihozlari kiritilgan.\nYozda ham xavfsizlik ishlaydimi? :: Albatta, 24/7 nazorat yil bo\u2018yi ishlaydi.\nQachon bron qilish kerak? :: Iloji boricha erta \u2014 yozgi joylar tez tugaydi.',
    },
    {
      title: 'Xona jihozlari va narxlar', slug: 'jihozlar', icon: 'bed', image: 'shaharcha/img/jihoz.jpg',
      summary: 'Har bir xona darajasida nima bor va to\u2018lov qanday hisoblanadi.',
      body: 'Xonalar uchta darajaga bo\u2018linadi. Har bir darajada jihozlar to\u2018plami va narx farq qiladi.\n\n**Bronza** \u2014 asosiy to\u2018plam: karavot, matras, shkaf, ish stoli, stul, javon, isitish va internet. Hammom va oshxona umumiy.\n\n**Kumush** \u2014 bronza + xonada yuvinish joyi, kattaroq ish stoli, qo\u2018shimcha javonlar va yumshoq kursi.\n\n**Oltin** \u2014 to\u2018liq mustaqillik: shaxsiy hammom, mini-oshxona (muzlatgich, plita, mikroto\u2018lqinli), keng ish zonasi va dam olish burchagi.\n\n**To\u2018lov nima o\u2018z ichiga oladi:** xona narxi, kommunal xizmatlar (suv, elektr, isitish), internet, umumiy joylar tozalash va xavfsizlik.\n\n**Muddat tanlovi** \u2014 semestrlik yoki to\u2018liq o\u2018quv yili. Uzoq muddat tanlaganlarga qulayroq narx qo\u2018llanadi.',
      faq: 'Qaysi daraja eng ommabop? :: Kumush \u2014 narx va qulaylik muvozanati yaxshi.\nDarajani keyin oshirsam bo\u2018ladimi? :: Bo\u2018sh joy bo\u2018lsa, semestr boshida mumkin.\nKommunal to\u2018lov alohidami? :: Yo\u2018q, narxga kiritilgan.\nBo\u2018lib to\u2018lash mumkinmi? :: Ha, shartnomada belgilangan grafik bo\u2018yicha.\nUzoq muddatga chegirma bormi? :: Ha, to\u2018liq o\u2018quv yiliga shartnoma qulayroq.\nKafolat to\u2018lovi qaytariladimi? :: Ha, shartnoma tugagach, zarar bo\u2018lmasa to\u2018liq qaytariladi.',
    },
    {
      title: 'Blog va maslahatlar', slug: 'blog', icon: 'speech', image: 'shaharcha/img/blog.jpg',
      summary: 'Talabalik hayoti, tejamkorlik va moslashish bo‘yicha foydali maqolalar.',
      body: 'Blogimizda talabalar uchun amaliy maslahatlar to‘planadi — ko‘chib o‘tishdan imtihon davrigacha.\n\n**Ko‘chib o‘tish** — nima olib kelish kerak, nimani joyida sotib olish arzon, birinchi hafta rejasi.\n\n**Byudjet** — oylik xarajatlarni rejalashtirish, tejamkor xarid, o‘zi pishirishning foydasi.\n\n**Moslashish** — yangi shaharda do‘st topish, sog‘inchni engish, kun tartibini shakllantirish.\n\n**O‘qish va dam** — imtihonga tayyorlanish usullari, tanaffuslar ahamiyati, uyqu tartibi.\n\n**Xavfsizlik** — kundalik ehtiyot choralari, muhim raqamlar, favqulodda holatlarda nima qilish.\n\nYangi maqolalar muntazam qo‘shiladi.',
      faq: 'Maqolalar qanchalik tez yangilanadi? :: Muntazam — har oy yangi mavzular qo‘shiladi.\nO‘zim maqola yozsam bo‘ladimi? :: Ha, talabalar tajribasi juda qadrli — koordinatorga yozing.\nMavzu taklif qilsam bo‘ladimi? :: Albatta, qiziqtirgan mavzuni ayting.',
    },
  ]);

  await seedTable('residences', ['name', 'city', 'image', 'summary', 'description', 'amenities', 'price', 'link', 'sort'], [
    {
      name: 'Markaziy talabalar shaharchasi', city: 'Qo‘qon — markaz',
      image: 'shaharcha/img/tj-1.jpg', price: 'Oyiga — qulay narx',
      summary: 'Universitetga piyoda 5 daqiqa. Eng ommabop va qulay variant.',
      description: 'Markaziy talabalar shaharchasi universitetning asosiy binosidan atigi 5 daqiqalik masofada joylashgan. Bu yerda 2 va 3 kishilik xonalar, umumiy oshxonalar va tinch o‘quv zonalari mavjud.\n\nHar bir qavatda kir yuvish xonasi, dam olish burchagi va tez internet bor. Kirish kartalar orqali nazorat qilinadi, hudud 24/7 kuzatuv ostida.',
      amenities: 'Tez Wi-Fi\nUmumiy oshxona\nKir yuvish xonasi\nO‘quv zonasi\n24/7 xavfsizlik\nVelosiped turargohi',
      link: '',
    },
    {
      name: 'Studiya turar joy majmuasi', city: 'Qo‘qon — universitet yaqinida',
      image: 'shaharcha/img/tj-2.jpg', price: 'Premium daraja',
      summary: 'Mustaqil studiya xonalar: shaxsiy hammom va mini-oshxona.',
      description: 'Mustaqillikni qadrlaydigan talabalar uchun to‘liq jihozlangan studiya xonalar. Har bir studiyada shaxsiy hammom, mini-oshxona, keng ish stoli va katta deraza bor.\n\nMajmuada umumiy sport zali, kinozal va tom-terrassa mavjud. Bu — o‘qish va dam olish uchun ideal muvozanat.',
      amenities: 'Shaxsiy hammom\nMini-oshxona\nSport zali\nKinozal\nTom-terrassa\nTez Wi-Fi',
      link: '',
    },
    {
      name: 'Umumiy kvartiralar (shared flat)', city: 'Qo‘qon — shahar markazi',
      image: 'shaharcha/img/tj-3.jpg', price: 'Tejamkor variant',
      summary: '3–5 talaba uchun: shaxsiy yotoqxona + umumiy zal.',
      description: 'Har bir talabaga shaxsiy yotoqxona, umumiy oshxona va mehmonxona. Xarajatlar bo‘lishiladi, shuning uchun narx ancha qulay bo‘ladi.\n\nHamxonalar bilan birga yashash mustaqillikka o‘rgatadi va umrbod do‘stlik boshlanadigan joy bo‘ladi.',
      amenities: 'Shaxsiy yotoqxona\nUmumiy oshxona va zal\nKir yuvish mashinasi\nIsh stoli\nTez Wi-Fi\nAvtoturargoh',
      link: '',
    },
    {
      name: 'Xalqaro talabalar uyi', city: 'Qo‘qon — kampus hududi',
      image: 'shaharcha/img/tj-4.jpg', price: 'Xizmatlar narxga kiritilgan',
      summary: 'Xorijdan kelgan talabalar uchun to‘liq xizmatli turar joy.',
      description: 'Xalqaro talabalar uchun maxsus tashkil etilgan turar joy: kelishdan boshlab moslashishgacha to‘liq yordam.\n\nXonalar to‘liq jihozlangan, kommunal xizmatlar narxga kiritilgan. Doimiy koordinator hujjatlar, tibbiy sug‘urta va kundalik masalalarda yordam beradi.',
      amenities: 'To‘liq jihozlangan xona\nKommunal xizmatlar narxda\nKoordinator yordami\nUmumiy oshxona\nTez Wi-Fi\n24/7 xavfsizlik',
      link: '',
    },
    {
      name: 'Oilaviy mehmondorchilik', city: 'Qo‘qon — turli mahallalar',
      image: 'shaharcha/img/tj-5.jpg', price: 'Ovqat bilan yoki ovqatsiz',
      summary: 'Mahalliy oila bag‘rida: uy sharoiti va uy ovqati.',
      description: 'Tekshirilgan mahalliy oilalar bag‘rida yashash imkoniyati. Bu variant ayniqsa birinchi kurs va xorijlik talabalar uchun moslashishni osonlashtiradi.\n\nUy sharoiti, uy ovqati va kundalik jonli muloqot — til va madaniyatni tez o‘zlashtirishning eng yaxshi yo‘li.',
      amenities: 'Uy ovqati (ixtiyoriy)\nAlohida xona\nKir yuvish\nOilaviy muhit\nWi-Fi\nTekshirilgan oilalar',
      link: '',
    },
    {
      name: 'Qisqa muddatli turar joy', city: 'Qo‘qon — markaz',
      image: 'shaharcha/img/tj-6.jpg', price: 'Kunlik / haftalik',
      summary: 'Imtihon, kurs yoki qisqa tashrif uchun bir necha kun/hafta.',
      description: 'Qabul imtihonlari, qisqa kurslar yoki tashrif uchun kelgan talabalar va ota-onalar uchun qisqa muddatli joy.\n\nBron qilish oddiy, xonalar to‘liq jihozlangan, minimal muddat — bir necha kun.',
      amenities: 'Kunlik bron\nTo‘liq jihozlangan\nToza choyshab va sochiq\nWi-Fi\nMarkazda joylashuv\n24/7 qabul',
      link: '',
    },
  ]);


  // ---- Sozlamalar: bazada yo'q kalitlar uchun standart qiymatlar ----
  const { SETTINGS_DEFAULTS } = require('../content');
  const defaults = { ...data.SETTINGS, ...SETTINGS_DEFAULTS };
  for (const [k, v] of Object.entries(defaults)) {
    const exists = await db.get('SELECT 1 AS x FROM settings WHERE key = ?', [k]);
    if (!exists) await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [k, v]);
  }
}

async function cleanupSessions() {
  await db.run('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
}

module.exports = { bootstrapUsers, seedContent, seedTable, cleanupSessions };
