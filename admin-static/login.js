'use strict';
(() => {
  const form = document.getElementById('loginForm');
  const messageEl = document.getElementById('loginMessage');
  const btn = document.getElementById('loginBtn');

  function setMessage(text, type = '') {
    messageEl.textContent = text;
    messageEl.className = `form-message ${type}`.trim();
  }
  function getCookie(name) {
    const m = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return m ? decodeURIComponent(m.pop()) : '';
  }

  // Sessiya bormi (CSRF cookie ham shu yerda o'rnatiladi)
  fetch('/api/admin/session', { credentials: 'same-origin' })
    .then((r) => r.json())
    .then((d) => { if (d.authenticated) window.location.href = '/admin'; })
    .catch(() => {});

  const pw = document.getElementById('password');
  const toggle = document.getElementById('pwToggle');
  toggle.addEventListener('click', () => {
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Parolni yashirish' : 'Parolni ko‘rsatish');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('');
    btn.disabled = true;
    btn.textContent = 'Tekshirilmoqda…';
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCookie('ku_csrf') },
        body: JSON.stringify({ email: document.getElementById('email').value.trim(), password: pw.value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Kirib bo‘lmadi');
      setMessage('Muvaffaqiyatli! Panel ochilmoqda…', 'success');
      window.location.href = '/admin';
    } catch (error) {
      setMessage(error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Kirish';
    }
  });
})();
