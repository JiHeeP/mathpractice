/* db.js — 데이터 계층 (반 단위 다중 교사 체계)
 *
 * Firestore 구조
 *   teachers/{uid}                     : { email, createdAt }
 *   classes/{code}                     : { teacherUid, name, createdAt, archived, offDays[] }
 *                                         offDays = 반이 정한 '등교 안 하는 날' (YYYY-MM-DD 배열)
 *   classes/{code}/students/{번호}     : { number, name, pinHash }
 *   classes/{code}/results/{auto}      : 연습·도전 기록
 *   classes/{code}/best/{번호}         : 학생별 레벨 최고점 요약 { studentNo, best:{레벨:점수}, lastTs } — 랭킹용
 *   classes/{code}/logs/{auto}         : 접속 로그
 *
 * ⚠️ Firestore 무료 요금제는 하루 읽기 5만 건까지다. 반 전체 기록을 자주 읽으면 금방 바닥나고,
 *    그러면 모든 읽기가 실패해 학생 기록이 '초기화'된 것처럼 보인다.
 *    그래서 학생 화면은 자기 기록만, 랭킹은 best 요약(학생 수만큼)만 읽는다.
 *    반 전체 기록은 교사 화면에서만 읽는다.
 *
 * Firebase 설정이 없으면 localStorage 로컬 모드로 동작한다.
 * 로컬 모드에서는 로그인도 흉내만 내므로(uid 'local') 배포 전 개발·테스트 전용이다.
 */
const DB = (() => {
const CACHE_MS = 60 * 1000;
const MINE_CACHE_MS = 30 * 60 * 1000;   // 내 기록 — 저장할 때 캐시에 직접 덧붙이므로 길게
const RANK_CACHE_MS = 5 * 60 * 1000;    // 랭킹 — 친구 점수는 몇 분 늦게 보여도 된다
const ALL_CACHE_MS = 10 * 60 * 1000;    // 반 전체 기록 (교사 화면 · 랭킹 대체 경로)
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // 헷갈리는 O/I/L/0/1 제외

let db = null, fbAuth = null, mode = 'local';
let cache = {};   // key → {at, data}

/* ═══ 초기화 ═══ */
function init() {
  const cfg = window.FIREBASE_CONFIG;
  const configured = cfg && cfg.projectId && !/YOUR_|xxxxx/i.test(JSON.stringify(cfg));
  if (!configured || typeof firebase === 'undefined') { mode = 'local'; seedLocal(); return mode; }
  try {
    firebase.initializeApp(cfg);
    db = firebase.firestore();
    fbAuth = firebase.auth();
    mode = 'firestore';
  } catch (e) {
    console.warn('Firestore 초기화 실패 — 로컬 모드로 전환합니다.', e);
    mode = 'local'; seedLocal();
  }
  return mode;
}
const isLocal = () => mode === 'local';
const invalidate = () => { cache = {}; };
function cached(key, loader, ms = CACHE_MS) {
  const hit = cache[key];
  if (hit && Date.now() - hit.at < ms) return Promise.resolve(hit.data);
  return Promise.resolve(loader()).then(data => { cache[key] = { at: Date.now(), data }; return data; });
}

/* ═══ localStorage 저장소 ═══ */
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('mp.' + k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('mp.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('mp.' + k); } catch (e) {} }
};
function seedLocal() {
  if (!LS.get('classes')) {
    LS.set('classes', { LOCAL1: { teacherUid: 'local', name: '연습 반', createdAt: 0, archived: false } });
    LS.set('cls.LOCAL1.students', [
      { number:'1', name:'예시학생1', pinHash:'' },
      { number:'2', name:'예시학생2', pinHash:'' },
      { number:'3', name:'예시학생3', pinHash:'' }
    ]);
    LS.set('cls.LOCAL1.results', []);
    LS.set('cls.LOCAL1.logs', []);
  }
}

/* ═══ PIN 해시 ═══ */
const SALT = 'mathpractice::v1::';
async function hashPin(pin) {
  const text = SALT + String(pin);
  if (!(window.crypto && crypto.subtle)) return 'plain:' + text;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ═══ 교사 인증 ═══ */
function authErrMsg(e) {
  const c = e && e.code || '';
  if (c.includes('invalid-email')) return '이메일 형식이 올바르지 않습니다.';
  if (c.includes('email-already-in-use')) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (c.includes('weak-password')) return '비밀번호는 6자 이상이어야 합니다.';
  if (c.includes('user-not-found') || c.includes('wrong-password') || c.includes('invalid-credential'))
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (c.includes('too-many-requests')) return '시도가 너무 많았습니다. 잠시 후 다시 해주세요.';
  if (c.includes('network')) return '네트워크 오류입니다. 연결을 확인해 주세요.';
  return '요청을 처리하지 못했습니다. (' + c + ')';
}

const auth = {
  current() {
    if (isLocal()) return LS.get('auth', null);
    const u = fbAuth.currentUser;
    return u ? { uid: u.uid, email: u.email } : null;
  },
  /** 로그인 상태가 정해지면 resolve (새로고침 시 세션 복원 대기) */
  ready() {
    if (isLocal()) return Promise.resolve(auth.current());
    return new Promise(res => { const off = fbAuth.onAuthStateChanged(u => { off(); res(u ? { uid:u.uid, email:u.email } : null); }); });
  },
  async signUp(email, pw) {
    if (isLocal()) { const u = { uid:'local', email }; LS.set('auth', u); return u; }
    try {
      const r = await fbAuth.createUserWithEmailAndPassword(email, pw);
      await db.collection('teachers').doc(r.user.uid).set({ email, createdAt: Date.now() }, { merge: true });
      return { uid: r.user.uid, email };
    } catch (e) { throw new Error(authErrMsg(e)); }
  },
  async signIn(email, pw) {
    if (isLocal()) { const u = { uid:'local', email }; LS.set('auth', u); return u; }
    try { const r = await fbAuth.signInWithEmailAndPassword(email, pw); return { uid:r.user.uid, email }; }
    catch (e) { throw new Error(authErrMsg(e)); }
  },
  async resetPassword(email) {
    if (isLocal()) return;
    try { await fbAuth.sendPasswordResetEmail(email); }
    catch (e) { throw new Error(authErrMsg(e)); }
  },
  async signOut() {
    if (isLocal()) { LS.del('auth'); return; }
    await fbAuth.signOut();
  }
};

/* ═══ 반 관리 (교사) ═══ */
function randomCode() {
  let s = '';
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[arr[i] % CODE_ALPHABET.length];
  return s;
}

async function listClasses() {
  const me = auth.current();
  if (!me) return [];
  if (isLocal()) {
    const all = LS.get('classes', {});
    return Object.entries(all).filter(([, c]) => c.teacherUid === me.uid && !c.archived)
      .map(([code, c]) => ({ code, name: c.name, offDays: offDaysOf(c) }));
  }
  const snap = await db.collection('classes').where('teacherUid', '==', me.uid).get();
  return snap.docs.filter(d => !d.data().archived).map(d => ({ code: d.id, name: d.data().name, offDays: offDaysOf(d.data()) }));
}
function offDaysOf(data) { return Array.isArray(data && data.offDays) ? data.offDays.map(String) : []; }

async function createClass(name) {
  const me = auth.current();
  if (!me) throw new Error('로그인이 필요합니다.');
  for (let t = 0; t < 8; t++) {
    const code = randomCode();
    if (isLocal()) {
      const all = LS.get('classes', {});
      if (all[code]) continue;
      all[code] = { teacherUid: me.uid, name, createdAt: Date.now(), archived: false, offDays: [] };
      LS.set('classes', all);
      LS.set(`cls.${code}.students`, []); LS.set(`cls.${code}.results`, []); LS.set(`cls.${code}.logs`, []);
      invalidate(); return { code, name, offDays: [] };
    }
    const ref = db.collection('classes').doc(code);
    if ((await ref.get()).exists) continue;
    await ref.set({ teacherUid: me.uid, name, createdAt: Date.now(), archived: false, offDays: [] });
    invalidate(); return { code, name, offDays: [] };
  }
  throw new Error('반 코드를 만들지 못했습니다. 다시 시도해 주세요.');
}

async function renameClass(code, name) {
  if (isLocal()) { const all = LS.get('classes', {}); if (all[code]) { all[code].name = name; LS.set('classes', all); } }
  else await db.collection('classes').doc(code).update({ name });
  invalidate();
}

/** 반의 '등교 안 하는 날' 저장 — SchoolDay.normalizeOffDays 로 정리된 dateKey 배열 */
async function setOffDays(code, offDays) {
  const list = SchoolDay.normalizeOffDays(offDays);
  if (isLocal()) { const all = LS.get('classes', {}); if (all[code]) { all[code].offDays = list; LS.set('classes', all); } }
  else await db.collection('classes').doc(code).update({ offDays: list });
  invalidate();
  return list;
}

async function archiveClass(code) {
  if (isLocal()) { const all = LS.get('classes', {}); if (all[code]) { all[code].archived = true; LS.set('classes', all); } }
  else await db.collection('classes').doc(code).update({ archived: true });
  invalidate();
}

async function getClass(code) {
  if (!code) return null;
  return cached('class:' + code, async () => {
    if (isLocal()) {
      const c = (LS.get('classes', {}))[code];
      return c && !c.archived ? { code, name: c.name, teacherUid: c.teacherUid, offDays: offDaysOf(c) } : null;
    }
    const doc = await db.collection('classes').doc(code).get();
    if (!doc.exists || doc.data().archived) return null;
    return { code, name: doc.data().name, teacherUid: doc.data().teacherUid, offDays: offDaysOf(doc.data()) };
  });
}

/* ═══ 학생 명단 ═══ */
function sortStudents(list) {
  return list.sort((a, b) => {
    const an = Number(a.number), bn = Number(b.number);
    if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn;
    return String(a.number).localeCompare(String(b.number));
  });
}

async function getStudents(code) {
  return cached('students:' + code, async () => {
    let list;
    if (isLocal()) list = LS.get(`cls.${code}.students`, []);
    else {
      const snap = await db.collection('classes').doc(code).collection('students').get();
      list = snap.docs.map(d => ({ number: String(d.data().number ?? d.id), name: d.data().name || '', pinHash: d.data().pinHash || '' }));
    }
    return sortStudents(list.slice());
  });
}

/** 추가/수정 — pin을 주면 새로 해시, 빈 값이면 기존 PIN 유지 */
async function upsertStudent(code, { number, name, pin }) {
  number = String(number).trim(); name = String(name).trim();
  if (!number || !name) throw new Error('번호와 이름을 입력해 주세요.');
  const existing = (await getStudents(code)).find(s => s.number === number);
  const pinHash = (pin !== undefined && String(pin).trim() !== '')
    ? await hashPin(String(pin).trim())
    : (existing ? existing.pinHash : '');
  const docData = { number, name, pinHash };
  if (isLocal()) {
    const list = LS.get(`cls.${code}.students`, []).filter(s => s.number !== number);
    list.push(docData); LS.set(`cls.${code}.students`, list);
  } else {
    await db.collection('classes').doc(code).collection('students').doc(number).set(docData);
  }
  invalidate();
}

async function deleteStudent(code, number) {
  if (isLocal()) {
    LS.set(`cls.${code}.students`, LS.get(`cls.${code}.students`, []).filter(s => s.number !== String(number)));
  } else {
    await db.collection('classes').doc(code).collection('students').doc(String(number)).delete();
  }
  invalidate();
}

/** "번호 이름 PIN" 여러 줄 일괄 등록. PIN 생략 가능 */
async function bulkImport(code, text) {
  const rows = String(text).split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const p = l.split(/[\s,\t]+/);
    return { number: p[0], name: p[1] || '', pin: p[2] || '' };
  });
  const bad = rows.find(r => !r.number || !r.name);
  if (bad) throw new Error(`형식 오류: "${bad.number || ''} ${bad.name || ''}" — 각 줄은 "번호 이름 PIN(선택)" 입니다.`);
  for (const r of rows) await upsertStudent(code, r);
  return rows.length;
}

/* ═══ 학생 인증 · 접속 로그 ═══ */
async function verifyStudentPin(code, studentNo, pin) {
  const s = (await getStudents(code)).find(x => String(x.number) === String(studentNo));
  if (!s) return { ok:false, message:'학생을 찾을 수 없습니다.' };
  if (!s.pinHash) { logAccess(code, studentNo); return { ok:true, noPinSet:true }; }
  const entered = String(pin || '').trim();
  const candidates = [entered];
  if (/^\d{1,3}$/.test(entered)) candidates.push(entered.padStart(4, '0'));   // 생일 PIN 앞 0 생략 허용
  for (const cand of candidates) {
    if ((await hashPin(cand)) === s.pinHash) { logAccess(code, studentNo); return { ok:true }; }
  }
  return { ok:false, message:'비밀번호가 틀렸어요. 다시 입력하세요.' };
}

function logAccess(code, studentNo) {
  const entry = { studentNo:String(studentNo), ts:Date.now(), sessionId:Math.random().toString(36).slice(2, 10) };
  if (isLocal()) { const l = LS.get(`cls.${code}.logs`, []); l.push(entry); LS.set(`cls.${code}.logs`, l.slice(-500)); return Promise.resolve(); }
  return db.collection('classes').doc(code).collection('logs').add(entry).catch(e => console.warn('접속 로그 실패', e));
}

/* ═══ 기록 ═══ */
const resultsCol = code => db.collection('classes').doc(code).collection('results');
const bestCol = code => db.collection('classes').doc(code).collection('best');

/** 한 학생의 기록만 읽는다 (studentNo 단일 필드 조건이라 색인을 따로 만들 필요 없음) */
async function loadMyResults(code, studentNo) {
  const no = String(studentNo);
  return cached(`mine:${code}:${no}`, async () => {
    if (isLocal()) return LS.get(`cls.${code}.results`, []).filter(r => String(r.studentNo) === no);
    const snap = await resultsCol(code).where('studentNo', '==', no).get();
    return snap.docs.map(d => d.data());
  }, MINE_CACHE_MS);
}

/** 반 전체 기록 — 1000건씩 끝까지 나눠 읽는다 (예전의 3000건 상한 없음). 교사 화면 전용 */
async function loadAllResults(code) {
  return cached('results:' + code, async () => {
    if (isLocal()) return LS.get(`cls.${code}.results`, []);
    const all = [];
    let last = null;
    for (;;) {
      let q = resultsCol(code).orderBy('ts', 'desc').limit(1000);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      snap.docs.forEach(d => all.push(d.data()));
      if (snap.docs.length < 1000) break;
      last = snap.docs[snap.docs.length - 1];
    }
    return all;
  }, ALL_CACHE_MS);
}

async function saveResult(code, payload) {
  const outcome = Levels.buildScoreOutcome(payload);
  const row = Object.assign({}, payload, { score: outcome.recordedScore, ts: Date.now(), dateKey: dateKey(new Date()) });
  try {
    if (isLocal()) { const r = LS.get(`cls.${code}.results`, []); r.push(row); LS.set(`cls.${code}.results`, r); }
    else await resultsCol(code).add(row);
  } catch (e) {
    console.warn('결과 저장 실패', e);
    return { displayScore: outcome.displayScore, scoreRecorded:false, message:'점수 저장에 실패했습니다.', isError:true };
  }
  // 캐시를 통째로 비우면 다음 화면에서 기록을 전부 다시 읽게 되므로, 방금 저장한 한 줄만 덧붙인다.
  const mine = cache[`mine:${code}:${String(row.studentNo)}`];
  if (mine) mine.data = mine.data.concat([row]);
  const all = cache['results:' + code];
  if (all) all.data = [row].concat(all.data);
  if (mine) syncBest(code, row.studentNo, bestOf(mine.data), lastTsOf(mine.data));
  return { displayScore: outcome.displayScore, scoreRecorded: outcome.scoreRecorded, message: outcome.message };
}

/** 점수로 인정할 수 있는 기록인지 판정하고 점수를 돌려준다.
 *  도전인데 문제 수를 다 채우지 않은 기록(중도 포기)은 점수로 치지 않는다.
 *  — 예전에 '그만하기'로 저장돼 버린 가짜 만점 기록도 여기서 걸러진다.
 */
function scoreOf(r) {
  if (!r || r.score === null || r.score === undefined) return null;
  const s = Number(r.score);
  if (isNaN(s)) return null;
  const cfg = Levels.LEVEL_CONFIGS[r.level];
  if (r.mode === 'challenge' && cfg && typeof r.totalQuestions === 'number' && r.totalQuestions < cfg.chalQ) return null;
  return s;
}

/** 기록 목록 → { 레벨: 최고점 } */
function bestOf(rows) {
  const best = {};
  rows.forEach(r => {
    const s = scoreOf(r);
    if (s === null) return;
    if (!best[r.level] || s > best[r.level]) best[r.level] = s;
  });
  return Levels.applyBackfillPass(best);
}
function lastTsOf(rows) {
  return rows.reduce((m, r) => (scoreOf(r) !== null && r.ts > m ? r.ts : m), 0);
}

/* ── 랭킹용 최고점 요약 (classes/{code}/best/{번호}) ──
 * 학생이 자기 기록을 읽거나 점수를 저장할 때 갱신한다. 내용이 같으면 다시 쓰지 않는다.
 * 보안 규칙을 아직 배포하지 않아 쓰기가 막혀도 학생 화면에는 영향이 없다(랭킹만 대체 경로로). */
const syncedBest = {};
function syncBest(code, studentNo, best, lastTs) {
  if (isLocal()) return Promise.resolve();
  if (!Object.keys(best).length) return Promise.resolve();
  const no = String(studentNo), key = `${code}:${no}`;
  const sig = JSON.stringify(best);
  if (syncedBest[key] === sig) return Promise.resolve();
  syncedBest[key] = sig;
  return bestCol(code).doc(no).set({ studentNo: no, best, lastTs: lastTs || 0 })
    .then(() => { delete cache['rankbest:' + code]; })
    .catch(e => { delete syncedBest[key]; console.warn('최고점 요약 저장 실패', e); });
}

async function getBestScores(code, studentNo) {
  const rows = await loadMyResults(code, studentNo);
  const best = bestOf(rows);
  syncBest(code, studentNo, best, lastTsOf(rows));
  return best;
}

async function getHistory(code, studentNo) {
  const rows = await loadMyResults(code, studentNo);
  return rows
    .filter(r => scoreOf(r) !== null)
    .map(r => ({ ts:r.ts, label:fmtTime(r.ts), score:scoreOf(r), level:r.level }))
    .sort((a, b) => a.ts - b.ts);
}

const levelWeight = lv => Levels.LEVEL_ORDER.indexOf(lv) + 1;
function compareEntries(a, b) {
  let d = b.score - a.score;                        if (d) return d;
  d = levelWeight(b.level) - levelWeight(a.level);  if (d) return d;
  d = a.ts - b.ts;                                  if (d) return d;
  return String(a.studentNo).localeCompare(String(b.studentNo));
}

/** 반 전체 기록 → 학생별 { studentNo, best, lastTs } */
function summariesFromRows(rows) {
  const by = {};
  rows.forEach(r => {
    const score = scoreOf(r);
    if (score === null) return;
    const no = String(r.studentNo);
    const e = by[no] = by[no] || { studentNo:no, best:{}, lastTs:0 };
    if (!e.best[r.level] || score > e.best[r.level]) e.best[r.level] = score;
    if (r.ts > e.lastTs) e.lastTs = r.ts;
  });
  return Object.values(by).map(e => Object.assign(e, { best: Levels.applyBackfillPass(e.best) }));
}

async function loadBestSummaries(code) {
  return cached('rankbest:' + code, async () => {
    const snap = await bestCol(code).get();
    return snap.docs.map(d => ({ studentNo: String(d.data().studentNo || d.id), best: d.data().best || {}, lastTs: d.data().lastTs || 0 }));
  }, RANK_CACHE_MS);
}

/** 랭킹 — 학생마다 레벨별 최고 점수를 모두 더한 '합계 점수' 순.
 *  같은 L22 라도 먼저 푼 순서가 아니라 L1~Ln 최고점 합이 큰 학생이 위로 온다.
 *  합계가 같으면 더 높은 레벨까지 간 학생, 그다음은 마지막 기록이 이른 학생.
 *
 *  학생 화면은 best 요약(학생 수만큼 읽기)으로 만든다.
 *  교사 화면(opts.full)은 반 전체 기록으로 정확히 계산하고, 그 결과로 모든 학생의 요약을 채워 둔다.
 */
async function getRanking(code, limit, opts) {
  const full = !!(opts && opts.full);
  let sums;
  if (isLocal() || full) {
    sums = summariesFromRows(await loadAllResults(code));
    if (full) sums.forEach(e => syncBest(code, e.studentNo, e.best, e.lastTs));
  } else {
    // 요약을 못 읽어도(보안 규칙 배포 전 등) 반 전체 기록으로 대신하지 않는다 — 그게 읽기 한도를 바닥낸 원인이었다.
    try { sums = await loadBestSummaries(code); }
    catch (e) { console.warn('랭킹 요약을 읽지 못했습니다', e); sums = []; }
  }
  const students = await getStudents(code);
  const names = {};
  students.forEach(s => names[String(s.number)] = s.name);
  const entries = sums.map(e => {
    const levels = Object.keys(e.best).filter(lv => levelWeight(lv) > 0);
    if (!levels.length) return null;
    const total = levels.reduce((sum, lv) => sum + Number(e.best[lv]), 0);
    const top = levels.reduce((a, b) => (levelWeight(b) > levelWeight(a) ? b : a), levels[0]);
    return { studentNo:e.studentNo, name:names[e.studentNo] || `학생 ${e.studentNo}`, total:parseFloat(total.toFixed(1)), level:top, levels:levels.length, ts:e.lastTs };
  }).filter(Boolean);
  entries.sort((a, b) => {
    let d = b.total - a.total;                         if (d) return d;
    d = levelWeight(b.level) - levelWeight(a.level);   if (d) return d;
    d = a.ts - b.ts;                                   if (d) return d;
    return String(a.studentNo).localeCompare(String(b.studentNo));
  });
  const ranked = entries.map((it, i) => ({ rank:`${i + 1}등`, name:it.name, level:it.level, levels:it.levels, score:it.total }));
  return limit ? ranked.slice(0, limit) : ranked;
}

/** 두 날짜의 기록만 읽는다 (dateKey 단일 필드 'in' 조건) */
async function loadResultsOnDates(code, keys) {
  if (isLocal()) return LS.get(`cls.${code}.results`, []);
  const snap = await resultsCol(code).where('dateKey', 'in', keys).get();
  return snap.docs.map(d => d.data());
}

async function getComparison(code, date1Key, date2Key) {
  const keys = date1Key === date2Key ? [date1Key] : [date1Key, date2Key];
  const [rows, students] = await Promise.all([loadResultsOnDates(code, keys), getStudents(code)]);
  const byStudent = {};
  rows.forEach(r => {
    const sc = scoreOf(r);
    if (sc === null) return;
    const dk = r.dateKey || dateKey(new Date(r.ts));
    if (dk !== date1Key && dk !== date2Key) return;
    const no = String(r.studentNo);
    const e = { studentNo:no, level:r.level, score:sc, ts:r.ts };
    byStudent[no] = byStudent[no] || {};
    if (!byStudent[no][dk] || compareEntries(e, byStudent[no][dk]) < 0) byStudent[no][dk] = e;
  });
  return students.map(s => {
    const b = byStudent[String(s.number)] || {};
    const d1 = b[date1Key] || null, d2 = b[date2Key] || null;
    return {
      studentNo:s.number, name:s.name,
      score1: d1 ? d1.score : null, level1: d1 ? d1.level : '',
      score2: d2 ? d2.score : null, level2: d2 ? d2.level : '',
      diff: d1 && d2 ? parseFloat((d2.score - d1.score).toFixed(1)) : null
    };
  });
}

async function getAccessAlerts(code) {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  let logs;
  if (isLocal()) logs = LS.get(`cls.${code}.logs`, []);
  else {
    const snap = await db.collection('classes').doc(code).collection('logs').where('ts', '>=', cutoff).get();
    logs = snap.docs.map(d => d.data());
  }
  const students = await getStudents(code);
  const names = {};
  students.forEach(s => names[String(s.number)] = s.name);
  const byStudent = {};
  logs.forEach(l => {
    if (!l.ts || l.ts < cutoff) return;
    (byStudent[String(l.studentNo)] = byStudent[String(l.studentNo)] || []).push(l.ts);
  });
  const alerts = [];
  Object.keys(byStudent).forEach(no => {
    const t = byStudent[no].sort((a, b) => a - b);
    if (t.length < 3) return;
    for (let i = 0; i + 2 < t.length; i++) {
      if (t[i + 2] - t[i] < 10 * 60 * 1000) {
        alerts.push({ studentNo:no, name:names[no] || `학생 ${no}`, count:t.length,
          message:`${no}번 ${names[no] || ''} — 10분 내 3회 이상 접속 (${fmtTime(t[i]).slice(-5)}경)` });
        break;
      }
    }
  });
  return alerts;
}

/* ═══ 기록 초기화 (담당 교사 전용) ═══
 * 학생 명단은 그대로 두고 연습·도전 기록과 접속 로그만 지운다.
 * 되돌릴 수 없으므로 호출하는 쪽에서 반드시 확인을 받아야 한다.
 */
async function clearRecords(code, onProgress) {
  let removed = { results: 0, logs: 0, logsBlocked: false };
  Object.keys(syncedBest).forEach(k => { if (k.startsWith(code + ':')) delete syncedBest[k]; });
  if (isLocal()) {
    removed.results = LS.get(`cls.${code}.results`, []).length;
    removed.logs = LS.get(`cls.${code}.logs`, []).length;
    LS.set(`cls.${code}.results`, []);
    LS.set(`cls.${code}.logs`, []);
    invalidate();
    return removed;
  }
  for (const col of ['results', 'best', 'logs']) {
    try {
      for (;;) {
        const snap = await db.collection('classes').doc(code).collection(col).limit(300).get();
        if (!snap.docs.length) break;
        for (const d of snap.docs) {
          await db.collection('classes').doc(code).collection(col).doc(d.id).delete();
          if (col !== 'best') removed[col]++;
          if (onProgress) onProgress(removed);
        }
        if (snap.docs.length < 300) break;
      }
    } catch (e) {
      // 접속 로그 삭제를 막아 둔 예전 보안 규칙에서는 여기로 온다.
      // 점수와 무관하고 24시간 뒤 감시 대상에서 빠지므로 나머지는 계속 진행한다.
      // best(랭킹 요약)도 규칙 배포 전이면 막히는데, 학생이 다시 접속하면 새 기록으로 덮어쓴다.
      if (col === 'logs') removed.logsBlocked = true;
      else if (col === 'best') { /* 무시 */ }
      else throw e;
    }
  }
  invalidate();
  return removed;
}

/* ═══ 날짜 유틸 ═══ */
function pad(n) { return String(n).padStart(2, '0'); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

return {
  init, get mode() { return mode; }, isLocal, hashPin, dateKey, invalidate,
  auth,
  listClasses, createClass, renameClass, archiveClass, getClass, setOffDays,
  getStudents, upsertStudent, deleteStudent, bulkImport,
  verifyStudentPin, logAccess,
  saveResult, getBestScores, getHistory, getRanking, getComparison, getAccessAlerts, clearRecords
};
})();
