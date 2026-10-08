/* =====================================================================
   Kokand University — sahifa vositalari
   Katalog filtrlari · yo'nalishlarni solishtirish · tanlash testi · lightbox
   ===================================================================== */
const { $, $$, t, boot, calm, toast } = window.KU;

const normalize = (s) => String(s || '').toLowerCase().replace(/[‘’ʻʼ'`]/g, '').replace(/\s+/g, ' ').trim();

/* ---------------- katalog filtrlari ---------------- */
function initFilters() {
  const bar = $('[data-filters]');
  const grid = $('[data-catalog]');
  if (!bar || !grid) return;
  const items = Array.from(grid.children).filter((el) => el.matches('.card, .g-tile'));
  const empty = $('[data-empty]');
  const countEl = $('[data-result-n]');
  const state = { q: '', level: '', field: '', forms: new Set(), cat: '', sort: 'default' };
  const original = items.slice();
  const search = $('[data-f-search]', bar);
  const apply = () => {
    let shown = 0;
    for (const el of items) {
      const hay = el.dataset.search || el.dataset.title || normalize(el.textContent);
      let ok = true;
      if (state.q && !normalize(hay + ' ' + (el.dataset.key || '')).includes(state.q)) ok = false;
      if (state.level && el.dataset.level !== state.level) ok = false;
      if (state.field && el.dataset.field !== state.field) ok = false;
      if (state.cat && el.dataset.cat !== state.cat) ok = false;
      if (state.forms.size) { const f = (el.dataset.forms || '').split(' '); for (const x of state.forms) if (!f.includes(x)) ok = false; }
      el.classList.toggle('is-hidden', !ok);
      el.hidden = !ok;
      if (ok) shown++;
    }
    if (countEl) countEl.textContent = String(shown);
    if (empty) empty.hidden = shown > 0;
    // tartiblash
    let order = original.slice();
    if (state.sort === 'title') order.sort((a, b) => (a.dataset.title || '').localeCompare(b.dataset.title || ''));
    if (state.sort === 'price-asc') order.sort((a, b) => (Number(a.dataset.price) || 9e12) - (Number(b.dataset.price) || 9e12));
    if (state.sort === 'price-desc') order.sort((a, b) => (Number(b.dataset.price) || 0) - (Number(a.dataset.price) || 0));
    order.forEach((el) => grid.append(el));
    // URL ga yozamiz (ulashish uchun)
    const u = new URL(location.href);
    ['q', 'daraja', 'soha', 'tur'].forEach((k) => u.searchParams.delete(k));
    if (state.q) u.searchParams.set('q', state.q);
    if (state.level) u.searchParams.set('daraja', state.level);
    if (state.field) u.searchParams.set('soha', state.field);
    if (state.cat) u.searchParams.set('tur', state.cat);
    history.replaceState(null, '', u);
  };
  let timer = 0;
  search?.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = normalize(search.value); apply(); }, 120); });
  bar.addEventListener('click', (e) => {
    const lv = e.target.closest('[data-f-level] button');
    if (lv) { state.level = lv.dataset.v; $$('[data-f-level] button', bar).forEach((b) => b.setAttribute('aria-pressed', String(b === lv))); apply(); return; }
    const fd = e.target.closest('[data-filter-field]');
    if (fd) { const v = fd.dataset.filterField; state.field = state.field === v ? '' : v; $$('[data-filter-field]', bar).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filterField === state.field))); apply(); return; }
    const fm = e.target.closest('[data-filter-form]');
    if (fm) { const v = fm.dataset.filterForm; if (state.forms.has(v)) state.forms.delete(v); else state.forms.add(v); fm.setAttribute('aria-pressed', String(state.forms.has(v))); apply(); return; }
    const ct = e.target.closest('[data-filter-cat]');
    if (ct) { state.cat = ct.dataset.filterCat; $$('[data-filter-cat]', bar).forEach((b) => b.setAttribute('aria-pressed', String(b === ct))); apply(); }
  });
  $('[data-f-sort]', bar)?.addEventListener('change', (e) => { state.sort = e.target.value; apply(); });
  // URL parametrlaridan tiklash
  const sp = new URLSearchParams(location.search);
  if (sp.get('q') && search) { search.value = sp.get('q'); state.q = normalize(sp.get('q')); }
  if (sp.get('daraja')) { state.level = sp.get('daraja'); $$('[data-f-level] button', bar).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.level))); }
  if (sp.get('soha')) { state.field = sp.get('soha'); $$('[data-filter-field]', bar).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filterField === state.field))); }
  if (sp.get('tur')) { state.cat = sp.get('tur'); $$('[data-filter-cat]', bar).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filterCat === state.cat))); }
  if (state.q || state.level || state.field || state.cat) apply();
}

/* ---------------- solishtirish ---------------- */
function initCompare() {
  const tray = $('[data-cmp-tray]');
  const dlg = $('#cmp');
  if (!tray || !dlg) return;
  const list = (boot.programmes || []);
  const byKey = new Map(list.map((p) => [p.key, p]));
  const sel = [];
  const sync = () => {
    $$('[data-compare]').forEach((b) => b.setAttribute('aria-pressed', String(sel.includes(b.dataset.compare))));
    $('[data-cmp-n]', tray).textContent = String(sel.length);
    tray.classList.toggle('is-on', sel.length > 0);
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-compare]');
    if (!b) return;
    e.preventDefault();
    const k = b.dataset.compare;
    const i = sel.indexOf(k);
    if (i >= 0) sel.splice(i, 1);
    else if (sel.length >= 3) { toast(t('ui.compare_max')); return; } else sel.push(k);
    sync();
  });
  $('[data-cmp-clear]', tray)?.addEventListener('click', () => { sel.length = 0; sync(); });
  const money = (n) => (n ? `${Number(n).toLocaleString(boot.lang === 'en' ? 'en-US' : 'ru-RU').replace(/ | /g, ' ')} ${t('ui.sum')}` : '—');
  $('[data-cmp-open]', tray)?.addEventListener('click', () => {
    const body = $('[data-cmp-body]', dlg);
    body.textContent = '';
    const chosen = sel.map((k) => byKey.get(k)).filter(Boolean);
    if (chosen.length < 2) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = t('ui.compare_empty'); body.append(p); dlg.showModal(); return; }
    const forms = [...new Set(chosen.flatMap((p) => p.prices.map((x) => x.form)).filter(Boolean))];
    const rows = [
      [t('ui.level'), (p) => p.level],
      [t('ui.code'), (p) => p.code || '—'],
      [t('ui.field'), (p) => p.field || '—'],
      [t('ui.forms'), (p) => p.forms.join(', ') || '—'],
      ...forms.map((f) => [`${t('ui.price')} · ${f}`, (p) => { const x = p.prices.find((y) => y.form === f); return x ? money(x.amount) : '—'; }, f]),
    ];
    const table = document.createElement('table');
    table.className = 'cmp-table';
    const thead = table.createTHead().insertRow();
    thead.append(document.createElement('th'));
    chosen.forEach((p) => {
      const th = document.createElement('th'); th.scope = 'col';
      const a = document.createElement('a'); a.href = p.url; a.textContent = p.title; th.append(a);
      thead.append(th);
    });
    const tb = table.createTBody();
    rows.forEach(([label, fn, form]) => {
      const tr = tb.insertRow();
      const th = document.createElement('th'); th.scope = 'row'; th.textContent = label; tr.append(th);
      // eng arzon narxni belgilash
      let best = null;
      if (form) {
        const vals = chosen.map((p) => (p.prices.find((y) => y.form === form) || {}).amount).filter(Boolean);
        if (vals.length > 1) best = Math.min(...vals);
      }
      chosen.forEach((p) => {
        const td = tr.insertCell();
        const v = fn(p);
        const b = document.createElement(form ? 'b' : 'span');
        b.textContent = v;
        if (best && (p.prices.find((y) => y.form === form) || {}).amount === best) b.className = 'best';
        td.append(b);
      });
    });
    body.append(table);
    dlg.showModal();
  });
  $('[data-cmp-close]', dlg)?.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  sync();
}

/* ---------------- yo'nalish tanlash testi ---------------- */
function initQuiz() {
  const dlg = $('#quiz');
  const body = dlg && $('[data-quiz-body]', dlg);
  const programmes = boot.quiz || [];
  if (!dlg || !body || !programmes.length) {
    $$('[data-quiz-open]').forEach((b) => { if (!dlg) b.hidden = true; });
    return;
  }
  const Q = [
    { q: 'quiz.q1', key: 'topic', opts: [['tech', 'cpu'], ['business', 'chart'], ['language', 'language'], ['people', 'heart'], ['society', 'landmark'], ['travel', 'plane']] },
    { q: 'quiz.q2', key: 'style', opts: [['analyse', 'chart'], ['create', 'lightbulb'], ['help', 'users'], ['communicate', 'chat']] },
    { q: 'quiz.q3', key: 'mode', opts: [['day', 'building'], ['remote', 'globe'], ['any', 'check']] },
  ];
  const STYLE = { analyse: ['tech', 'business'], create: ['tech', 'travel'], help: ['people'], communicate: ['language', 'travel', 'society'] };
  let step = 0; const ans = {};
  const L = (k) => t(k);
  const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="/img/icons.svg#${name}"/></svg>`;
  const render = () => {
    body.textContent = '';
    if (step < Q.length) {
      const q = Q[step];
      const steps = document.createElement('div'); steps.className = 'quiz-steps'; steps.setAttribute('aria-hidden', 'true');
      Q.forEach((_, i) => { const s = document.createElement('i'); if (i <= step) s.className = 'on'; steps.append(s); });
      const small = document.createElement('p'); small.className = 'src'; small.textContent = (boot.strings && boot.strings['quiz.step']) ? t('quiz.step', { i: step + 1, n: Q.length }) : `${step + 1} / ${Q.length}`;
      const h = document.createElement('h3'); h.className = 'quiz-q'; h.textContent = quizText(q.q);
      const opts = document.createElement('div'); opts.className = 'quiz-opts';
      q.opts.forEach(([v, ic]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'quiz-opt';
        b.innerHTML = icon(ic) + '<span></span>';
        b.querySelector('span').textContent = quizText('quiz.o.' + v);
        b.addEventListener('click', () => { ans[q.key] = v; step++; render(); });
        opts.append(b);
      });
      body.append(steps, small, h, opts);
      requestAnimationFrame(() => opts.querySelector('button')?.focus());
      return;
    }
    // natija
    const want = new Set([ans.topic, ...(STYLE[ans.style] || [])]);
    const scored = programmes.map((p) => {
      let s = 0;
      if (p.tags.includes(ans.topic)) s += 3;
      for (const w of want) if (p.tags.includes(w)) s += 1;
      if (ans.mode === 'remote') s += p.tags.includes('remote') ? 2 : -3;
      return { p, s };
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4);
    const h = document.createElement('h3'); h.className = 'quiz-q'; h.textContent = L('quiz.result_title');
    body.append(h);
    if (!scored.length) {
      const p = document.createElement('p'); p.className = 'muted'; p.textContent = L('quiz.result_empty'); body.append(p);
    } else {
      const res = document.createElement('div'); res.className = 'quiz-res';
      const max = scored[0].s;
      scored.forEach(({ p, s }) => {
        const a = document.createElement('a'); a.href = p.url;
        a.innerHTML = '<span><b></b><small></small></span><span class="score"></span>';
        a.querySelector('b').textContent = p.title;
        a.querySelector('small').textContent = [p.forms.join(', '), p.price ? `${Number(p.price).toLocaleString('ru-RU').replace(/ | /g, ' ')} ${t('ui.sum')}` : ''].filter(Boolean).join(' · ');
        a.querySelector('.score').textContent = Math.round((s / max) * 100) + '%';
        res.append(a);
      });
      body.append(res);
    }
    const again = document.createElement('button'); again.type = 'button'; again.className = 'btn btn-ghost btn-sm'; again.textContent = L('quiz.restart');
    again.addEventListener('click', () => { step = 0; render(); });
    const all = document.createElement('a'); all.className = 'btn btn-accent btn-sm'; all.href = `${boot.prefix || ''}/yonalishlar`; all.textContent = t('ui.see_programme').replace(/^./, (c) => c);
    const row = document.createElement('div'); row.className = 'sec-foot'; row.style.marginTop = '0'; row.append(again);
    body.append(row);
  };
  const open = () => { step = 0; render(); dlg.showModal(); };
  $$('[data-quiz-open]').forEach((b) => b.addEventListener('click', open));
  $('[data-quiz-close]', dlg)?.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  if (new URLSearchParams(location.search).get('test')) setTimeout(open, calm() ? 0 : 400);
}
/* Test matnlari boot.strings da bo'lmasligi mumkin — shuning uchun alohida lug'at */
const QUIZ = {
  uz: { 'quiz.q1': 'Sizni ko‘proq nima qiziqtiradi?', 'quiz.q2': 'Qanday ishlashni yoqtirasiz?', 'quiz.q3': 'Qaysi ta’lim shakli qulay?', 'quiz.o.tech': 'Texnologiya va dasturlash', 'quiz.o.business': 'Iqtisod, moliya va biznes', 'quiz.o.language': 'Tillar va adabiyot', 'quiz.o.people': 'Bolalar va odamlar bilan ishlash', 'quiz.o.society': 'Tarix va jamiyat', 'quiz.o.travel': 'Sayohat va mehmondo‘stlik', 'quiz.o.analyse': 'Tahlil qilish, raqamlar bilan', 'quiz.o.create': 'Yaratish va loyihalash', 'quiz.o.help': 'Odamlarga yordam berish, o‘rgatish', 'quiz.o.communicate': 'Muloqot va jamoada ishlash', 'quiz.o.day': 'Kunduzgi — auditoriyada', 'quiz.o.remote': 'Masofaviy — ishlab turib', 'quiz.o.any': 'Farqi yo‘q' },
  ru: { 'quiz.q1': 'Что вас больше интересует?', 'quiz.q2': 'Как вам нравится работать?', 'quiz.q3': 'Какая форма обучения удобнее?', 'quiz.o.tech': 'Технологии и программирование', 'quiz.o.business': 'Экономика, финансы и бизнес', 'quiz.o.language': 'Языки и литература', 'quiz.o.people': 'Работа с детьми и людьми', 'quiz.o.society': 'История и общество', 'quiz.o.travel': 'Путешествия и гостеприимство', 'quiz.o.analyse': 'Анализировать, работать с цифрами', 'quiz.o.create': 'Создавать и проектировать', 'quiz.o.help': 'Помогать людям, обучать', 'quiz.o.communicate': 'Общаться и работать в команде', 'quiz.o.day': 'Очная — в аудитории', 'quiz.o.remote': 'Дистанционная — совмещая с работой', 'quiz.o.any': 'Без разницы' },
  en: { 'quiz.q1': 'What interests you most?', 'quiz.q2': 'How do you like to work?', 'quiz.q3': 'Which study mode suits you?', 'quiz.o.tech': 'Technology and coding', 'quiz.o.business': 'Economics, finance and business', 'quiz.o.language': 'Languages and literature', 'quiz.o.people': 'Working with children and people', 'quiz.o.society': 'History and society', 'quiz.o.travel': 'Travel and hospitality', 'quiz.o.analyse': 'Analysing things, working with numbers', 'quiz.o.create': 'Building and designing', 'quiz.o.help': 'Helping and teaching people', 'quiz.o.communicate': 'Communicating and teamwork', 'quiz.o.day': 'Full-time — on campus', 'quiz.o.remote': 'Distance — while working', 'quiz.o.any': 'No preference' },
};
function quizText(k) { const d = QUIZ[boot.lang] || QUIZ.uz; return d[k] || t(k); }

/* ---------------- lightbox ---------------- */
function initLightbox() {
  const dlg = $('#lightbox');
  const items = boot.gallery || [];
  if (!dlg || !items.length) return;
  const stage = $('[data-lb-stage]', dlg);
  const cap = $('[data-lb-cap]', dlg);
  const count = $('[data-lb-count]', dlg);
  let idx = 0;
  const visibleIdx = () => $$('[data-lightbox]').filter((b) => !b.closest('[hidden]')).map((b) => Number(b.dataset.lightbox));
  const yt = (u) => { const m = String(u).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : null; };
  const show = (i) => {
    const order = visibleIdx();
    if (!order.length) return;
    if (!order.includes(i)) i = order[0];
    idx = i;
    const it = items[i];
    $$('img, iframe', stage).forEach((n) => n.remove());
    const id = it.video && yt(it.video);
    if (id) {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true; f.title = it.title;
      stage.prepend(f);
    } else if (it.src) {
      const img = document.createElement('img');
      img.src = it.src; img.alt = it.title; if (it.w) { img.width = it.w; img.height = it.h; }
      stage.prepend(img);
    }
    cap.textContent = '';
    const b = document.createElement('b'); b.textContent = it.title; cap.append(b);
    if (it.text) { const p = document.createElement('p'); p.textContent = it.text; cap.append(p); }
    const pos = order.indexOf(i) + 1;
    count.textContent = t('ui.photo_of', { i: pos, n: order.length });
  };
  const step = (d) => { const order = visibleIdx(); const p = order.indexOf(idx); show(order[(p + d + order.length) % order.length]); };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lightbox]');
    if (!b) return;
    e.preventDefault();
    show(Number(b.dataset.lightbox));
    dlg.showModal();
  });
  $('[data-lb-prev]', dlg).addEventListener('click', () => step(-1));
  $('[data-lb-next]', dlg).addEventListener('click', () => step(1));
  $('[data-lb-close]', dlg).addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => $$('iframe', stage).forEach((n) => n.remove()));
  dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target === stage) dlg.close(); });
  // surish (swipe)
  let x0 = null;
  stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  stage.addEventListener('pointerup', (e) => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); });
}

initFilters();
initCompare();
initQuiz();
initLightbox();
