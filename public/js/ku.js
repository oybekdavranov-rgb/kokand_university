/* =====================================================================
   Kokand University — asosiy skript (barcha sahifalar)
   Ko'rinish sozlamalari · sarlavha · menyu · ⌘K qidiruv · paydo bo'lish
   animatsiyalari · hisoblagichlar · yordamchi · PWA
   Bog'liqliksiz (vanilla ES2022). Animatsiyalar "tinch" rejimda o'chadi.
   ===================================================================== */
const root = document.documentElement;
const bootEl = document.getElementById('ku-boot');
export const boot = (() => { try { return JSON.parse(bootEl ? bootEl.textContent : '{}'); } catch { return {}; } })();
const S = boot.strings || {};
export const lang = boot.lang || root.lang || 'uz';
export const prefix = boot.prefix || '';
export function t(key, vars) {
  let s = S[key] != null ? S[key] : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  return s;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
export const calm = () => root.classList.contains('calm') || mqReduce.matches;
export const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* maxfiy rejim */ } },
};

/* ---------------- toast ---------------- */
let toastTimer = 0;
export function toast(msg) {
  const el = $('[data-toast]');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------------- ko'rinish sozlamalari ---------------- */
const prefs = {
  theme: () => store.get('ku-theme') || 'auto',
  contrast: () => (root.dataset.contrast === 'high' ? 'high' : 'normal'),
  motion: () => (root.classList.contains('calm') ? 'calm' : 'full'),
};
function applyTheme(v) {
  if (v === 'light' || v === 'dark') { root.dataset.theme = v; store.set('ku-theme', v); } else { delete root.dataset.theme; store.set('ku-theme', null); }
  document.dispatchEvent(new CustomEvent('ku:theme'));
}
function syncPrefsUI() {
  $$('[data-pref]').forEach((g) => {
    const cur = prefs[g.dataset.pref]();
    $$('button[data-v]', g).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === cur)));
  });
  const fs = parseFloat(getComputedStyle(root).getPropertyValue('--fs')) || 1;
  $$('[data-fs-out]').forEach((o) => { o.textContent = Math.round(fs * 100) + '%'; });
}
function initPrefs() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pref] button[data-v]');
    if (b) {
      const kind = b.closest('[data-pref]').dataset.pref;
      const v = b.dataset.v;
      if (kind === 'theme') applyTheme(v);
      if (kind === 'contrast') { if (v === 'high') root.dataset.contrast = 'high'; else delete root.dataset.contrast; store.set('ku-contrast', v === 'high' ? 'high' : null); }
      if (kind === 'motion') { root.classList.toggle('calm', v === 'calm'); store.set('ku-motion', v === 'calm' ? 'calm' : null); document.dispatchEvent(new CustomEvent('ku:motion')); }
      syncPrefsUI();
      return;
    }
    const f = e.target.closest('[data-fs]');
    if (f) {
      const cur = parseFloat(getComputedStyle(root).getPropertyValue('--fs')) || 1;
      const next = Math.min(1.4, Math.max(0.85, Math.round((cur + Number(f.dataset.fs) * 0.1) * 100) / 100));
      root.style.setProperty('--fs', next);
      store.set('ku-fs', next === 1 ? null : String(next));
      syncPrefsUI();
    }
  });
  syncPrefsUI();
}

/* ---------------- sarlavha (header) ---------------- */
function initHeader() {
  const head = $('[data-head]');
  if (!head) return;
  let lastY = scrollY;
  let ticking = false;
  const solidAt = root.dataset.page === 'home' ? 40 : 8;
  const update = () => {
    ticking = false;
    const y = scrollY;
    head.classList.toggle('is-solid', y > solidAt);
    const anyOpen = $('.sub.is-open') || document.activeElement?.closest?.('[data-head]');
    if (y > 420 && y > lastY + 6 && !anyOpen) head.classList.add('is-hidden');
    else if (y < lastY - 6 || y < 420) head.classList.remove('is-hidden');
    lastY = y;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();

  // Joriy sahifa (aria-current)
  const path = location.pathname.replace(/^\/(ru|en)(?=\/|$)/, '') || '/';
  $$('[data-nav]').forEach((a) => { if (path === a.dataset.nav || path.startsWith(a.dataset.nav + '/')) a.setAttribute('aria-current', 'page'); });
  $$('.nav-link[href]').forEach((a) => {
    const href = (a.getAttribute('href') || '').replace(/^\/(ru|en)(?=\/|$)/, '');
    if (href && href !== '/' && !href.includes('#') && (path === href || path.startsWith(href + '/'))) a.setAttribute('aria-current', 'page');
  });
  $$('.has-sub').forEach((li) => { if ($('[aria-current="page"]', li)) $('.nav-link', li)?.setAttribute('aria-current', 'page'); });

  // Ochiluvchi menyular
  const closeAll = (except) => $$('[data-sub]').forEach((b) => {
    if (b === except) return;
    b.setAttribute('aria-expanded', 'false');
    document.getElementById(b.getAttribute('aria-controls'))?.classList.remove('is-open');
  });
  $$('[data-sub]').forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    const open = (v) => { btn.setAttribute('aria-expanded', String(v)); panel?.classList.toggle('is-open', v); };
    btn.addEventListener('click', () => { const v = btn.getAttribute('aria-expanded') !== 'true'; closeAll(btn); open(v); });
    const li = btn.closest('.has-sub');
    let timer = 0;
    if (finePointer.matches) {
      li.addEventListener('pointerenter', () => { clearTimeout(timer); closeAll(btn); open(true); });
      li.addEventListener('pointerleave', () => { timer = setTimeout(() => open(false), 220); });
    }
    li.addEventListener('focusout', (e) => { if (!li.contains(e.relatedTarget)) open(false); });
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.has-sub')) closeAll(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const open = $('[data-sub][aria-expanded="true"]'); closeAll(); open?.focus(); } });
}

/* ---------------- mobil menyu ---------------- */
function initDrawer() {
  const dlg = $('#drawer');
  if (!dlg || !dlg.showModal) return;
  $$('[data-drawer-open]').forEach((b) => b.addEventListener('click', () => { dlg.showModal(); b.setAttribute('aria-expanded', 'true'); }));
  dlg.addEventListener('close', () => $$('[data-drawer-open]').forEach((b) => b.setAttribute('aria-expanded', 'false')));
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-drawer-close]')) dlg.close();
    else if (e.target.closest('a[href]')) setTimeout(() => dlg.close(), 60);
  });
}

/* ---------------- ⌘K qidiruv ---------------- */
function initPalette() {
  const dlg = $('#palette');
  if (!dlg || !dlg.showModal) return;
  const input = $('[data-pal-input]', dlg);
  const list = $('[data-pal-results]', dlg);
  let items = [];
  let sel = 0;
  let ctrl = null;
  let timer = 0;
  const GROUP = { page: 'grp.page', programme: 'grp.programme', news: 'grp.news', story: 'grp.story', service: 'grp.service', contact: 'grp.contact' };
  const render = (results) => {
    items = results;
    sel = 0;
    list.textContent = '';
    if (!results.length) {
      const p = document.createElement('p'); p.className = 'pal-empty'; p.textContent = t('ui.no_results'); list.append(p); return;
    }
    let lastGroup = '';
    results.forEach((r, i) => {
      if (r.group !== lastGroup) {
        const g = document.createElement('div'); g.className = 'pal-group'; g.textContent = t(GROUP[r.group] || 'ui.results'); list.append(g); lastGroup = r.group;
      }
      const a = document.createElement('a');
      a.className = 'pal-item'; a.href = r.url; a.id = 'pal-' + i;
      a.setAttribute('role', 'option');
      if (r.external) { a.target = '_blank'; a.rel = 'noopener'; }
      a.innerHTML = `<svg class="ic" aria-hidden="true"><use href="/img/icons.svg#${encodeURIComponent(r.icon || 'arrow-right')}"/></svg><span><b></b><small></small></span>`;
      a.querySelector('b').textContent = r.title;
      a.querySelector('small').textContent = r.desc || '';
      a.addEventListener('pointermove', () => mark(i));
      list.append(a);
    });
    mark(0);
  };
  const mark = (i) => {
    sel = Math.max(0, Math.min(items.length - 1, i));
    $$('.pal-item', list).forEach((el, j) => el.setAttribute('aria-selected', String(j === sel)));
    const cur = $('#pal-' + sel, list);
    if (cur) { cur.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', cur.id); }
  };
  const query = (q) => {
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    fetch(`/api/public/search?lang=${encodeURIComponent(lang)}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
      .then((r) => r.json()).then((d) => render(d.results || [])).catch(() => {});
  };
  const open = () => {
    if (dlg.open) return;
    dlg.showModal();
    input.value = '';
    query('');
    requestAnimationFrame(() => input.focus());
  };
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-controls', list.id || (list.id = 'pal-list'));
  input.setAttribute('aria-expanded', 'true');
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => query(input.value), 140); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); mark(sel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mark(sel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); const a = $('#pal-' + sel, list); if (a) a.click(); }
  });
  list.addEventListener('click', (e) => { if (e.target.closest('a')) setTimeout(() => dlg.close(), 30); });
  $$('[data-palette-open]').forEach((b) => b.addEventListener('click', open));
  $('[data-pal-close]', dlg)?.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.addEventListener('keydown', (e) => {
    const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open(); }
    else if (e.key === '/' && !typing && !dlg.open) { e.preventDefault(); open(); }
  });
}

/* ---------------- paydo bo'lish (reveal) ---------------- */
function splitWords(el) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  let i = 0;
  const walk = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(part); continue; }
          const w = document.createElement('span');
          w.className = 'w'; w.style.setProperty('--i', i++); w.textContent = part;
          frag.append(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && !/svg/i.test(child.tagName)) walk(child);
    }
  };
  walk(el);
}
export function initReveal(scope = document) {
  const els = $$('[data-reveal]', scope).filter((el) => !el.classList.contains('in'));
  const words = $$('[data-split]', scope);
  if (calm() || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    words.forEach((el) => el.classList.add('in'));
    return;
  }
  words.forEach(splitWords);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  els.forEach((el) => io.observe(el));
  words.forEach((el) => io.observe(el));
  // Ekrandan tashqarida qolib ketmasin (masalan, print yoki tez aylantirish)
  setTimeout(() => els.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('in'); }), 1200);
}

/* ---------------- hisoblagichlar ---------------- */
function formatLike(sample, n) {
  if (/\d,\d{3}/.test(sample)) return n.toLocaleString('en-US');
  if (/\d[\s ]\d{3}/.test(sample)) return n.toLocaleString('en-US').replace(/,/g, ' ');
  return String(n);
}
function initCounters() {
  const els = $$('[data-count]');
  if (!els.length) return;
  const run = (el) => {
    const raw = el.textContent.trim();
    const target = Number(raw.replace(/[^\d]/g, ''));
    if (!target || calm()) return;
    const dur = Math.min(2200, 900 + target / 20);
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      el.textContent = formatLike(raw, Math.round(target * e));
      if (p < 1) requestAnimationFrame(step); else el.textContent = raw;
    };
    requestAnimationFrame(step);
  };
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: 0.4 });
  els.forEach((el) => io.observe(el));
}

/* ---------------- shisha "rim" yorug'ligi + magnit tugmalar ---------------- */
function initPointerFx() {
  if (!finePointer.matches) return;
  let raf = 0;
  let last = null;
  addEventListener('pointermove', (e) => {
    last = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const el = last.target?.closest?.('.card, .glass[data-rim]');
      if (el) {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--px', `${last.clientX - r.left}px`);
        el.style.setProperty('--py', `${last.clientY - r.top}px`);
      }
    });
  }, { passive: true });
  $$('[data-magnetic]').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      if (calm()) return;
      const r = b.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / r.width;
      const y = (e.clientY - r.top - r.height / 2) / r.height;
      b.style.transform = `translate(${(x * 10).toFixed(1)}px, ${(y * 8 - 2).toFixed(1)}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}

/* ---------------- nusxalash va ulashish ---------------- */
async function copyText(s, okMsg) {
  try { await navigator.clipboard.writeText(s); toast(okMsg || t('ui.copied')); } catch { toast(t('ui.copy_failed')); }
}
function initShare() {
  document.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) { e.preventDefault(); copyText(c.dataset.copy); return; }
    if (e.target.closest('[data-copy-url]')) { e.preventDefault(); copyText(location.href, t('ui.link_copied')); return; }
    if (e.target.closest('[data-share]')) {
      e.preventDefault();
      const data = { title: document.title, url: location.href };
      if (navigator.share) { try { await navigator.share(data); } catch { /* bekor qilindi */ } } else copyText(location.href, t('ui.link_copied'));
      return;
    }
    const href = e.target.closest('[data-href]');
    if (href && !e.target.closest('a,button')) {
      if (href.dataset.hrefTarget === '_blank') window.open(href.dataset.href, '_blank', 'noopener'); else location.href = href.dataset.href;
    }
  });
  $$('[data-share-tg]').forEach((a) => { a.href = `https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(document.title)}`; });
}

/* ---------------- o'qish progressi ---------------- */
function initReadProgress() {
  const bar = $('[data-read-progress]');
  const art = $('[data-progress]');
  if (!bar || !art) return;
  const upd = () => {
    const r = art.getBoundingClientRect();
    const total = r.height - innerHeight * 0.6;
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
    bar.style.setProperty('--rp', p.toFixed(4));
  };
  addEventListener('scroll', upd, { passive: true });
  upd();
}

/* ---------------- KU yordamchisi (chat) ---------------- */
class Chat {
  constructor(el) {
    this.el = el;
    this.log = $('[data-chat-log]', el);
    this.form = $('[data-chat-form]', el);
    this.input = this.form ? $('input', this.form) : null;
    this.busy = false;
    this.greeted = false;
    this.form?.addEventListener('submit', (e) => { e.preventDefault(); this.ask(this.input.value); });
    $('[data-chat-chips]', el)?.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.ask(b.textContent); });
  }
  greet() {
    if (this.greeted) return;
    this.greeted = true;
    this.bot({ blocks: [{ type: 'p', text: t('as.hello') }] }, false);
  }
  push(cls) {
    const m = document.createElement('div');
    m.className = 'msg ' + cls;
    this.log.append(m);
    this.log.scrollTop = this.log.scrollHeight;
    return m;
  }
  me(text) { this.push('me').textContent = text; }
  bot(data) {
    const m = this.push('bot');
    for (const b of data.blocks || []) {
      if (b.type === 'p') { const p = document.createElement('p'); p.textContent = b.text; m.append(p); }
      if (b.type === 'list') {
        const ul = document.createElement('ul');
        for (const it of b.items || []) {
          const li = document.createElement('li');
          if (it.url) {
            const a = document.createElement('a');
            a.href = it.url; a.textContent = it.text;
            if (/^https?:/i.test(it.url) && !it.url.startsWith(location.origin)) { a.target = '_blank'; a.rel = 'noopener'; }
            li.append(a);
          } else li.textContent = it.text;
          ul.append(li);
        }
        m.append(ul);
      }
    }
    if (data.sources && data.sources.length) {
      const s = document.createElement('div');
      s.className = 'srcs';
      s.setAttribute('aria-label', t('as.sources'));
      for (const src of data.sources) {
        const a = document.createElement('a');
        a.href = src.url; a.textContent = '↗ ' + src.label;
        if (/^https?:/i.test(src.url)) { a.target = '_blank'; a.rel = 'noopener'; }
        s.append(a);
      }
      m.append(s);
    }
    const chips = $('[data-chat-chips]', this.el);
    if (chips && data.chips && data.chips.length) {
      chips.textContent = '';
      data.chips.forEach((c) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = c; chips.append(b); });
    }
    this.log.scrollTop = this.log.scrollHeight;
  }
  async ask(q) {
    q = String(q || '').trim();
    if (!q || this.busy) return;
    this.greet();
    this.busy = true;
    this.me(q);
    if (this.input) this.input.value = '';
    const typing = this.push('bot typing');
    typing.innerHTML = '<i></i><i></i><i></i>';
    typing.setAttribute('aria-label', t('as.thinking'));
    try {
      const [res] = await Promise.all([
        fetch('/api/public/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, lang }) }).then((r) => r.json()),
        new Promise((r) => setTimeout(r, calm() ? 0 : 450)),
      ]);
      typing.remove();
      if (!res || !res.ok) throw new Error(res && res.error);
      this.bot(res);
    } catch {
      typing.remove();
      this.bot({ blocks: [{ type: 'p', text: t('as.error') }] });
    } finally { this.busy = false; }
  }
}
function initAssistant() {
  const chats = $$('[data-chat]').map((el) => new Chat(el));
  // Bosh sahifadagi ichki chat ko'rinishga kelganda salomlashadi
  const inline = chats.find((c) => !c.el.closest('dialog'));
  if (inline && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { inline.greet(); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(inline.el);
  }
  const panel = $('#as-panel');
  const panelChat = chats.find((c) => panel && panel.contains(c.el));
  const fab = $('.fab');
  const openPanel = (q) => {
    if (!panel || !panel.show) return;
    if (!panel.open) panel.show();
    panelChat?.greet();
    fab?.classList.add('is-hidden');
    if (q) panelChat?.ask(q); else setTimeout(() => panelChat?.input?.focus(), 50);
  };
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-assistant-open]');
    if (o) {
      // Bosh sahifada ichki chat bor bo'lsa — o'shanga aylantiramiz (tugma hero'da bo'lsa)
      if (inline && o.closest('.hero')) { inline.el.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' }); setTimeout(() => inline.input?.focus({ preventScroll: true }), calm() ? 0 : 700); return; }
      openPanel();
      return;
    }
    const a = e.target.closest('[data-assistant-ask]');
    if (a) { openPanel(a.dataset.assistantAsk); return; }
    if (e.target.closest('[data-assistant-close]')) { panel?.close(); }
  });
  panel?.addEventListener('close', () => fab?.classList.remove('is-hidden'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel?.open) panel.close(); });
  // FAB footer'da va ichki chat ko'ringanda yashirinadi
  if (fab && 'IntersectionObserver' in window) {
    const watch = [$('.site-foot'), inline && inline.el].filter(Boolean);
    const vis = new Set();
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) vis.add(e.target); else vis.delete(e.target); });
      if (!panel?.open) fab.classList.toggle('is-hidden', vis.size > 0);
    }, { threshold: 0.15 });
    watch.forEach((w) => io.observe(w));
  }
}

/* ---------------- PWA: service worker, o'rnatish, oflayn ---------------- */
function initPWA() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
  let deferred = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; root.classList.add('can-install'); });
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-install]') || !deferred) return;
    deferred.prompt();
    const r = await deferred.userChoice.catch(() => null);
    if (r && r.outcome === 'accepted') toast(t('ui.installed'));
    deferred = null; root.classList.remove('can-install');
  });
  addEventListener('offline', () => toast(t('ui.offline')));
  addEventListener('online', () => toast(t('ui.online')));
}

/* Boshqa skriptlar (ku-home.js, ku-pages.js) uchun umumiy yordamchilar.
   Eslatma: ular `import` qilmaydi — versiyalangan URL (?v=) tufayli modul ikki marta yuklanmasin. */
window.KU = { boot, t, $, $$, calm, toast, lang, prefix, initReveal, finePointer };

/* ---------------- ishga tushirish ---------------- */
function init() {
  initPrefs();
  initHeader();
  initDrawer();
  initPalette();
  initReveal();
  initCounters();
  initPointerFx();
  initShare();
  initReadProgress();
  initAssistant();
  initPWA();
  document.addEventListener('ku:motion', () => { if (calm()) $$('[data-reveal]').forEach((el) => el.classList.add('in')); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
