/* test-outbox.js — 기록 보관함 · 레벨 만점 검사 (node tools/test-outbox.js)
 * 가짜 Firestore 로 js/db.js 를 돌려, 서버가 기록을 거부했을 때 기록이 지워지지 않는지 본다. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

let ok = 0, fail = 0;
function check(name, cond) { if (cond) { ok++; console.log('  ✔ ' + name); } else { fail++; console.log('  ✘ ' + name); } }

function makeEnv(server) {
  const store = {};
  const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const docRef = id => ({
    id,
    set: row => server.set(id, row),
    get: () => server.get(id)
  });
  const col = { doc: id => docRef(id || 'auto' + Math.random().toString(36).slice(2, 8)), where: () => col, get: () => Promise.resolve({ docs: [] }) };
  const firestore = { collection: () => ({ doc: () => ({ collection: () => col }) }) };
  const ctx = {
    FIREBASE_CONFIG: { projectId: 'test-project' }, addEventListener() {}, localStorage, console: { log() {}, warn() {}, error() {} }, setTimeout, Promise, Date, Math, JSON, Object, Array, String, Number, Set,
    firebase: { initializeApp() {}, firestore: () => firestore, auth: () => ({}) },
    crypto: { subtle: {} }, TextEncoder
  };
  ctx.window = ctx.self = ctx;   // 브라우저처럼 window = 전역
  vm.createContext(ctx);
  for (const f of ['js/levels.js', 'js/schoolday.js', 'js/db.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8') + '\n;if (typeof DB !== "undefined") this.DB = DB;', ctx, { filename: f });
  }
  ctx.DB.init();
  return { DB: ctx.DB, Levels: ctx.Levels, outbox: () => JSON.parse(store['mp.outbox'] || '[]') };
}

const denied = () => Promise.reject({ code: 'permission-denied' });
const payload = { studentNo: '99', level: 'L1', mode: 'aborted', resultStatus: 'aborted', correct: 1, incorrect: 0, totalQuestions: 1, durationSec: 5, timeLimit: 240 };

(async () => {
  console.log('레벨 만점이 예전 계산식과 같음');
  {
    const { Levels } = makeEnv({ set: () => Promise.resolve(), get: () => Promise.resolve({ exists: true }) });
    const old = {};
    Levels.LEVEL_ORDER.filter(lv => lv !== 'L9-2').forEach((lv, i) => { old[lv] = 90 + i * 5; });
    old['L9-2'] = 133;
    check('37레벨 모두 같은 값', Levels.LEVEL_ORDER.every(lv => Levels.LEVEL_MAX[lv] === old[lv]));
    check('만점 목록과 레벨 목록(두 트랙)의 레벨이 같음', Object.keys(Levels.LEVEL_MAX).length === Levels.ALL_LEVELS.length
      && Levels.ALL_LEVELS.every(lv => Levels.LEVEL_MAX[lv] > 0));
    check('모든 만점 ≤ 300 (보안 규칙 상한)', Object.values(Levels.LEVEL_MAX).every(v => v <= 300));
  }

  console.log('정상 저장');
  {
    const env = makeEnv({ set: () => Promise.resolve(), get: () => Promise.resolve({ exists: true }) });
    const r = await env.DB.saveResult('TEST', payload);
    check('보관함이 비워짐', env.outbox().length === 0);
    check('오류 표시 없음', !r.isError);
  }

  console.log('같은 기록을 두 번 보냄 (서버에 이미 있음)');
  {
    const env = makeEnv({ set: denied, get: () => Promise.resolve({ exists: true }) });
    const r = await env.DB.saveResult('TEST', payload);
    check('이미 올라간 것으로 보고 보관함에서 지움', env.outbox().length === 0);
    check('오류 표시 없음', !r.isError);
  }

  console.log('보안 규칙이 기록을 거부함 (서버에 없음)');
  {
    const env = makeEnv({ set: denied, get: () => Promise.resolve({ exists: false }) });
    const r = await env.DB.saveResult('TEST', payload);
    const ob = env.outbox();
    check('기록이 보관함에 남아 있음', ob.length === 1 && ob[0].row.studentNo === '99');
    check('rejected 표시가 붙음', ob[0] && ob[0].rejected === true);
    check('학생 화면에 경고', r.isError === true && /저장되지 않았어요/.test(r.message));
    check('rejectedCount = 1', env.DB.rejectedCount() === 1);
    const n = await env.DB.flushOutbox();
    check('저장 직후 재전송에서는 거부된 기록을 다시 보내지 않음', n === 0 && env.outbox().length === 1);
  }

  console.log('거부된 기록 — 규칙을 고친 뒤 앱을 다시 열면 올라감');
  {
    let allow = false;
    const env = makeEnv({ set: () => allow ? Promise.resolve() : denied(), get: () => Promise.resolve({ exists: false }) });
    await env.DB.saveResult('TEST', payload);
    allow = true;
    const n = await env.DB.flushOutbox(true);
    check('앱 시작 재전송(includeRejected)으로 올라가고 보관함에서 지워짐', n === 1 && env.outbox().length === 0);
  }

  console.log('거부 원인 확인 중 인터넷이 끊김');
  {
    const env = makeEnv({ set: denied, get: () => Promise.reject({ code: 'unavailable' }) });
    await env.DB.saveResult('TEST', payload);
    const ob = env.outbox();
    check('보관함에 남고 rejected 표시는 없음 (다음에 다시 보냄)', ob.length === 1 && !ob[0].rejected);
  }

  console.log(fail ? `\n${fail}개 실패` : '\n모두 통과');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
