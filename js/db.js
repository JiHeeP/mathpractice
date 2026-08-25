/* db.js — 데이터 계층
 * Firebase(Firestore)가 설정되어 있으면 Firestore를, 아니면 브라우저 localStorage를 쓴다.
 * (localStorage 모드는 배포 전 로컬 테스트용)
 */
const DB = (() => {
const COL = { students:'students', results:'results', logs:'accessLogs', config:'config' };
const CACHE_MS = 60 * 1000;

let db = null, mode = 'local';
let cache = { results:null, resultsAt:0, students:null, studentsAt:0 };

/* ═══ 초기화 ═══ */
function init() {
  const cfg = window.FIREBASE_CONFIG;
  const configured = cfg && cfg.projectId && !/YOUR_|xxxxx/i.test(JSON.stringify(cfg));
  if (!configured || typeof firebase === 'undefined') {
    mode = 'local';
    seedLocal();
    return mode;
  }
  try {
    firebase.initializeApp(cfg);
    db = firebase.firestore();
    mode = 'firestore';
  } catch (e) {
    console.warn('Firestore 초기화 실패 — 로컬 모드로 전환합니다.', e);
    mode = 'local';
    seedLocal();
  }
  return mode;
}
const isLocal = () => mode === 'local';
const invalidate = () => { cache.results = null; cache.students = null; };

/* ═══ localStorage 백업 저장소 ═══ */
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('mp.' + k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('mp.' + k, JSON.stringify(v)); } catch (e) {} }
};
function seedLocal() {
  if (!LS.get('students')) {
    LS.set('students', [
      { number:'1', name:'예시학생1', pin:'' },
      { number:'2', name:'예시학생2', pin:'' },
      { number:'3', name:'예시학생3', pin:'' }
    ]);
  }
  if (!LS.get('results')) LS.set('results', []);
}

/* ═══ PIN 해시 ═══ */
const SALT = 'mathpractice::v1::';
async function hashPin(pin) {
  const text = SALT + String(pin);
  if (!(window.crypto && crypto.subtle)) return 'plain:' + text;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ═══ 학생 ═══ */
async function getStudents() {
  if (cache.students && Date.now() - cache.studentsAt < CACHE_MS) return cache.students;
  let list;
  if (isLocal()) {
    list = LS.get('students', []);
  } else {
    const snap = await db.collection(COL.students).get();
    list = snap.docs.map(d => ({ number: String(d.data().number ?? d.id), name: d.data().name || '', pin: d.data().pin || '', pinHash: d.data().pinHash || '' }));
  }
  list.sort((a, b) => {
    const an = Number(a.number), bn = Number(b.number);
    if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn;
    return String(a.number).localeCompare(String(b.number));
  });
  cache.students = list; cache.studentsAt = Date.now();
  return list;
}

async function verifyStudentPin(studentNo, pin) {
  const s = (await getStudents()).find(x => String(x.number) === String(studentNo));
  if (!s) return { ok:false, message:'학생을 찾을 수 없습니다.' };
  const hasPin = !!(s.pinHash || s.pin);
  if (!hasPin) { logAccess(studentNo); return { ok:true, noPinSet:true }; }     // 아직 PIN 미설정
  const entered = String(pin || '').trim();
  // 생일 PIN(월일 4자리)의 앞자리 0을 빼고 입력해도 통과하도록 두 형태 모두 확인
  const candidates = [entered];
  if (/^\d{1,3}$/.test(entered)) candidates.push(entered.padStart(4, '0'));
  let ok = false;
  for (const cand of candidates) {
    if (s.pinHash ? (await hashPin(cand)) === s.pinHash : cand === String(s.pin).trim()) { ok = true; break; }
  }
  if (!ok) return { ok:false, message:'비밀번호가 틀렸어요. 다시 입력하세요.' };
  logAccess(studentNo);
  return { ok:true };
}

/* ═══ 접속 로그 ═══ */
function logAccess(studentNo) {
  const entry = { studentNo:String(studentNo), ts:Date.now(), sessionId:Math.random().toString(36).slice(2, 10) };
  if (isLocal()) { const l = LS.get('logs', []); l.push(entry); LS.set('logs', l.slice(-500)); return Promise.resolve(); }
  return db.collection(COL.logs).add(entry).catch(e => console.warn('접속 로그 실패', e));
}

/* ═══ 결과 ═══ */
async function loadResults() {
  if (cache.results && Date.now() - cache.resultsAt < CACHE_MS) return cache.results;
  let rows;
  if (isLocal()) rows = LS.get('results', []);
  else {
    const snap = await db.collection(COL.results).orderBy('ts', 'desc').limit(3000).get();
    rows = snap.docs.map(d => d.data());
  }
  cache.results = rows; cache.resultsAt = Date.now();
  return rows;
}

async function saveResult(payload) {
  const outcome = Levels.buildScoreOutcome(payload);
  const row = Object.assign({}, payload, {
    score: outcome.recordedScore,
    ts: Date.now(),
    dateKey: dateKey(new Date())
  });
  try {
    if (isLocal()) { const r = LS.get('results', []); r.push(row); LS.set('results', r); }
    else await db.collection(COL.results).add(row);
    invalidate();
  } catch (e) {
    console.warn('결과 저장 실패', e);
    return { displayScore: outcome.displayScore, scoreRecorded:false, message:'점수 저장에 실패했습니다.', isError:true };
  }
  return { displayScore: outcome.displayScore, scoreRecorded: outcome.scoreRecorded, message: outcome.message };
}

/* ═══ 조회 ═══ */
async function getBestScores(studentNo) {
  const rows = await loadResults();
  const best = {};
  rows.forEach(r => {
    if (String(r.studentNo) !== String(studentNo)) return;
    if (r.score === null || r.score === undefined) return;
    const s = Number(r.score);
    if (isNaN(s)) return;
    if (!best[r.level] || s > best[r.level]) best[r.level] = s;
  });
  return best;
}

async function getHistory(studentNo) {
  const rows = await loadResults();
  return rows
    .filter(r => String(r.studentNo) === String(studentNo) && r.score !== null && r.score !== undefined)
    .map(r => ({ ts:r.ts, label:fmtTime(r.ts), score:Number(r.score), level:r.level }))
    .sort((a, b) => a.ts - b.ts);
}

const levelWeight = lv => Levels.LEVEL_ORDER.indexOf(lv) + 1;
function compareEntries(a, b) {
  let d = b.score - a.score;              if (d) return d;
  d = levelWeight(b.level) - levelWeight(a.level); if (d) return d;
  d = a.ts - b.ts;                        if (d) return d;
  return String(a.studentNo).localeCompare(String(b.studentNo));
}

/** 학생별 최고 기록으로 랭킹 계산 */
async function getRanking(limit) {
  const [rows, students] = await Promise.all([loadResults(), getStudents()]);
  const names = {};
  students.forEach(s => names[String(s.number)] = s.name);
  const best = {};
  rows.forEach(r => {
    if (r.score === null || r.score === undefined) return;
    const score = Number(r.score);
    if (isNaN(score)) return;
    const no = String(r.studentNo);
    const e = { studentNo:no, name:names[no] || `학생 ${no}`, level:r.level, score, ts:r.ts };
    if (!best[no] || compareEntries(e, best[no]) < 0) best[no] = e;
  });
  const ranked = Object.values(best).sort(compareEntries);
  const out = ranked.map((it, i) => ({ rank:`${i + 1}등`, name:it.name, level:it.level, score:it.score }));
  return limit ? out.slice(0, limit) : out;
}

/** 두 날짜의 학생별 최고 점수 비교 */
async function getComparison(date1Key, date2Key) {
  const [rows, students] = await Promise.all([loadResults(), getStudents()]);
  const byStudent = {};
  rows.forEach(r => {
    if (r.score === null || r.score === undefined) return;
    const dk = r.dateKey || dateKey(new Date(r.ts));
    if (dk !== date1Key && dk !== date2Key) return;
    const no = String(r.studentNo);
    const e = { studentNo:no, level:r.level, score:Number(r.score), ts:r.ts };
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

/** 최근 24시간, 10분 안에 3회 이상 접속한 학생 */
async function getAccessAlerts() {
  let logs;
  if (isLocal()) logs = LS.get('logs', []);
  else {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const snap = await db.collection(COL.logs).where('ts', '>=', cutoff).get();
    logs = snap.docs.map(d => d.data());
  }
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const students = await getStudents();
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
          message:`${no}번 ${names[no] || ''} — 10분 내 3회 이상 접속 (${fmtTime(t[i])}경)` });
        break;
      }
    }
  });
  return alerts;
}

/* ═══ 교사 PIN ═══ */
async function verifyTeacherPin(pin) {
  const entered = String(pin || '').trim();
  if (!entered) return { ok:false, message:'PIN을 입력하세요.' };
  let stored = null;
  if (!isLocal()) {
    try {
      const doc = await db.collection(COL.config).doc('app').get();
      if (doc.exists) stored = doc.data();
    } catch (e) { /* 규칙상 읽기 불가면 기본 PIN 사용 */ }
  }
  const expectHash = stored && stored.teacherPinHash;
  const expectPlain = (stored && stored.teacherPin) || window.DEFAULT_TEACHER_PIN || '490800';
  const ok = expectHash ? (await hashPin(entered)) === expectHash : entered === String(expectPlain);
  return ok ? { ok:true } : { ok:false, message:'PIN이 올바르지 않습니다.' };
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
  getStudents, verifyStudentPin, logAccess,
  saveResult, getBestScores, getHistory, getRanking, getComparison, getAccessAlerts,
  verifyTeacherPin
};
})();
