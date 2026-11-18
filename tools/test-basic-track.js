/* test-basic-track.js — 기초 연산 트랙 점검 (node tools/test-basic-track.js)
 * 브라우저 없이 levels.js · generator.js 만 돌려 본다.
 *   - 트랙 분리 뒤에도 분수·소수 트랙의 잠금이 예전과 같은가
 *   - 기초 레벨은 항상 열려 있는가
 *   - B1~B10 문제가 조건에 맞게 나오는가 (레벨마다 2,000문제)
 *   - 시작점 입력 해석
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Object, Array, String, Number, Error };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/fraction.js', 'js/decimal.js', 'js/pictures.js', 'js/shapes.js', 'js/levels.js', 'js/generator.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const L = ctx.Levels, G = ctx.Gen;
let fails = 0;
const check = (name, cond) => { console.log((cond ? '  ✔ ' : '  ✘ ') + name); if (!cond) fails++; };

console.log('트랙');
check('분수·소수 트랙 37레벨 그대로', L.LEVEL_ORDER.length === 37 && L.TRACKS.frac.levels === L.LEVEL_ORDER);
check('기초 트랙 B1~B10', L.BASIC_ORDER.join() === 'B1,B2,B3,B4,B5,B6,B7,B8,B9,B10');
check('모든 레벨 59개(기초 10 + 분수·소수 37 + 소수의 곱셈 6 + 도형의 넓이 6), 겹침 없음', L.ALL_LEVELS.length === 59 && new Set(L.ALL_LEVELS).size === 59);
check('레벨 이름 8자 이하 (보안 규칙)', L.ALL_LEVELS.every(lv => lv.length <= 8));
check('모든 만점 ≤ 300 (보안 규칙)', L.ALL_LEVELS.every(lv => L.LEVEL_MAX[lv] <= 300));
check('기존 레벨 문제 수 그대로 (L1 20 · L11 10 · L15 8)', L.LEVEL_CONFIGS.L1.chalQ === 20 && L.LEVEL_CONFIGS.L11.chalQ === 10 && L.LEVEL_CONFIGS.L15.chalQ === 8);

check('계산 연습장 30레벨(소수의 곱셈 5개 · 넓이 5개 포함), 모두 4지선다·숫자 입력', L.SCRATCH_LEVELS.length === 30 && L.SCRATCH_LEVELS.every(lv => L.LEVEL_CONFIGS[lv].scratch && L.LEVEL_CONFIGS[lv].engine !== 'frac'));
check('B5·L1·L11 에는 연습장 없음', !L.LEVEL_CONFIGS.B5.scratch && !L.LEVEL_CONFIGS.L1.scratch && !L.LEVEL_CONFIGS.L11.scratch);

console.log('잠금');
let same = true;
L.LEVEL_ORDER.forEach((lv, i) => {
  if (i === 0) { if (!L.isLevelUnlocked(lv, {})) same = false; return; }
  const prev = L.LEVEL_ORDER[i - 1];
  if (L.isLevelUnlocked(lv, {}) || !L.isLevelUnlocked(lv, { [prev]: true })) same = false;
  if (L.prevInTrack(lv) !== prev) same = false;
});
check('분수·소수: 앞 레벨을 통과해야 열림 (예전 한 줄 규칙과 같음)', same);
check('L10 의 앞 레벨은 L9-2', L.prevInTrack('L10') === 'L9-2');
check('기초 레벨은 기록이 없어도 모두 열림', L.BASIC_ORDER.every(lv => L.isLevelUnlocked(lv, {})));
check('기초 레벨에는 "먼저 통과" 안내 없음', L.BASIC_ORDER.every(lv => L.getPrevLevelInfo(lv, {}) === null));
check('B1 통과가 L1 을 열지 않음', !L.isLevelUnlocked('L2', { B10: true, B1: true }));
check('다음 레벨: B2→B3, B4→없음(줄 끝), L9→L9-2, L36→없음',
  L.nextInTrack('B2') === 'B3' && L.nextInTrack('B4') === null && L.nextInTrack('L9') === 'L9-2' && L.nextInTrack('L36') === null);

console.log('통과 판정');
let ts = 0;
const row = (level, mode, seq) => ({ level, mode, seq, ts: ++ts, totalQuestions: seq.length, score: null });
const prog = rows => L.computeProgress(rows, () => null);
check('기초: 여러 판을 이어 붙이지 않음 (9+9개 정답이어도 통과 아님)', !prog([row('B1', 'aborted', '0111111111'), row('B1', 'challenge', '1111111101')]).passed.B1);
check('기초: 한 판에서 18개 맞히면 통과 (자동 통과 판)', !!prog([row('B1', 'aborted', '1'.repeat(18))]).passed.B1);
check('기초: 한 판 17개는 통과 아님', !prog([row('B1', 'aborted', '1101111111111111110')]).passed.B1);
check('기초: 레벨 화면 막대는 가장 최근 판', prog([row('B1', 'aborted', '1'.repeat(10)), row('B1', 'aborted', '001')]).recent.B1.join('') === '001');
check('기초 판 규칙: 20문제 3개 틀리면 끝 · 10문제 2개', L.failAt('B1') === 3 && L.failAt('B4') === 2 && L.passWindow('B1').need === 18 && L.passWindow('B9').need === 9);
check('분수 레벨은 예전처럼 이어 붙임 (9+9개 → 통과)', !!prog([row('L1', 'aborted', '111111111'), row('L1', 'aborted', '111111111')]).passed.L1);
check('B4(10문제) 창 = 최근 10문제 중 9개', L.passWindow('B4').size === 10 && L.passWindow('B4').need === 9);
check('B3(10문제) = 한 판 10문제 · 9개 통과 · 2개 틀리면 다시', L.LEVEL_CONFIGS.B3.chalQ === 10 && L.LEVEL_CONFIGS.B3.chalTime === 400 && L.passWindow('B3').need === 9 && L.failAt('B3') === 2);
check('B3 예전 20문제 판: 9개 맞히고 3개 틀린 판은 통과 아님', !prog([row('B3', 'aborted', '1111111110100')]).passed.B3);
check('B3 예전 20문제 판: 18개 맞힌 판은 그대로 통과', !!prog([row('B3', 'aborted', '1'.repeat(18))]).passed.B3);
check('B3 새 10문제 판: 9개 맞히면 통과 · 8개는 아님', !!prog([row('B3', 'aborted', '1111111110')]).passed.B3 && !prog([row('B3', 'aborted', '1111111100')]).passed.B3);
check('교사 화면 분모: B3 새 판 /10 · 예전 판 /20 · B1 /20', L.shownSize('B3', [1,1,1]) === 10 && L.shownSize('B3', new Array(13).fill(1)) === 20 && L.shownSize('B1', [1]) === 20);

console.log('문제 만들기 (레벨마다 2,000문제)');
const N = 2000;
const gen = lv => G.generateNumProblem(lv);
const all = (lv, fn) => { for (let i = 0; i < N; i++) { const p = gen(lv); if (!fn(p)) { console.log('    예:', JSON.stringify(p)); return false; } } return true; };
const nums = p => (p.display.match(/\d+/g) || []).map(Number);
const val = p => p.fields[0].ans;
check('B1 세 자리 − 세 자리, 받아내림 있음, 답 양수', all('B1', p => {
  const [a, b] = nums(p);
  return a >= 100 && a <= 999 && b >= 100 && b <= 999 && val(p) === a - b && val(p) > 0 && ((a % 10) < (b % 10) || (Math.floor(a / 10) % 10) < (Math.floor(b / 10) % 10) + ((a % 10) < (b % 10) ? 1 : 0));
}));
check('B2 (두·세 자리) × (한 자리)', all('B2', p => { const [a, b] = nums(p); return a >= 10 && a <= 999 && b >= 2 && b <= 9 && val(p) === a * b; }));
check('B3 (두 자리) × (두 자리)', all('B3', p => { const [a, b] = nums(p); return a >= 10 && a <= 99 && b >= 10 && b <= 99 && val(p) === a * b; }));
check('B4 (세 자리) × (두 자리)', all('B4', p => { const [a, b] = nums(p); return a >= 100 && a <= 999 && b >= 10 && b <= 99 && val(p) === a * b; }));
check('B5 구구 범위, 나누어떨어짐', all('B5', p => { const [a, b] = nums(p); return b >= 2 && b <= 9 && val(p) >= 2 && val(p) <= 9 && a === b * val(p); }));
const qr = (p, a, b) => p.fields.length === 2 && p.fields[0].label === '몫' && p.fields[1].label === '나머지'
  && p.fields[0].ans === Math.floor(a / b) && p.fields[1].ans === a % b && p.fields[1].ans < b;
check('B6 (두 자리) ÷ (한 자리), 몫·나머지', all('B6', p => { const [a, b] = nums(p); return a >= 10 && a <= 99 && b >= 2 && b <= 9 && qr(p, a, b); }));
check('B7 (세 자리) ÷ (한 자리), 몫·나머지', all('B7', p => { const [a, b] = nums(p); return a >= 100 && a <= 999 && b >= 2 && b <= 9 && qr(p, a, b); }));
check('B8 ÷ (두 자리), 몫·나머지', all('B8', p => { const [a, b] = nums(p); return a <= 999 && b >= 10 && b <= 99 && qr(p, a, b) && p.fields[0].ans >= 2; }));
check('B9 약수 모두 (4개 이상, 정확)', all('B9', p => { const [n] = nums(p); const d = p.fields[0].ans; return p.fields[0].list && d.length >= 4 && d.join() === G.divisorsOf(n).join(); }));
check('B10 배수·공배수·최소공배수', all('B10', p => {
  const t = p.display, n = nums(p), f = p.fields[0];
  if (/최소공배수/.test(t)) { const [a, b] = n; return !f.list && f.ans % a === 0 && f.ans % b === 0 && f.ans === ctx.Frac.lcm(a, b); }
  if (/공배수/.test(t)) { const [a, b] = n; return f.list && f.ans.length === 3 && f.ans.every(x => x % a === 0 && x % b === 0) && f.ans[0] === ctx.Frac.lcm(a, b); }
  const [a] = n; return f.list && f.ans.join() === [a, 2 * a, 3 * a, 4 * a].join();
}));
check('모르는 과정 유형은 뺄셈으로 바뀌지 않고 오류', (() => { try { G.generateStepProblem('B1'); return false; } catch (e) { return /모름/.test(e.message); } })());
check('분수·소수 37레벨 문제 생성 오류 없음', L.LEVEL_ORDER.every(lv => { const c = L.LEVEL_CONFIGS[lv];
  try { for (let i = 0; i < 50; i++) c.engine === 'choice' ? G.generateChoiceSet(lv, 1) : G.generateStepProblem(lv); return true; } catch (e) { console.log('    ', lv, e.message); return false; } }));

console.log('시작점 입력');
const r1 = L.parseBasicStart('3 B1 B2 B6 가\n1 - B3 B6 나  # 메모\n\n6 통과 - - 라\n8 - - -');
check('네 줄 해석, 오류 없음', r1.errors.length === 0 && Object.keys(r1.map).length === 4);
check("'통과'는 '-' 로", r1.map['6'].sub === '-' && r1.map['8'].div === '-' && !r1.map['8'].g);
check('다시 글로 바꾸면 같은 내용', L.parseBasicStart(L.formatBasicStart(r1.map)).map['3'].div === 'B6');
const r2 = L.parseBasicStart('3 B2 B2 B6\n홍길동 B1 B2 B6\n4 B1 B3\n5 - B4 B7 마');
check('잘못된 줄 4개 모두 오류로 알려 줌', r2.errors.length === 4 && Object.keys(r2.map).length === 0);

const st = r1.map['3'];   // 3 B1 B2 B6 가
check('시작점 앞 레벨: B5 건너뜀, B6·B2 아님, 약수배수는 안 건너뜀', L.basicSkipped(st, 'B5') && !L.basicSkipped(st, 'B6') && !L.basicSkipped(st, 'B2') && !L.basicSkipped(st, 'B9'));
check("'-' 줄은 전부 건너뜀 (6번 곱셈·나눗셈)", ['B1','B2','B3','B4','B5','B8'].every(lv => L.basicSkipped(r1.map['6'], lv)));
check('다음 기초 레벨: B1 → (B1 통과) B2 → 다 통과하면 B9', L.nextBasicLevel(st, {}) === 'B1' && L.nextBasicLevel(st, { B1: true }) === 'B2'
  && L.nextBasicLevel(st, { B1: true, B2: true, B3: true, B4: true, B6: true, B7: true, B8: true }) === 'B9');
check('시작점이 없으면 B1부터', L.nextBasicLevel(null, {}) === 'B1' && L.nextBasicLevel(null, { B1: true }) === 'B2');
check('기초를 다 통과하면 없음', L.nextBasicLevel(st, Object.fromEntries(L.BASIC_ORDER.map(lv => [lv, true]))) === null);

console.log(fails ? `\n${fails}개 실패` : '\n모두 통과');
process.exit(fails ? 1 : 0);
