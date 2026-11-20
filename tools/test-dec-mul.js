/* test-dec-mul.js — 소수의 곱셈 트랙 점검 (node tools/test-dec-mul.js)
 * 브라우저 없이 levels.js · generator.js 만 돌려 본다.
 *   - D1~D6 트랙·잠금(앞 레벨 통과해야 열림)·만점·랭킹 제외
 *   - 문제 조건 (레벨마다 3,000문제): 정답 = 두 수의 곱(정수 계산으로 따로 검산), 자릿수 범위, 답이 자연수 아님(D1~D4)
 *   - D6 보기 4개, 정답 하나, 겹침 없음
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Object, Array, String, Number, Error, Set };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/fraction.js', 'js/decimal.js', 'js/pictures.js', 'js/shapes.js', 'js/levels.js', 'js/generator.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const L = ctx.Levels, G = ctx.Gen;
let fails = 0;
const check = (name, cond) => { console.log((cond ? '  ✔ ' : '  ✘ ') + name); if (!cond) fails++; };

console.log('트랙 · 잠금');
check('소수의 곱셈 트랙 D1~D6', L.TRACKS.dmul.levels.join() === 'D1,D2,D3,D4,D5,D6' && L.TRACK_KEYS.slice(0, 4).join() === 'basic,frac,fmul,dmul');
check('D1 은 처음부터 열림', L.isLevelUnlocked('D1', {}));
check('D2~D6 은 앞 레벨을 통과해야 열림', ['D2','D3','D4','D5','D6'].every((lv, i) => {
  const prev = 'D' + (i + 1);
  return !L.isLevelUnlocked(lv, {}) && L.isLevelUnlocked(lv, { [prev]: true }) && L.prevInTrack(lv) === prev;
}));
check('분수 트랙 통과(L36)로 D 레벨이 열리지 않음', !L.isLevelUnlocked('D2', { L36: true }));
check('D 레벨은 최근 문제 창 규칙(한 판 규칙 아님)', ['D1','D4','D6'].every(lv => !L.isRunRule(lv)));
check('통과 창: D1 20문제 중 18개 · D3·D4 10문제 중 9개', L.passWindow('D1').need === 18 && ['D3','D4'].every(lv => L.passWindow(lv).size === 10 && L.passWindow(lv).need === 9));
check('만점 100 · 이름 8자 이하', L.DMUL_ORDER.every(lv => L.LEVEL_MAX[lv] === 100 && lv.length <= 8));
check('랭킹 순서(LEVEL_ORDER)에 들어가지 않음', L.DMUL_ORDER.every(lv => L.LEVEL_ORDER.indexOf(lv) === -1));
check('다음 레벨: D5 → D6, D6 → 없음', L.nextInTrack('D5') === 'D6' && L.nextInTrack('D6') === null);
check('D1~D5 숫자 입력 · D6 4지선다', ['D1','D2','D3','D4','D5'].every(lv => L.LEVEL_CONFIGS[lv].engine === 'num') && L.LEVEL_CONFIGS.D6.engine === 'choice');
const rows = Array.from({ length: 2 }, (_, i) => ({ level: 'D1', mode: 'challenge', ts: i + 1, seq: '1111111110' }));
check('D1: 앞 판 9개 + 뒤 판 9개 = 최근 20문제 중 18개 → 통과', !!L.computeProgress(rows, () => null).passed.D1);

/* 정수만으로 검산: "3.25" → [325, 2] */
const parse = t => { const [w, f = ''] = t.split('.'); return [Number(w + f), f.length]; };
const strip = t => t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const valueOf = (v, p) => v / Math.pow(10, p);
const N = 3000;
function checkNum(lv, rule) {
  let bad = null;
  for (let i = 0; i < N && !bad; i++) {
    const q = G.generateNumProblem(lv), f = q.fields[0];
    const m = strip(q.display).match(/^([\d.]+) × ([\d.]+) =$/);
    if (!m || q.fields.length !== 1 || !f.dec) { bad = strip(q.display); break; }
    const [av, ap] = parse(m[1]), [bv, bp] = parse(m[2]);
    const want = valueOf(av * bv, ap + bp);
    if (Math.abs(f.ans - want) > 1e-9 || f.raw !== av * bv || f.places !== ap + bp) { bad = `${m[0]} 정답 ${f.ans}`; break; }
    const r = rule(m[1], m[2], f.ans);
    if (r !== true) bad = `${m[0]} ${f.ans} — ${r}`;
  }
  check(`${lv} ${N}문제: ${L.LEVEL_CONFIGS[lv].label}${bad ? ' — ' + bad : ''}`, !bad);
}
const places = t => (t.split('.')[1] || '').length;
const notInt = ans => Number.isInteger(ans) ? '답이 자연수' : true;
console.log('문제');
checkNum('D1', (a, b, ans) => places(b) === 0 && [1, 2].includes(places(a)) && Number(b) >= 2 && Number(b) <= 25 ? notInt(ans) : '모양');
checkNum('D2', (a, b, ans) => places(a) === 0 && [1, 2].includes(places(b)) ? notInt(ans) : '모양');
checkNum('D3', (a, b, ans) => places(a) === 1 && places(b) === 1 ? notInt(ans) : '모양');
checkNum('D4', (a, b, ans) => places(a) + places(b) === 3 && places(a) && places(b) ? notInt(ans) : '모양');
checkNum('D5', (a, b, ans) => {
  const m = [a, b].find(t => /^(10|100|1000|0\.1|0\.01|0\.001)$/.test(t));
  if (!m) return '× 10·100·1000·0.1·0.01·0.001 아님';
  return places(String(ans)) <= 3 ? true : '소수 넷째 자리';
});
let zeroPad = 0;
for (let i = 0; i < N; i++) { const a = G.generateNumProblem('D3').fields[0].ans; if (a < 0.1) zeroPad++; }
check(`D3 에 0.06 처럼 0을 채우는 답이 섞임 (${zeroPad}/${N})`, zeroPad > N * 0.03);

console.log('D6 4지선다');
let bad6 = null;
for (let i = 0; i < N && !bad6; i++) {
  const q = G.generateChoiceSet('D6', 1)[0];
  const cs = q.choices, right = cs.filter(c => c.correct);
  const m = strip(q.display).match(/^([\d.]+) × ([\d.]+) = \?$/);
  if (!m || cs.length !== 4 || right.length !== 1 || new Set(cs.map(c => strip(c.html))).size !== 4) { bad6 = strip(q.display) + ' / ' + cs.map(c => strip(c.html)).join(','); break; }
  const [av, ap] = parse(m[1]), [bv, bp] = parse(m[2]);
  if (Math.abs(Number(strip(right[0].html)) - valueOf(av * bv, ap + bp)) > 1e-9) bad6 = `${m[0]} 정답 보기 ${strip(right[0].html)}`;
  if (cs.some(c => !/^\d+(\.\d+)?$/.test(strip(c.html)))) bad6 = `${m[0]} 보기 모양 ${cs.map(c => strip(c.html)).join(',')}`;
}
check(`D6 ${N}문제: 보기 4개 · 정답 하나 · 겹침 없음${bad6 ? ' — ' + bad6 : ''}`, !bad6);

console.log(fails ? `\n✘ ${fails}개 실패` : '\n모두 통과');
process.exit(fails ? 1 : 0);
