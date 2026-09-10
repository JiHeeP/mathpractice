/* schoolday.js — 등교일 판단
 *
 * 등교일 = 월~금 이면서 공휴일이 아니고, 반에서 따로 정한 '등교 안 하는 날'도 아닌 날.
 *
 *  - 날짜가 고정된 공휴일(신정·3·1절·어린이날·현충일·광복절·개천절·한글날·성탄절)은 내장.
 *    3·1절·어린이날·광복절·개천절·한글날·성탄절이 토·일과 겹치면 대체공휴일(다음 평일)도 자동 계산.
 *  - 설·추석·부처님오신날처럼 해마다 바뀌는 날, 선거일, 재량휴업일, 방학은
 *    반 설정의 '등교 안 하는 날'(offDays)에 적어 두면 된다.
 *
 * 날짜는 모두 'YYYY-MM-DD' 문자열(dateKey)로 다룬다.
 */
const SchoolDay = (() => {
const ONE_DAY = 86400000;

/* 날짜가 고정된 공휴일 — [월-일, 대체공휴일 적용 여부] */
const FIXED_HOLIDAYS = [
  ['01-01', false],   // 신정 (대체공휴일 없음)
  ['03-01', true],    // 3·1절
  ['05-05', true],    // 어린이날
  ['06-06', false],   // 현충일 (대체공휴일 없음)
  ['08-15', true],    // 광복절
  ['10-03', true],    // 개천절
  ['10-09', true],    // 한글날
  ['12-25', true]     // 성탄절
];

function pad(n) { return String(n).padStart(2, '0'); }
function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fromKey(key) {
  const p = String(key || '').split('-').map(Number);
  if (p.length !== 3 || p.some(isNaN)) return null;
  const d = new Date(p[0], p[1] - 1, p[2]);
  return isNaN(d.getTime()) ? null : d;
}
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function isWeekend(d) { const w = d.getDay(); return w === 0 || w === 6; }

/* 연도별 공휴일(대체공휴일 포함) 집합 — 연도마다 한 번만 계산 */
const holidayCache = {};
function holidaysOf(year) {
  if (holidayCache[year]) return holidayCache[year];
  const set = new Set();
  FIXED_HOLIDAYS.forEach(([md]) => set.add(`${year}-${md}`));
  FIXED_HOLIDAYS.forEach(([md, substitute]) => {
    if (!substitute) return;
    const d = fromKey(`${year}-${md}`);
    if (!isWeekend(d)) return;
    let s = addDays(d, 1);
    while (isWeekend(s) || set.has(toKey(s))) s = addDays(s, 1);
    set.add(toKey(s));
  });
  holidayCache[year] = set;
  return set;
}
function isPublicHoliday(d) { return holidaysOf(d.getFullYear()).has(toKey(d)); }

/* 반 설정의 '등교 안 하는 날' 정리 — 배열이든 텍스트든 받아서 dateKey 집합으로 */
function normalizeOffDays(src) {
  const lines = Array.isArray(src) ? src : String(src || '').split(/\r?\n|,|;/);
  const out = new Set();
  lines.forEach(raw => {
    const line = String(raw || '').trim();
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^(\d{4})[.\-\/년\s]+(\d{1,2})[.\-\/월\s]+(\d{1,2})/);
    if (!m) return;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (isNaN(d.getTime()) || d.getMonth() !== +m[2] - 1) return;
    out.add(toKey(d));
  });
  return Array.from(out).sort();
}

/** 등교일인가? offDays 는 dateKey 배열 */
function isSchoolDay(dateOrKey, offDays) {
  const d = dateOrKey instanceof Date ? dateOrKey : fromKey(dateOrKey);
  if (!d) return false;
  if (isWeekend(d) || isPublicHoliday(d)) return false;
  const off = offDays instanceof Set ? offDays : new Set(offDays || []);
  return !off.has(toKey(d));
}

/** dateOrKey 보다 앞선 가장 가까운 등교일 (당일 제외). 없으면 null */
function prevSchoolDay(dateOrKey, offDays) {
  let d = dateOrKey instanceof Date ? dateOrKey : fromKey(dateOrKey);
  if (!d) return null;
  const off = new Set(offDays || []);
  for (let i = 0; i < 120; i++) {
    d = addDays(d, -1);
    if (isSchoolDay(d, off)) return toKey(d);
  }
  return null;
}

/** dateOrKey 당일을 포함해 가장 가까운 등교일. 없으면 null */
function nextSchoolDay(dateOrKey, offDays) {
  let d = dateOrKey instanceof Date ? dateOrKey : fromKey(dateOrKey);
  if (!d) return null;
  const off = new Set(offDays || []);
  for (let i = 0; i < 120; i++) {
    if (isSchoolDay(d, off)) return toKey(d);
    d = addDays(d, 1);
  }
  return null;
}

/** 등교하지 않는 이유 — '주말' | '공휴일' | '등교 안 하는 날' | '' (등교일) */
function whyOff(dateOrKey, offDays) {
  const d = dateOrKey instanceof Date ? dateOrKey : fromKey(dateOrKey);
  if (!d) return '';
  if (isWeekend(d)) return '주말';
  if (isPublicHoliday(d)) return '공휴일';
  if (new Set(offDays || []).has(toKey(d))) return '등교 안 하는 날';
  return '';
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
/** '9/5 (금)' 형태 */
function label(key) {
  const d = fromKey(key);
  return d ? `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAY_KO[d.getDay()]})` : '—';
}

return { FIXED_HOLIDAYS, ONE_DAY, toKey, fromKey, addDays, holidaysOf, isPublicHoliday,
  normalizeOffDays, isSchoolDay, prevSchoolDay, nextSchoolDay, whyOff, label };
})();
if (typeof module !== 'undefined') module.exports = SchoolDay;
