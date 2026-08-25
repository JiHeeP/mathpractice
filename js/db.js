/* db.js — 데이터 계층 (반 단위 다중 교사 체계)
 *
 * Firestore 구조
 *   teachers/{uid}                     : { email, createdAt }
 *   classes/{code}                     : { teacherUid, name, createdAt, archived }
 *   classes/{code}/students/{번호}     : { number, name, pinHash }
 *   classes/{code}/results/{auto}      : 연습·도전 기록
 *   classes/{code}/logs/{auto}         : 접속 로그
 *
 * Firebase 설정이 없으면 localStorage 로컬 모드로 동작한다.
 * 로컬 모드에서는 로그인도 흉내만 내므로(uid 'local') 배포 전 개발·테스트 전용이다.
 */
const DB = (() => {
const CACHE_MS = 60 * 1000;
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
function cached(key, loader) {
  const hit = cache[key];
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);
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
      .map(([code, c]) => ({ code, name: c.name }));
  }
  const snap = await db.collection('classes').where('teacherUid', '==', me.uid).get();
  return snap.docs.filter(d => !d.data().archived).map(d => ({ code: d.id, name: d.data().name }));
}

async function createClass(name) {
  const me = auth.current();
  if (!me) throw new Error('로그인이 필요합니다.');
  for (let t = 0; t < 8; t++) {
    const code = randomCode();
    if (isLocal()) {
      const all = LS.get('classes', {});
      if (all[code]) continue;
      all[code] = { teacherUid: me.uid, name, createdAt: Date.now(), archived: false };
      LS.set('classes', all);
      LS.set(`cls.${code}.students`, []); LS.set(`cls.${code}.results`, []); LS.set(`cls.${code}.logs`, []);
      invalidate(); return { code, name };
    }
    const ref = db.collection('classes').doc(code);
    if ((await ref.get()).exists) continue;
    await ref.set({ teacherUid: me.uid, name, createdAt: Date.now(), archived: false });
    invalidate(); return { code, name };
  }
  throw new Error('반 코드를 만들지 못했습니다. 다시 시도해 주세요.');
}

async function renameClass(code, name) {
  if (isLocal()) { const all = LS.get('classes', {}); if (all[code]) { all[code].name = name; LS.set('classes', all); } }
  else await db.collection('classes').doc(code).update({ name });
  invalidate();
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
      return c && !c.archived ? { code, name: c.name, teacherUid: c.teacherUid } : null;
    }
    const doc = await db.collection('classes').doc(code).get();
    if (!doc.exists || doc.data().archived) return null;
    return { code, name: doc.data().name, teacherUid: doc.data().teacherUid };
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
async function loadResults(code) {
  return cached('results:' + code, async () => {
    if (isLocal()) return LS.get(`cls.${code}.results`, []);
    const snap = await db.collection('classes').doc(code).collection('results').orderBy('ts', 'desc').limit(3000).get();
    return snap.docs.map(d => d.data());
  });
}

async function saveResult(code, payload) {
  const outcome = Levels.buildScoreOutcome(payload);
  const row = Object.assign({}, payload, { score: outcome.recordedScore, ts: Date.now(), dateKey: dateKey(new Date()) });
  try {
    if (isLocal()) { const r = LS.get(`cls.${code}.results`, []); r.push(row); LS.set(`cls.${code}.results`, r); }
    else await db.collection('classes').doc(code).collection('results').add(row);
    invalidate();
  } catch (e) {
    console.warn('결과 저장 실패', e);
    return { displayScore: outcome.displayScore, scoreRecorded:false, message:'점수 저장에 실패했습니다.', isError:true };
  }
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

async function getBestScores(code, studentNo) {
  const rows = await loadResults(code);
  const best = {};
  rows.forEach(r => {
    if (String(r.studentNo) !== String(studentNo)) return;
    const s = scoreOf(r);
    if (s === null) return;
    if (!best[r.level] || s > best[r.level]) best[r.level] = s;
  });
  return best;
}

async function getHistory(code, studentNo) {
  const rows = await loadResults(code);
  return rows
    .filter(r => String(r.studentNo) === String(studentNo) && scoreOf(r) !== null)
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

async function getRanking(code, limit) {
  const [rows, students] = await Promise.all([loadResults(code), getStudents(code)]);
  const names = {};
  students.forEach(s => names[String(s.number)] = s.name);
  const best = {};
  rows.forEach(r => {
    const score = scoreOf(r);
    if (score === null) return;
    const no = String(r.studentNo);
    const e = { studentNo:no, name:names[no] || `학생 ${no}`, level:r.level, score, ts:r.ts };
    if (!best[no] || compareEntries(e, best[no]) < 0) best[no] = e;
  });
  const ranked = Object.values(best).sort(compareEntries)
    .map((it, i) => ({ rank:`${i + 1}등`, name:it.name, level:it.level, score:it.score }));
  return limit ? ranked.slice(0, limit) : ranked;
}

async function getComparison(code, date1Key, date2Key) {
  const [rows, students] = await Promise.all([loadResults(code), getStudents(code)]);
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
  listClasses, createClass, renameClass, archiveClass, getClass,
  getStudents, upsertStudent, deleteStudent, bulkImport,
  verifyStudentPin, logAccess,
  saveResult, getBestScores, getHistory, getRanking, getComparison, getAccessAlerts
};
})();
