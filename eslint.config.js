'use strict';
// ESLint 9 flat config
const browserGlobals = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
  fetch: 'readonly', FormData: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
  localStorage: 'readonly', sessionStorage: 'readonly', alert: 'readonly', confirm: 'readonly',
  getComputedStyle: 'readonly', requestAnimationFrame: 'readonly', matchMedia: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
  console: 'readonly', IntersectionObserver: 'readonly', MutationObserver: 'readonly',
  CustomEvent: 'readonly', Event: 'readonly', HTMLElement: 'readonly',
  history: 'readonly', AbortController: 'readonly', AbortSignal: 'readonly', ResizeObserver: 'readonly',
  performance: 'readonly', Intl: 'readonly', Blob: 'readonly', Image: 'readonly', KeyboardEvent: 'readonly',
  cancelAnimationFrame: 'readonly', requestIdleCallback: 'readonly', caches: 'readonly', self: 'readonly',
  clients: 'readonly', scrollTo: 'readonly', innerWidth: 'readonly', innerHeight: 'readonly', devicePixelRatio: 'readonly',
  prompt: 'readonly', DOMParser: 'readonly', Response: 'readonly', Request: 'readonly', Headers: 'readonly',
  addEventListener: 'readonly', removeEventListener: 'readonly', scrollY: 'readonly', scrollX: 'readonly',
  getSelection: 'readonly', WebGLRenderingContext: 'readonly', SVGElement: 'readonly', Node: 'readonly',
};

module.exports = [
  // Node (server) kodi
  {
    files: ['**/*.js'],
    ignores: ['public/js/**', 'public/**', 'admin-static/**', 'node_modules/**', 'data/**', 'dist-sites/**'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', require: 'readonly', module: 'writable', __dirname: 'readonly', fetch: 'readonly', Request: 'readonly', FormData: 'readonly', Blob: 'readonly', setInterval: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', AbortSignal: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      eqeqeq: ['warn', 'smart'],
      'no-var': 'warn',
    },
  },
  // Brauzer (frontend) kodi — minifikatsiya qilingan vendor fayllari tekshirilmaydi
  {
    files: ['public/**/*.js', 'admin-static/**/*.js'],
    ignores: ['public/js/vendor/**', 'public/i18n.js', 'public/ku-enhance.js', 'public/ku-protect.js', 'public/ku-ux.js', 'public/shaharcha/**'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: browserGlobals,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      eqeqeq: ['warn', 'smart'],
    },
  },
  // Yangi sayt skriptlari — ES modullar (<script type="module">)
  {
    files: ['public/js/ku*.js'],
    languageOptions: { sourceType: 'module' },
  },
];
