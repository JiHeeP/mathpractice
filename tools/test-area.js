/* test-area.js — 도형의 넓이 트랙 점검 (node tools/test-area.js)
 * 브라우저 없이 shapes.js · levels.js · generator.js 만 돌려 본다.
 *   - A1~A6 트랙·잠금(앞 레벨 통과해야 열림)·만점·랭킹 제외
 *   - 문제 조건 (레벨마다 3,000문제): 넓이 = 공식(길이로 따로 계산), 답이 자연수, 단위 cm²·m², 함정 옆변 > 높이
 *   - 그림 SVG 에 길이 숫자가 모두 적혀 있고 좌표에 NaN 이 없음
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
check('도형의 넓이 트랙 A1~A6', L.TRACKS.area.levels.join() === 'A1,A2,A3,A4,A5,A6' && L.TRACK_KEYS.join() === 'basic,frac,dmul,area');
check('A1 은 처음부터 열림', L.isLevelUnlocked('A1', {}));
check('A2~A6 은 앞 레벨을 통과해야 열림', ['A2','A3','A4','A5','A6'].every((lv, i) => {
  const prev = 'A' + (i + 1);
  return !L.isLevelUnlocked(lv, {}) && L.isLevelUnlocked(lv, { [prev]: true }) && L.prevInTrack(lv) === prev;
}));
check('소수의 곱셈 통과(D6)로 A 레벨이 열리지 않음', !L.isLevelUnlocked('A2', { D6: true }));
check('최근 문제 창 규칙 · A1 20문제 중 18개 · A2~A6 10문제 중 9개(2026-11-19)', L.AREA_ORDER.every(lv => !L.isRunRule(lv)) && L.passWindow('A1').need === 18
  && ['A2','A3','A4','A5','A6'].every(lv => L.LEVEL_CONFIGS[lv].chalQ === 10 && L.passWindow(lv).size === 10 && L.passWindow(lv).need === 9));
const at = (seqs) => seqs.map((seq, i) => ({ level: 'A2', mode: 'challenge', ts: i + 1, seq }));
check('A2 예전 20문제 판: 마지막 10개 중 9개여도 20문제 중 16개면 통과 아님', !L.computeProgress(at(['1110111011' + '1111111110']), () => null).passed.A2);
check('A2 예전 20문제 판 18개 → 통과', !!L.computeProgress(at(['11111111110111111110']), () => null).passed.A2);
check('A2 새 10문제 판 9개 → 통과', !!L.computeProgress(at(['11111111110111011101', '1111111110']), () => null).passed.A2);
check('A2 새 판 8개 → 통과 아님, 화면 막대는 10칸', (p => !p.passed.A2 && p.recent.A2.length === 10)(L.computeProgress(at(['1111111100']), () => null)));
check('만점 100 · 이름 8자 이하 · 랭킹 제외', L.AREA_ORDER.every(lv => L.LEVEL_MAX[lv] === 100 && lv.length <= 8 && L.LEVEL_ORDER.indexOf(lv) === -1));
check('모두 숫자 입력', L.AREA_ORDER.every(lv => L.LEVEL_CONFIGS[lv].engine === 'num'));

const formula = (shape, d) => ({
  rect: () => d.w * d.h, square: () => d.s * d.s, para: () => d.b * d.h,
  tri: () => d.b * d.h / 2, rhom: () => d.d1 * d.d2 / 2, trap: () => (d.a + d.b) * d.h / 2
})[shape]();
const lens = (shape, d) => ({
  rect: [d.w, d.h], square: [d.s], para: [d.b, d.h, d.side], tri: [d.b, d.h, d.side],
  rhom: [d.d1, d.d2], trap: [d.a, d.b, d.h, d.side]
})[shape];
const WANT = { A1: ['rect', 'square'], A2: ['para'], A3: ['tri'], A4: ['rhom'], A5: ['trap'], A6: ['rect', 'square', 'para', 'tri', 'rhom', 'trap'] };
const N = 3000;
console.log('문제');
for (const lv of L.AREA_ORDER) {
  let bad = null; const seen = new Set(); let m = 0, obtuse = 0;
  for (let i = 0; i < N && !bad; i++) {
    const q = G.generateNumProblem(lv), f = q.fields[0], d = q.dims;
    seen.add(q.shape);
    const u = f.unit === 'm²' ? 'm' : 'cm'; if (u === 'm') m++;
    if (q.shape === 'tri' && (d.apex < 0 || d.apex > d.b)) obtuse++;
    const tag = `${q.shape} ${JSON.stringify(d)}`;
    if (WANT[lv].indexOf(q.shape) === -1) bad = `다른 도형 ${tag}`;
    else if (!['cm²', 'm²'].includes(f.unit)) bad = `단위 ${f.unit}`;
    else if (f.ans !== formula(q.shape, d)) bad = `넓이 ${f.ans} ≠ 공식 ${tag}`;
    else if (!Number.isInteger(f.ans) || f.ans <= 0) bad = `답이 자연수 아님 ${tag}`;
    else if (d.side !== undefined && d.side <= d.h) bad = `옆변이 높이보다 짧음 ${tag}`;
    else if (/NaN|Infinity/.test(q.display)) bad = `그림 좌표 오류 ${tag}`;
    else if (lens(q.shape, d).some(n => q.display.indexOf(`>${n} ${u}<`) === -1)) bad = `길이 글자 빠짐 ${tag}`;
    else if ((lv === 'A6') === /사각형의|평행사변형의|삼각형의|마름모의|사다리꼴의/.test(q.display)) bad = `도형 이름 ${lv === 'A6' ? '보임' : '안 보임'} ${tag}`;
  }
  const allShapes = WANT[lv].every(s => seen.has(s));
  check(`${lv} ${N}문제: ${L.LEVEL_CONFIGS[lv].label} (m 단위 ${m}개${lv === 'A3' ? `, 높이가 밖에 있는 삼각형 ${obtuse}개` : ''})${bad ? ' — ' + bad : ''}${allShapes ? '' : ' — 안 나온 도형 있음'}`,
    !bad && allShapes && m > N * 0.15 && m < N * 0.35 && (lv !== 'A3' || obtuse > N * 0.2));
}

console.log(fails ? `\n✘ ${fails}개 실패` : '\n모두 통과');
process.exit(fails ? 1 : 0);
