'use strict';
/**
 * Kokand University CMS — boshqaruv paneli (2027)
 *
 * Bo'limlar: bosh panel, sahifa matnlari (CMS elementlari, UZ/RU/EN),
 * to'plamlar (yo'nalishlar, yangiliklar, hikoyalar, ...), fayllar,
 * sayt sozlamalari, adminlar, hisob. Manzil: #bolim yoki #bolim/id.
 */
(() => {
  /* ============================ yordamchilar ============================ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ic = (name) => `<svg class="ic" aria-hidden="true"><use href="/img/icons.svg#${name}"/></svg>`;
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const clip = (s, n) => { const v = norm(s); return v.length > n ? `${v.slice(0, n - 1)}…` : v; };

  function getCookie(name) {
    const m = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return m ? decodeURIComponent(m.pop()) : '';
  }

  async function api(url, opts = {}) {
    const o = { ...opts, headers: { ...(opts.headers || {}) }, credentials: 'same-origin' };
    if (o.body && typeof o.body === 'object' && !(o.body instanceof FormData)) {
      o.body = JSON.stringify(o.body);
      o.headers['Content-Type'] = 'application/json';
    }
    const method = (o.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') o.headers['X-CSRF-Token'] = getCookie('ku_csrf');
    const res = await fetch(url, o);
    let data = {};
    try { data = await res.json(); } catch { data = {}; }
    if (res.status === 401) {
      window.location.href = '/admin/login';
      throw new Error('Sessiya tugadi. Qayta kiring.');
    }
    if (!res.ok) {
      const err = new Error(data.error || `So‘rov bajarilmadi (${res.status})`);
      err.data = data;
      throw err;
    }
    return data;
  }

  function toast(text, type = 'success') {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast${type === 'error' ? ' error' : ''}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `${ic(type === 'error' ? 'close' : 'check')}<span>${esc(text)}</span>`;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, type === 'error' ? 6000 : 3200);
  }

  function setMessage(el, text, type = '') {
    if (!el) return;
    el.textContent = text;
    el.className = `form-message ${type}`.trim();
  }

  function fmtTime(ts) {
    const n = Number(ts);
    if (!n) return '';
    const d = new Date(n);
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function ago(ts) {
    const s = Math.round((Date.now() - Number(ts)) / 1000);
    if (s < 60) return 'hozirgina';
    if (s < 3600) return `${Math.round(s / 60)} daqiqa oldin`;
    if (s < 86400) return `${Math.round(s / 3600)} soat oldin`;
    if (s < 86400 * 7) return `${Math.round(s / 86400)} kun oldin`;
    return fmtTime(ts).split(' ')[0];
  }
  function fileSize(bytes) {
    const b = Number(bytes) || 0;
    if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  /* Sanalar: saytdagi formatlar ("23-may 2026", "02.10.2026", "2026-10-02") */
  const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  function toIsoDate(str) {
    const s = String(str || '').trim().toLowerCase();
    const pad = (x) => String(x).padStart(2, '0');
    let m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = s.match(/^(\d{1,2})[-\s]([a-z‘'ʻ]+)[,\s]+(\d{4})$/);
    if (m) {
      const name = m[2].replace(/[‘'ʻ]/g, '');
      const idx = UZ_MONTHS.findIndex((x) => name.startsWith(x.slice(0, 3)));
      if (idx >= 0) return `${m[3]}-${pad(idx + 1)}-${pad(m[1])}`;
    }
    return '';
  }

  /* ============================ to'plamlar ============================ */
  const LEVELS = [['bakalavr', 'Bakalavriat'], ['magistratura', 'Magistratura'], ['doktorantura', 'Doktorantura']];
  const levelName = (v) => (LEVELS.find((l) => l[0] === v) || LEVELS[0])[1];
  const STATUSES = [['yangi', 'Yangi'], ['ko‘rildi', 'Ko‘rildi'], ['tasdiqlandi', 'Tasdiqlandi'], ['rad etildi', 'Rad etildi']];
  const statusSlug = (st) => ({ yangi: 'new', 'ko‘rildi': 'seen', tasdiqlandi: 'ok', 'rad etildi': 'no' }[st] || 'new');

  const SORT = { key: 'sort', label: 'Tartib raqami', type: 'number', hint: 'Kichik raqam — oldinroq ko‘rinadi.' };
  const COLLECTIONS = {
    programmes: {
      label: 'Yo‘nalishlar', single: 'yo‘nalish', icon: 'grad', title: 'title',
      help: '<b>Yo‘nalishlar katalogi.</b> <code>/yonalishlar</code> sahifasi, filtrlar, solishtirish va har bir yo‘nalishning alohida sahifasi shu ma’lumotlardan yig‘iladi. Narxlarni rasmiy manba bilan tekshirib kiriting.',
      meta: (it) => [levelName(it.level), it.code, it.field].filter(Boolean).join(' · '),
      view: (it) => `/yonalishlar/${encodeURIComponent(it.key || it.id)}`,
      fields: [
        { key: 'title', label: 'Yo‘nalish nomi', required: true, span: 2 },
        { key: 'level', label: 'Ta’lim bosqichi', type: 'select', options: LEVELS },
        { key: 'code', label: 'Yo‘nalish shifri', placeholder: '60610300' },
        { key: 'field', label: 'Soha', placeholder: 'IT va muhandislik', hint: 'Katalogdagi “Soha” filtri shu qiymat bo‘yicha guruhlaydi.' },
        { key: 'forms', label: 'Ta’lim shakllari', placeholder: 'Kunduzgi, Sirtqi, Masofaviy', hint: 'Vergul bilan: Kunduzgi, Sirtqi, Kechki, Masofaviy.' },
        { key: 'price', label: 'Kontrakt narxlari (so‘m, yiliga)', type: 'textarea', rows: 3, span: 2, placeholder: 'Kunduzgi :: 18411520\nMasofaviy :: 14729216', hint: 'Har qatorda: <code>Ta’lim shakli :: summa</code>. Katalogdagi “…dan” narx eng kichigidan olinadi.' },
        { key: 'duration', label: 'O‘qish muddati', placeholder: '4 yil' },
        { key: 'language', label: 'Ta’lim tili', placeholder: 'O‘zbek, rus' },
        { key: 'subtitle', label: 'Qisqa tavsif', span: 2, hint: 'Soha ko‘rsatilmagan bo‘lsa kartada shu matn chiqadi.' },
        { key: 'intro', label: 'Kirish matni', type: 'textarea', rows: 5, span: 2 },
        { key: 'highlights', label: 'Asosiy fanlar / sohalar', type: 'textarea', rows: 5, span: 2, hint: 'Har qatorda bittadan.' },
        { key: 'faq', label: 'Savol-javoblar', type: 'textarea', rows: 5, span: 2, placeholder: 'Kontrakt narxi qancha? :: Kunduzgi — 18 411 520 so‘m', hint: 'Har qatorda: <code>Savol :: Javob</code>.' },
        { key: 'link', label: 'Ariza havolasi', type: 'url', placeholder: 'https://qabul.kokanduni.uz' },
        { key: 'key', label: 'Sahifa manzili (kalit)', placeholder: 'kompyuter-injiniringi', hint: 'Manzil: <code>/yonalishlar/kalit</code>. Bo‘sh qolsa — nomidan avtomatik.' },
        { key: 'image', label: 'Muqova rasmi (ixtiyoriy)', type: 'image', span: 2, hint: 'Rasm bo‘lmasa — Rishton naqshli muqova avtomatik chiziladi.' },
        SORT,
      ],
    },
    news: {
      label: 'Yangiliklar', single: 'yangilik', icon: 'news', title: 'title', image: 'image',
      help: '<b>Yangiliklar.</b> Sana bo‘yicha saralanadi (eng yangisi tepada). Har bir yangilikning alohida sahifasi, ijtimoiy tarmoqlar uchun rasmi va qidiruvdagi o‘rni avtomatik tayyorlanadi.',
      meta: (it) => [it.date, clip(it.excerpt, 60)].filter(Boolean).join(' · '),
      view: (it) => `/yangiliklar/${it.id}`,
      fields: [
        { key: 'title', label: 'Sarlavha', required: true, span: 2 },
        { key: 'date', label: 'Sana', type: 'date' },
        { key: 'link', label: 'Manba havolasi (ixtiyoriy)', type: 'url', placeholder: 'https://t.me/kokanduniversity/…' },
        { key: 'image', label: 'Rasm', type: 'image', span: 2 },
        { key: 'excerpt', label: 'Qisqa matn (kartada)', type: 'textarea', rows: 3, span: 2 },
        { key: 'body', label: 'To‘liq matn', type: 'textarea', rows: 10, span: 2, hint: 'Bo‘sh qator — yangi xatboshi. <code>**qalin**</code> — qalin matn. Havolalar avtomatik bosiladigan bo‘ladi.' },
        SORT,
      ],
    },
    stories: {
      label: 'Hikoyalar', single: 'hikoya', icon: 'quote', title: 'title', image: 'image',
      help: '<b>Hikoyalar.</b> Talabalar, bitiruvchilar va loyihalar haqidagi maqolalar. Turkum bo‘yicha saytda filtrlanadi.',
      meta: (it) => [it.category, it.date].filter(Boolean).join(' · '),
      view: (it) => `/hikoyalar/${it.id}`,
      fields: [
        { key: 'title', label: 'Sarlavha', required: true, span: 2 },
        { key: 'category', label: 'Turkum', placeholder: 'Talabalar hayoti / Karyera / Startaplar' },
        { key: 'date', label: 'Sana', type: 'date' },
        { key: 'image', label: 'Rasm', type: 'image', span: 2 },
        { key: 'excerpt', label: 'Qisqa matn (kartada)', type: 'textarea', rows: 3, span: 2 },
        { key: 'body', label: 'To‘liq matn', type: 'textarea', rows: 10, span: 2, hint: 'Bo‘sh qator — yangi xatboshi. <code>**qalin**</code> — qalin matn.' },
        { key: 'link', label: 'Manba havolasi (ixtiyoriy)', type: 'url' },
        SORT,
      ],
    },
    achievements: {
      label: 'Startaplar', single: 'startap', icon: 'rocket', title: 'name', image: 'image',
      help: '<b>Startaplar.</b> Bosh sahifadagi “Talabalar startaplari” bo‘limi. Tavsifning birinchi qatori <code>Soha · Bosqich</code> ko‘rinishida bo‘lsa — kartada yorliq sifatida chiqadi.',
      meta: (it) => clip(it.subtitle || it.description, 70),
      view: () => '/#startaplar',
      fields: [
        { key: 'name', label: 'Loyiha nomi', required: true, span: 2 },
        { key: 'subtitle', label: 'Yutuq / mukofot (ixtiyoriy)', span: 2, placeholder: '«Mirzo Ulug‘bek vorislari» tanlovi g‘olibi' },
        { key: 'description', label: 'Tavsif', type: 'textarea', rows: 5, span: 2, placeholder: 'EdTech · MVP\nLoyiha haqida 1–2 gap.' },
        { key: 'image', label: 'Rasm (ixtiyoriy)', type: 'image', span: 2 },
        SORT,
      ],
    },
    distinctions: {
      label: 'Nega aynan KU', single: 'afzallik', icon: 'star', title: 'title',
      help: '<b>“Nega aynan Kokand University?”</b> — bosh sahifa va “Universitet” sahifasidagi afzalliklar kartalari. “Batafsil” bosilganda to‘liq matn ochiladi.',
      meta: (it) => clip(it.summary, 70),
      view: () => '/universitet',
      fields: [
        { key: 'title', label: 'Sarlavha', required: true, span: 2 },
        { key: 'summary', label: 'Qisqa izoh (kartada)', type: 'textarea', rows: 2, span: 2 },
        { key: 'body', label: 'To‘liq matn (“Batafsil”)', type: 'textarea', rows: 6, span: 2 },
        SORT,
      ],
    },
    interests: {
      label: 'Foydali havolalar', single: 'havola', icon: 'link', title: 'title',
      help: '<b>Foydali havolalar.</b> Abituriyentlar, talabalar va ota-onalar uchun tezkor kartalar. Ikonka sarlavha va havola bo‘yicha avtomatik tanlanadi.',
      meta: (it) => it.link || clip(it.body, 60),
      view: () => '/#havolalar',
      fields: [
        { key: 'title', label: 'Sarlavha', required: true, span: 2 },
        { key: 'body', label: 'Qisqa izoh', type: 'textarea', rows: 2, span: 2 },
        { key: 'link', label: 'Havola', type: 'url', span: 2, placeholder: 'https://… yoki /yonalishlar' },
        SORT,
      ],
    },
    gallery: {
      label: 'Galereya', single: 'rasm', icon: 'image', title: 'title', image: 'image',
      help: '<b>Galereya.</b> Kampus va talabalar hayoti suratlari. Turkum bo‘yicha saytda filtrlanadi; YouTube havolasi qo‘shilsa — rasm ustida “play” tugmasi chiqadi.',
      meta: (it) => it.category || '',
      view: () => '/galereya',
      fields: [
        { key: 'title', label: 'Sarlavha', required: true, span: 2 },
        { key: 'category', label: 'Turkum', placeholder: 'Kampus / Tadbirlar / Talabalar hayoti' },
        { key: 'video', label: 'YouTube havolasi (ixtiyoriy)', type: 'url', placeholder: 'https://www.youtube.com/watch?v=…' },
        { key: 'image', label: 'Rasm', type: 'image', span: 2 },
        { key: 'description', label: 'Izoh', type: 'textarea', rows: 4, span: 2 },
        SORT,
      ],
    },
    residences: {
      label: 'Turar joylar', single: 'turar joy', icon: 'building', title: 'name', image: 'image',
      help: '<b>Talabalar shaharchasi — turar joylar.</b>',
      meta: (it) => [it.city, it.price].filter(Boolean).join(' · '),
      fields: [
        { key: 'name', label: 'Nomi', required: true, span: 2 },
        { key: 'city', label: 'Joylashuv', placeholder: 'Qo‘qon — markaz' },
        { key: 'price', label: 'Narx yorlig‘i', placeholder: 'Oyiga — …' },
        { key: 'image', label: 'Rasm', type: 'image', span: 2 },
        { key: 'summary', label: 'Qisqa matn', type: 'textarea', rows: 2, span: 2 },
        { key: 'description', label: 'To‘liq matn', type: 'textarea', rows: 8, span: 2 },
        { key: 'amenities', label: 'Qulayliklar', type: 'textarea', rows: 5, span: 2, hint: 'Har qatorda bittadan.' },
        { key: 'link', label: 'Havola (ixtiyoriy)', type: 'url' },
        SORT,
      ],
    },
    castle_pages: {
      label: 'Shaharcha sahifalari', single: 'sahifa', icon: 'file', title: 'title', image: 'image',
      help: '<b>Talabalar shaharchasi — ma’lumot sahifalari</b> (modal oynalar).',
      meta: (it) => it.slug || clip(it.summary, 60),
      fields: [
        { key: 'title', label: 'Sahifa nomi', required: true, span: 2 },
        { key: 'slug', label: 'Kalit', placeholder: 'joylashuvlar' },
        { key: 'icon', label: 'Ikonka nomi', placeholder: 'map-pin / compass / hands' },
        { key: 'image', label: 'Rasm', type: 'image', span: 2 },
        { key: 'summary', label: 'Qisqa matn', type: 'textarea', rows: 2, span: 2 },
        { key: 'body', label: 'To‘liq matn', type: 'textarea', rows: 10, span: 2, hint: '<code>**qalin**</code> ishlatish mumkin.' },
        { key: 'faq', label: 'Savol-javoblar', type: 'textarea', rows: 6, span: 2, hint: 'Har qatorda: <code>Savol :: Javob</code>.' },
        SORT,
      ],
    },
    applications: {
      label: 'Yotoqxona arizalari', single: 'ariza', icon: 'mail', title: 'name', staff: true, noCreate: true,
      help: '<b>Yotoqxona arizalari</b> — saytdagi formadan keladi. Holatini belgilab boring. O‘chirishdan oldin <b>Excel (CSV)</b> zaxira oling — o‘chirilgan ariza qaytmaydi.',
      meta: (it) => [fmtTime(it.created_at), it.phone].filter(Boolean).join(' · '),
      badge: (it) => `<span class="badge status-${statusSlug(it.status)}">${esc(it.status || 'yangi')}</span>`,
      fields: [
        { key: 'status', label: 'Holati', type: 'select', options: STATUSES },
        { key: 'name', label: 'Ism-familiya', required: true },
        { key: 'phone', label: 'Telefon' },
        { key: 'email', label: 'Email' },
        { key: 'gender', label: 'Jinsi' },
        { key: 'faculty', label: 'Fakultet / yo‘nalish' },
        { key: 'course', label: 'Kurs' },
        { key: 'city', label: 'Shahar / tuman' },
        { key: 'residence', label: 'Turar joy varianti' },
        { key: 'duration', label: 'Muddat' },
        { key: 'note', label: 'Izoh', type: 'textarea', rows: 4, span: 2 },
      ],
    },
  };
  const I18N_COLLECTIONS = new Set(['programmes', 'news', 'stories', 'achievements', 'distinctions', 'interests', 'gallery', 'residences', 'castle_pages']);
  const FIELD_LABELS = {
    title: 'Sarlavha', name: 'Nomi', subtitle: 'Qisqa tavsif / yutuq', excerpt: 'Qisqa matn', body: 'To‘liq matn',
    summary: 'Qisqa izoh', description: 'Tavsif', category: 'Turkum', intro: 'Kirish matni', highlights: 'Asosiy fanlar',
    faq: 'Savol-javoblar', field: 'Soha', duration: 'O‘qish muddati', language: 'Ta’lim tili', city: 'Joylashuv',
    amenities: 'Qulayliklar', price: 'Narx',
  };

  /* ============================ sozlamalar ============================ */
  const SETTINGS_GROUPS = [
    { title: 'Aloqa', icon: 'phone', fields: [
      { key: 'phone_1', label: 'Asosiy telefon', placeholder: '+998 73 545-55-55' },
      { key: 'phone_2', label: 'Qo‘shimcha telefon' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'press_email', label: 'Matbuot xizmati emaili', type: 'email' },
    ] },
    { title: 'Manzil', icon: 'pin', hint: 'Ruscha va inglizcha maydonlar bo‘sh qolsa — standart tarjima (yoki o‘zbekcha matn) ko‘rsatiladi.', fields: [
      { key: 'address', label: 'Bosh bino manzili', span: 2 },
      { key: 'address_ru', label: 'Manzil — ruscha' },
      { key: 'address_en', label: 'Manzil — inglizcha' },
      { key: 'address_branch', label: 'Andijon filiali manzili', span: 2 },
      { key: 'address_branch_ru', label: 'Filial manzili — ruscha' },
      { key: 'address_branch_en', label: 'Filial manzili — inglizcha' },
      { key: 'postal_code', label: 'Pochta indeksi' },
      { key: 'map_url', label: 'Xarita havolasi', type: 'url' },
    ] },
    { title: 'Universitet xizmatlari', icon: 'grad', hint: 'Menyu, “Xizmatlar” paneli va pastki qismdagi havolalar. Bo‘sh qoldirilgan xizmat saytda ko‘rinmaydi.', fields: [
      { key: 'admission_url', label: 'Qabul platformasi', type: 'url' },
      { key: 'admission_tg_url', label: 'Qabul Telegram kanali', type: 'url' },
      { key: 'structure_url', label: 'Universitet tuzilmasi (interaktiv)', type: 'url' },
      { key: 'hemis_student_url', label: 'HEMIS — talaba kabineti', type: 'url' },
      { key: 'hemis_teacher_url', label: 'HEMIS — o‘qituvchi', type: 'url' },
      { key: 'library_url', label: 'Elektron kutubxona', type: 'url' },
      { key: 'webmail_url', label: 'Korporativ pochta', type: 'url' },
      { key: 'rector_bot_url', label: 'Rektorga murojaat (Telegram bot)', type: 'url' },
      { key: 'vacancies_url', label: 'Vakansiyalar', type: 'url' },
      { key: 'journal_url', label: 'Ilmiy jurnal', type: 'url' },
      { key: 'scholar_url', label: 'Ilmiy maqolalar platformasi', type: 'url' },
      { key: 'license_url', label: 'Litsenziya', type: 'url' },
      { key: 'campus_url', label: 'Talabalar shaharchasi sayti', type: 'url' },
      { key: 'official_url', label: 'Rasmiy sayt (dars jadvali va boshqalar)', type: 'url' },
    ] },
    { title: 'Ijtimoiy tarmoqlar', icon: 'share', fields: [
      { key: 'telegram_url', label: 'Telegram', type: 'url' },
      { key: 'instagram_url', label: 'Instagram', type: 'url' },
      { key: 'facebook_url', label: 'Facebook', type: 'url' },
      { key: 'youtube_url', label: 'YouTube', type: 'url' },
    ] },
    { title: 'Texnik va yuridik', icon: 'cpu', fields: [
      { key: 'site_url', label: 'Sayt manzili (SEO)', type: 'url', placeholder: 'https://www.kokanduni.uz', span: 2, hint: 'Kanonik havolalar, sitemap.xml va ijtimoiy tarmoq rasmlari uchun. Bo‘sh qolsa — SITE_URL muhit o‘zgaruvchisi yoki so‘rov manzili ishlatiladi.' },
      { key: 'legal_name', label: 'Yuridik nomi', span: 2 },
      { key: 'legal_name_ru', label: 'Yuridik nomi — ruscha' },
      { key: 'legal_name_en', label: 'Yuridik nomi — inglizcha' },
    ] },
    { title: 'Talabalar shaharchasi sahifasi', icon: 'building', needs: 'residences', fields: [
      { key: 'castle_title', label: 'Sarlavha', span: 2 },
      { key: 'castle_intro', label: 'Kirish matni', type: 'textarea', span: 2 },
      { key: 'castle_phone', label: 'Telefon' },
      { key: 'castle_email', label: 'Email', type: 'email' },
      { key: 'university_url', label: 'Universitet sayti manzili', type: 'url', span: 2 },
    ] },
  ];

  /* ============================ holat ============================ */
  const state = {
    user: null,
    role: 'editor',
    enabled: [],
    elements: [],
    elementId: null,
    files: [],
    lists: {},
    collection: null,
    itemId: null,
    dirty: false,
    view: null,
  };
  const VIEW_TITLES = {
    dashboard: 'Bosh panel', content: 'Sahifa matnlari', files: 'Fayllar',
    sitesettings: 'Sayt sozlamalari', users: 'Adminlar', account: 'Mening hisobim',
  };
  const PAGE_URLS = {
    'Bosh sahifa': '/', Universitet: '/universitet', 'Yo‘nalishlar': '/yonalishlar', Yangiliklar: '/yangiliklar',
    Hikoyalar: '/hikoyalar', Galereya: '/galereya', '404 sahifa': '/sahifa-topilmadi', 'Oflayn sahifa': '/offline',
  };
  const isStaff = () => state.role === 'staff';

  /* ============================ sessiya va rollar ============================ */
  async function loadSession() {
    const data = await api('/api/admin/session');
    if (!data.authenticated) { window.location.href = '/admin/login'; return false; }
    state.user = data.user;
    state.role = data.user.role || 'editor';
    state.enabled = Array.isArray(data.collections) ? data.collections : Object.keys(COLLECTIONS);
    $('#userInfo').textContent = data.user.email;
    $('#avatar').textContent = (data.user.email || 'K').trim().charAt(0);
    const badge = $('#roleBadge');
    badge.textContent = isStaff() ? 'Staff — to‘liq huquq' : 'Editor';
    badge.classList.toggle('staff', isStaff());
    if (data.profileLabel) {
      $('#brandPill').textContent = data.profileLabel === 'Kokand University' ? 'Boshqaruv paneli · CMS' : `${data.profileLabel} · CMS`;
    }
    const name = String(data.user.email || '').split('@')[0];
    $('#helloTitle').textContent = `Xush kelibsiz, ${name}!`;
    // Shu profilda yo'q to'plamlar va staff bo'limlari
    for (const btn of $$('.nav-btn[data-view]')) {
      const v = btn.dataset.view;
      if (COLLECTIONS[v] && !state.enabled.includes(v)) btn.remove();
    }
    $$('.staff-only').forEach((el) => { el.hidden = !isStaff(); });
    // Shaharcha profilida universitet sahifalari (va ularning matnlari) yo'q
    if (data.profile === 'castle') $$('.nav-btn[data-view="content"], [data-go="content"]').forEach((el) => el.remove());
    // Bosh paneldagi tezkor tugmalar faqat mavjud bo'limlarga
    $$('[data-go]').forEach((el) => {
      const v = el.dataset.go.split(':')[0];
      if (COLLECTIONS[v] && !state.enabled.includes(v)) el.remove();
    });
    state.profile = data.profile;
    $$('.sidebar-nav .nav-group').forEach((g) => {
      let el = g.nextElementSibling; let has = false;
      while (el && !el.classList.contains('nav-group')) { if (el.matches('.nav-btn') && !el.hidden) { has = true; break; } el = el.nextElementSibling; }
      if (!has) g.remove();
    });
    return true;
  }

  /* ============================ yo'naltirish (router) ============================ */
  function parseHash() {
    const raw = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));
    const [view, ...rest] = raw.split('/');
    return { view: view || 'dashboard', arg: rest.join('/') || null };
  }
  function go(view, arg) {
    const h = `#${view}${arg != null && arg !== '' ? `/${encodeURIComponent(arg)}` : ''}`;
    if (window.location.hash === h) { if (confirmLeave()) route(); } else window.location.hash = h;
  }
  function confirmLeave() {
    if (!state.dirty) return true;
    if (window.confirm('Saqlanmagan o‘zgarishlar bor. Ularni bekor qilib davom etamizmi?')) { state.dirty = false; return true; }
    return false;
  }

  let lastHash = '';
  async function route() {
    if (window.location.hash !== lastHash && state.dirty && !confirmLeave()) {
      history.replaceState(null, '', lastHash || '#dashboard');
      return;
    }
    lastHash = window.location.hash;
    let { view, arg } = parseHash();
    const known = ['dashboard', 'content', 'files', 'sitesettings', 'users', 'account'];
    if (!known.includes(view) && !(COLLECTIONS[view] && state.enabled.includes(view))) view = 'dashboard';
    if (['sitesettings', 'users'].includes(view) && !isStaff()) view = 'dashboard';
    if (view === 'content' && state.profile === 'castle') view = 'dashboard';
    if (COLLECTIONS[view] && COLLECTIONS[view].staff && !isStaff()) view = 'dashboard';
    if (view !== parseHash().view) { history.replaceState(null, '', `#${view}`); lastHash = window.location.hash; }
    state.view = view;
    document.body.classList.remove('nav-open');
    $('#menuToggle').setAttribute('aria-expanded', 'false');

    const isCol = Boolean(COLLECTIONS[view]);
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === (isCol ? 'view-collection' : `view-${view}`)));
    $$('.nav-btn[data-view]').forEach((b) => {
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const title = isCol ? COLLECTIONS[view].label : VIEW_TITLES[view];
    $('#viewTitle').textContent = title;
    $('#viewCrumbs').textContent = isCol ? 'Sayt kontenti' : (view === 'dashboard' ? 'Kokand University CMS' : (view === 'content' ? 'Sayt kontenti' : 'Tizim'));
    document.title = `${title} — Kokand University CMS`;
    try {
      if (view === 'dashboard') await showDashboard();
      else if (view === 'content') await showContent(arg);
      else if (isCol) await showCollection(view, arg);
      else if (view === 'files') await showFiles();
      else if (view === 'sitesettings') await showSettings();
      else if (view === 'users') await showUsers();
    } catch (err) { toast(err.message, 'error'); }
    window.scrollTo(0, 0);
  }

  /* ============================ ma'lumot yuklash ============================ */
  async function loadList(name, force) {
    if (!force && state.lists[name]) return state.lists[name];
    const data = await api(`/api/admin/${name}`);
    state.lists[name] = data.items || [];
    updateCount(name, data.total != null ? data.total : state.lists[name].length);
    return state.lists[name];
  }
  function updateCount(name, n) {
    const el = $(`.count[data-count="${name}"]`);
    if (el) el.textContent = n ? String(n) : '';
  }
  async function loadElements(force) {
    if (!force && state.elements.length) return state.elements;
    const data = await api('/api/admin/elements');
    state.elements = data.elements || [];
    return state.elements;
  }
  async function loadFiles(force) {
    if (!force && state.filesLoaded) return state.files;
    const data = await api('/api/admin/files');
    state.files = data.files || [];
    state.filesLoaded = true;
    updateCount('files', state.files.length);
    return state.files;
  }

  /* ============================ BOSH PANEL ============================ */
  const ACTIONS = {
    login: 'Tizimga kirdi', login_failed: 'Muvaffaqiyatsiz kirish urinishi', 'element.update': 'Sahifa matni o‘zgartirildi',
    'element.reset': 'Sahifa matni asl holatiga qaytarildi', 'settings.update': 'Sayt sozlamalari yangilandi',
    'file.upload': 'Fayl yuklandi', 'file.delete': 'Fayl o‘chirildi', 'user.create': 'Admin qo‘shildi', 'user.update': 'Admin tahrirlandi',
    'user.delete': 'Admin o‘chirildi', 'credentials.change': 'Login/parol yangilandi', 'content.retranslate': 'Tarjimalar to‘ldirildi',
    'applications.export': 'Arizalar CSV’ga yuklab olindi',
  };
  function describe(a) {
    if (ACTIONS[a.action]) return ACTIONS[a.action];
    const [col, act] = String(a.action).split('.');
    const c = COLLECTIONS[col];
    const verb = { create: 'qo‘shildi', update: 'tahrirlandi', delete: 'o‘chirildi', i18n: 'tarjimasi tuzatildi' }[act] || act;
    return c ? `${c.label}: yozuv ${verb}` : a.action;
  }

  async function showDashboard() {
    const kp = $('#kpis');
    const names = ['programmes', 'news', 'stories', 'gallery', 'achievements', 'residences', 'castle_pages']
      .filter((n) => state.enabled.includes(n)).slice(0, 5);
    const [lists, elements, files] = await Promise.all([
      Promise.all(names.map((n) => loadList(n).catch(() => []))),
      loadElements().catch(() => []),
      loadFiles().catch(() => []),
    ]);
    const changed = elements.filter((e) => e.hasOverride).length;
    const tiles = names.map((n, i) => ({ go: n, icon: COLLECTIONS[n].icon, label: COLLECTIONS[n].label, value: lists[i].length, sub: n === 'programmes' ? 'katalogda' : 'saytda' }));
    if (state.profile !== 'castle') tiles.push({ go: 'content', icon: 'type', label: 'Sahifa matnlari', value: elements.length, sub: `${changed} tasi o‘zgartirilgan` });
    tiles.push({ go: 'files', icon: 'layers', label: 'Fayllar', value: files.length, sub: 'kutubxonada' });
    kp.innerHTML = tiles.map((t) => `<button class="kpi" type="button" data-go="${t.go}">
      <span class="kpi-top"><span>${esc(t.label)}</span><span class="kpi-ic">${ic(t.icon)}</span></span>
      <b>${t.value}</b><small>${esc(t.sub)}</small></button>`).join('');
    try {
      const act = await api('/api/admin/activity?limit=8');
      const items = act.items || [];
      $('#recentList').innerHTML = items.length ? items.map((a) => `<li><span class="dot" aria-hidden="true"></span>
        <span class="t" title="${esc(a.target || '')}">${esc(describe(a))}${isStaff() && a.email ? ` <span class="muted small">— ${esc(a.email)}</span>` : ''}</span>
        <time datetime="${new Date(Number(a.created_at)).toISOString()}" title="${esc(fmtTime(a.created_at))}">${esc(ago(a.created_at))}</time></li>`).join('')
        : '<li class="muted">Hali o‘zgarish yo‘q.</li>';
    } catch { $('#recentList').innerHTML = '<li class="muted">Ma’lumot olinmadi.</li>'; }
  }

  /* ============================ SAHIFA MATNLARI ============================ */
  const TYPE_ICON = { text: 'type', image: 'image', video: 'play', link: 'link' };
  const TYPE_NAME = { text: 'Matn', image: 'Rasm', video: 'Video', link: 'Havola' };

  async function showContent(arg) {
    await Promise.all([loadElements(), loadFiles().catch(() => [])]);
    const pf = $('#pageFilter');
    if (pf.options.length <= 1) {
      const pages = [...new Set(state.elements.map((e) => e.page).filter(Boolean))];
      pf.insertAdjacentHTML('beforeend', pages.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join(''));
    }
    if (!isStaff()) $('#typeFilter option[value="video"]')?.remove();
    if (arg && state.elements.some((e) => e.id === arg)) state.elementId = arg;
    renderElementList();
    renderElementEditor();
  }

  function filteredElements() {
    const q = norm($('#searchInput').value).toLowerCase();
    const type = $('#typeFilter').value;
    const page = $('#pageFilter').value;
    return state.elements.filter((e) => {
      if (e.type === 'video' && !isStaff()) return false;
      if (type === 'changed' ? !e.hasOverride : (type !== 'all' && e.type !== type)) return false;
      if (page !== 'all' && e.page !== page) return false;
      if (!q) return true;
      const cur = e.current || {};
      return `${e.id} ${e.label} ${e.context} ${cur.text || ''} ${cur.alt || ''} ${cur.text_ru || ''} ${cur.text_en || ''}`.toLowerCase().includes(q);
    });
  }

  function renderElementList() {
    const list = filteredElements();
    $('#listCount').textContent = `${list.length} ta`;
    if (!list.some((e) => e.id === state.elementId)) state.elementId = list[0] ? list[0].id : null;
    $('#elementList').innerHTML = list.length ? list.map((e) => {
      const cur = e.current || {};
      const title = e.type === 'image' ? (cur.alt || e.label) : (e.type === 'text' ? (cur.text || e.label) : e.label);
      return `<button type="button" class="item${e.id === state.elementId ? ' active' : ''}" role="option" aria-selected="${e.id === state.elementId}" data-id="${esc(e.id)}">
        <span class="item-thumb type-${e.type}">${e.type === 'image' && cur.src ? `<img src="${esc(cur.src)}" alt="" loading="lazy">` : ic(TYPE_ICON[e.type] || 'type')}</span>
        <span class="item-body"><span class="item-title">${esc(clip(title, 80))}</span><span class="item-meta">${esc(e.context)}</span></span>
        <span class="item-flags">${e.hasOverride ? '<span class="flag-dot" title="O‘zgartirilgan"></span>' : ''}${cur.hide ? `<span title="Yashirilgan">${ic('eye')}</span>` : ''}</span>
      </button>`;
    }).join('') : '<div class="list-empty">Mos element topilmadi.</div>';
    $('#elementList .item.active')?.scrollIntoView({ block: 'nearest' });
  }

  /** Tarjima holati: own (qo'lda), auto (avtomatik), dict (standart), none */
  function trStatus(item, lang, field) {
    const ov = item.override || {};
    const orig = item.original || {};
    if (ov[`${field}_${lang}`]) return ov[`auto_${lang}`] ? 'auto' : 'own';
    const changed = ov[field] && norm(ov[field]) !== norm(orig[field]);
    if (!changed && orig[`${field}_${lang}`]) return 'dict';
    return 'none';
  }
  const ST_TEXT = { own: 'Qo‘lda kiritilgan tarjima', auto: 'Avtomatik tarjima', dict: 'Standart tarjima', none: 'Tarjima yo‘q — saqlaganingizdan so‘ng avtomatik tayyorlanadi' };

  function langTabs(item, field, uzValue, opts = {}) {
    const ov = item.override || {};
    const orig = item.original || {};
    const multiline = opts.multiline;
    const control = (id, val, ph) => (multiline
      ? `<textarea id="${id}" rows="${Math.min(10, Math.max(3, Math.ceil(String(val || ph || '').length / 70)))}" placeholder="${esc(ph || '')}">${esc(val || '')}</textarea>`
      : `<input id="${id}" value="${esc(val || '')}" placeholder="${esc(ph || '')}">`);
    const tabs = ['uz', 'ru', 'en'].map((l) => {
      const st = l === 'uz' ? 'own' : trStatus(item, l, field);
      return `<button type="button" class="lang-tab" role="tab" id="tab-${field}-${l}" aria-controls="pan-${field}-${l}" aria-selected="${l === 'uz'}" data-lang="${l}">${l === 'uz' ? '' : `<span class="st ${st}" aria-hidden="true"></span>`}${l.toUpperCase()}</button>`;
    }).join('');
    const panels = ['uz', 'ru', 'en'].map((l) => {
      if (l === 'uz') return `<div class="lang-panel" role="tabpanel" id="pan-${field}-uz" aria-labelledby="tab-${field}-uz">${control(`f-${field}`, uzValue, orig[field])}</div>`;
      const st = trStatus(item, l, field);
      const ph = st === 'dict' ? orig[`${field}_${l}`] : 'Bo‘sh qolsa — avtomatik tarjima qilinadi';
      return `<div class="lang-panel" role="tabpanel" id="pan-${field}-${l}" aria-labelledby="tab-${field}-${l}" hidden>
        ${control(`f-${field}_${l}`, ov[`${field}_${l}`] || '', ph)}
        <span class="hint">${esc(ST_TEXT[st])}${st === 'dict' ? ' (lug‘atdan). O‘zgartirish uchun maydonga yozing.' : ''}</span></div>`;
    }).join('');
    return `<div class="field"><span class="field-label">${esc(opts.label || 'Matn')}<span class="lang-tabs" role="tablist" aria-label="Til">${tabs}</span></span>${panels}
      <div class="lang-legend" aria-hidden="true"><span><i style="background:var(--teal)"></i>standart</span><span><i style="background:var(--gold)"></i>avtomatik</span><span><i style="background:var(--ok)"></i>qo‘lda</span></div></div>`;
  }
  function wireTabs(root) {
    $$('.lang-tabs', root).forEach((tl) => {
      tl.addEventListener('click', (e) => {
        const b = e.target.closest('.lang-tab');
        if (!b) return;
        $$('.lang-tab', tl).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
        const field = b.id.replace(/^tab-/, '').replace(/-(uz|ru|en)$/, '');
        ['uz', 'ru', 'en'].forEach((l) => { const p = document.getElementById(`pan-${field}-${l}`); if (p) p.hidden = l !== b.dataset.lang; });
        document.getElementById(`pan-${field}-${b.dataset.lang}`)?.querySelector('input,textarea')?.focus();
      });
    });
  }

  function fileOptions(kind) {
    const list = state.files.filter((f) => (kind === 'image' ? f.mime_type.startsWith('image/') : kind === 'video' ? f.mime_type.startsWith('video/') : true));
    return `<option value="">Kutubxonadan tanlash…</option>${list.map((f) => `<option value="${esc(f.public_path)}">${esc(f.original_name)}</option>`).join('')}`;
  }
  function mediaPreview(src, kind) {
    if (!src) return ic(kind === 'video' ? 'play' : 'image');
    return kind === 'video' ? `<video src="${esc(src)}" muted playsinline preload="metadata"></video>` : `<img src="${esc(src)}" alt="" loading="lazy">`;
  }
  function mediaField(id, label, value, kind = 'image', hint = '') {
    return `<div class="field span-2"><span class="field-label">${esc(label)}</span>
      <div class="media-field">
        <div class="media-preview" id="${id}-prev">${mediaPreview(value, kind)}</div>
        <div>
          <input id="${id}" value="${esc(value || '')}" placeholder="/uploads/… yoki https://…" data-media="${kind}" inputmode="url">
          <div class="media-tools">
            <select data-lib="${id}" aria-label="Kutubxonadan tanlash">${fileOptions(kind)}</select>
            <label class="upload-inline">${ic('upload')}Yuklash<input type="file" data-up="${id}" accept="${kind === 'video' ? 'video/mp4,video/webm' : 'image/*'}"></label>
            ${value ? `<button type="button" class="btn btn-ghost btn-sm" data-clear="${id}">Olib tashlash</button>` : ''}
          </div>
          ${hint ? `<span class="hint">${hint}</span>` : ''}
        </div>
      </div></div>`;
  }
  function wireMedia(root, onChange) {
    const refresh = (id) => {
      const input = document.getElementById(id);
      const prev = document.getElementById(`${id}-prev`);
      if (input && prev) prev.innerHTML = mediaPreview(input.value.trim(), input.dataset.media);
      onChange?.();
    };
    $$('[data-lib]', root).forEach((sel) => sel.addEventListener('change', () => {
      if (!sel.value) return;
      document.getElementById(sel.dataset.lib).value = sel.value;
      sel.value = '';
      refresh(sel.dataset.lib);
    }));
    $$('[data-up]', root).forEach((inp) => inp.addEventListener('change', async () => {
      const f = inp.files[0];
      if (!f) return;
      try {
        const file = await uploadFile(f);
        document.getElementById(inp.dataset.up).value = file.public_path;
        refresh(inp.dataset.up);
        toast('Fayl yuklandi va tanlandi.');
      } catch (err) { toast(err.message, 'error'); }
      inp.value = '';
    }));
    $$('[data-clear]', root).forEach((b) => b.addEventListener('click', () => {
      document.getElementById(b.dataset.clear).value = '';
      refresh(b.dataset.clear);
    }));
    $$('input[data-media]', root).forEach((inp) => inp.addEventListener('change', () => refresh(inp.id)));
  }
  async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    const data = await api('/api/admin/files', { method: 'POST', body: fd });
    state.filesLoaded = false;
    await loadFiles(true).catch(() => {});
    return data.file;
  }

  function renderElementEditor() {
    const pane = $('#editorPane');
    const item = state.elements.find((e) => e.id === state.elementId);
    state.dirty = false;
    if (!item) {
      pane.innerHTML = `<div class="empty-state">${ic('type')}Chap tomondan element tanlang.</div>`;
      return;
    }
    const cur = item.current || {};
    const ov = item.override || {};
    const orig = item.original || {};
    const pageUrl = PAGE_URLS[item.page] || '/';
    let body = '';
    if (item.type === 'text') {
      body += `<div class="original-box"><b>Asl matn:</b> <q>${esc(orig.text)}</q></div>`;
      body += langTabs(item, 'text', ov.text || orig.text, { label: 'Matn', multiline: String(orig.text || '').length > 70 });
    } else if (item.type === 'link') {
      if (item.editableText) body += langTabs(item, 'text', ov.text || orig.text, { label: 'Havola matni' });
      body += `<div class="field-grid"><label class="field"><span>Havola (URL)</span><input id="f-href" value="${esc(cur.href || '')}" inputmode="url"></label>
        <label class="field"><span>Qayerda ochilsin</span><select id="f-target"><option value="_self">Shu oynada</option><option value="_blank"${cur.target === '_blank' ? ' selected' : ''}>Yangi oynada</option></select></label></div>`;
    } else if (item.type === 'image') {
      body += `<div class="field-grid">${mediaField('f-src', 'Rasm', cur.src, 'image', 'Tavsiya: 1600px kenglikdagi JPG/WebP. Yangi rasm qo‘yilganda saytning tayyor kichraytirilgan nusxalari o‘rniga shu fayl ishlatiladi.')}</div>`;
      body += langTabs(item, 'alt', ov.alt || orig.alt, { label: 'Alt matn (ekran o‘quvchilar va SEO uchun)' });
      body += `<label class="field"><span>Sarlavha (title, ixtiyoriy)</span><input id="f-title" value="${esc(cur.title || '')}"></label>`;
    } else if (item.type === 'video') {
      body += `<div class="help-box" style="margin:0">${ic('lightbulb')}<div>Bosh sahifa orqa fon videosi. Bo‘sh bo‘lsa — jonli WebGL “sir” foni ko‘rinadi. MP4 (H.264), 10 MB gacha, ovozsiz tavsiya etiladi.</div></div>`;
      body += `<div class="field-grid">${mediaField('f-src', 'Video fayl', cur.src, 'video')}
        <label class="field"><span>MIME turi</span><input id="f-mimeType" value="${esc(cur.mimeType || '')}" placeholder="video/mp4"></label>
        <label class="field"><span>Poster (rasm URL)</span><input id="f-poster" value="${esc(cur.poster || '')}" inputmode="url"></label></div>
        <div class="form-actions">${['autoplay', 'muted', 'loop', 'controls'].map((k) => `<label class="check"><input type="checkbox" id="f-${k}"${cur[k] ? ' checked' : ''}> ${k}</label>`).join('')}</div>`;
    }
    const extra = item.type === 'link' ? '' : `
      <details class="tr-block"${cur.linkUrl || cur.hide ? ' open' : ''}>
        <summary>Qo‘shimcha: havola va ko‘rinish</summary>
        <div class="field-grid">
          <label class="field"><span>Bosilganda ochiladigan havola</span><input id="f-linkUrl" value="${esc(cur.linkUrl || '')}" placeholder="https://…" inputmode="url"></label>
          <label class="field"><span>Qayerda ochilsin</span><select id="f-linkTarget"><option value="_self">Shu oynada</option><option value="_blank"${cur.linkTarget === '_blank' ? ' selected' : ''}>Yangi oynada</option></select></label>
          <label class="check span-2"><input type="checkbox" id="f-hide"${cur.hide ? ' checked' : ''}> Elementni saytda yashirish</label>
        </div>
      </details>`;
    pane.innerHTML = `
      <div class="editor-head">
        <div><div class="crumbs">${esc(item.context)}</div><h2>${esc(clip(item.type === 'text' ? (cur.text || item.label) : item.type === 'image' ? (cur.alt || item.label) : item.label, 120))}</h2></div>
        <div class="chips"><span class="badge cobalt">${esc(TYPE_NAME[item.type] || item.type)}</span>${item.hasOverride ? `<span class="badge brand" title="${esc(fmtTime(item.updatedAt))}">O‘zgartirilgan</span>` : '<span class="badge">Asl holat</span>'}</div>
      </div>
      <form id="elementForm" class="editor-body stack" autocomplete="off">${body}${extra}</form>
      <div class="editor-foot">
        <button type="submit" form="elementForm" class="btn btn-primary">${ic('check')}Saqlash</button>
        ${item.hasOverride ? `<button type="button" id="resetBtn" class="btn btn-danger">${ic('refresh')}Asl holatga qaytarish</button>` : ''}
        <span class="spacer"></span>
        <a class="btn btn-ghost" href="${esc(pageUrl)}" target="_blank" rel="noopener">${ic('external')}Saytda ko‘rish</a>
        <span class="muted small mono" title="Element kaliti">${esc(item.id)}</span>
      </div>`;
    const form = $('#elementForm');
    wireTabs(pane);
    wireMedia(pane, () => { state.dirty = true; });
    form.addEventListener('input', () => { state.dirty = true; });
    form.addEventListener('submit', (e) => { e.preventDefault(); saveElement(item); });
    $('#resetBtn')?.addEventListener('click', () => resetElement(item));
  }

  const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
  const checked = (id) => Boolean(document.getElementById(id)?.checked);

  async function saveElement(item) {
    const orig = item.original || {};
    const p = { hide: checked('f-hide'), linkUrl: val('f-linkUrl').trim(), linkTarget: val('f-linkTarget') || '_self' };
    if (item.type === 'text' || (item.type === 'link' && item.editableText)) {
      p.text = val('f-text');
      p.text_ru = val('f-text_ru').trim();
      p.text_en = val('f-text_en').trim();
    }
    if (item.type === 'link') { p.href = val('f-href').trim(); p.target = val('f-target'); }
    if (item.type === 'image') {
      p.src = val('f-src').trim(); p.alt = val('f-alt'); p.title = val('f-title');
      p.alt_ru = val('f-alt_ru').trim(); p.alt_en = val('f-alt_en').trim();
    }
    if (item.type === 'video') {
      Object.assign(p, { src: val('f-src').trim(), mimeType: val('f-mimeType').trim(), poster: val('f-poster').trim() });
      ['autoplay', 'muted', 'loop', 'controls'].forEach((k) => { p[k] = checked(`f-${k}`); });
    }
    // Hech narsa o'zgarmagan bo'lsa — override yaratmaymiz (asl holat qoladi)
    const pristine = !p.hide && !p.linkUrl
      && (p.text == null || (norm(p.text) === norm(orig.text) && !p.text_ru && !p.text_en))
      && (item.type !== 'image' || ((!p.src || p.src === orig.src) && norm(p.alt) === norm(orig.alt) && !p.title && !p.alt_ru && !p.alt_en))
      && item.type !== 'video' && item.type !== 'link';
    try {
      if (pristine) {
        if (item.hasOverride) await api(`/api/admin/elements/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
        toast('O‘zgarish yo‘q — element asl holatda.');
      } else {
        await api(`/api/admin/elements/${encodeURIComponent(item.id)}`, { method: 'PUT', body: p });
        const needsTr = (p.text != null && norm(p.text) !== norm(orig.text) && (!p.text_ru || !p.text_en))
          || (item.type === 'image' && norm(p.alt) !== norm(orig.alt) && (!p.alt_ru || !p.alt_en));
        toast(needsTr ? 'Saqlandi. RU/EN tarjimasi fon rejimida tayyorlanmoqda.' : 'Saqlandi. Saytda yangilandi.');
      }
      state.dirty = false;
      await loadElements(true);
      renderElementList();
      renderElementEditor();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function resetElement(item) {
    if (!window.confirm('Element saytning asl matni/rasmiga qaytarilsinmi? Kiritilgan tarjimalar ham o‘chadi.')) return;
    try {
      await api(`/api/admin/elements/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      toast('Asl holat tiklandi.');
      state.dirty = false;
      await loadElements(true);
      renderElementList();
      renderElementEditor();
    } catch (err) { toast(err.message, 'error'); }
  }

  $('#elementList').addEventListener('click', (e) => {
    const b = e.target.closest('.item');
    if (!b || b.dataset.id === state.elementId) return;
    if (!confirmLeave()) return;
    state.elementId = b.dataset.id;
    history.replaceState(null, '', `#content/${encodeURIComponent(b.dataset.id)}`);
    lastHash = window.location.hash;
    renderElementList();
    renderElementEditor();
    if (window.matchMedia('(max-width: 1180px)').matches) $('#editorPane').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  ['input', 'change'].forEach((ev) => {
    $('#searchInput').addEventListener(ev, () => { renderElementList(); if (!state.dirty) renderElementEditor(); });
  });
  ['#typeFilter', '#pageFilter'].forEach((s) => $(s).addEventListener('change', () => { renderElementList(); if (!state.dirty) renderElementEditor(); }));

  /* ============================ TO'PLAMLAR ============================ */
  async function showCollection(name, arg) {
    const cfg = COLLECTIONS[name];
    if (state.collection !== name) {
      state.collection = name;
      $('#collectionSearch').value = '';
      $('#collectionList').scrollTop = 0;
    }
    $('#collectionHelp').innerHTML = `${ic('lightbulb')}<div>${cfg.help}</div>`;
    $('#collectionListTitle').textContent = cfg.label;
    $('#collectionNew span').textContent = `Yangi ${cfg.single}`;
    $('#collectionNew').hidden = Boolean(cfg.noCreate);
    $('#collectionCsv').hidden = name !== 'applications';
    await Promise.all([loadList(name, true), loadFiles().catch(() => [])]);
    const items = state.lists[name];
    // Holat manzildan olinadi: #news, #news/12, #news/new
    if (arg === 'new' && !cfg.noCreate) state.itemId = 'new';
    else if (arg && items.some((x) => String(x.id) === String(arg))) state.itemId = Number(arg);
    else state.itemId = null;
    renderCollectionList();
    renderCollectionForm();
  }

  function renderCollectionList() {
    const name = state.collection;
    const cfg = COLLECTIONS[name];
    const q = norm($('#collectionSearch').value).toLowerCase();
    const all = state.lists[name] || [];
    const items = q ? all.filter((it) => `${it[cfg.title] || ''} ${cfg.meta(it)}`.toLowerCase().includes(q)) : all;
    $('#collectionCount').textContent = `${all.length} ta`;
    $('#collectionList').innerHTML = items.length ? items.map((it) => {
      const img = cfg.image && it[cfg.image];
      return `<button type="button" class="item${state.itemId === it.id ? ' active' : ''}" data-id="${it.id}">
        <span class="item-thumb">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ic(cfg.icon)}</span>
        <span class="item-body"><span class="item-title">${esc(it[cfg.title] || '(nomsiz)')}</span><span class="item-meta">${esc(cfg.meta(it) || '')}</span></span>
        <span class="item-flags">${cfg.badge ? cfg.badge(it) : ''}</span>
      </button>`;
    }).join('') : `<div class="list-empty">${all.length ? 'Mos yozuv topilmadi.' : 'Hozircha yozuv yo‘q.'}</div>`;
    $('#collectionList .item.active')?.scrollIntoView({ block: 'nearest' });
  }

  function fieldHtml(f, value) {
    const id = `cf-${f.key}`;
    const cls = `field${f.span === 2 ? ' span-2' : ''}`;
    const req = f.required ? ' <i class="req" aria-hidden="true">*</i>' : '';
    const hint = f.hint ? `<span class="hint">${f.hint}</span>` : '';
    const v = value == null ? '' : value;
    if (f.type === 'image') return mediaField(id, f.label, v, 'image', f.hint || '');
    if (f.type === 'textarea') return `<label class="${cls}"><span>${esc(f.label)}${req}</span><textarea id="${id}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}"${f.required ? ' required' : ''}>${esc(v)}</textarea>${hint}</label>`;
    if (f.type === 'select') {
      const opts = f.options.map(([k, label]) => `<option value="${esc(k)}"${String(v) === k ? ' selected' : ''}>${esc(label)}</option>`).join('');
      return `<label class="${cls}"><span>${esc(f.label)}${req}</span><select id="${id}">${opts}</select>${hint}</label>`;
    }
    if (f.type === 'date') {
      const iso = toIsoDate(v);
      if (v && !iso) return `<label class="${cls}"><span>${esc(f.label)}</span><input id="${id}" value="${esc(v)}" placeholder="2026-10-02">${hint || '<span class="hint">Format: 2026-10-02 yoki 02.10.2026</span>'}</label>`;
      return `<label class="${cls}"><span>${esc(f.label)}</span><input id="${id}" type="date" value="${esc(iso)}">${hint}</label>`;
    }
    if (f.type === 'number') return `<label class="${cls}"><span>${esc(f.label)}</span><input id="${id}" type="number" step="1" value="${esc(v === '' ? 0 : v)}">${hint}</label>`;
    const type = f.type === 'email' ? 'email' : 'text';
    return `<label class="${cls}"><span>${esc(f.label)}${req}</span><input id="${id}" type="${type}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}"${f.type === 'url' ? ' inputmode="url"' : ''}${f.required ? ' required' : ''}>${hint}</label>`;
  }

  function renderCollectionForm() {
    const name = state.collection;
    const cfg = COLLECTIONS[name];
    const pane = $('#collectionForm');
    state.dirty = false;
    const isNew = state.itemId === 'new';
    const item = isNew ? null : (state.lists[name] || []).find((x) => x.id === state.itemId);
    if (!isNew && !item) {
      pane.innerHTML = `<div class="empty-state">${ic(cfg.icon)}<span>Chapdan yozuvni tanlang${cfg.noCreate ? '' : ` yoki “Yangi ${esc(cfg.single)}” tugmasini bosing`}.</span></div>`;
      return;
    }
    const data = item || {};
    const viewUrl = item && cfg.view ? cfg.view(item) : '';
    const fields = cfg.fields.map((f) => fieldHtml(f, data[f.key] != null ? data[f.key] : (f.type === 'select' ? f.options[0][0] : ''))).join('');
    pane.innerHTML = `
      <div class="editor-head">
        <div><div class="crumbs">${esc(cfg.label)}</div><h2>${esc(isNew ? `Yangi ${cfg.single}` : (data[cfg.title] || '(nomsiz)'))}</h2></div>
        <div class="chips">${item ? `<span class="badge">ID ${item.id}</span>` : '<span class="badge teal">Yangi</span>'}${item && item.updated_at ? `<span class="badge" title="Oxirgi o‘zgarish">${esc(fmtTime(item.updated_at))}</span>` : ''}</div>
      </div>
      <form id="cform" class="editor-body stack" novalidate autocomplete="off">
        <div class="field-grid">${fields}</div>
        ${item && I18N_COLLECTIONS.has(name) ? `<details class="tr-block" id="trBlock"><summary>Tarjimalar (RU / EN) — ko‘rish va tuzatish</summary><div id="trBody" class="stack"><span class="muted small">Yuklanmoqda…</span></div></details>` : ''}
        ${!item && I18N_COLLECTIONS.has(name) ? '<p class="hint" style="margin:0">Saqlangandan so‘ng matnlar rus va ingliz tillariga avtomatik tarjima qilinadi.</p>' : ''}
      </form>
      <div class="editor-foot">
        <button type="submit" form="cform" class="btn btn-primary">${ic('check')}${isNew ? 'Qo‘shish' : 'Saqlash'}</button>
        ${item ? `<button type="button" class="btn btn-danger" id="cDelete">${ic('close')}O‘chirish</button>` : `<button type="button" class="btn" id="cCancel">Bekor qilish</button>`}
        <span class="spacer"></span>
        ${viewUrl ? `<a class="btn btn-ghost" href="${esc(viewUrl)}" target="_blank" rel="noopener">${ic('external')}Saytda ko‘rish</a>` : ''}
      </div>`;
    const form = $('#cform');
    wireMedia(pane, () => { state.dirty = true; });
    form.addEventListener('input', () => { state.dirty = true; });
    form.addEventListener('submit', (e) => { e.preventDefault(); submitCollection(item); });
    $('#cDelete')?.addEventListener('click', () => deleteCollectionItem(item));
    $('#cCancel')?.addEventListener('click', () => { state.dirty = false; go(name); });
    const tb = $('#trBlock');
    if (tb) tb.addEventListener('toggle', () => { if (tb.open && !tb.dataset.loaded) loadTranslations(name, item.id); });
  }

  async function submitCollection(item) {
    const name = state.collection;
    const cfg = COLLECTIONS[name];
    const payload = {};
    let firstInvalid = null;
    for (const f of cfg.fields) {
      const el = document.getElementById(`cf-${f.key}`);
      if (!el) continue;
      el.classList.remove('is-invalid');
      payload[f.key] = f.type === 'number' ? Number(el.value || 0) : el.value;
      if (f.required && !String(el.value).trim()) { el.classList.add('is-invalid'); firstInvalid = firstInvalid || el; }
    }
    if (firstInvalid) { firstInvalid.focus(); toast('Majburiy maydonni to‘ldiring.', 'error'); return; }
    try {
      const data = item
        ? await api(`/api/admin/${name}/${item.id}`, { method: 'PUT', body: payload })
        : await api(`/api/admin/${name}`, { method: 'POST', body: payload });
      state.dirty = false;
      toast(item ? 'Saqlandi. Saytda yangilandi.' : 'Qo‘shildi. Saytda paydo bo‘ldi.');
      await loadList(name, true);
      state.itemId = data.item.id;
      history.replaceState(null, '', `#${name}/${data.item.id}`);
      lastHash = window.location.hash;
      renderCollectionList();
      renderCollectionForm();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteCollectionItem(item) {
    const name = state.collection;
    const cfg = COLLECTIONS[name];
    const title = item[cfg.title] || 'yozuv';
    const msg = name === 'applications'
      ? `DIQQAT: “${title}” arizasi butunlay o‘chiriladi va qaytarilmaydi.\n\nKerak bo‘lsa, avval “Excel (CSV)” tugmasi bilan zaxira oling.\n\nDavom etamizmi?`
      : `“${title}” o‘chirilsinmi? Bu amalni qaytarib bo‘lmaydi.`;
    if (!window.confirm(msg)) return;
    try {
      await api(`/api/admin/${name}/${item.id}`, { method: 'DELETE' });
      toast('O‘chirildi.');
      state.dirty = false;
      state.itemId = null;
      await loadList(name, true);
      history.replaceState(null, '', `#${name}`);
      lastHash = window.location.hash;
      renderCollectionList();
      renderCollectionForm();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function loadTranslations(name, id) {
    const box = $('#trBody');
    try {
      const data = await api(`/api/admin/i18n/${name}/${id}`);
      $('#trBlock').dataset.loaded = '1';
      if (!data.fields.length) { box.innerHTML = '<span class="muted small">Tarjima qilinadigan matn yo‘q.</span>'; return; }
      box.innerHTML = `<p class="hint" style="margin:0">Avtomatik tarjimani shu yerda tuzatishingiz mumkin. Bo‘sh qoldirilgan maydon qayta avtomatik tarjima qilinadi. O‘zbekcha matn o‘zgarsa — tarjima ham yangilanadi.</p>
        ${data.fields.map((f) => {
          const longest = Math.max(f.uz.length, (f.ru || '').length, (f.en || '').length);
          const rows = Math.min(12, Math.max(2, Math.ceil(longest / 42) + (f.uz.match(/\n/g) || []).length));
          const uz = f.uz.length > 600 ? `${f.uz.slice(0, 599)}…` : f.uz;
          return `<div class="tr-row" data-field="${esc(f.field)}">
            <div class="uz"><b>${esc(FIELD_LABELS[f.field] || f.field)}</b>${esc(uz)}</div>
            ${f.stale ? '<span class="badge warn" style="justify-self:start">Matn o‘zgargan — yangi tarjima tayyorlanmoqda</span>' : ''}
            <div class="tr-pair">
              <label>RU<textarea rows="${rows}" data-l="ru">${esc(f.ru)}</textarea></label>
              <label>EN<textarea rows="${rows}" data-l="en">${esc(f.en)}</textarea></label>
            </div></div>`;
        }).join('')}
        <div class="form-actions"><button type="button" class="btn" id="trSave">${ic('check')}Tarjimalarni saqlash</button></div>`;
      $('#trSave').addEventListener('click', async () => {
        const fields = {};
        $$('.tr-row', box).forEach((r) => { fields[r.dataset.field] = { ru: $('[data-l="ru"]', r).value, en: $('[data-l="en"]', r).value }; });
        try {
          await api(`/api/admin/i18n/${name}/${id}`, { method: 'PUT', body: { fields } });
          state.dirty = false;
          toast('Tarjimalar saqlandi.');
        } catch (err) { toast(err.message, 'error'); }
      });
    } catch (err) { box.innerHTML = `<span class="form-message error">${esc(err.message)}</span>`; }
  }

  $('#collectionList').addEventListener('click', (e) => {
    const b = e.target.closest('.item');
    if (!b || Number(b.dataset.id) === state.itemId) return;
    if (!confirmLeave()) return;
    state.itemId = Number(b.dataset.id);
    history.replaceState(null, '', `#${state.collection}/${b.dataset.id}`);
    lastHash = window.location.hash;
    renderCollectionList();
    renderCollectionForm();
    if (window.matchMedia('(max-width: 1180px)').matches) $('#collectionForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#collectionSearch').addEventListener('input', renderCollectionList);
  $('#collectionNew').addEventListener('click', () => {
    if (!confirmLeave()) return;
    state.itemId = 'new';
    history.replaceState(null, '', `#${state.collection}/new`);
    lastHash = window.location.hash;
    renderCollectionList();
    renderCollectionForm();
    $('#cf-' + COLLECTIONS[state.collection].fields[0].key)?.focus();
  });

  /* ============================ FAYLLAR ============================ */
  async function showFiles() {
    await loadFiles(true);
    renderFiles();
  }
  function renderFiles() {
    $('#fileCount').textContent = `${state.files.length} ta`;
    $('#fileList').innerHTML = state.files.length ? state.files.map((f) => {
      const isImg = f.mime_type.startsWith('image/');
      const isVid = f.mime_type.startsWith('video/');
      return `<article class="file-card">
        <div class="file-thumb">${isImg ? `<img src="${esc(f.public_path)}" alt="" loading="lazy">` : isVid ? `<video src="${esc(f.public_path)}" muted preload="metadata"></video>` : ic('file')}</div>
        <div class="file-info"><b title="${esc(f.original_name)}">${esc(f.original_name)}</b>
          <small>${esc(f.mime_type)} · ${fileSize(f.size_bytes)}</small>
          <div class="file-actions">
            <button type="button" class="btn btn-sm" data-copy="${esc(f.public_path)}">${ic('copy')}URL</button>
            <a class="btn btn-sm btn-ghost" href="${esc(f.public_path)}" target="_blank" rel="noopener" aria-label="Ochish">${ic('external')}</a>
            <button type="button" class="btn btn-sm btn-ghost" data-del="${esc(f.filename)}" aria-label="O‘chirish" style="color:var(--danger)">${ic('close')}</button>
          </div>
        </div></article>`;
    }).join('') : `<div class="empty-state" style="grid-column:1/-1">${ic('layers')}Hozircha fayl yo‘q.</div>`;
  }
  $('#fileList').addEventListener('click', async (e) => {
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      const url = new URL(copy.dataset.copy, window.location.origin).pathname;
      try { await navigator.clipboard.writeText(url); toast(`Nusxalandi: ${url}`); } catch { window.prompt('URL:', url); }
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      if (!window.confirm('Fayl o‘chirilsinmi? U ishlatilgan joylarda rasm ko‘rinmay qoladi.')) return;
      try {
        await api(`/api/admin/files/${encodeURIComponent(del.dataset.del)}`, { method: 'DELETE' });
        toast('Fayl o‘chirildi.');
        await showFiles();
      } catch (err) { toast(err.message, 'error'); }
    }
  });
  async function handleUpload(file) {
    if (!file) return;
    setMessage($('#uploadMessage'), `Yuklanmoqda: ${file.name}…`);
    try {
      await uploadFile(file);
      setMessage($('#uploadMessage'), '');
      toast(`Yuklandi: ${file.name}`);
      renderFiles();
    } catch (err) { setMessage($('#uploadMessage'), err.message, 'error'); }
  }
  $('#uploadInput').addEventListener('change', (e) => { handleUpload(e.target.files[0]); e.target.value = ''; });
  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => handleUpload(e.dataTransfer.files[0]));

  /* ============================ SAYT SOZLAMALARI ============================ */
  async function showSettings() {
    const data = await api('/api/admin/settings');
    const s = data.settings || {};
    const defaults = data.defaults || {};
    const trs = data.translations || {};
    const placeholderFor = (f) => {
      const m = f.key.match(/^(.+)_(ru|en)$/);
      if (m && trs[m[1]] && trs[m[1]][m[2]]) return trs[m[1]][m[2]];
      return f.placeholder || defaults[f.key] || '';
    };
    const groups = SETTINGS_GROUPS.filter((g) => !g.needs || state.enabled.includes(g.needs));
    $('#siteSettingsForm').innerHTML = groups.map((g) => `
      <fieldset><legend>${ic(g.icon)}${esc(g.title)}</legend>
        ${g.hint ? `<p class="hint">${esc(g.hint)}</p>` : ''}
        <div class="field-grid">${g.fields.map((f) => {
          const v = s[f.key] != null ? s[f.key] : '';
          const cls = `field${f.span === 2 ? ' span-2' : ''}`;
          const input = f.type === 'textarea'
            ? `<textarea id="ss-${f.key}" rows="3">${esc(v)}</textarea>`
            : `<input id="ss-${f.key}" type="${f.type === 'email' ? 'email' : 'text'}" value="${esc(v)}" placeholder="${esc(placeholderFor(f))}"${f.type === 'url' ? ' inputmode="url"' : ''}>`;
          return `<label class="${cls}"><span>${esc(f.label)}</span>${input}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</label>`;
        }).join('')}</div>
      </fieldset>`).join('') + `<div class="form-actions"><button type="submit" class="btn btn-primary">${ic('check')}Sozlamalarni saqlash</button><p id="siteSettingsMessage" class="form-message" role="status"></p></div>`;
    const form = $('#siteSettingsForm');
    form.oninput = () => { state.dirty = true; };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const payload = {};
      $$('[id^="ss-"]', form).forEach((el) => { el.classList.remove('is-invalid'); payload[el.id.slice(3)] = el.value.trim(); });
      try {
        await api('/api/admin/settings', { method: 'PUT', body: payload });
        state.dirty = false;
        setMessage($('#siteSettingsMessage'), '');
        toast('Sozlamalar saqlandi. Sayt yangilandi.');
      } catch (err) {
        const bad = (err.data && err.data.fields) || [];
        bad.forEach((k) => document.getElementById(`ss-${k}`)?.classList.add('is-invalid'));
        if (bad[0]) document.getElementById(`ss-${bad[0]}`)?.focus();
        const labels = bad.map((k) => (SETTINGS_GROUPS.flatMap((g) => g.fields).find((f) => f.key === k) || { label: k }).label);
        setMessage($('#siteSettingsMessage'), bad.length ? 'Belgilangan maydonlarni tekshiring: havola https:// bilan boshlansin, email to‘g‘ri formatda bo‘lsin.' : err.message, 'error');
        toast(bad.length ? `Tekshiring: ${labels.join(', ')}` : err.message, 'error');
      }
    };
    loadDiagnostics();
    const btn = $('#retranslateBtn');
    if (!btn.dataset.wired) {
      btn.dataset.wired = '1';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await api('/api/admin/retranslate', { method: 'POST' });
          setMessage($('#retranslateMessage'), 'Ishga tushdi. Natija bir necha daqiqada saytda ko‘rinadi.', 'success');
        } catch (err) { setMessage($('#retranslateMessage'), err.message, 'error'); }
        btn.disabled = false;
      });
    }
  }

  async function loadDiagnostics() {
    const box = $('#diagBody');
    try {
      const d = await api('/api/admin/diagnostics');
      const tr = d.translate || {};
      const trOk = tr.provider === 'google' ? tr.hasKey : tr.provider !== 'none';
      const rows = [
        ['Muhit', `${d.env} · Node ${d.node}`],
        ['Baza', d.db === 'postgres' ? 'PostgreSQL' : 'SQLite (fayl)'],
        ['Profil', d.profile],
        ['Kontent versiyasi', d.contentVersion ? `v${d.contentVersion}` : '—'],
        ['Sayt manzili (SEO)', d.siteUrl || 'berilmagan — so‘rov manzili ishlatiladi'],
        ['Tarjima xizmati', `${tr.provider}${tr.provider === 'google' ? (tr.hasKey ? ' (kalit bor)' : ' — KALIT YO‘Q') : ''}`],
        ['Yuklamalar papkasi', d.uploadsDir],
        ['Sizning IP (aniqlangan)', d.proxy.clientIp],
        ['Proxy zanjiri (X-Forwarded-For)', d.proxy.forwardedFor.join(' → ') || '—'],
        ['TRUST_PROXY_HOPS', String(d.proxy.trustHops)],
      ];
      const proxyWarn = d.proxy.forwardedFor.length && !d.proxy.trustHops;
      box.className = '';
      box.innerHTML = `<div class="field-grid">${rows.map(([k, v]) => `<div class="field"><span>${esc(k)}</span><code style="white-space:normal;word-break:break-all">${esc(v)}</code></div>`).join('')}</div>
        ${proxyWarn ? '<p class="hint" style="margin-top:12px;color:var(--gold)">Sayt proxy ortida ishlayapti, lekin TRUST_PROXY_HOPS=0 — barcha tashrifchilar bitta IP sifatida ko‘rinadi va so‘rov limiti umumiy bo‘lib qoladi. Proxy zanjiridagi o‘zingizning IP’ingiz o‘ngdan nechanchi o‘rinda tursa, TRUST_PROXY_HOPS ga shu sonni bering (odatda 1).</p>' : ''}
        ${!d.siteUrl ? '<p class="hint" style="margin-top:8px">Tavsiya: “Texnik” bo‘limida sayt manzilini (masalan https://www.kokanduni.uz) kiriting — kanonik havolalar va sitemap barqaror bo‘ladi.</p>' : ''}`;
      const badge = $('#diagBadge');
      badge.textContent = trOk && !proxyWarn ? 'Hammasi joyida' : 'E’tibor bering';
      badge.className = `badge ${trOk && !proxyWarn ? 'ok' : 'warn'}`;
    } catch (err) { box.textContent = err.message; }
  }

  /* ============================ ADMINLAR ============================ */
  async function showUsers() {
    const data = await api('/api/admin/users');
    const users = data.users || [];
    $('#users-count').textContent = `${users.length} ta`;
    $('#users-list').innerHTML = users.map((u) => `
      <div class="item" data-id="${u.id}" style="cursor:default">
        <span class="avatar" aria-hidden="true">${esc((u.email || '?').charAt(0))}</span>
        <span class="item-body"><span class="item-title">${esc(u.email)}${state.user && u.email === state.user.email ? ' <span class="badge teal">siz</span>' : ''}</span>
          <span class="item-meta">${u.role === 'staff' ? 'Staff — to‘liq huquq' : 'Editor'}</span></span>
        <span class="item-flags"><button type="button" class="link-btn" data-edit="${u.id}">Tahrirlash</button><button type="button" class="link-btn danger" data-del="${u.id}" style="margin-left:10px">O‘chirish</button></span>
      </div>`).join('');
    state.users = users;
  }
  function resetUserForm() {
    $('#user-form-title').textContent = 'Yangi admin qo‘shish';
    $('#user-id').value = '';
    $('#user-email').value = '';
    $('#user-password').value = '';
    $('#user-role').value = 'editor';
    setMessage($('#userMessage'), '');
  }
  $('#users-list').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      const u = (state.users || []).find((x) => String(x.id) === ed.dataset.edit);
      if (!u) return;
      $('#user-form-title').textContent = 'Adminni tahrirlash';
      $('#user-id').value = u.id;
      $('#user-email').value = u.email;
      $('#user-password').value = '';
      $('#user-role').value = u.role;
      $('#user-email').focus();
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      if (!window.confirm('Bu admin o‘chirilsinmi?')) return;
      try { await api(`/api/admin/users/${del.dataset.del}`, { method: 'DELETE' }); toast('Admin o‘chirildi.'); resetUserForm(); await showUsers(); } catch (err) { toast(err.message, 'error'); }
    }
  });
  $('#userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#user-id').value;
    const payload = { email: $('#user-email').value.trim(), password: $('#user-password').value, role: $('#user-role').value };
    try {
      if (id) await api(`/api/admin/users/${id}`, { method: 'PUT', body: payload });
      else await api('/api/admin/users', { method: 'POST', body: payload });
      toast('Saqlandi.');
      resetUserForm();
      await showUsers();
    } catch (err) { setMessage($('#userMessage'), err.message, 'error'); }
  });
  $('#userResetBtn').addEventListener('click', resetUserForm);

  /* ============================ HISOB ============================ */
  $('#settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage($('#settingsMessage'), '');
    try {
      const data = await api('/api/admin/change-credentials', {
        method: 'POST',
        body: { currentPassword: $('#currentPassword').value, newEmail: $('#newEmail').value.trim(), newPassword: $('#newPassword').value },
      });
      $('#currentPassword').value = '';
      $('#newPassword').value = '';
      $('#newEmail').value = '';
      if (data.user && data.user.email) { $('#userInfo').textContent = data.user.email; state.user.email = data.user.email; }
      toast('Login/parol yangilandi.');
    } catch (err) { setMessage($('#settingsMessage'), err.message, 'error'); }
  });

  /* ============================ umumiy hodisalar ============================ */
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-view]');
    if (nav) { e.preventDefault(); go(nav.dataset.view); return; }
    const g = e.target.closest('[data-go]');
    if (g) {
      const [v, a] = g.dataset.go.split(':');
      go(v, a);
    }
  });
  $('#menuToggle').addEventListener('click', () => {
    const open = !document.body.classList.contains('nav-open');
    document.body.classList.toggle('nav-open', open);
    $('#menuToggle').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) document.body.classList.remove('nav-open');
    // Ctrl/⌘ + S — joriy formani saqlash
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      const form = $('.view.active #elementForm, .view.active #cform, .view.active #siteSettingsForm');
      if (form) { e.preventDefault(); form.requestSubmit(); }
    }
  });
  window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', route);
  $('#logoutBtn').addEventListener('click', async () => {
    if (!confirmLeave()) return;
    try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* baribir chiqamiz */ }
    window.location.href = '/admin/login';
  });

  /* ============================ ishga tushirish ============================ */
  (async function init() {
    try {
      if (!(await loadSession())) return;
      // Menyudagi sonlar
      state.enabled.filter((n) => COLLECTIONS[n] && (!COLLECTIONS[n].staff || isStaff()))
        .forEach((n) => loadList(n).catch(() => {}));
      loadFiles().catch(() => {});
      await route();
    } catch (err) { toast(err.message, 'error'); }
  })();
})();
