'use strict';
/**
 * URL uchun "slug": lotin/kirill matndan qisqa, xavfsiz manzil qismi.
 *   "Kompyuter injiniringi" -> "kompyuter-injiniringi"
 *   "Moliya va moliyaviy texnologiyalar" -> "moliya-va-moliyaviy-texnologiyalar"
 */
const CYR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h' };

function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/[‘’ʻʼ'`]/g, '')
    .replace(/[а-яёўқғҳ]/g, (c) => (CYR[c] != null ? CYR[c] : c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 70).replace(/-$/, '');
}

module.exports = { slugify };
