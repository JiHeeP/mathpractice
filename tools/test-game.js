/* 반 보스 계산 점검 — `node tools/test-game.js`
 * 브라우저 없이 js/levels.js · js/game.js 만 돌려 본다.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['levels.js', 'game.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx);
const L = ctx.window.Levels, G = ctx.window.Game;
const scoreOf = r => {
  if (!r || r.score == null) return null;
  const cfg = L.LEVEL_CONFIGS[r.level];
  if (r.mode === 'challenge' && cfg && r.totalQuestions < cfg.chalQ) return null;
  return Number(r.score);
};
let fails = 0;
const check = (name, cond) => { console.log((cond ? '  ✔ ' : '  ✘ ') + name); if (!cond) fails++; };
const DAY = 86400000, T0 = Date.UTC(2026, 10, 23, 1);   // 시작 시각
const game = { on: true, startTs: T0, base: 34, coefs: G.DEFAULT_COEFS.slice(), exclude: ['99'] };
const ones = n => '1'.repeat(n);
// 한 판 기록: seq 로 맞힌 수를 정한다
const run = (level, seq, ts, extra) => Object.assign({ level, mode: 'aborted', seq, ts, dateKey: new Date(ts).toISOString().slice(0, 10),
  totalQuestions: seq.length, correct: (seq.match(/1/g) || []).length, incorrect: (seq.match(/0/g) || []).length, score: null }, extra);
const dmg = rows => G.damageOf(rows, game, scoreOf);

console.log('보스 체력과 단계');
check('1단계 체력 = 학생 수 × 2 (34)', G.hpAt(game, 0) === 34);
check('2~5단계 체력 37 · 44 · 54 · 68', [1, 2, 3, 4].map(i => G.hpAt(game, i)).join() === '37,44,54,68');
check('계수 표를 넘으면 1씩 커진다 (9번째 = ×5)', G.coefAt(game.coefs, 8) === 5 && G.coefAt(game.coefs, 9) === 6);
check('데미지 0 → 1단계 문어 대장, 체력 가득', (b => b.stage === 1 && b.hp === 34 && b.max === 34 && b.name === '문어 대장')(G.bossOf(0, game)));
check('데미지 33.7 → 아직 1단계, 남은 체력 0.3', (b => b.stage === 1 && b.hp === 0.3)(G.bossOf(33.7, game)));
check('데미지 34 → 2단계, 체력 37 가득', (b => b.stage === 2 && b.hp === 37 && b.killed === 1)(G.bossOf(34, game)));
check('데미지 34+37+10 → 3단계, 남은 체력 34', (b => b.stage === 3 && b.hp === 34)(G.bossOf(81, game)));
check('꺼져 있으면 데미지 0', G.damageOf([run('B1', ones(18), T0 + 1)], Object.assign({}, game, { on: false }), scoreOf).total === 0);

console.log('통과 데미지');
check('기초 B1 한 판 18개 → 처음 통과 1 + 그날 10문제 0.3', (d => d.total === 1.3 && d.events.length === 1 && d.events[0].pass === 1 && d.events[0].chip === 0.3)(dmg([run('B1', ones(18), T0 + 1)])));
check('이미 통과한 레벨을 다시 통과해도 통과 데미지는 0', dmg([run('B1', ones(18), T0 + 1), run('B1', ones(18), T0 + DAY)]).total === 1.6);
check('게임 시작 전에 통과한 레벨은 0 (그날 10문제만)', dmg([run('B1', ones(18), T0 - DAY), run('B1', ones(18), T0 + 1)]).total === 0.3);
check('게임 시작 전 기록만 있으면 0', dmg([run('B1', ones(18), T0 - DAY)]).total === 0);
check('분수 L1: 두 판을 이어 붙여 18개가 되는 판에서 통과 1', (d => d.events.filter(e => e.pass === 1).length === 1 && d.events.filter(e => e.pass).pop().ts === T0 + 2)(dmg([run('L1', ones(9), T0 + 1), run('L1', ones(9), T0 + 2)])));
check('자유 연습(free)은 세지 않는다', dmg([run('B1', ones(18), T0 + 1, { mode: 'free' })]).total === 0);

console.log('잔타격 (그날 맞힌 문제 합계 10개)');
check('한 판 9개 → 0', dmg([run('L1', ones(9), T0 + 1)]).total === 0);
check('같은 날 4개 + 6개 → 둘째 판에서 0.3', (d => d.total === 0.3 && d.events[0].ts === T0 + 2)(dmg([run('L1', ones(4), T0 + 1), run('L1', ones(6), T0 + 2)])));
check('하루 한 번만 — 같은 날 30개 맞혀도 0.3', dmg([run('L1', ones(8) + '00', T0 + 1), run('L1', ones(8) + '00', T0 + 2), run('L1', ones(8) + '00', T0 + 3), run('L1', '1111110000', T0 + 4)]).events.filter(e => e.chip).length === 1);
check('다음 날은 다시 받는다', dmg([run('L5', '1111111111000', T0 + 1), run('L5', '1111111111000', T0 + DAY)]).events.filter(e => e.chip === 0.3).length === 2);
check('틀린 문제는 세지 않는다 (맞힌 9 + 틀린 5)', dmg([run('L1', ones(9) + '00000', T0 + 1)]).total === 0);

console.log('그 밖');
check('빼는 번호 판정', G.isExcluded(game, 99) && !G.isExcluded(game, '7'));
check("'18, 99 18' → ['18','99']", G.parseExclude('18, 99 18').join() === '18,99');
check('숫자 표시 0.3 · 1 · 12.6', G.fmt(0.3) === '0.3' && G.fmt(1) === '1' && G.fmt(12.6000001) === '12.6');
check('배수가 붙은 기록은 곱한다 (통과 1.5 + 잔타격 0.45)', dmg([run('B1', ones(18), T0 + 1, { mult: 1.5 })]).total === 1.95);

console.log('막타와 보상 고르는 사람');
const K = (studentNo, s, ts, next) => ({ studentNo, s, ts: T0 + ts, next });
const picks = claims => G.resolveKills(claims, T0).map(k => `${k.stage}:${k.by}>${k.pick}`).join(' ');
check('막타 친 학생이 고른다', picks([K('7', 1, 10, '3')]) === '1:7>7');
check('두 번 연속 막타 → 둘째 보스는 다음 사람(3번)이 고른다', picks([K('7', 1, 10, '3'), K('7', 2, 20, '3')]) === '1:7>7 2:7>3');
check('세 번 연속이면 셋째도 다음 사람', picks([K('7', 1, 10, '3'), K('7', 2, 20, '3'), K('7', 3, 30, '5')]) === '1:7>7 2:7>3 3:7>5');
check('사이에 다른 학생이 막타면 다시 고를 수 있다', picks([K('7', 1, 10, '3'), K('4', 2, 20, '7'), K('7', 3, 30, '4')]) === '1:7>7 2:4>4 3:7>7');
check('다음 사람이 없으면(혼자 깎음) 그대로', picks([K('7', 1, 10, ''), K('7', 2, 20, '')]) === '1:7>7 2:7>7');
check('같은 단계가 겹치면 먼저 적힌 것만', picks([K('4', 1, 12, '7'), K('7', 1, 10, '3')]) === '1:7>7');
check('새로 시작 전의 막타는 버린다', picks([K('7', 1, -5, '3'), K('4', 1, 10, '7')]) === '1:4>4');

console.log(fails ? `\n실패 ${fails}건` : '\n모두 통과');
process.exit(fails ? 1 : 0);
