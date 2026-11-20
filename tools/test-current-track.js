/* 학생 화면에 보이는 트랙 점검 — `node tools/test-current-track.js`
 * 지금 푸는 트랙 하나만 보인다 (a 기초 → b 분수·소수 기초 → c 분수의 곱셈 → d 소수의 곱셈 → e 도형의 넓이).
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'levels.js'), 'utf8'), ctx);
const L = ctx.window.Levels;
let fails = 0;
const check = (name, cond) => { console.log((cond ? '  ✔ ' : '  ✘ ') + name); if (!cond) fails++; };
const pass = (...lists) => { const p = {}; lists.flat().forEach(lv => { p[lv] = true; }); return p; };
const now = (start, passed) => { const t = L.currentTrack(start, passed); return t + ':' + L.nextInTrackFor(t, start, passed); };
const basicDone = { sub: '-', mul: '-', div: '-', g: '라' };   // 시작점으로 B1~B8 건너뜀 → B9·B10만 남음

console.log('기초가 남아 있으면 기초만');
check('기록 없음, 시작점 없음 → basic:B1', now(null, {}) === 'basic:B1');
check('분수 L36까지 끝냈어도 기초가 남으면 basic', L.currentTrack(null, pass(L.LEVEL_ORDER)) === 'basic');
check('시작점 "- B3 B6" → basic:B3', now({ sub: '-', mul: 'B3', div: 'B6', g: '나' }, {}) === 'basic:B3');
check('시작점으로 B1~B8 건너뛰어도 B9·B10은 거친다 → basic:B9', now(basicDone, {}) === 'basic:B9');

console.log('기초를 끝내면 분수·소수');
check('B9·B10 통과 → frac:L1', now(basicDone, pass('B9', 'B10')) === 'frac:L1');
check('기초 전부 + L1~L13 통과 → frac:L14', now(null, pass(L.BASIC_ORDER, L.LEVEL_ORDER.slice(0, L.LEVEL_ORDER.indexOf('L14')))) === 'frac:L14');

console.log('b를 끝내면 c(분수의 곱셈)');
const B_ALL = L.TRACKS.frac.levels;
check('기초 + L1~L22 → fmul:L23', now(null, pass(L.BASIC_ORDER, B_ALL)) === 'fmul:L23');
check('기초 + L1~L22 + L23~L27 → fmul:L28', now(null, pass(L.BASIC_ORDER, B_ALL, ['L23','L24','L25','L26','L27'])) === 'fmul:L28');
check('L22를 못 넘었으면 c가 아니라 b', L.currentTrack(null, pass(L.BASIC_ORDER, B_ALL.slice(0, -1))) === 'frac');

console.log('분수를 끝내면 소수의 곱셈, 그다음 도형의 넓이');
check('기초 + 분수 전부 → dmul:D1', now(null, pass(L.BASIC_ORDER, L.LEVEL_ORDER)) === 'dmul:D1');
check('기초 + 분수 + D1~D6 → area:A1', now(null, pass(L.BASIC_ORDER, L.LEVEL_ORDER, L.TRACKS.dmul.levels)) === 'area:A1');
check('다 끝냄 → null (전부 보임)', L.currentTrack(null, pass(L.BASIC_ORDER, L.LEVEL_ORDER, L.TRACKS.dmul.levels, L.TRACKS.area.levels)) === null);
check('트랙이 없으면 할 레벨도 null', L.nextInTrackFor(null, null, {}) === null);

console.log(fails ? `\n실패 ${fails}건` : '\n모두 통과');
process.exit(fails ? 1 : 0);
