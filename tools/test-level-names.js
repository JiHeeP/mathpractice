/* 화면 레벨 이름 점검 — `node tools/test-level-names.js`
 * 선생님 결정 2026-11-20: a 기초 · b 분수·소수 기초 · c 분수의 곱셈 · d 소수의 곱셈 · e 도형의 넓이, 트랙 안 번호.
 * 속 이름(B1 · L1 · D1 · A1)은 그대로 — 기록 · 보안 규칙 · 기초 시작점 · 학급 관리 사이트가 쓴다.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'levels.js'), 'utf8'), ctx);
const L = ctx.window.Levels;
let fails = 0;
const check = (name, cond) => { console.log((cond ? '  ✔ ' : '  ✘ ') + name); if (!cond) fails++; };
const nm = L.levelName;

console.log('트랙과 글자');
check('트랙 순서 a b c d e', L.TRACK_KEYS.map(t => L.TRACKS[t].letter).join('') === 'abcde');
check('b = L1~L22 (23레벨, L9-2 포함)', L.TRACKS.frac.levels.length === 23 && L.TRACKS.frac.levels[0] === 'L1' && L.TRACKS.frac.levels[22] === 'L22');
check('c = L23~L36 (14레벨)', L.TRACKS.fmul.levels.length === 14 && L.TRACKS.fmul.levels[0] === 'L23' && L.TRACKS.fmul.levels[13] === 'L36');

console.log('이름 바꾸기');
check('B1 → a1, B10 → a10', nm('B1') === 'a1' && nm('B10') === 'a10');
check('L1 → b1, L9 → b9, L9-2 → b10, L10 → b11, L22 → b23', nm('L1') === 'b1' && nm('L9') === 'b9' && nm('L9-2') === 'b10' && nm('L10') === 'b11' && nm('L22') === 'b23');
check('L23 → c1, L36 → c14', nm('L23') === 'c1' && nm('L36') === 'c14');
check('D1 → d1, D6 → d6, A1 → e1, A6 → e6', nm('D1') === 'd1' && nm('D6') === 'd6' && nm('A1') === 'e1' && nm('A6') === 'e6');
check('모르는 이름은 그대로, 빈 값은 -', nm('X9') === 'X9' && nm('') === '-' && nm(null) === '-');
check('모든 레벨 화면 이름이 서로 다름', new Set(L.ALL_LEVELS.map(nm)).size === L.ALL_LEVELS.length);

console.log('잠금은 예전 그대로 (L 한 줄)');
check('L23 앞 레벨은 L22, L22 다음은 L23', L.prevInTrack('L23') === 'L22' && L.nextInTrack('L22') === 'L23');
check('L23은 L22를 통과해야 열림', !L.isLevelUnlocked('L23', {}) && L.isLevelUnlocked('L23', { L22: true }));
check('L1은 늘 열림, D1은 앞이 없으니 열림', L.isLevelUnlocked('L1', {}) && L.isLevelUnlocked('D1', {}));
check('속 이름은 바뀌지 않음', L.LEVEL_ORDER[0] === 'L1' && L.BASIC_ORDER[0] === 'B1' && !!L.LEVEL_CONFIGS.L23);

console.log(fails ? `\n실패 ${fails}건` : '\n모두 통과');
process.exit(fails ? 1 : 0);
