'use strict';
/**
 * Sahifa kontrollerlari: qaysi shablon, qaysi dinamik bloklar (slot),
 * SEO teglari va brauzerga beriladigan JSON (boot).
 */
const i18n = require('./i18n');
const v = require('./views');
const content = require('./content');

const { esc, t, icon } = v;

/** Brauzer skriptlari ishlatadigan satrlar */
const JS_STRINGS = [
  'ui.close', 'ui.copied', 'ui.copy_failed', 'ui.search_placeholder', 'ui.no_results', 'ui.prev', 'ui.next',
  'ui.results', 'ui.pages', 'ui.open', 'ui.share', 'ui.link_copied', 'ui.loading', 'ui.error_try_again',
  'ui.compare', 'ui.compare_title', 'ui.compare_empty', 'ui.compare_clear', 'ui.compare_max', 'ui.remove',
  'ui.price', 'ui.forms', 'ui.level', 'ui.code', 'ui.field', 'ui.sum', 'ui.all', 'ui.photo_of',
  'ui.install', 'ui.installed', 'ui.offline', 'ui.online', 'ui.theme_light', 'ui.theme_dark', 'ui.theme_auto',
  'as.title', 'as.placeholder', 'as.send', 'as.thinking', 'as.sources', 'as.hello', 'as.disclaimer', 'as.error',
  'quiz.result_title', 'quiz.result_empty', 'quiz.restart', 'quiz.step', 'ui.see_programme',
  'grp.page', 'grp.programme', 'grp.news', 'grp.story', 'grp.service', 'grp.contact',
];

function baseBoot(ctx, extra) {
  return { strings: i18n.pick(JS_STRINGS, ctx.lang), ...(extra || {}) };
}

function pageTitle(key, ctx) { return t(`seo.${key}.title`, ctx.lang); }
function pageDesc(key, ctx) { return t(`seo.${key}.desc`, ctx.lang); }

function orgJsonLd(ctx) {
  const s = ctx.settings;
  const base = ctx.baseUrl;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollegeOrUniversity',
    '@id': `${base}/#university`,
    name: 'Kokand University',
    alternateName: ['Qo‘qon universiteti', 'Кокандский университет', 'KU'],
    url: `${base}/`,
    logo: `${base}/img/icons/icon-512.png`,
    image: `${base}/img/og/og-image.jpg`,
    foundingDate: '2019-08-17',
    email: s.email || undefined,
    telephone: [s.phone_1, s.phone_2].filter(Boolean),
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Turkiston ko‘chasi, 28-A',
      addressLocality: 'Qo‘qon',
      addressRegion: 'Farg‘ona viloyati',
      postalCode: s.postal_code || '150700',
      addressCountry: 'UZ',
    },
    sameAs: [s.telegram_url, s.instagram_url, s.facebook_url, s.youtube_url].filter(Boolean),
  };
}

function breadcrumbs(ctx, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${ctx.baseUrl}${it.url}` })),
  };
}

/** Yangiliklarni sanasi bo'yicha (yangi birinchi) tartiblash; sort qo'lda berilgan bo'lsa — hurmat qilinadi. */
function sortedNews(list) {
  return [...list].sort((a, b) => (a.sort || 0) - (b.sort || 0) || v.dateValue(b.date) - v.dateValue(a.date) || b.id - a.id);
}

/* ================================ BOSH SAHIFA ================================ */
const home = {
  template: 'index.html',
  slots: {
    services: (ctx) => v.servicesDock(ctx),
    distinctions: (ctx) => ctx.data.distinctions.map((d, i) => v.distinctionCard(d, ctx, i)).join(''),
    'programme-rows': (ctx) => programmeRows(ctx),
    startups: (ctx) => ctx.data.achievements.map((a, i) => v.startupCard(a, ctx, i)).join(''),
    news: (ctx) => {
      const list = sortedNews(ctx.data.news).slice(0, 3);
      if (!list.length) return `<p class="empty">${esc(t('ui.no_news', ctx.lang))}</p>`;
      return list.map((n, i) => v.newsCard(n, ctx, { big: i === 0 })).join('');
    },
    gallery: (ctx) => ctx.data.gallery.slice(0, 6).map((g, i) => v.galleryTile(g, ctx, i, { sizes: '(max-width: 760px) 50vw, 33vw' })).join(''),
    interests: (ctx) => ctx.data.interests.map((it, i) => v.interestCard(it, ctx, i)).join(''),
    socials: (ctx) => v.socials(ctx),
  },
  seo: (ctx) => ({ title: pageTitle('home', ctx), description: pageDesc('home', ctx), path: '/', jsonld: [orgJsonLd(ctx)] }),
  boot: (ctx) => baseBoot(ctx, { gallery: galleryBoot(ctx, ctx.data.gallery.slice(0, 6)), quiz: quizBoot(ctx) }),
};

function programmeRows(ctx) {
  const lang = ctx.lang;
  const list = ctx.data.programmes;
  const groups = [['bakalavr', t('level.bachelor_plural', lang)], ['magistr', t('level.master_plural', lang)]];
  return groups.map(([lvl, label]) => {
    const items = list.filter((p) => v.levelKey(p.level) === lvl);
    if (!items.length) return '';
    return `<div class="prow-group" data-level="${lvl}">
  <h3 class="prow-head"><span>${esc(label)}</span><span class="count">${items.length}</span></h3>
  <ul class="prows">${items.map((p) => {
    const min = v.minPrice(p);
    return `<li class="prow" data-reveal><a href="${v.programmeUrl(ctx, p)}">
      <span class="prow-code mono">${esc(p.code || '')}</span>
      <span class="prow-title">${esc(p.title)}</span>
      <span class="prow-forms">${v.forms(p).map((f) => `<i>${esc(v.formLabel(f, lang))}</i>`).join('')}</span>
      <span class="prow-price">${min ? esc(v.priceFrom(p, lang)) : ''}</span>
      <span class="prow-go" aria-hidden="true">${icon('arrow-right')}</span>
    </a></li>`;
  }).join('')}</ul>
</div>`;
  }).join('');
}

function galleryBoot(ctx, list) {
  const photos = content.getPhotos();
  return list.map((g) => {
    const key = v.picture(g.image, '') ? (String(g.image).match(/img\/ku\/([a-z0-9-]+?)(?:-\d+)?\.(?:jpg|webp)$/i) || [])[1] : null;
    const ph = key && photos[key];
    const src = ph ? `/img/ku/${ph.variants[ph.variants.length - 1].file}` : (g.image ? (String(g.image).startsWith('/') || /^https?:/.test(g.image) ? g.image : '/' + g.image) : '');
    return { src, w: ph ? ph.w : null, h: ph ? ph.h : null, title: g.title, text: g.description || '', cat: g.category || '', video: g.video || '' };
  });
}

/** "Yo'nalish tanlash" testi uchun yo'nalishlar ro'yxati (soha teglari bilan) */
function quizBoot(ctx) {
  return ctx.data.programmes.filter((p) => v.levelKey(p.level) === 'bakalavr').map((p) => ({
    key: p.key, title: p.title, url: v.programmeUrl(ctx, p), field: v.slugify(p.field_uz || p.field || ''),
    tags: quizTags(p), price: v.minPrice(p), forms: v.forms(p).map((f) => v.formLabel(f, ctx.lang)),
  }));
}
function quizTags(p) {
  const s = `${p.field_uz || p.field || ''} ${p.title_uz || p.title || ''}`.toLowerCase().replace(/[‘’ʻ']/g, '');
  const tags = [];
  if (/kompyuter|kiber|it\b|muhandis/.test(s)) tags.push('tech');
  if (/iqtisod|moliya|biznes|turizm/.test(s)) tags.push('business');
  if (/til|filolog|adabiyot|lingvist/.test(s)) tags.push('language');
  if (/talim|pedagog|maktabgacha|boshlangich|psixolog/.test(s)) tags.push('people');
  if (/tarix|psixolog|ijtimoiy/.test(s)) tags.push('society');
  if (/turizm|mehmondost/.test(s)) tags.push('travel');
  if (/masofaviy/i.test(p.forms || '')) tags.push('remote');
  return tags;
}

/* ================================ UNIVERSITET ================================ */
const about = {
  template: 'universitet.html',
  slots: {
    distinctions: (ctx) => ctx.data.distinctions.map((d, i) => v.distinctionCard(d, ctx, i)).join(''),
    socials: (ctx) => v.socials(ctx),
  },
  seo: (ctx) => ({
    title: pageTitle('about', ctx), description: pageDesc('about', ctx), path: '/universitet',
    image: '/img/ku/kampus.jpg', imageAlt: 'Kokand University',
    jsonld: [orgJsonLd(ctx), breadcrumbs(ctx, [{ name: t('nav.home', ctx.lang), url: `${ctx.prefix}/` }, { name: t('nav.about', ctx.lang), url: `${ctx.prefix}/universitet` }])],
  }),
  boot: (ctx) => baseBoot(ctx),
};

/* ================================ YO'NALISHLAR ================================ */
const programmes = {
  template: 'dasturlar.html',
  prepare(ctx) {
    if (ctx.param) {
      const key = decodeURIComponent(ctx.param);
      ctx.item = ctx.data.programmes.find((p) => String(p.key) === key || String(p.id) === key);
      if (!ctx.item) return { notFound: true };
      ctx.flags.detail = true;
    } else ctx.flags.list = true;
    return {};
  },
  slots: {
    'field-chips': (ctx) => {
      const seen = new Map();
      for (const p of ctx.data.programmes) {
        const k = v.slugify(p.field_uz || p.field || '');
        if (k && !seen.has(k)) seen.set(k, p.field);
      }
      return [...seen.entries()].map(([k, label]) => `<button class="chip-btn" type="button" data-filter-field="${esc(k)}" aria-pressed="false">${esc(label)}</button>`).join('');
    },
    catalog: (ctx) => ctx.data.programmes.map((p) => v.programmeCard(p, ctx, { compare: true })).join(''),
    count: (ctx) => String(ctx.data.programmes.length),
    detail: (ctx) => programmeDetail(ctx, ctx.item),
  },
  seo: (ctx) => {
    if (ctx.item) {
      const p = ctx.item;
      const min = v.minPrice(p);
      return {
        title: `${p.title} — ${t('seo.programmes.suffix', ctx.lang)}`,
        description: p.intro || p.subtitle || pageDesc('programmes', ctx),
        path: `/yonalishlar/${encodeURIComponent(p.key || p.id)}`,
        jsonld: [{
          '@context': 'https://schema.org', '@type': 'EducationalOccupationalProgram',
          name: p.title, description: v.clip(p.intro || '', 300) || undefined,
          programPrerequisites: undefined, educationalProgramMode: v.forms(p).join(', ') || undefined,
          identifier: p.code || undefined,
          provider: { '@id': `${ctx.baseUrl}/#university` },
          offers: min ? { '@type': 'Offer', price: String(min), priceCurrency: 'UZS', category: 'Tuition' } : undefined,
          url: `${ctx.baseUrl}${v.programmeUrl(ctx, p)}`,
        }, breadcrumbs(ctx, [{ name: t('nav.home', ctx.lang), url: `${ctx.prefix}/` }, { name: t('nav.programmes', ctx.lang), url: `${ctx.prefix}/yonalishlar` }, { name: p.title, url: v.programmeUrl(ctx, p) }])],
      };
    }
    return { title: pageTitle('programmes', ctx), description: pageDesc('programmes', ctx), path: '/yonalishlar' };
  },
  boot: (ctx) => baseBoot(ctx, {
    programmes: ctx.data.programmes.map((p) => ({
      key: String(p.key || p.id), title: p.title, code: p.code || '', level: v.levelLabel(p.level, ctx.lang),
      field: p.field || '', url: v.programmeUrl(ctx, p),
      forms: v.forms(p).map((f) => v.formLabel(f, ctx.lang)),
      prices: v.prices(p).map((x) => ({ form: x.form ? v.formLabel(x.form, ctx.lang) : '', amount: x.amount })),
      language: p.language || '', duration: p.duration || '',
    })),
    quiz: quizBoot(ctx),
  }),
};

function programmeDetail(ctx, p) {
  const lang = ctx.lang;
  const hl = v.lines(p.highlights);
  const faq = v.faqParse(p.faq);
  const pr = v.prices(p);
  const related = ctx.data.programmes.filter((x) => x !== p && v.slugify(x.field_uz || x.field || '') === v.slugify(p.field_uz || p.field || '')).slice(0, 3);
  const others = related.length ? related : ctx.data.programmes.filter((x) => x !== p && v.levelKey(x.level) === v.levelKey(p.level)).slice(0, 3);
  const s = ctx.settings;
  return `<article class="pd">
  <header class="pd-hero">
    ${v.cover(p.key || p.id, { hint: p.field_uz || p.field || p.title_uz, glyph: p.code || '', cls: 'pd-cover', icon: v.fieldIcon(p.field_uz || p.field) })}
    <div class="wrap pd-hero-in">
      <nav class="crumbs" aria-label="${esc(t('ui.breadcrumbs', lang))}"><a href="${ctx.prefix}/">${esc(t('nav.home', lang))}</a><span aria-hidden="true">/</span><a href="${ctx.prefix}/yonalishlar">${esc(t('nav.programmes', lang))}</a></nav>
      <p class="eyebrow">${esc(v.levelLabel(p.level, lang))}${p.code ? ` · <span class="mono">${esc(p.code)}</span>` : ''}</p>
      <h1 class="h1">${esc(p.title)}</h1>
      ${p.subtitle ? `<p class="lead">${esc(p.subtitle)}</p>` : ''}
      <div class="pd-actions">
        ${s.admission_url ? `<a class="btn btn-primary" href="${esc(p.link || s.admission_url)}" target="_blank" rel="noopener">${icon('grad')}<span>${esc(t('ui.apply', lang))}</span></a>` : ''}
        <button class="btn btn-glass" type="button" data-share>${icon('share')}<span>${esc(t('ui.share', lang))}</span></button>
        <button class="btn btn-glass" type="button" data-assistant-ask="${esc(t('as.ask_price', lang, null, { name: p.title }))}">${icon('chat')}<span>${esc(t('ui.ask', lang))}</span></button>
      </div>
    </div>
  </header>
  <div class="wrap pd-grid">
    <div class="pd-main">
      ${p.intro ? `<section class="pd-sec"><h2 class="h3">${esc(t('pd.about', lang))}</h2><div class="prose">${v.prose(p.intro)}</div></section>` : ''}
      ${hl.length ? `<section class="pd-sec"><h2 class="h3">${esc(t('pd.highlights', lang))}</h2><ul class="ticks">${hl.map((x) => `<li>${icon('check')}<span>${v.inline(x)}</span></li>`).join('')}</ul></section>` : ''}
      ${faq.length ? `<section class="pd-sec"><h2 class="h3">${esc(t('pd.faq', lang))}</h2><div class="faq">${faq.map((f) => `<details><summary>${esc(f.q)}${icon('plus')}</summary><div class="prose">${v.prose(f.a)}</div></details>`).join('')}</div></section>` : ''}
    </div>
    <aside class="pd-aside">
      <div class="glass pd-facts">
        <h2 class="h4">${esc(t('pd.facts', lang))}</h2>
        <dl>
          <div><dt>${esc(t('ui.level', lang))}</dt><dd>${esc(v.levelLabel(p.level, lang))}</dd></div>
          ${p.code ? `<div><dt>${esc(t('ui.code', lang))}</dt><dd class="mono">${esc(p.code)}</dd></div>` : ''}
          ${p.field ? `<div><dt>${esc(t('ui.field', lang))}</dt><dd>${esc(p.field)}</dd></div>` : ''}
          ${v.forms(p).length ? `<div><dt>${esc(t('ui.forms', lang))}</dt><dd>${v.forms(p).map((f) => esc(v.formLabel(f, lang))).join(', ')}</dd></div>` : ''}
          ${p.language ? `<div><dt>${esc(t('ui.language_of', lang))}</dt><dd>${esc(p.language)}</dd></div>` : ''}
          ${p.duration ? `<div><dt>${esc(t('ui.duration', lang))}</dt><dd>${esc(p.duration)}</dd></div>` : ''}
        </dl>
        ${pr.length ? `<h3 class="h5">${esc(t('pd.prices', lang))}</h3><ul class="pd-prices">${pr.map((x) => `<li><span>${esc(x.form ? v.formLabel(x.form, lang) : t('ui.price', lang))}</span><b>${x.amount ? esc(v.money(x.amount, lang)) : esc(x.raw)}</b></li>`).join('')}</ul><p class="src">${esc(t('pd.price_note', lang))}</p>` : ''}
      </div>
    </aside>
  </div>
  ${others.length ? `<section class="sec sec-tight"><div class="wrap"><h2 class="h3">${esc(t('pd.related', lang))}</h2><div class="grid g-3 cards">${others.map((x) => v.programmeCard(x, ctx)).join('')}</div></div></section>` : ''}
</article>`;
}

/* ================================ YANGILIKLAR ================================ */
const news = {
  template: 'news.html',
  prepare(ctx) {
    if (ctx.param) {
      const id = Number(String(ctx.param).split('-')[0]);
      ctx.item = ctx.data.news.find((n) => n.id === id);
      if (!ctx.item) return { notFound: true };
      const canonical = v.newsUrl({ prefix: '' }, ctx.item).replace(/^\/yangiliklar\//, '');
      if (decodeURIComponent(ctx.param) !== canonical) return { redirect: `${ctx.prefix}/yangiliklar/${canonical}` };
      ctx.flags.detail = true;
    } else ctx.flags.list = true;
    return {};
  },
  slots: {
    list: (ctx) => {
      const list = sortedNews(ctx.data.news);
      return list.length ? list.map((n) => v.newsCard(n, ctx)).join('') : `<p class="empty">${esc(t('ui.no_news', ctx.lang))}</p>`;
    },
    article: (ctx) => article(ctx, ctx.item, 'news'),
    related: (ctx) => sortedNews(ctx.data.news).filter((n) => n !== ctx.item).slice(0, 3).map((n) => v.newsCard(n, ctx)).join(''),
  },
  seo: (ctx) => {
    if (ctx.item) {
      const n = ctx.item;
      const img = v.picture(n.image, '') ? imageUrl(n.image) : null;
      return {
        title: `${n.title} — Kokand University`, ogTitle: n.title, description: n.excerpt || v.clip(n.body, 200),
        path: v.newsUrl({ prefix: '' }, n), type: 'article', image: img, published: v.isoDate(n.date) || undefined,
        jsonld: [{
          '@context': 'https://schema.org', '@type': 'NewsArticle', headline: n.title,
          datePublished: v.isoDate(n.date) || undefined, image: img ? [`${ctx.baseUrl}${img}`] : [`${ctx.baseUrl}/img/og/og-image.jpg`],
          description: n.excerpt || undefined, publisher: { '@id': `${ctx.baseUrl}/#university` },
          mainEntityOfPage: `${ctx.baseUrl}${v.newsUrl(ctx, n)}`, inLanguage: ctx.lang,
        }, breadcrumbs(ctx, [{ name: t('nav.home', ctx.lang), url: `${ctx.prefix}/` }, { name: t('nav.news', ctx.lang), url: `${ctx.prefix}/yangiliklar` }, { name: n.title, url: v.newsUrl(ctx, n) }])],
      };
    }
    return { title: pageTitle('news', ctx), description: pageDesc('news', ctx), path: '/yangiliklar' };
  },
  boot: (ctx) => baseBoot(ctx),
};

function imageUrl(src) {
  const key = (String(src).match(/img\/ku\/([a-z0-9-]+?)(?:-\d+)?\.(?:jpg|webp)$/i) || [])[1];
  if (key) return `/img/ku/${key}.jpg`;
  return String(src).startsWith('/') || /^https?:/.test(src) ? src : '/' + src;
}

function article(ctx, item, kind) {
  const lang = ctx.lang;
  const listUrl = kind === 'news' ? `${ctx.prefix}/yangiliklar` : `${ctx.prefix}/hikoyalar`;
  const listName = kind === 'news' ? t('nav.news', lang) : t('nav.stories', lang);
  const img = v.picture(item.image, item.title, { sizes: '(max-width: 1100px) 100vw, 1100px', eager: true, cls: 'art-img' });
  const words = String(item.body || '').split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 180));
  return `<article class="art" data-progress>
  <header class="art-head wrap">
    <nav class="crumbs" aria-label="${esc(t('ui.breadcrumbs', lang))}"><a href="${ctx.prefix}/">${esc(t('nav.home', lang))}</a><span aria-hidden="true">/</span><a href="${listUrl}">${esc(listName)}</a></nav>
    <p class="art-meta">${item.category ? `<span class="tag">${esc(item.category)}</span>` : ''}${icon('calendar')}${v.timeTag(item.date, lang)}<span class="dot" aria-hidden="true"></span>${icon('clock')}<span>${esc(t('ui.read_min', lang, null, { n: mins }))}</span></p>
    <h1 class="h1 art-title">${esc(item.title)}</h1>
    ${item.excerpt ? `<p class="lead">${esc(item.excerpt)}</p>` : ''}
  </header>
  ${img ? `<figure class="art-figure wrap">${img}</figure>` : `<div class="art-figure wrap">${v.cover(`${kind}-${item.id}`, { cls: 'art-cover', glyph: v.shortDate(item.date, lang), icon: kind === 'news' ? 'news' : 'rocket' })}</div>`}
  <div class="art-body wrap">
    <div class="prose prose-lg">${v.prose(item.body || item.excerpt || '')}</div>
    <aside class="art-aside">
      <div class="art-share glass">
        <p class="h5">${esc(t('ui.share', lang))}</p>
        <div class="share-row">
          <button class="icon-btn" type="button" data-share aria-label="${esc(t('ui.share', lang))}">${icon('share')}</button>
          <a class="icon-btn" data-share-tg href="https://t.me/share/url" target="_blank" rel="noopener" aria-label="Telegram">${icon('telegram')}</a>
          <button class="icon-btn" type="button" data-copy-url aria-label="${esc(t('ui.copy_link', lang))}">${icon('link')}</button>
        </div>
        ${item.link ? `<a class="btn btn-glass btn-sm" href="${esc(item.link)}"${v.extAttrs(item.link)}>${icon('external')}<span>${esc(t('ui.source', lang))}</span></a>` : ''}
      </div>
    </aside>
  </div>
</article>`;
}

/* ================================ HIKOYALAR ================================ */
const stories = {
  template: 'stories.html',
  prepare(ctx) {
    if (ctx.param) {
      const id = Number(String(ctx.param).split('-')[0]);
      ctx.item = ctx.data.stories.find((n) => n.id === id);
      if (!ctx.item) return { notFound: true };
      const canonical = v.storyUrl({ prefix: '' }, ctx.item).replace(/^\/hikoyalar\//, '');
      if (decodeURIComponent(ctx.param) !== canonical) return { redirect: `${ctx.prefix}/hikoyalar/${canonical}` };
      ctx.flags.detail = true;
    } else ctx.flags.list = true;
    return {};
  },
  slots: {
    cats: (ctx) => {
      const seen = new Map();
      for (const s of ctx.data.stories) { const k = v.slugify(s.category_uz || s.category || ''); if (k && !seen.has(k)) seen.set(k, s.category); }
      return [...seen.entries()].map(([k, label]) => `<button class="chip-btn" type="button" data-filter-cat="${esc(k)}" aria-pressed="false">${esc(label)}</button>`).join('');
    },
    list: (ctx) => ctx.data.stories.length ? ctx.data.stories.map((s) => v.storyCard(s, ctx)).join('') : `<p class="empty">${esc(t('ui.no_stories', ctx.lang))}</p>`,
    article: (ctx) => article(ctx, ctx.item, 'story'),
    related: (ctx) => ctx.data.stories.filter((s) => s !== ctx.item).slice(0, 3).map((s) => v.storyCard(s, ctx)).join(''),
  },
  seo: (ctx) => {
    if (ctx.item) {
      const s = ctx.item;
      const img = v.picture(s.image, '') ? imageUrl(s.image) : null;
      return { title: `${s.title} — Kokand University`, ogTitle: s.title, description: s.excerpt || v.clip(s.body, 200), path: v.storyUrl({ prefix: '' }, s), type: 'article', image: img };
    }
    return { title: pageTitle('stories', ctx), description: pageDesc('stories', ctx), path: '/hikoyalar' };
  },
  boot: (ctx) => baseBoot(ctx),
};

/* ================================ GALEREYA ================================ */
const gallery = {
  template: 'galereya.html',
  slots: {
    cats: (ctx) => {
      const seen = new Map();
      for (const g of ctx.data.gallery) { const k = v.slugify(g.category_uz || g.category || ''); if (k && !seen.has(k)) seen.set(k, g.category); }
      return [...seen.entries()].map(([k, label]) => `<button class="chip-btn" type="button" data-filter-cat="${esc(k)}" aria-pressed="false">${esc(label)}</button>`).join('');
    },
    grid: (ctx) => {
      const tiles = ctx.data.gallery.map((g, i) => v.galleryTile(g, ctx, i, { sizes: '(max-width: 760px) 100vw, (max-width: 1200px) 50vw, 33vw' })).join('');
      return tiles || `<p class="empty">${esc(t('ui.no_photos', ctx.lang))}</p>`;
    },
  },
  seo: (ctx) => ({ title: pageTitle('gallery', ctx), description: pageDesc('gallery', ctx), path: '/galereya', image: '/img/ku/ai-hackathon.jpg' }),
  boot: (ctx) => baseBoot(ctx, { gallery: galleryBoot(ctx, ctx.data.gallery) }),
};

/* ================================ 404 / OFLAYN ================================ */
const notFound = {
  template: '404.html',
  slots: {},
  seo: (ctx) => ({ title: pageTitle('404', ctx), description: pageDesc('404', ctx), noindex: true }),
  boot: (ctx) => baseBoot(ctx),
};
const offline = {
  template: 'offline.html',
  slots: {},
  seo: (ctx) => ({ title: pageTitle('offline', ctx), description: pageDesc('offline', ctx), noindex: true, path: '/offline' }),
  boot: (ctx) => baseBoot(ctx),
};

const PAGES = { home, about, programmes, news, stories, gallery, notFound, offline };

/* ================================ marshrutlar ================================ */
const ROUTES = [
  [/^\/$/, 'home'],
  [/^\/universitet$/, 'about'],
  [/^\/yonalishlar$/, 'programmes'],
  [/^\/yonalishlar\/([^/]+)$/, 'programmes'],
  [/^\/yangiliklar$/, 'news'],
  [/^\/yangiliklar\/([^/]+)$/, 'news'],
  [/^\/hikoyalar$/, 'stories'],
  [/^\/hikoyalar\/([^/]+)$/, 'stories'],
  [/^\/galereya$/, 'gallery'],
  [/^\/offline$/, 'offline'],
];
/** Eski manzillar -> yangi (301) */
const LEGACY = {
  '/index.html': '/', '/news.html': '/yangiliklar', '/stories.html': '/hikoyalar', '/galereya.html': '/galereya',
  '/universitet.html': '/universitet', '/dasturlar.html': '/yonalishlar', '/yonalishlar.html': '/yonalishlar',
};

/**
 * pathname -> { lang, pageKey, param, pathNoLang } | { redirect } | null
 */
function resolve(pathname, query) {
  let p = pathname || '/';
  let lang = 'uz';
  const m = p.match(/^\/(ru|en|uz)(\/.*)?$/);
  if (m) {
    if (!m[2]) return { redirect: `/${m[1] === 'uz' ? '' : m[1] + '/'}` };
    if (m[1] === 'uz') return { redirect: m[2] };
    lang = m[1];
    p = m[2];
  }
  const pre = i18n.prefix(lang);
  if (LEGACY[p]) {
    let to = LEGACY[p];
    const id = query && query.get && query.get('id');
    if (id && /^\d+$/.test(id) && (p === '/news.html' || p === '/stories.html')) to += `/${id}`;
    return { redirect: pre + (to === '/' ? '/' : to) };
  }
  if (p.length > 1 && p.endsWith('/')) return { redirect: pre + p.replace(/\/+$/, '') };
  for (const [re, key] of ROUTES) {
    const r = p.match(re);
    if (r) return { lang, pageKey: key, param: r[1] || null, pathNoLang: p };
  }
  return null;
}

module.exports = { PAGES, resolve, JS_STRINGS, sortedNews, quizTags };
