/* 통과 규칙 점검 — `node tools/test-pass-rule.js`
 * 브라우저 없이 js/levels.js 의 computeProgress · isLevelUnlocked 만 돌려 본다.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'levels.js'), 'utf8'), ctx);
const L = ctx.window.Levels;

// db.js 의 scoreOf 와 같은 판정 (완주하지 않은 도전은 점수로 치지 않는다)
const scoreOf = r => {
  if (!r || r.score == null) return null;
  const cfg = L.LEVEL_CONFIGS[r.level];
  if (r.mode === 'challenge' && cfg && r.totalQuestions < cfg.chalQ) return null;
  return Number(r.score);
};
let ts = 0, fails = 0;
const row = (level, mode, seq, extra) => Object.assign({ level, mode, seq, ts: ++ts, totalQuestions: seq ? seq.length : 0, score: null }, extra);
const check = (name, cond) => { console.log((cond ? '  ✔ ' : '  ✘ ') + name); if (!cond) fails++; };
const prog = rows => L.computeProgress(rows, scoreOf);

console.log('창 크기');
check('4지선다 L1 = 최근 20문제 중 18개', L.passWindow('L1').size === 20 && L.passWindow('L1').need === 18);
check('과정형 L11 = 최근 10문제 중 9개', L.passWindow('L11').size === 10 && L.passWindow('L11').need === 9);
check('과정형 L15(8문제) = 최근 10문제 중 9개', L.passWindow('L15').size === 10 && L.passWindow('L15').need === 9);

console.log('틀리면 그만두고 다시 시작하기');
let rows = [];
for (let i = 0; i < 6; i++) rows.push(row('L1', 'aborted', '0'));          // 첫 문제 틀리고 그만두기 6번
rows.push(row('L1', 'aborted', '1'.repeat(14)));                            // 그 뒤 14문제 연속 정답
check('오답 6개가 남아 있어 통과 안 됨 (예전 규칙이면 깨끗한 새 판)', !prog(rows).passed.L1);
check('최근 20문제에 정답 14개로 보임', L.windowCorrect(prog(rows).recent.L1) === 14);
rows.push(row('L1', 'aborted', '1'.repeat(3)));
check('17개 — 아직', !prog(rows).passed.L1);
rows.push(row('L1', 'aborted', '1'));
check('계속 풀어 오답이 밀려나 18개가 되면 통과', !!prog(rows).passed.L1);
check('L2 도전이 열림', L.isLevelUnlocked('L2', prog(rows).passed));

console.log('여러 번에 나눠 풀어도 이어짐');
rows = [row('L3', 'aborted', '1111111110'), row('L3', 'challenge', '11111111101111111111', { score: 98, totalQuestions: 20 })];
check('앞 판 9개 + 뒤 판 = 최근 20문제 중 19개 → 통과', !!prog(rows).passed.L3);

console.log('한 번 통과하면 유지');
rows = [row('L1', 'challenge', '1'.repeat(20), { score: 90, totalQuestions: 20 }), row('L1', 'aborted', '0000000000')];
check('통과 뒤에 많이 틀려도 통과 유지', !!prog(rows).passed.L1);

console.log('예전 기록(seq 없음)');
rows = [row('L1', 'challenge', undefined, { score: 86, totalQuestions: 20 })];
check('예전 규칙 통과 점수(86) 이상이면 통과 인정', !!prog(rows).passed.L1);
rows = [row('L1', 'challenge', undefined, { score: 85.9, totalQuestions: 20 })];
check('통과 점수 미만이면 통과 아님', !prog(rows).passed.L1);
rows = [row('L1', 'aborted', undefined, { correct: 5, incorrect: 0, totalQuestions: 5 })];
check('예전 중도 포기 기록은 계산에 넣지 않음', !prog(rows).passed.L1 && !prog(rows).recent.L1);

console.log('새 기록은 점수만으로 통과되지 않음');
rows = [row('L11', 'challenge', '1111111100', { score: 136, totalQuestions: 10 })];
check('과정형 10문제 중 8개 — 통과 아님', !prog(rows).passed.L11);

console.log('그 밖');
rows = [row('L1', 'free', '1'.repeat(20))];
check('자유 연습은 계산에 넣지 않음', !prog(rows).passed.L1);
rows = [row('L10', 'challenge', undefined, { score: 135, totalQuestions: 20 })];
check('L10 을 통과한 학생은 나중에 넣은 L9-2 도 통과로 인정', !!prog(rows).passed['L9-2']);
check('L1 은 언제나 열림', L.isLevelUnlocked('L1', {}));
check('기록이 없으면 L2 는 잠김', !L.isLevelUnlocked('L2', prog([]).passed));
check('이상한 seq 는 무시', !prog([row('L1', 'aborted', '1x1')]).recent.L1);

console.log(fails ? `\n실패 ${fails}건` : '\n모두 통과');
process.exit(fails ? 1 : 0);
