/* game.js — 반 보스 (반 전체가 함께 깎는 협동 보스) · 계산만 담는다. 저장·읽기는 db.js
 *
 * 규칙 (선생님 결정 2026-11-19~20)
 *   - 레벨을 '처음' 통과하면 보스에게 1 (기초 B·분수 L·소수·넓이 모두 같다. 이미 통과한 레벨은 0)
 *   - 잔타격: 그날 도전에서 맞힌 문제를 모두 더해 10개가 되는 순간 0.3 (하루 한 번)
 *   - 1단계 보스 체력 = 학생 수 × 2 (game.base). 쓰러지면 다음 단계, 체력 = base × 단계 계수
 *   - 보스는 주마다 초기화하지 않는다. '새로 시작'은 시작 시각(startTs)을 바꾸는 것 — 그 뒤 기록만 센다
 *
 * 데미지는 따로 적어 두지 않고 학생 자기 기록(results)에서 그때그때 다시 계산한다.
 *   → 저장이 늦거나 기기를 바꿔도 값이 같다. 반 합계는 번호별 요약(classes/{code}/wallet/{번호})을 더한다.
 * 막타: 보스를 쓰러뜨린 마지막 한 방을 친 학생. 교실 보상을 고른다(선생님 결정 2026-11-20).
 *   같은 학생이 두 번 연속 막타면 그 보스의 보상은 '다음 사람'(막타 바로 앞에 보스를 깎은 학생)이 고른다.
 * 나중에 꾸미기 배수가 들어오면 기록 한 줄의 mult 를 곱한다(없으면 1).
 */
(() => {
const PASS_DMG = 1, CHIP_DMG = 0.3, CHIP_NEED = 10;
const DEFAULT_COEFS = [1, 1.1, 1.3, 1.6, 2, 2.5, 3, 4];
const BOSSES = [['🐙', '문어 대장'], ['🦀', '집게 장군'], ['🦈', '상어 선장'], ['🐊', '악어 대왕'],
                ['🦖', '공룡 대장'], ['🐲', '용 대왕'], ['👾', '외계 대장'], ['🤖', '로봇 대왕']];
const r2 = v => Math.round(v * 100) / 100;

/** i번째(0부터) 보스의 계수 — 표를 넘어가면 마지막 값에서 1씩 커진다 */
function coefAt(coefs, i) {
  const c = Array.isArray(coefs) && coefs.length ? coefs : DEFAULT_COEFS;
  return i < c.length ? Number(c[i]) || 1 : (Number(c[c.length - 1]) || 1) + (i - c.length + 1);
}
function hpAt(game, i) { return Math.max(1, Math.round((Number(game && game.base) || 1) * coefAt(game && game.coefs, i))); }
function isOn(game) { return !!(game && game.on && Number(game.base) > 0 && Number(game.startTs) > 0); }
function isExcluded(game, studentNo) {
  return !!(game && Array.isArray(game.exclude) && game.exclude.map(String).indexOf(String(studentNo)) !== -1);
}
function dayOf(r) {
  if (r.dateKey) return String(r.dateKey);
  const d = new Date(r.ts), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 한 학생의 기록 → 게임 시작 뒤 보스에게 준 데미지
 *  돌려주는 값: { total, events:[{ ts, level, pass, chip, dmg }] }  (pass·chip 은 그 판에서 준 데미지, 없으면 0) */
function damageOf(rows, game, scoreOf) {
  const out = { total: 0, events: [] };
  if (!isOn(game)) return out;
  const L = window.Levels;
  const list = (rows || []).filter(r => r && L.LEVEL_CONFIGS[r.level] && (r.mode === 'challenge' || r.mode === 'aborted'))
    .slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const start = Number(game.startTs);
  let i = 0;
  while (i < list.length && (list[i].ts || 0) < start) i++;
  let passed = L.computeProgress(list.slice(0, i), scoreOf).passed;
  const dayCorrect = {};
  for (; i < list.length; i++) {
    const r = list[i], mult = Number(r.mult) > 0 ? Number(r.mult) : 1;
    let pass = 0, chip = 0;
    if (!passed[r.level]) {
      const after = L.computeProgress(list.slice(0, i + 1), scoreOf).passed;
      if (after[r.level]) pass = PASS_DMG * mult;
      passed = after;
    }
    const day = dayOf(r), before = dayCorrect[day] || 0, now = before + (Number(r.correct) || 0);
    dayCorrect[day] = now;
    if (before < CHIP_NEED && now >= CHIP_NEED) chip = CHIP_DMG * mult;
    if (pass || chip) {
      out.events.push({ ts: r.ts, level: r.level, pass: r2(pass), chip: r2(chip), dmg: r2(pass + chip) });
      out.total += pass + chip;
    }
  }
  out.total = r2(out.total);
  return out;
}

/** 반 합계 데미지 → 지금 보스 { stage(1부터), icon, name, max, hp, killed(쓰러뜨린 수) } */
function bossOf(total, game) {
  let left = Math.max(0, Number(total) || 0), i = 0;
  for (; i < 500; i++) {
    const hp = hpAt(game, i);
    if (left < hp - 1e-9) break;
    left -= hp;
  }
  const max = hpAt(game, i), b = BOSSES[i % BOSSES.length];
  return { stage: i + 1, icon: b[0], name: b[1], max, hp: r2(max - left), killed: i };
}

/** 막타 기록들 → 단계별 [{ stage, by(막타 번호), next(바로 앞에 깎은 번호), pick(보상 고르는 번호), ts }]
 *  claims = [{ studentNo, s(단계), ts, next }] — 학생 기기가 저마다 적으므로 같은 단계가 겹칠 수 있다. 가장 이른 것만 인정한다.
 *  바로 앞 단계와 막타가 같은 학생이면 next 가 고른다(next 가 없으면 그대로). */
function resolveKills(claims, startTs) {
  const by = {};
  (claims || []).forEach(c => {
    const s = Number(c && c.s), ts = Number(c && c.ts);
    if (!(s >= 1) || !(ts >= (Number(startTs) || 0)) || c.studentNo == null) return;
    if (!by[s] || ts < by[s].ts) by[s] = { stage: s, by: String(c.studentNo), next: c.next ? String(c.next) : '', ts };
  });
  const list = Object.keys(by).map(Number).sort((a, b) => a - b).map(s => by[s]);
  list.forEach(k => {
    const prev = by[k.stage - 1];
    k.pick = prev && prev.by === k.by && k.next ? k.next : k.by;
  });
  return list;
}

/** 화면에 쓰는 숫자 — 소수 첫째 자리까지, 필요 없는 0은 뺀다 (0.3 · 1 · 12.6) */
function fmt(v) { return String(Math.round((Number(v) || 0) * 10) / 10); }

/** '18, 99' 같은 글 → ['18','99'] */
function parseExclude(text) {
  return String(text || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 40);
}

window.Game = { PASS_DMG, CHIP_DMG, CHIP_NEED, DEFAULT_COEFS, BOSSES, coefAt, hpAt, isOn, isExcluded, damageOf, bossOf, resolveKills, fmt, parseExclude };
})();
