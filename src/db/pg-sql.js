'use strict';
/**
 * Postgres SQL yordamchilari — `pg` modulisiz, sof funksiyalar.
 * Alohida fayl: dev muhitida `pg` o'rnatilmasa ham test qilish mumkin.
 */

/** `?` placeholder'larni Postgres `$1, $2, ...` ko'rinishiga aylantiradi. */
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * `RETURNING id` ni faqat oddiy INSERT'larga qo'shamiz. Upsert (ON CONFLICT)
 * ishlatadigan `settings` (PK: key) va `overrides` (PK: element_id) jadvallarida
 * `id` ustuni YO'Q — ularga RETURNING id qo'shilsa Postgres xato beradi.
 * Bu jadvallarga lastId kerak ham emas.
 */
// `id` ustuni bo'lmagan jadvallar — ularga hech qachon RETURNING id qo'shilmaydi
const NO_ID_TABLES = new Set(['settings', 'overrides']);

function withReturningId(q) {
  const needs = /^\s*insert/i.test(q) && !/returning/i.test(q) && !/on\s+conflict/i.test(q);
  if (!needs) return q;
  const m = q.match(/^\s*insert\s+into\s+"?(\w+)"?/i);
  if (m && NO_ID_TABLES.has(m[1].toLowerCase())) return q;
  return q + ' RETURNING id';
}

module.exports = { toPg, withReturningId };
