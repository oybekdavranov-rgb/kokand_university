'use strict';
/**
 * Sayt bo'yicha qidiruv (⌘K palitrasi va yordamchi uchun).
 * Indeks — joriy kontent (yo'nalishlar, yangiliklar, hikoyalar, sahifalar,
 * xizmatlar). Tanlangan til + o'zbekcha matn birga indekslanadi.
 */
const content = require('./content');
const i18n = require('./i18n');
const v = require('./views');

/** Apostrof va diakritikalarni tekislash: "O‘zbek" -> "ozbek" */
function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/[‘’ʻʼ'`´]/g, '')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s.+-]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}
function tokens(s) { return norm(s).split(' ').filter((x) => x.length > 1); }

const PAGES = [
  { key: 'home', path: '/', icon: 'home', title: 'nav.home', kw: 'bosh sahifa главная home kokand university qoqon' },
  { key: 'about', path: '/universitet', icon: 'landmark', title: 'nav.about', desc: 'nav.about_d', kw: 'universitet haqida tarix missiya litsenziya fakultet kafedra departament университет история миссия факультет кафедра about history mission faculty' },
  { key: 'programmes', path: '/yonalishlar', icon: 'grad', title: 'nav.programmes', desc: 'nav.prices_d', kw: 'yonalish mutaxassislik kontrakt narx dastur направления специальности стоимость контракт programmes majors tuition fees' },
  { key: 'quiz', path: '/yonalishlar?test=1', icon: 'compass', title: 'nav.quiz', desc: 'nav.quiz_d', kw: 'test tanlash qaysi тест выбор quiz finder' },
  { key: 'joint', path: '/universitet#xalqaro', icon: 'globe', title: 'nav.intl', desc: 'nav.intl_d', kw: 'xalqaro qoshma xorij koreya latviya международные совместные корея латвия international joint abroad korea latvia' },
  { key: 'news', path: '/yangiliklar', icon: 'news', title: 'nav.news', desc: 'nav.news_d', kw: 'yangiliklar xabarlar новости news' },
  { key: 'stories', path: '/hikoyalar', icon: 'rocket', title: 'nav.stories', desc: 'nav.stories_d', kw: 'hikoyalar startaplar yutuqlar истории стартапы stories startups awards' },
  { key: 'gallery', path: '/galereya', icon: 'image', title: 'nav.gallery', desc: 'nav.gallery_d', kw: 'galereya rasmlar suratlar галерея фото gallery photos' },
  { key: 'contact', path: '/#aloqa', icon: 'pin', title: 'nav.contact', kw: 'aloqa manzil telefon email контакты адрес телефон contact address phone' },
];
const SERVICES = [
  ['admission_url', 'svc.admission', 'grad', 'qabul hujjat ariza abituriyent приём поступление admission apply'],
  ['hemis_student_url', 'svc.hemis_student', 'user', 'hemis talaba baho jadval студент оценки student grades'],
  ['hemis_teacher_url', 'svc.hemis_teacher', 'users', 'hemis oqituvchi преподаватель teacher'],
  ['library_url', 'svc.library', 'book', 'kutubxona kitob библиотека library books'],
  ['rector_bot_url', 'svc.rector_bot', 'chat', 'rektor bot murojaat ректор обращение rector'],
  ['webmail_url', 'svc.webmail', 'mail', 'pochta email korporativ почта mail'],
  ['structure_url', 'nav.structure', 'network', 'tuzilma rahbariyat departament xodim структура руководство structure leadership staff'],
  ['vacancies_url', 'nav.vacancies', 'briefcase', 'vakansiya ish вакансии работа careers jobs'],
  ['journal_url', 'nav.journal', 'file', 'jurnal ilmiy maqola журнал научный journal research'],
];

async function buildIndex(lang) {
  const data = await content.getContent(lang);
  const pre = i18n.prefix(lang);
  const s = data.settings;
  const items = [];
  for (const p of PAGES) {
    const title = i18n.t(p.title, lang);
    items.push({ group: 'page', icon: p.icon, title, desc: p.desc ? i18n.t(p.desc, lang) : '', url: pre + p.path, hay: `${title} ${p.kw}` });
  }
  for (const p of data.programmes) {
    const min = v.minPrice(p);
    items.push({
      group: 'programme', icon: v.fieldIcon(p.field_uz || p.field), title: p.title,
      desc: [v.levelLabel(p.level, lang), p.code, min ? v.priceFrom(p, lang) : ''].filter(Boolean).join(' · '),
      url: v.programmeUrl({ prefix: pre }, p), code: p.code || '',
      hay: `${p.title} ${p.title_uz || ''} ${p.code || ''} ${p.field || ''} ${p.field_uz || ''} ${p.subtitle || ''} ${v.forms(p).join(' ')}`,
    });
  }
  for (const n of data.news) {
    items.push({ group: 'news', icon: 'news', title: n.title, desc: v.fmtDate(n.date, lang), url: v.newsUrl({ prefix: pre }, n), hay: `${n.title} ${n.title_uz || ''} ${n.excerpt || ''}`, date: v.dateValue(n.date) });
  }
  for (const st of data.stories) {
    items.push({ group: 'story', icon: 'rocket', title: st.title, desc: st.category || '', url: v.storyUrl({ prefix: pre }, st), hay: `${st.title} ${st.title_uz || ''} ${st.category || ''} ${st.excerpt || ''}` });
  }
  for (const [k, label, icon, kw] of SERVICES) {
    if (!s[k]) continue;
    const title = i18n.t(label, lang);
    items.push({ group: 'service', icon, title, desc: s[k].replace(/^https?:\/\//, ''), url: s[k], external: true, hay: `${title} ${kw}` });
  }
  if (s.phone_1) items.push({ group: 'contact', icon: 'phone', title: s.phone_1, desc: i18n.t('contact.phone', lang), url: `tel:${s.phone_1.replace(/[^\d+]/g, '')}`, hay: `${s.phone_1} telefon телефон phone qongiroq` });
  if (s.email) items.push({ group: 'contact', icon: 'mail', title: s.email, desc: i18n.t('contact.email', lang), url: `mailto:${s.email}`, hay: `${s.email} email pochta почта` });
  if (s.address) items.push({ group: 'contact', icon: 'pin', title: s.address, desc: i18n.t('contact.address', lang), url: s.map_url || `${pre}/#aloqa`, external: Boolean(s.map_url), hay: `${s.address} manzil адрес address qayerda где where` });
  for (const it of items) it.n = norm(it.hay);
  return items;
}

const GROUP_ORDER = ['programme', 'page', 'service', 'news', 'story', 'contact'];

async function search(q, lang, limit = 14) {
  const query = norm(q).slice(0, 120);
  const toks = tokens(query);
  const items = await buildIndex(lang);
  if (!toks.length) {
    // Bo'sh so'rov: tavsiya etilgan natijalar
    const pick = items.filter((x) => x.group === 'page').slice(1, 6)
      .concat(items.filter((x) => x.group === 'service').slice(0, 3))
      .concat(items.filter((x) => x.group === 'news').sort((a, b) => b.date - a.date).slice(0, 2));
    return pick.map(strip);
  }
  const scored = [];
  for (const it of items) {
    const title = norm(it.title);
    let score = 0;
    for (const tk of toks) {
      if (it.code && norm(it.code) === tk) score += 10;
      if (title.startsWith(tk)) score += 6;
      else if (title.split(' ').some((w) => w.startsWith(tk))) score += 5;
      else if (title.includes(tk)) score += 3;
      if (it.n.split(' ').some((w) => w.startsWith(tk))) score += 2;
      else if (tk.length >= 4 && it.n.includes(tk.slice(0, Math.max(4, tk.length - 2)))) score += 1;
    }
    // barcha so'zlar topilganda bonus
    if (toks.every((tk) => it.n.includes(tk.slice(0, Math.max(3, tk.length - 2))))) score += 3;
    if (title.includes(query)) score += 4;
    if (score > 0) scored.push({ it, score });
  }
  scored.sort((a, b) => b.score - a.score || GROUP_ORDER.indexOf(a.it.group) - GROUP_ORDER.indexOf(b.it.group));
  return scored.slice(0, limit).map((x) => strip(x.it));
}

function strip(it) {
  return { group: it.group, icon: it.icon, title: it.title, desc: it.desc, url: it.url, external: Boolean(it.external) };
}

module.exports = { search, norm, tokens, buildIndex };
