/* =====================================================================
   Kokand University — bosh sahifa sahnalari
   WebGL "Rishton sirlari" fon · medalyon · nuqtali diagramma ·
   yopishqoq "Nega KU" · gorizontal startaplar · xarita yoylari · marquee
   ===================================================================== */
const { $, $$, calm, finePointer } = window.KU;
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------------- WebGL sir (glaze) foni ---------------- */
function initGlaze() {
  const canvas = $('[data-glaze]');
  const hero = canvas && canvas.closest('.hero');
  if (!canvas || !hero) return;
  if (document.documentElement.dataset.contrast === 'high') return;
  let gl = null; const uni = {}; let ok = false; let q = 2.5; let staticMode = false;
  let last = 0; let slow = 0; let frames = 0; let raf = 0; let visible = true;
  let mx = 0.7; let my = 0.6; let tx = mx; let ty = my;
  const hexRGB = (h) => { h = (h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const size = () => {
    if (!ok) return;
    const r = hero.getBoundingClientRect();
    const w = Math.max(2, Math.ceil(r.width / q)); const h = Math.max(2, Math.ceil(r.height / q));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h); gl.uniform2f(uni.r, w, h);
  };
  const colors = () => {
    if (!ok) return;
    gl.uniform3fv(uni.bg, hexRGB(css('--gl-bg'))); gl.uniform3fv(uni.c1, hexRGB(css('--gl-1')));
    gl.uniform3fv(uni.c2, hexRGB(css('--gl-2'))); gl.uniform3fv(uni.c3, hexRGB(css('--gl-3')));
    gl.uniform1f(uni.k, parseFloat(css('--gl-k')) || 1);
    draw(performance.now());
  };
  const draw = (now) => { if (!ok) return; gl.uniform1f(uni.t, (staticMode || calm()) ? 14.0 : now / 1000); gl.uniform2f(uni.m, mx, my); gl.drawArrays(gl.TRIANGLES, 0, 3); };
  try {
    gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
    const fs = [
      'precision mediump float;',
      'uniform vec2 r;uniform float t;uniform float k;uniform vec3 bg;uniform vec3 c1;uniform vec3 c2;uniform vec3 c3;uniform vec2 m;',
      'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float n(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1.0,0.0)),u.x),mix(h(i+vec2(0.0,1.0)),h(i+vec2(1.0,1.0)),u.x),u.y);}',
      'float fb(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=0.5;}return v;}',
      'void main(){',
      ' vec2 uv=gl_FragCoord.xy/r; vec2 p=uv*vec2(r.x/r.y,1.0); float tt=t*0.045;',
      ' vec2 q=vec2(fb(p*1.4+vec2(tt,-tt*0.6)),fb(p*1.4+vec2(-tt*0.7,tt)+vec2(5.2,1.3)));',
      ' vec2 w=vec2(fb(p*1.2+2.4*q),fb(p*1.2+2.0*q+vec2(3.1,0.0)));',
      ' float f=fb(p*1.1+2.2*w);',
      ' vec3 col=bg;',
      ' col=mix(col,c2,smoothstep(0.36,0.92,f)*0.62*k);',
      ' col=mix(col,c1,smoothstep(0.5,0.95,w.x*f*1.35)*0.55*k);',
      ' col=mix(col,c3,smoothstep(0.6,1.0,q.y*w.y*1.6)*0.3*k);',
      ' float g=exp(-5.0*length(p-m*vec2(r.x/r.y,1.0)));',
      ' col=mix(col,c1,g*0.18*k);',
      ' float vg=smoothstep(1.2,0.2,length((uv-0.5)*vec2(1.25,1.0)));',
      ' col=mix(bg,col,0.45+0.55*vg);',
      ' gl_FragColor=vec4(col,1.0);',
      '}',
    ].join('\n');
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['r', 't', 'k', 'bg', 'c1', 'c2', 'c3', 'm'].forEach((k) => { uni[k] = gl.getUniformLocation(prog, k); });
    ok = true; size(); colors();
    canvas.classList.add('is-on');
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ok = false; canvas.classList.remove('is-on'); });
  } catch { ok = false; return; }

  const glint = $('[data-glint]');
  let gx = innerWidth * 0.7; let gy = innerHeight * 0.3; let lastMove = -1e9; const t0 = performance.now();
  const loop = (now) => {
    raf = 0;
    if (document.hidden || !visible) return;
    if (calm()) { draw(now); return; }
    if (now - lastMove > 3500) {
      const s = (now - t0) / 1000;
      tx = 0.5 + 0.35 * Math.sin(s * 0.11); ty = 0.5 + 0.3 * Math.sin(s * 0.17 + 1.3);
    }
    mx += (tx - mx) * 0.045; my += (ty - my) * 0.045;
    if (glint) { gx = mx * innerWidth; gy = (1 - my) * innerHeight; glint.style.setProperty('--gx', gx.toFixed(1) + 'px'); glint.style.setProperty('--gy', gy.toFixed(1) + 'px'); }
    if (!staticMode && now - last >= 33) {
      const dt = now - last; last = now;
      draw(now);
      frames++;
      if (dt > 55 && frames > 30) slow++;
      if (frames % 90 === 0) { if (slow > 30) { if (q < 5.5) { q += 1.5; size(); } else { staticMode = true; draw(now); } } slow = 0; }
    }
    raf = requestAnimationFrame(loop);
  };
  const start = () => { if (!raf) raf = requestAnimationFrame(loop); };
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) start(); }, { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  document.addEventListener('ku:theme', () => requestAnimationFrame(colors));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => requestAnimationFrame(colors));
  document.addEventListener('ku:motion', () => { draw(performance.now()); start(); });
  addEventListener('resize', () => { size(); draw(performance.now()); }, { passive: true });
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width; ty = 1 - (e.clientY - r.top) / r.height; lastMove = performance.now();
  }, { passive: true });
  start();
}

/* ---------------- medalyon (3D og'ish) ---------------- */
function initMedal() {
  const disc = $('[data-tilt]');
  if (!disc || !finePointer.matches) return;
  const hero = disc.closest('.hero');
  hero.addEventListener('pointermove', (e) => {
    if (calm()) return;
    const r = disc.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / innerWidth;
    const y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
    disc.style.setProperty('--ry', (x * 18).toFixed(2) + 'deg');
    disc.style.setProperty('--rx', (-y * 18).toFixed(2) + 'deg');
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { disc.style.setProperty('--rx', '0deg'); disc.style.setProperty('--ry', '0deg'); });
}

/* ---------------- yuguruvchi qator ---------------- */
function initMarquee() {
  const track = $('[data-marquee]');
  if (!track || track.dataset.cloned) return;
  track.dataset.cloned = '1';
  const items = Array.from(track.children).filter((el) => !el.hidden);
  items.forEach((el) => { const c = el.cloneNode(true); c.removeAttribute('data-cms-id'); track.append(c); });
}

/* ---------------- nuqtali diagramma (waffle) ---------------- */
function initWaffle() {
  const canvas = $('[data-waffle]');
  if (!canvas) return;
  const num = (sel) => Number(($(sel)?.textContent || '').replace(/[^\d]/g, '')) || 0;
  const students = num('[data-stat="students"]'); const alumni = num('[data-stat="alumni"]'); const staff = num('[data-stat="staff"]');
  const per = 25;
  const a = Math.round(students / per); const b = Math.round(alumni / per); const c = Math.max(1, Math.round(staff / per));
  const total = a + b + c;
  let progress = calm() ? 1 : 0;
  const draw = () => {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth || 600;
    const cols = 40; const rows = Math.ceil(total / cols);
    const cell = w / cols; const h = rows * cell;
    canvas.style.aspectRatio = `${cols} / ${rows}`;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const colA = css('--accent'); const colB = css('--accent-2'); const colC = css('--gold'); const colE = css('--line');
    const shown = Math.round(total * progress);
    for (let i = 0; i < total; i++) {
      const x = (i % cols) * cell + cell / 2; const y = Math.floor(i / cols) * cell + cell / 2;
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = i >= shown ? colE : (i < a ? colA : i < a + b ? colB : colC);
      ctx.fill();
    }
  };
  draw();
  if (!calm() && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now) => { progress = Math.min(1, (now - t0) / 1600); draw(); if (progress < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, { threshold: 0.3 });
    io.observe(canvas);
  } else { progress = 1; draw(); }
  let rz = 0;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(draw, 150); });
  document.addEventListener('ku:theme', () => requestAnimationFrame(draw));
}

/* ---------------- "Nega KU" — yopishqoq progress ---------------- */
function initWhy() {
  const list = $('[data-why]');
  const prog = $('[data-why-progress]');
  if (!list) return;
  const cards = $$('.dist-card', list);
  if (prog) {
    cards.forEach((c, i) => {
      const li = document.createElement('li');
      li.textContent = $('.dist-title', c)?.textContent || String(i + 1);
      prog.append(li);
    });
  }
  const marks = prog ? $$('li', prog) : [];
  if (!('IntersectionObserver' in window)) { cards.forEach((c) => c.classList.add('is-on')); return; }
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      const i = cards.indexOf(e.target);
      if (e.isIntersecting) { e.target.classList.add('is-on'); marks.forEach((m, j) => m.classList.toggle('is-on', j === i)); }
      else e.target.classList.remove('is-on');
    });
  }, { rootMargin: '-35% 0px -35% 0px' });
  cards.forEach((c) => io.observe(c));
}

/* ---------------- gorizontal startaplar ---------------- */
function initHScroll() {
  const sec = $('[data-hscroll]');
  const track = sec && $('[data-hs-track]', sec);
  if (!sec || !track) return;
  const mq = matchMedia('(min-width: 900px)');
  let dist = 0; let raf = 0;
  const measure = () => {
    const pin = mq.matches && !calm() && track.children.length > 2;
    sec.toggleAttribute('data-pin', pin);
    if (!pin) { sec.style.removeProperty('--hs-dist'); track.style.removeProperty('--tx'); return; }
    dist = Math.max(0, track.scrollWidth - innerWidth);
    sec.style.setProperty('--hs-dist', dist + 'px');
    update();
  };
  const update = () => {
    raf = 0;
    if (!sec.hasAttribute('data-pin')) return;
    const r = sec.getBoundingClientRect();
    const total = r.height - innerHeight;
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
    track.style.setProperty('--tx', (p * dist).toFixed(1) + 'px');
    sec.style.setProperty('--p', p.toFixed(4));
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  addEventListener('resize', measure, { passive: true });
  mq.addEventListener('change', measure);
  document.addEventListener('ku:motion', measure);
  measure();
  // Rasm/shrift yuklangach o'lchamni qayta hisoblaymiz
  addEventListener('load', measure);
  // Klaviatura bilan: fokus kartaga o'tsa, sahifa shu joyga aylanadi
  track.addEventListener('focusin', (e) => {
    if (!sec.hasAttribute('data-pin')) return;
    const card = e.target.closest('.card');
    if (!card) return;
    const idx = Array.from(track.children).indexOf(card);
    const p = Math.min(1, idx / Math.max(1, track.children.length - 1));
    const top = sec.getBoundingClientRect().top + scrollY + p * (sec.offsetHeight - innerHeight);
    scrollTo({ top, behavior: 'auto' });
  });
}

/* ---------------- xarita yoylari ---------------- */
function initMap() {
  const map = $('[data-map]');
  if (!map) return;
  if (calm() || !('IntersectionObserver' in window)) { map.classList.add('is-on'); return; }
  const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { map.classList.add('is-on'); io.disconnect(); } }, { threshold: 0.35 });
  io.observe(map);
}

initGlaze();
initMedal();
initMarquee();
initWaffle();
initWhy();
initHScroll();
initMap();
