/* 오늘 목표 점검 — `node tools/test-today-goal.js`
 * 학급 관리 사이트(classcheckprogram)의 '오늘 했다'와 같은 기준인지 본다 (levels.js todayGoal).
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'levels.js'), 'utf8'), ctx);
const L = ctx.window.Levels;
let fails = 0;
const check = (name, cond) => { console.log((cond ? '  ✔ ' : '  ✘ ') + name); if (!cond) fails++; };
const T = '2026-11-24', P = '2026-11-23';
let ts = 1;
const row = (level, dateKey, seq, mode = 'aborted') => ({ level, dateKey, seq, mode, ts: ts++ });
const full = lv => row(lv, '2026-11-10', '1'.repeat(L.LEVEL_CONFIGS[lv].chalQ), 'challenge');
const base = ['B1', 'B2', 'B3'].map(full);

console.log('처음 푸는 레벨');
let g = L.todayGoal(base, null, T);
check('오늘 할 레벨 B4, 목표 10문제', g.level === 'B4' && g.first && g.goal === 10 && !g.done);
g = L.todayGoal([...base, row('B4', T, '1110'), row('B4', T, '111100')], null, T);
check('오늘 여러 판 합쳐 10문제 → 달성', g.done && g.solved === 10);

console.log('전에 푼 레벨');
const prev = row('B4', P, '111111100');   // 7개
g = L.todayGoal([...base, prev], null, T);
check('지난번 7개 → 목표 8개', g.prev === 7 && g.goal === 8 && !g.done);
g = L.todayGoal([...base, prev, row('B4', T, '1111011')], null, T);
check('오늘 최고 6개 → 아직', !g.done && g.best === 6);
g = L.todayGoal([...base, prev, row('B4', T, '111111100')], null, T);
check('오늘도 7개 → 아직 (같으면 못 넘은 것)', !g.done);
g = L.todayGoal([...base, prev, row('B4', T, '11111111')], null, T);
check('오늘 8개 → 달성', g.done && !g.passed);

console.log('오늘 통과');
g = L.todayGoal([...base, prev, row('B4', T, '1111111111', 'challenge')], null, T);
check('오늘 B4 통과 → 달성(통과), 레벨은 오늘 시작할 때의 B4', g.done && g.passed && g.level === 'B4');
g = L.todayGoal([...base, row('B4', P, '1111111111', 'challenge')], null, T);
check('어제 통과했으면 오늘 레벨은 B5', g.level === 'B5');

console.log('다른 레벨만 풂');
g = L.todayGoal([...base, prev, row('B1', T, '11111111111111111111')], null, T);
check('B1만 풀면 B4 목표는 아직', g.level === 'B4' && !g.done);

console.log(fails ? `\n${fails}개 실패` : '\n모두 통과');
process.exit(fails ? 1 : 0);
