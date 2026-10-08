'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { config } = require('./config');
const { escapeHtml } = require('./security/sanitize');

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, chunk) => {
    const [name, ...rest] = chunk.trim().split('=');
    if (!name) return acc;
    acc[name] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.maxAge) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.secure) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  list.push(parts.join('; '));
  res.setHeader('Set-Cookie', list);
}

function clearCookie(res, name) {
  setCookie(res, name, '', { expires: new Date(0) });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function parseJsonBody(req) {
  const buffer = await readBody(req, config.MAX_JSON_BYTES);
  const text = buffer.toString('utf8');
  return text ? JSON.parse(text) : {};
}

async function parseFormData(req) {
  const body = await readBody(req, config.MAX_UPLOAD_BYTES + 1024 * 1024);
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers,
    body,
  });
  return request.formData();
}

function inferMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
    '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

/* Matnli fayllarni siqish (brotli/gzip) — xotirada keshlanadi */
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|manifest\+json|xml)|image\/svg\+xml)/;
const zcache = new Map();
const MAX_ZCACHE_BYTES = 24 * 1024 * 1024;
let zcacheBytes = 0;
function compressed(absPath, mtimeMs, enc) {
  const key = `${enc}|${absPath}|${mtimeMs}`;
  const hit = zcache.get(key);
  if (hit) return hit;
  const raw = fs.readFileSync(absPath);
  const zlib = require('node:zlib');
  const buf = enc === 'br'
    ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 10, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } })
    : zlib.gzipSync(raw, { level: 9 });
  if (zcacheBytes + buf.length > MAX_ZCACHE_BYTES) { zcache.clear(); zcacheBytes = 0; }
  zcache.set(key, buf);
  zcacheBytes += buf.length;
  return buf;
}

/** Kesh siyosati: ?v=xesh bilan — 1 yil; shriftlar/rasmlar — 7 kun; qolganlar — 1 soat. */
function cacheControlFor(absPath, req) {
  const ext = path.extname(absPath).toLowerCase();
  const versioned = req && /[?&]v=[\w-]+/.test(String(req.url || ''));
  if (ext === '.html') return 'no-cache';
  if (versioned) return 'public, max-age=31536000, immutable';
  if (['.woff2', '.woff', '.ttf'].includes(ext)) return 'public, max-age=31536000, immutable';
  if (absPath.startsWith(config.UPLOADS_DIR)) return 'public, max-age=604800';
  if (['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ico', '.mp4', '.webm', '.pdf'].includes(ext)) return 'public, max-age=604800';
  if (ext === '.webmanifest') return 'public, max-age=86400';
  return 'public, max-age=3600';
}

/**
 * Statik fayl: ETag/304, Cache-Control, brotli/gzip, HTTP Range (video).
 * `onNotFound` berilsa — fayl topilmaganda o'sha chaqiriladi (masalan, chiroyli 404 sahifa).
 */
async function serveStaticFile(res, absolutePath, roots, req, onNotFound) {
  const safePath = path.normalize(absolutePath);
  const allowedRoots = roots || [config.PUBLIC_DIR, config.ADMIN_DIR, config.UPLOADS_DIR];
  if (!allowedRoots.some((root) => safePath === root || safePath.startsWith(root + path.sep))) {
    sendJson(res, 403, { ok: false, error: 'Forbidden' });
    return;
  }
  let stat;
  try {
    stat = await fsp.stat(safePath);
    if (!stat.isFile()) throw new Error('not file');
  } catch {
    if (onNotFound) return onNotFound();
    sendJson(res, 404, { ok: false, error: 'Not found' });
    return;
  }
  const type = inferMimeType(safePath);
  const total = stat.size;
  const etag = `W/"${total.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const baseHeaders = {
    'Content-Type': type,
    'Cache-Control': cacheControlFor(safePath, req),
    ETag: etag,
    'Last-Modified': new Date(stat.mtimeMs).toUTCString(),
    'Accept-Ranges': 'bytes',
  };
  if (/^(image|video)\/|font\//.test(type) || type.startsWith('font/')) baseHeaders['Cross-Origin-Resource-Policy'] = 'same-origin';
  const range = req && req.headers ? req.headers.range : null;
  if (!range && req && req.headers && req.headers['if-none-match'] === etag) {
    res.writeHead(304, baseHeaders);
    res.end();
    return;
  }
  // HTTP Range — video/audio seek + oqim (streaming)
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m && (m[1] !== '' || m[2] !== '')) {
    let start = m[1] === '' ? null : parseInt(m[1], 10);
    let end = m[2] === '' ? null : parseInt(m[2], 10);
    if (start === null) { start = Math.max(0, total - (end || 0)); end = total - 1; }
    else if (end === null || end >= total) { end = total - 1; }
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      res.writeHead(416, { 'Content-Range': `bytes */${total}`, 'Accept-Ranges': 'bytes' });
      res.end();
      return;
    }
    res.writeHead(206, { ...baseHeaders, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(safePath, { start, end }).pipe(res);
    return;
  }
  const ae = String((req && req.headers && req.headers['accept-encoding']) || '');
  if (COMPRESSIBLE.test(type) && total > 1024 && total < 8 * 1024 * 1024 && (/\bbr\b/.test(ae) || /\bgzip\b/.test(ae))) {
    const enc = /\bbr\b/.test(ae) ? 'br' : 'gzip';
    try {
      const body = compressed(safePath, stat.mtimeMs, enc);
      res.writeHead(200, { ...baseHeaders, 'Content-Encoding': enc, 'Content-Length': body.length, Vary: 'Accept-Encoding' });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    } catch { /* siqib bo'lmadi — oddiy yuboramiz */ }
  }
  res.writeHead(200, { ...baseHeaders, 'Content-Length': total, Vary: 'Accept-Encoding' });
  if (req && req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(safePath).pipe(res);
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  // CSP: manbalarni cheklaydi (tashqi skript/stil/iframe inyeksiyasini bloklaydi),
  // lekin sahifalardagi inline skript/stil va YouTube (galereya orqa-foni) ishlaydi.
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "img-src 'self' data: blob: https:",             // passiv: rasm skript ishga tushira olmaydi
    "media-src 'self' https: blob:",
    "script-src 'self' 'unsafe-inline'",              // XSS uchun asosiy nazorat — faqat o'z domen + inline
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://use.typekit.net",
    "font-src 'self' data: https://fonts.gstatic.com https://use.typekit.net",
    "connect-src 'self'",                             // tashqi eksfiltratsiyani bloklaydi
    'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '));
  if (config.IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

module.exports = {
  parseCookies, setCookie, clearCookie, sendJson, redirect,
  readBody, parseJsonBody, parseFormData, inferMimeType, serveStaticFile,
  setSecurityHeaders, escapeHtml,
};
