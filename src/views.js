'use strict';
/**
 * Server tomonidagi komponentlar (HTML satrlar).
 * Har bir funksiya tayyor, tanlangan tilga o'girilgan va xavfsiz (escape
 * qilingan) HTML qaytaradi. Ma'lumot — admin paneldagi to'plamlardan.
 */
const { escapeHtml: esc } = require('./security/sanitize');
const i18n = require('./i18n');
const content = require('./content');

const t = (k, lang, fb, vars) => i18n.t(k, lang, fb, vars);

/* ============================ matn yordamchilari ============================ */
function lines(text) {
  return String(text || '').split('\n').map((x) => x.trim()).filter(Boolean);
}

/** "Savol :: Javob" qatorlari */
function faqParse(text) {
  return lines(text).map((line) => {
    const i = line.indexOf('::');
    return i >= 0 ? { q: line.slice(0, i).trim(), a: line.slice(i + 2).trim() } : { q: line, a: '' };
  }).filter((x) => x.q);
}

/** Inline: **qalin** va avtomatik havolalar (faqat http/https). */
function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

/** Bo'sh qator — yangi paragraf, oddiy qator — <br>. */
function prose(text) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b) => `<p>${b.split('\n').map(inline).join('<br>')}</p>`).join('');
}

function clip(s, n) {
  const v = String(s || '').replace(/\s+/g, ' ').trim();
  return v.length > n ? v.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : v;
}

/* ============================ sanalar ============================ */
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "02.10.2026", "2026-10-02", "23-may 2026", "23 may 2026" -> {y,m,d} */
function parseDate(str) {
  const s = String(str || '').trim().toLowerCase();
  let m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return { d: +m[1], m: +m[2], y: +m[3] };
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = s.match(/^(\d{1,2})[-\s]([a-z‘'ʻ]+)[,\s]+(\d{4})$/);
  if (m) {
    const name = m[2].replace(/[‘'ʻ]/g, '');
    const idx = UZ_MONTHS.findIndex((x) => name.startsWith(x.slice(0, 3)));
    if (idx >= 0) return { d: +m[1], m: idx + 1, y: +m[3] };
  }
  return null;
}
function isoDate(str) {
  const p = parseDate(str);
  return p ? `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : '';
}
function fmtDate(str, lang) {
  const p = parseDate(str);
  if (!p) return String(str || '');
  if (lang === 'ru') return `${p.d} ${RU_MONTHS[p.m - 1]} ${p.y}`;
  if (lang === 'en') return `${p.d} ${EN_MONTHS[p.m - 1]} ${p.y}`;
  return `${p.d}-${UZ_MONTHS[p.m - 1]}, ${p.y}`;
}
function timeTag(str, lang, cls) {
  const iso = isoDate(str);
  return iso ? `<time${cls ? ` class="${cls}"` : ''} datetime="${iso}">${esc(fmtDate(str, lang))}</time>` : (str ? `<span${cls ? ` class="${cls}"` : ''}>${esc(str)}</span>` : '');
}
/** Saralash uchun: sana (yangi birinchi) */
function dateValue(str) {
  const p = parseDate(str);
  return p ? p.y * 10000 + p.m * 100 + p.d : 0;
}

/* ============================ slug ============================ */
const { slugify } = require('./slug');

/* ============================ URL'lar ============================ */
function newsUrl(ctx, n) { return `${ctx.prefix}/yangiliklar/${n.id}-${slugify(n.title_uz || n.title) || 'yangilik'}`; }
function storyUrl(ctx, s) { return `${ctx.prefix}/hikoyalar/${s.id}-${slugify(s.title_uz || s.title) || 'hikoya'}`; }
function programmeUrl(ctx, p) { return `${ctx.prefix}/yonalishlar/${encodeURIComponent(p.key || p.id)}`; }
function isExternal(u) { return /^https?:\/\//i.test(String(u || '')); }
function extAttrs(u) { return isExternal(u) ? ' target="_blank" rel="noopener"' : ''; }

/* ============================ ikonka ============================ */
function icon(name, cls) {
  return `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="/img/icons.svg#${name}"/></svg>`;
}

/* ============================ rasmlar ============================ */
/**
 * Rasm: public/img/ku/photos.json dagi rasm (kalit yoki yo'l) bo'lsa — WebP srcset,
 * aks holda oddiy <img>. Mahalliy fayl topilmasa — null (o'rniga generativ muqova).
 */
function photoKey(src) {
  const s = String(src || '');
  const m = s.match(/^\/?img\/ku\/([a-z0-9-]+?)(?:-\d+)?\.(?:jpg|webp)$/i) || s.match(/^ku:([a-z0-9-]+)$/i);
  return m ? m[1] : null;
}
function picture(src, alt, opts = {}) {
  const sizes = opts.sizes || '(max-width: 760px) 100vw, 50vw';
  const loading = opts.eager ? 'eager' : 'lazy';
  const fetchp = opts.eager ? ' fetchpriority="high"' : '';
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  const key = photoKey(src);
  const photos = content.getPhotos();
  if (key && photos[key]) {
    const ph = photos[key];
    const srcset = ph.variants.map((v) => `/img/ku/${v.file} ${v.w}w`).join(', ');
    const fallback = `/img/ku/${ph.variants[Math.min(1, ph.variants.length - 1)].file}`;
    const lqip = opts.lqip === false ? '' : ` style="background-image:url(${ph.lqip})"`;
    return `<img${cls} src="${fallback}" srcset="${srcset}" sizes="${esc(sizes)}" width="${ph.w}" height="${ph.h}" alt="${esc(alt)}" loading="${loading}" decoding="async"${fetchp}${lqip}>`;
  }
  if (!src || !content.localImageExists(src)) return null;
  const url = /^(https?:)?\/\//i.test(src) || src.startsWith('/') ? src : '/' + src;
  return `<img${cls} src="${esc(url)}" alt="${esc(alt)}" loading="${loading}" decoding="async"${fetchp}>`;
}

/** Generativ muqova (Rishton sirlari palitrasi) — rasm bo'lmaganda. */
const PALETTES = [
  ['#16A7B6', '#2E42CC', '#0A1A4A', '#0B2C5A'], // feruza-kobalt
  ['#C99436', '#16A7B6', '#0B2C3A', '#123F47'], // oltin-feruza
  ['#9C1447', '#2E42CC', '#1A0F3A', '#2A1250'], // KU qirmizi-kobalt
  ['#2E42CC', '#7391FF', '#0A143D', '#14206A'], // kobalt
  ['#0E8C7F', '#C99436', '#0B2A28', '#0F3B36'], // zumrad-oltin
  ['#7B3FE4', '#16A7B6', '#1A1240', '#141A52'], // binafsha
];
const FIELD_PALETTE = { it: 3, iqtisod: 1, moliya: 1, turizm: 4, til: 5, filolog: 5, pedagog: 2, talim: 2, psixolog: 2, tarix: 0 };
function paletteFor(seed, hint) {
  const h = String(hint || '').toLowerCase().replace(/[‘’ʻ']/g, '');
  for (const [k, v] of Object.entries(FIELD_PALETTE)) if (h.includes(k)) return v;
  let n = 0;
  for (const ch of String(seed)) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return n % PALETTES.length;
}
function cover(seed, opts = {}) {
  const p = PALETTES[opts.palette != null ? opts.palette : paletteFor(seed, opts.hint)];
  let n = 7;
  for (const ch of String(seed)) n = (n * 33 + ch.charCodeAt(0)) >>> 0;
  const ang = n % 360;
  const cx = 10 + (n % 60);
  const glyph = opts.glyph ? `<span class="cover-glyph" aria-hidden="true">${esc(opts.glyph)}</span>` : '';
  const ic = opts.icon ? `<span class="cover-ic" aria-hidden="true">${icon(opts.icon)}</span>` : '';
  return `<div class="cover${opts.cls ? ' ' + opts.cls : ''}" style="--c1:${p[0]};--c2:${p[1]};--c3:${p[2]};--c4:${p[3]};--ang:${ang}deg;--cx:${cx}%" aria-hidden="true">${ic}${glyph}</div>`;
}

/* ============================ dasturlar ============================ */
const FORM_KEYS = { kunduzgi: 'form.day', sirtqi: 'form.extramural', kechki: 'form.evening', masofaviy: 'form.distance' };
function formKey(name) {
  const k = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
  return FORM_KEYS[k] || null;
}
function formLabel(name, lang) {
  const key = formKey(name);
  return key ? t(key, lang) : String(name || '');
}
function forms(p) { return String(p.forms || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean); }
/** "Kunduzgi :: 18 411 520" -> [{form, amount}] */
function prices(p) {
  return lines(p.price).map((line) => {
    const i = line.indexOf('::');
    const form = i >= 0 ? line.slice(0, i).trim() : '';
    const raw = i >= 0 ? line.slice(i + 2) : line;
    const amount = Number(String(raw).replace(/[^\d]/g, ''));
    return { form, amount: Number.isFinite(amount) && amount > 0 ? amount : null, raw: raw.trim() };
  });
}
function money(amount, lang) {
  if (!amount) return '';
  return `${i18n.num(amount, lang)} ${t('ui.sum', lang)}`;
}
function minPrice(p) {
  const list = prices(p).map((x) => x.amount).filter(Boolean);
  return list.length ? Math.min(...list) : null;
}
/** Bitta narx bo'lsa — aniq summa, bir nechta bo'lsa — "…dan". */
function priceFrom(p, lang) {
  const list = [...new Set(prices(p).map((x) => x.amount).filter(Boolean))];
  if (!list.length) return '';
  if (list.length === 1) return money(list[0], lang);
  return t('ui.price_from_v', lang, null, { v: i18n.num(Math.min(...list), lang) });
}
function levelLabel(level, lang) {
  const l = String(level || '').toLowerCase();
  if (l.startsWith('magistr')) return t('level.master', lang);
  if (l.startsWith('doktor') || l.startsWith('phd')) return t('level.phd', lang);
  return t('level.bachelor', lang);
}
function levelKey(level) {
  const l = String(level || '').toLowerCase();
  if (l.startsWith('magistr')) return 'magistr';
  if (l.startsWith('doktor') || l.startsWith('phd')) return 'phd';
  return 'bakalavr';
}

function programmeCard(p, ctx, opts = {}) {
  const lang = ctx.lang;
  const f = forms(p);
  const min = minPrice(p);
  const url = programmeUrl(ctx, p);
  const glyph = p.code || (p.title || '').slice(0, 2);
  const tags = f.map((x) => `<li>${esc(formLabel(x, lang))}</li>`).join('');
  const lvl = levelKey(p.level);
  return `<article class="card prog-card" data-level="${lvl}" data-field="${esc(slugify(p.field_uz || p.field || ''))}" data-forms="${esc(f.map((x) => formKey(x) || x).join(' '))}" data-price="${min || 0}" data-key="${esc(p.key || p.id)}" data-title="${esc((p.title || '').toLowerCase())}"${opts.reveal === false ? '' : ' data-reveal'}>
  ${cover(p.key || p.id, { hint: p.field_uz || p.field || p.title_uz || p.title, glyph, cls: 'card-cover', icon: fieldIcon(p.field_uz || p.field) })}
  <div class="card-body">
    <p class="card-kicker"><span>${esc(levelLabel(p.level, lang))}</span>${p.code ? `<span class="mono">${esc(p.code)}</span>` : ''}</p>
    <h3 class="card-title"><a class="card-link" href="${url}">${esc(p.title)}</a></h3>
    ${p.field ? `<p class="card-text">${esc(p.field)}</p>` : (p.subtitle ? `<p class="card-text">${esc(p.subtitle)}</p>` : '')}
    ${tags ? `<ul class="chips" aria-label="${esc(t('ui.forms', lang))}">${tags}</ul>` : ''}
    ${min ? `<p class="price"><span>${esc(t('ui.price_from', lang))}</span> <b>${esc(priceFrom(p, lang))}</b></p>` : ''}
  </div>
  ${opts.compare ? `<button class="cmp-toggle" type="button" data-compare="${esc(p.key || p.id)}" aria-pressed="false">${icon('scale')}<span>${esc(t('ui.compare', lang))}</span></button>` : ''}
</article>`;
}
function fieldIcon(field) {
  const f = String(field || '').toLowerCase().replace(/[‘’ʻ']/g, '');
  if (/it|muhandis|kiber|kompyuter/.test(f)) return 'cpu';
  if (/iqtisod|moliya|biznes/.test(f)) return 'chart';
  if (/turizm/.test(f)) return 'plane';
  if (/til|filolog/.test(f)) return 'language';
  if (/talim|pedagog|psixolog/.test(f)) return 'book';
  if (/tarix|ijtimoiy|gumanitar/.test(f)) return 'landmark';
  return 'grad';
}

/* ============================ yangiliklar ============================ */
function newsCard(n, ctx, opts = {}) {
  const lang = ctx.lang;
  const url = newsUrl(ctx, n);
  const media = picture(n.image, n.title, { sizes: opts.big ? '(max-width: 900px) 100vw, 60vw' : '(max-width: 900px) 100vw, 30vw', cls: 'card-img' })
    || cover(`news-${n.id}`, { cls: 'card-cover', glyph: shortDate(n.date, lang), icon: 'news' });
  return `<article class="card news-card${opts.big ? ' is-big' : ''}" data-reveal data-search="${esc((n.title + ' ' + (n.excerpt || '')).toLowerCase())}">
  <div class="card-media">${media}</div>
  <div class="card-body">
    <p class="card-kicker">${icon('calendar')}${timeTag(n.date, lang)}</p>
    <h3 class="card-title"><a class="card-link" href="${url}">${esc(n.title)}</a></h3>
    ${n.excerpt ? `<p class="card-text">${esc(clip(n.excerpt, opts.big ? 220 : 140))}</p>` : ''}
  </div>
</article>`;
}
function shortDate(str, lang) {
  const p = parseDate(str);
  if (!p) return '';
  const months = lang === 'ru' ? RU_MONTHS : lang === 'en' ? EN_MONTHS : UZ_MONTHS;
  return `${p.d} ${months[p.m - 1].slice(0, 3)}`;
}

function storyCard(s, ctx) {
  const url = storyUrl(ctx, s);
  const media = picture(s.image, s.title, { sizes: '(max-width: 900px) 100vw, 33vw', cls: 'card-img' })
    || cover(`story-${s.id}`, { cls: 'card-cover', hint: s.category, icon: 'rocket' });
  return `<article class="card story-card" data-reveal data-cat="${esc(slugify(s.category_uz || s.category || ''))}" data-search="${esc((s.title + ' ' + (s.excerpt || '')).toLowerCase())}">
  <div class="card-media">${media}</div>
  <div class="card-body">
    <p class="card-kicker">${s.category ? `<span class="tag">${esc(s.category)}</span>` : ''}${timeTag(s.date, ctx.lang)}</p>
    <h3 class="card-title"><a class="card-link" href="${url}">${esc(s.title)}</a></h3>
    ${s.excerpt ? `<p class="card-text">${esc(clip(s.excerpt, 160))}</p>` : ''}
  </div>
</article>`;
}

/* ============================ startaplar (achievements) ============================ */
function startupCard(a, ctx, idx) {
  const desc = lines(a.description);
  // Tavsifning birinchi qatori "Soha · Bosqich" bo'lishi mumkin
  let meta = '';
  let body = a.description || '';
  if (desc.length > 1 && desc[0].length < 60 && desc[0].includes('·')) { meta = desc[0]; body = desc.slice(1).join('\n'); }
  const media = picture(a.image, a.name, { sizes: '(max-width: 760px) 85vw, 380px', cls: 'card-img' })
    || cover(`st-${a.id}`, { cls: 'card-cover', hint: meta, glyph: String(idx + 1).padStart(2, '0'), icon: 'rocket' });
  return `<article class="card startup-card" data-reveal>
  <div class="card-media">${media}</div>
  <div class="card-body">
    ${meta ? `<p class="card-kicker">${esc(meta)}</p>` : ''}
    <h3 class="card-title">${esc(a.name)}</h3>
    ${a.subtitle ? `<p class="award">${icon('trophy')}<span>${esc(a.subtitle)}</span></p>` : ''}
    ${body ? `<p class="card-text">${esc(clip(body, 170))}</p>` : ''}
  </div>
</article>`;
}

/* ============================ ajralib turish ============================ */
const DIST_ICONS = ['flag', 'globe', 'rocket', 'cpu', 'flask', 'grad', 'users', 'shield'];
function distinctionCard(d, ctx, idx) {
  return `<article class="dist-card glass" data-reveal style="--i:${idx}">
  <span class="dist-n" aria-hidden="true">${String(idx + 1).padStart(2, '0')}</span>
  <span class="dist-ic" aria-hidden="true">${icon(DIST_ICONS[idx % DIST_ICONS.length])}</span>
  <h3 class="dist-title">${esc(d.title)}</h3>
  ${d.summary ? `<p class="dist-sum">${esc(d.summary)}</p>` : ''}
  ${d.body ? `<details class="dist-more"><summary>${esc(t('ui.more', ctx.lang))}</summary><div class="prose">${prose(d.body)}</div></details>` : ''}
</article>`;
}

/* ============================ foydali havolalar ============================ */
const INT_ICONS = ['grad', 'users', 'heart', 'briefcase', 'book', 'flask', 'globe', 'link'];
const INT_KEYWORDS = [
  [/abituriyent|qabul|applicant/, 'grad'], [/talaba|student/, 'users'], [/ota-ona|parent/, 'heart'],
  [/bitiruvchi|alumni/, 'award'], [/vakansiya|ish o|hrd|career/, 'briefcase'], [/jurnal|herald|journal/, 'file'],
  [/kutubxona|library/, 'book'], [/maqola|scholar/, 'flask'], [/xalqaro|international/, 'globe'],
];
function interestIcon(it, idx) {
  const hay = `${it.title_uz || it.title} ${it.link || ''}`.toLowerCase().replace(/[‘’ʻ']/g, '');
  for (const [re, ic] of INT_KEYWORDS) if (re.test(hay)) return ic;
  return INT_ICONS[idx % INT_ICONS.length];
}
function interestCard(it, ctx, idx) {
  const link = it.link || '';
  const tag = link ? 'a' : 'div';
  const href = link ? ` href="${esc(link)}"${extAttrs(link)}` : '';
  return `<${tag} class="int-card glass" data-reveal${href}>
  <span class="int-ic" aria-hidden="true">${icon(interestIcon(it, idx))}</span>
  <span class="int-title">${esc(it.title)}</span>
  ${it.body ? `<span class="int-text">${esc(clip(it.body, 120))}</span>` : ''}
  ${link ? `<span class="int-go" aria-hidden="true">${icon(isExternal(link) ? 'external' : 'arrow-right')}</span>` : ''}
</${tag}>`;
}

/* ============================ galereya ============================ */
function galleryTile(g, ctx, idx, opts = {}) {
  const img = picture(g.image, g.title, { sizes: opts.sizes || '(max-width: 760px) 50vw, 33vw', cls: 'g-img' });
  if (!img && !g.video) return '';
  const media = img || cover(`g-${g.id}`, { cls: 'g-img', icon: 'play' });
  return `<figure class="g-tile" data-reveal data-cat="${esc(slugify(g.category_uz || g.category || ''))}" data-index="${idx}">
  <button class="g-open" type="button" data-lightbox="${idx}" aria-label="${esc(t('ui.open_photo', ctx.lang))}: ${esc(g.title)}">${media}${g.video ? `<span class="g-play">${icon('play')}</span>` : ''}</button>
  <figcaption><span class="g-cat">${esc(g.category || '')}</span><span class="g-title">${esc(g.title)}</span></figcaption>
</figure>`;
}

/* ============================ xizmatlar paneli ============================ */
const SERVICES = [
  ['admission_url', 'svc.admission', 'grad'],
  ['hemis_student_url', 'svc.hemis_student', 'user'],
  ['hemis_teacher_url', 'svc.hemis_teacher', 'users'],
  ['library_url', 'svc.library', 'book'],
  ['rector_bot_url', 'svc.rector_bot', 'chat'],
  ['webmail_url', 'svc.webmail', 'mail'],
];
function servicesDock(ctx) {
  const s = ctx.settings;
  return SERVICES.filter(([k]) => s[k]).map(([k, label, ic]) =>
    `<li><a class="svc" href="${esc(s[k])}" target="_blank" rel="noopener"><span class="svc-ic">${icon(ic)}</span><span class="svc-label">${esc(t(label, ctx.lang))}</span>${icon('external', 'svc-ext')}</a></li>`).join('');
}

function socials(ctx, cls) {
  const s = ctx.settings;
  const list = [['telegram_url', 'telegram', 'Telegram'], ['instagram_url', 'instagram', 'Instagram'], ['facebook_url', 'facebook', 'Facebook'], ['youtube_url', 'youtube', 'YouTube']];
  return list.filter(([k]) => s[k]).map(([k, ic, name]) =>
    `<a class="${cls || 'soc'}" href="${esc(s[k])}" target="_blank" rel="noopener" aria-label="${name}">${icon(ic)}</a>`).join('');
}

module.exports = {
  esc, t, lines, faqParse, prose, inline, clip, parseDate, isoDate, fmtDate, timeTag, dateValue, slugify,
  newsUrl, storyUrl, programmeUrl, isExternal, extAttrs, icon, picture, cover, paletteFor,
  forms, formKey, formLabel, prices, money, minPrice, priceFrom, levelLabel, levelKey, fieldIcon,
  programmeCard, newsCard, storyCard, startupCard, distinctionCard, interestCard, galleryTile,
  servicesDock, socials, shortDate,
};
