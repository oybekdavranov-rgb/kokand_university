'use strict';
/**
 * KU yordamchisi — saytdagi RASMIY ma'lumotlardan javob beradi (LLM emas).
 * Niyat (intent) aniqlanadi, javob bazadagi yo'nalishlar, narxlar va
 * sozlamalardan yig'iladi, manba havolalari bilan qaytariladi.
 * Ma'lumot yo'q bo'lsa — o'ylab topmaydi, qabul komissiyasiga yo'naltiradi.
 *
 * Javob formati (XSS'dan xavfsiz — brauzer textContent bilan chizadi):
 *   { blocks: [{type:'p', text} | {type:'list', items:[{text, url?}]}], sources: [{label,url}], chips: [..] }
 */
const content = require('./content');
const i18n = require('./i18n');
const v = require('./views');
const { search, norm } = require('./search');

const T = {
  hello: {
    uz: 'Assalomu alaykum! Yo‘nalishlar, kontrakt narxlari, qabul, xalqaro dasturlar yoki aloqa haqida so‘rang.',
    ru: 'Здравствуйте! Спросите о направлениях, стоимости обучения, приёме, международных программах или контактах.',
    en: 'Hello! Ask me about programmes, tuition fees, admissions, international options or contacts.',
  },
  pricesIntro: {
    uz: 'Kontrakt narxlari (2026/2027 o‘quv yili):',
    ru: 'Стоимость обучения (2026/2027 учебный год):',
    en: 'Tuition fees (2026/2027 academic year):',
  },
  pricesBachelorDay: { uz: 'Bakalavriat, kunduzgi', ru: 'Бакалавриат, очная форма', en: 'Bachelor’s, full-time' },
  pricesBachelorDist: { uz: 'Bakalavriat, masofaviy', ru: 'Бакалавриат, дистанционная форма', en: 'Bachelor’s, distance' },
  pricesMaster: { uz: 'Magistratura', ru: 'Магистратура', en: 'Master’s' },
  pricesOutro: {
    uz: 'Aniq yo‘nalish narxini bilish uchun uning nomini yozing, masalan: “Kiberxavfsizlik narxi”.',
    ru: 'Чтобы узнать стоимость конкретного направления, напишите его название, например: «Кибербезопасность стоимость».',
    en: 'For a specific programme, type its name, for example: “Cybersecurity fee”.',
  },
  programmeHead: { uz: '{title} — {level}{code}.', ru: '{title} — {level}{code}.', en: '{title} — {level}{code}.' },
  programmeForms: { uz: 'Ta’lim shakli: {forms}.', ru: 'Форма обучения: {forms}.', en: 'Study mode: {forms}.' },
  programmePrice: { uz: 'Kontrakt narxi:', ru: 'Стоимость обучения:', en: 'Tuition fee:' },
  programmeMore: { uz: 'Batafsil ma’lumot yo‘nalish sahifasida.', ru: 'Подробности — на странице направления.', en: 'More details on the programme page.' },
  listIntro: {
    uz: 'Universitetda {n} ta dastur bor: bakalavriat — {b} ta, magistratura — {m} ta.',
    ru: 'В университете {n} программ: бакалавриат — {b}, магистратура — {m}.',
    en: 'The university offers {n} programmes: {b} bachelor’s and {m} master’s.',
  },
  listOutro: {
    uz: 'Mos yo‘nalishni tanlashda qisqa test yordam beradi.',
    ru: 'Подобрать направление поможет короткий тест.',
    en: 'A short quiz can help you choose.',
  },
  admission: {
    uz: 'Hujjatlar qabul platformasi orqali onlayn topshiriladi. Platformada qabul shartlari, muddatlari va ro‘yxatdan o‘tish tartibi e’lon qilinadi.',
    ru: 'Документы подаются онлайн через платформу приёма. Там публикуются условия, сроки и порядок регистрации.',
    en: 'Applications are submitted online via the admissions portal, which lists the requirements, deadlines and registration steps.',
  },
  admissionContact: {
    uz: 'Savollar bo‘yicha: {phone}{tg}.',
    ru: 'По вопросам: {phone}{tg}.',
    en: 'Questions: {phone}{tg}.',
  },
  joint: {
    uz: 'Qo‘shma ta’lim dasturlarida talaba 4-semestrda (mart–aprel) ariza topshiradi va o‘qishni hamkor universitetda 2 yil davom ettiradi. Talablar: GPA kamida 3.37 va IELTS 6.0+ (Joongbu University uchun TOPIK 3).',
    ru: 'В совместных программах студент подаёт заявку на 4-м семестре (март–апрель) и продолжает обучение 2 года в университете-партнёре. Требования: GPA не ниже 3.37 и IELTS 6.0+ (для Joongbu University — TOPIK 3).',
    en: 'In joint programmes, students apply in the 4th semester (March–April) and continue for 2 years at a partner university. Requirements: GPA of at least 3.37 and IELTS 6.0+ (TOPIK 3 for Joongbu University).',
  },
  jointPartners: { uz: 'Hamkor universitetlar:', ru: 'Университеты-партнёры:', en: 'Partner universities:' },
  contacts: { uz: 'Universitet manzili va aloqa ma’lumotlari:', ru: 'Адрес и контакты университета:', en: 'University address and contacts:' },
  services: { uz: 'Talaba va o‘qituvchilar uchun tizimlar:', ru: 'Системы для студентов и преподавателей:', en: 'Systems for students and staff:' },
  master: { uz: 'Magistratura mutaxassisliklari:', ru: 'Специальности магистратуры:', en: 'Master’s programmes:' },
  phd: {
    uz: 'Universitetda doktorantura bosqichi mavjud: hozir 31 nafar doktorant va 88 nafar mustaqil tadqiqotchi ilmiy izlanish olib bormoqda.',
    ru: 'В университете есть докторантура: сейчас исследования ведут 31 докторант и 88 независимых исследователей.',
    en: 'The university offers doctoral studies: 31 doctoral students and 88 independent researchers are currently conducting research.',
  },
  startups: {
    uz: 'Talabalar startaplari tanlovlarda natija ko‘rsatmoqda. Bir nechta misol:',
    ru: 'Студенческие стартапы побеждают на конкурсах. Несколько примеров:',
    en: 'Student startups are winning competitions. A few examples:',
  },
  news: { uz: 'So‘nggi yangiliklar:', ru: 'Последние новости:', en: 'Latest news:' },
  about: {
    uz: 'Kokand University 2019-yil 17-avgustda Vazirlar Mahkamasining 683-son qarori asosida tashkil etilgan — Farg‘ona viloyatidagi birinchi nodavlat oliy ta’lim muassasasi. Universitetda 3 ta fakultet, 9 ta kafedra va 12 ta departament bor.',
    ru: 'Kokand University основан 17 августа 2019 года постановлением Кабинета Министров № 683 — это первый негосударственный вуз Ферганской области. В университете 3 факультета, 9 кафедр и 12 департаментов.',
    en: 'Kokand University was founded on 17 August 2019 by Cabinet of Ministers Resolution No. 683 — the first private higher education institution in the Fergana region. It has 3 faculties, 9 chairs and 12 departments.',
  },
  distance: { uz: 'Masofaviy shaklda o‘qish mumkin bo‘lgan yo‘nalishlar:', ru: 'Направления с дистанционной формой обучения:', en: 'Programmes available by distance learning:' },
  dorm: {
    uz: 'Turar joy (yotoqxona) bo‘yicha aniq ma’lumot saytda e’lon qilinmagan. Qabul komissiyasidan so‘rang: {phone}.',
    ru: 'Подробная информация об общежитии на сайте не опубликована. Уточните в приёмной комиссии: {phone}.',
    en: 'Detailed accommodation information isn’t published on the site. Please ask the admissions office: {phone}.',
  },
  dormLink: { uz: 'Talabalar shaharchasi sayti:', ru: 'Сайт студенческого городка:', en: 'Student campus website:' },
  fallback: {
    uz: 'Bu savolga aniq javob topa olmadim. Ehtimol, quyidagilar yordam beradi:',
    ru: 'Точного ответа не нашлось. Возможно, помогут эти страницы:',
    en: 'I couldn’t find an exact answer. These pages might help:',
  },
  nothing: {
    uz: 'Bu haqda saytda ma’lumot topilmadi. Qabul komissiyasiga murojaat qiling: {phone}, {email}.',
    ru: 'На сайте нет информации об этом. Обратитесь в приёмную комиссию: {phone}, {email}.',
    en: 'There’s no information about this on the site. Please contact the admissions office: {phone}, {email}.',
  },
  src: {
    catalog: { uz: 'Yo‘nalishlar va narxlar', ru: 'Направления и цены', en: 'Programmes and fees' },
    admission: { uz: 'Qabul platformasi', ru: 'Платформа приёма', en: 'Admissions portal' },
    applicants: { uz: 'Abituriyentlarga', ru: 'Абитуриентам', en: 'For applicants' },
    joint: { uz: 'Qo‘shma dasturlar', ru: 'Совместные программы', en: 'Joint programmes' },
    contacts: { uz: 'Aloqa', ru: 'Контакты', en: 'Contact' },
    map: { uz: 'Xaritada', ru: 'На карте', en: 'Map' },
    about: { uz: 'Universitet haqida', ru: 'Об университете', en: 'About' },
    stories: { uz: 'Startap hikoyalari', ru: 'Истории стартапов', en: 'Startup stories' },
    news: { uz: 'Yangiliklar', ru: 'Новости', en: 'News' },
    quiz: { uz: 'Yo‘nalish tanlash testi', ru: 'Тест выбора направления', en: 'Programme finder' },
  },
};
function tr(entry, lang, vars) {
  let s = (entry && (entry[lang] || entry.uz)) || '';
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : ''));
  return s;
}

const INTENTS = [
  ['greet', /^(salom|assalom\S*|привет\S*|здравств\S*|добрый\S*|hello|hi|hey)(\s|$)/],
  ['price', /narx|kontrakt|to.?lov|pul|qancha|summa|necha pul|стоим|цен|сколько|контракт|оплат|price|fee|tuition|cost|how much/],
  ['distance', /masofaviy|onlayn|sirtqi|дистанц|заоч|онлайн|distance|online|part.?time/],
  ['master', /magistr|магистр|master/],
  ['phd', /doktor|phd|tadqiqotchi|ilmiy daraja|докторант|аспирант|doctoral|doctorate/],
  ['joint', /xorij|chet el|qo.?shma|koreya|latviya|xalqaro|ikki diplom|almashinuv|за рубеж|совмест|коре|латви|международ|обмен|abroad|joint|exchange|korea|latvia|international|double degree/],
  ['admission', /qabul|hujjat|ariza|topshir|abituriyent|imtihon|ro.?yxat|поступ|документ|приём|прием|заявк|экзамен|регистрац|admission|apply|application|enrol|document|entrance/],
  ['dorm', /yotoqxona|turar.?joy|shaharcha|общежит|жиль|городок|dorm|accommodation|housing/],
  ['services', /hemis|kabinet|baho|jadval|kutubxona|webmail|korporativ|расписан|оценк|библиотек|кабинет|timetable|grades|schedule|library|portal/],
  ['contacts', /manzil|telefon|aloqa|qayerda|email|pochta|qo.?ng.?iroq|адрес|телефон|контакт|где|почт|address|phone|contact|where|location|email|call/],
  ['startups', /startap|innovats|loyiha|tanlov|yutuq|стартап|проект|конкурс|достижен|startup|innovation|project|award/],
  ['news', /yangilik|xabar|e.?lon|новост|объявлен|news|announcement/],
  ['about', /tarix|qachon|tashkil|haqida|litsenziya|fakultet|kafedra|universitet haqida|история|основан|лиценз|факультет|кафедр|history|founded|about|licen|faculty/],
  ['programmes', /yo.?nalish|mutaxassis|dastur|nima o.?qi|qaysi|направлен|специальн|программ|programme|program|major|course|degree|study/],
];

function detectIntents(q) {
  const s = norm(q);
  return INTENTS.filter(([, re]) => re.test(s)).map(([k]) => k);
}

/** So'rovdagi yo'nalishni topish (nom yoki kod bo'yicha). */
function matchProgramme(q, programmes) {
  const s = norm(q);
  const words = s.split(' ').filter((w) => w.length >= 4);
  let best = null;
  for (const p of programmes) {
    if (p.code && s.includes(String(p.code))) return p;
    const names = [p.title, p.title_uz].filter(Boolean).map(norm);
    let score = 0;
    for (const name of names) {
      const nameWords = name.split(' ').filter((w) => w.length >= 4);
      for (const w of words) {
        if (nameWords.some((nw) => nw.startsWith(w.slice(0, Math.min(6, w.length))) || w.startsWith(nw.slice(0, Math.min(6, nw.length))))) score += 2;
      }
      // "ingliz", "rus", "o'zbek" kabi aniqlashtiruvchi so'zlar
      if (/ingliz|english|английск/.test(s) && /ingliz|english|английск/.test(name)) score += 2;
      if (/\brus\b|russian|русск/.test(s) && /\brus\b|russian|русск/.test(name)) score += 2;
      if (/ozbek|uzbek|узбек/.test(s) && /ozbek|uzbek|узбек/.test(name)) score += 2;
    }
    if (score > 0 && (!best || score > best.score)) best = { p, score };
  }
  return best && best.score >= 2 ? best.p : null;
}

function priceLines(p, lang) {
  return v.prices(p).filter((x) => x.amount).map((x) => ({ text: `${x.form ? v.formLabel(x.form, lang) : i18n.t('ui.price', lang)} — ${v.money(x.amount, lang)}` }));
}

function range(list) {
  const vals = list.filter(Boolean);
  if (!vals.length) return null;
  return [Math.min(...vals), Math.max(...vals)];
}
function fmtRange(r, lang) {
  if (!r) return '';
  return r[0] === r[1] ? v.money(r[0], lang) : `${i18n.num(r[0], lang)} — ${v.money(r[1], lang)}`;
}

async function answer(qRaw, langRaw) {
  const lang = i18n.normalizeLang(langRaw);
  const q = String(qRaw || '').slice(0, 300);
  const data = await content.getContent(lang);
  const s = data.settings;
  const pre = i18n.prefix(lang);
  const progs = data.programmes;
  const intents = detectIntents(q);
  const prog = matchProgramme(q, progs);
  const blocks = [];
  const sources = [];
  const chips = [];
  const add = (type, payload) => blocks.push({ type, ...payload });
  const src = (key, url) => { if (url && !sources.some((x) => x.url === url)) sources.push({ label: tr(T.src[key], lang), url }); };
  const phone = s.phone_1 || '';
  const tgName = s.admission_tg_url ? ` · Telegram @${String(s.admission_tg_url).split('/').pop()}` : '';

  // 1) Aniq yo'nalish so'ralgan
  if (prog && !intents.includes('joint')) {
    const lvl = v.levelLabel(prog.level, lang);
    add('p', { text: tr(T.programmeHead, lang, { title: prog.title, level: lvl, code: prog.code ? `, ${prog.code}` : '' }) });
    const f = v.forms(prog).map((x) => v.formLabel(x, lang));
    if (f.length) add('p', { text: tr(T.programmeForms, lang, { forms: f.join(', ') }) });
    const pl = priceLines(prog, lang);
    if (pl.length) { add('p', { text: tr(T.programmePrice, lang) }); add('list', { items: pl }); }
    add('p', { text: tr(T.programmeMore, lang) });
    sources.push({ label: prog.title, url: v.programmeUrl({ prefix: pre }, prog) });
    src('admission', s.admission_url);
    chips.push(i18n.t('as.q3', lang), i18n.t('as.q4', lang));
    return { blocks, sources, chips, intent: 'programme' };
  }

  const primary = intents[0] || null;
  switch (primary) {
    case 'greet':
      add('p', { text: tr(T.hello, lang) });
      chips.push(i18n.t('as.q1', lang), i18n.t('as.q2', lang), i18n.t('as.q3', lang));
      break;
    case 'price': {
      const lvl = (p) => v.levelKey(p.level);
      const pick = (level, formKey) => progs.filter((p) => lvl(p) === level)
        .flatMap((p) => v.prices(p).filter((x) => !formKey || v.formKey(x.form) === formKey).map((x) => x.amount));
      add('p', { text: tr(T.pricesIntro, lang) });
      const items = [];
      const bd = range(pick('bakalavr', 'form.day')); if (bd) items.push({ text: `${tr(T.pricesBachelorDay, lang)}: ${fmtRange(bd, lang)}` });
      const bm = range(pick('bakalavr', 'form.distance')); if (bm) items.push({ text: `${tr(T.pricesBachelorDist, lang)}: ${fmtRange(bm, lang)}` });
      const mm = range(pick('magistr')); if (mm) items.push({ text: `${tr(T.pricesMaster, lang)}: ${fmtRange(mm, lang)}` });
      if (items.length) add('list', { items }); else add('p', { text: tr(T.nothing, lang, { phone, email: s.email }) });
      add('p', { text: tr(T.pricesOutro, lang) });
      src('catalog', `${pre}/yonalishlar`);
      chips.push(i18n.t('as.q2', lang), i18n.t('as.q3', lang));
      break;
    }
    case 'distance': {
      const list = progs.filter((p) => v.prices(p).some((x) => v.formKey(x.form) === 'form.distance') || v.forms(p).some((f) => v.formKey(f) === 'form.distance'));
      if (!list.length) { add('p', { text: tr(T.nothing, lang, { phone, email: s.email }) }); break; }
      add('p', { text: tr(T.distance, lang) });
      add('list', {
        items: list.map((p) => {
          const pr = v.prices(p).find((x) => v.formKey(x.form) === 'form.distance');
          return { text: `${p.title}${pr && pr.amount ? ` — ${v.money(pr.amount, lang)}` : ''}`, url: v.programmeUrl({ prefix: pre }, p) };
        }),
      });
      src('catalog', `${pre}/yonalishlar`);
      break;
    }
    case 'master': {
      const list = progs.filter((p) => v.levelKey(p.level) === 'magistr');
      if (!list.length) { add('p', { text: tr(T.nothing, lang, { phone, email: s.email }) }); break; }
      add('p', { text: tr(T.master, lang) });
      add('list', { items: list.map((p) => ({ text: `${p.title}${p.code ? ` (${p.code})` : ''}${v.minPrice(p) ? ` — ${v.money(v.minPrice(p), lang)}` : ''}`, url: v.programmeUrl({ prefix: pre }, p) })) });
      src('catalog', `${pre}/yonalishlar`);
      break;
    }
    case 'phd':
      add('p', { text: tr(T.phd, lang) });
      src('about', `${pre}/universitet`);
      break;
    case 'joint': {
      add('p', { text: tr(T.joint, lang) });
      add('p', { text: tr(T.jointPartners, lang) });
      add('list', { items: [
        { text: 'SolBridge International School of Business (KR)' }, { text: 'Woosong University (KR)' },
        { text: 'Joongbu University (KR)' }, { text: 'Transport and Telecommunication Institute, Riga (LV)' },
      ] });
      src('joint', `${pre}/universitet#xalqaro`);
      break;
    }
    case 'admission': {
      add('p', { text: tr(T.admission, lang) });
      if (phone) add('p', { text: tr(T.admissionContact, lang, { phone, tg: tgName }) });
      src('admission', s.admission_url);
      if (s.official_url) src('applicants', `${s.official_url}/uz/static/for-applicants`);
      src('quiz', `${pre}/yonalishlar?test=1`);
      chips.push(i18n.t('as.q1', lang), i18n.t('as.q2', lang));
      break;
    }
    case 'dorm':
      add('p', { text: tr(T.dorm, lang, { phone }) });
      if (s.campus_url) { add('p', { text: tr(T.dormLink, lang) }); add('list', { items: [{ text: s.campus_url, url: s.campus_url }] }); }
      src('contacts', `${pre}/#aloqa`);
      break;
    case 'services': {
      add('p', { text: tr(T.services, lang) });
      const items = [['hemis_student_url', 'svc.hemis_student'], ['hemis_teacher_url', 'svc.hemis_teacher'], ['library_url', 'svc.library'], ['webmail_url', 'svc.webmail'], ['rector_bot_url', 'svc.rector_bot']]
        .filter(([k]) => s[k]).map(([k, label]) => ({ text: i18n.t(label, lang), url: s[k] }));
      if (s.official_url) items.push({ text: i18n.t('nav.schedule', lang), url: `${s.official_url}/uz/static/for-students` });
      add('list', { items });
      break;
    }
    case 'contacts': {
      add('p', { text: tr(T.contacts, lang) });
      const items = [];
      if (s.address) items.push({ text: s.address, url: s.map_url || undefined });
      if (s.phone_1) items.push({ text: s.phone_1, url: `tel:${s.phone_1.replace(/[^\d+]/g, '')}` });
      if (s.phone_2) items.push({ text: s.phone_2, url: `tel:${s.phone_2.replace(/[^\d+]/g, '')}` });
      if (s.email) items.push({ text: s.email, url: `mailto:${s.email}` });
      if (s.admission_tg_url) items.push({ text: `Telegram: @${String(s.admission_tg_url).split('/').pop()}`, url: s.admission_tg_url });
      add('list', { items });
      src('contacts', `${pre}/#aloqa`);
      if (s.map_url) src('map', s.map_url);
      break;
    }
    case 'startups': {
      const list = data.achievements.slice(0, 4);
      if (!list.length) { add('p', { text: tr(T.nothing, lang, { phone, email: s.email }) }); break; }
      add('p', { text: tr(T.startups, lang) });
      add('list', { items: list.map((a) => ({ text: `${a.name}${a.subtitle ? ` — ${a.subtitle}` : ''}` })) });
      src('stories', `${pre}/hikoyalar`);
      break;
    }
    case 'news': {
      const { sortedNews } = require('./pages');
      const list = sortedNews(data.news).slice(0, 3);
      if (!list.length) { add('p', { text: tr(T.nothing, lang, { phone, email: s.email }) }); break; }
      add('p', { text: tr(T.news, lang) });
      add('list', { items: list.map((n) => ({ text: `${n.title} (${v.fmtDate(n.date, lang)})`, url: v.newsUrl({ prefix: pre }, n) })) });
      src('news', `${pre}/yangiliklar`);
      break;
    }
    case 'about':
      add('p', { text: tr(T.about, lang) });
      src('about', `${pre}/universitet`);
      break;
    case 'programmes': {
      const b = progs.filter((p) => v.levelKey(p.level) === 'bakalavr');
      const m = progs.filter((p) => v.levelKey(p.level) === 'magistr');
      add('p', { text: tr(T.listIntro, lang, { n: progs.length, b: b.length, m: m.length }) });
      const groups = new Map();
      for (const p of b) {
        const k = p.field || i18n.t('level.bachelor', lang);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(p.title);
      }
      add('list', { items: [...groups.entries()].map(([k, arr]) => ({ text: `${k}: ${arr.join(', ')}` })).concat(m.length ? [{ text: `${i18n.t('level.master', lang)}: ${m.map((p) => p.title).join(', ')}` }] : []) });
      add('p', { text: tr(T.listOutro, lang) });
      src('catalog', `${pre}/yonalishlar`);
      src('quiz', `${pre}/yonalishlar?test=1`);
      chips.push(i18n.t('as.q1', lang));
      break;
    }
    default: {
      const results = (await search(q, lang, 4)).filter((r) => r.group !== 'contact');
      if (results.length) {
        add('p', { text: tr(T.fallback, lang) });
        add('list', { items: results.map((r) => ({ text: r.title, url: r.url })) });
      } else {
        add('p', { text: tr(T.nothing, lang, { phone, email: s.email }) });
      }
      chips.push(i18n.t('as.q1', lang), i18n.t('as.q2', lang), i18n.t('as.q5', lang));
    }
  }
  return { blocks, sources, chips: [...new Set(chips)].slice(0, 3), intent: primary || 'fallback' };
}

module.exports = { answer, detectIntents, matchProgramme };
