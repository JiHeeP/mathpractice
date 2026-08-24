/* app.js — 화면 전환 · 학생/레벨 선택 · 교사 대시보드 */
const App = (() => {
const L = window.Levels;

const state = {
  studentNo: null,
  studentName: '',
  level: null,
  bestScores: {},
  teacherPin: '',
  chart: null,
  students: []
};

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const SCREENS = ['studentSelection','studentPinScreen','levelSelection','modeSelection',
                 'practiceArea','teacherLogin','teacherDashboard','historyArea','rankingArea'];
function only(...ids) { SCREENS.forEach(hide); ids.forEach(show); }

/* ═══ 부팅 ═══ */
function boot() {
  DB.init();
  if (DB.isLocal()) $('localBanner').classList.remove('hidden');

  const params = new URLSearchParams(location.search);
  if (params.get('view') === 'teacher') { openTeacherLogin(); return; }

  DB.getStudents().then(list => {
    state.students = list;
    renderStudentButtons(list);
    const param = params.get('student');
    if (param) autoEnter(list, param);
  }).catch(err => {
    $('studentButtons').innerHTML =
      `<div class="col-span-full text-red-500 text-sm py-4">학생 명단을 불러오지 못했습니다.<br><span class="text-xs text-gray-400">${err.message || err}</span></div>`;
  });
}

function renderStudentButtons(list) {
  const wrap = $('studentButtons');
  wrap.innerHTML = '';
  if (!list.length) { wrap.innerHTML = '<div class="col-span-full text-gray-500 py-4">등록된 학생이 없습니다.</div>'; return; }
  list.forEach(s => {
    const b = document.createElement('button');
    b.className = 'p-2 bg-white border border-gray-200 rounded-lg text-sm font-bold hover:bg-orange-100 hover:border-orange-300 transition break-keep';
    b.textContent = `${s.number}. ${s.name}`;
    b.onclick = () => selectStudent(s.number, s.name, b);
    wrap.appendChild(b);
  });
}

/** 개인 링크(?student=번호)로 들어온 경우 */
function autoEnter(list, param) {
  const found = list.find(s => String(s.number) === String(param));
  if (!found) return;
  state.studentNo = found.number;
  state.studentName = found.name;
  $('gameTitle').textContent = `${found.name} 학생의 연산 마스터`;
  DB.verifyStudentPin(found.number, '').then(r => {
    if (r.ok) loadLevels(); else goToPin();
  });
}

function selectStudent(no, name, btn) {
  state.studentNo = no; state.studentName = name;
  document.querySelectorAll('#studentButtons button').forEach(b => b.classList.remove('ring-2','ring-orange-400','bg-orange-50'));
  btn.classList.add('ring-2','ring-orange-400','bg-orange-50');
  const go = $('goToPinBtn');
  go.disabled = false;
  go.classList.replace('bg-gray-300','bg-orange-500');
  $('gameTitle').textContent = `${name} 학생의 연산 마스터`;
}

/* ═══ 학생 PIN ═══ */
function goToPin() {
  only('studentPinScreen');
  $('studentPinTitle').textContent = `${state.studentName} 학생, 비밀번호를 입력하세요`;
  $('studentPinInput').value = '';
  $('studentPinMessage').textContent = '';
  $('studentPinInput').focus();
}

function submitStudentPin() {
  const pin = $('studentPinInput').value.trim();
  const msg = $('studentPinMessage'), btn = $('studentPinSubmitBtn');
  msg.textContent = '확인 중...'; msg.className = 'h-6 mt-3 text-sm font-bold text-gray-500';
  btn.disabled = true; btn.textContent = '확인 중...';
  DB.verifyStudentPin(state.studentNo, pin).then(r => {
    btn.disabled = false; btn.textContent = '확인';
    if (!r.ok) { msg.textContent = r.message || '인증 실패'; msg.className = 'h-6 mt-3 text-sm font-bold text-red-500'; return; }
    msg.textContent = '';
    loadLevels();
  }).catch(() => {
    btn.disabled = false; btn.textContent = '확인';
    msg.textContent = '인증 중 오류가 발생했습니다.'; msg.className = 'h-6 mt-3 text-sm font-bold text-red-500';
  });
}

function backToStudents() {
  state.studentNo = null; state.studentName = '';
  only('studentSelection');
  $('gameTitle').textContent = '수학 연산 마스터';
  const go = $('goToPinBtn');
  go.disabled = true; go.classList.replace('bg-orange-500','bg-gray-300');
}

/* ═══ 레벨 ═══ */
function loadLevels() {
  DB.getBestScores(state.studentNo)
    .then(s => { state.bestScores = s || {}; })
    .catch(() => { state.bestScores = {}; })
    .then(() => { renderLevelButtons(); only('levelSelection'); });
}

function renderLevelButtons() {
  const container = $('levelList');
  container.innerHTML = '';
  let group = '', groupDiv = null;

  L.LEVEL_ORDER.forEach(lv => {
    const cfg = L.LEVEL_CONFIGS[lv], t = cfg.theme;
    const max = L.LEVEL_MAX[lv], best = state.bestScores[lv] || 0;
    const unlocked = L.isLevelUnlocked(lv, state.bestScores);

    if (cfg.group !== group) {
      group = cfg.group;
      const section = document.createElement('div');
      section.innerHTML = `<h3 class="text-sm font-black text-gray-500 mb-2 px-1">${L.GROUP_LABELS[group]}</h3>`;
      groupDiv = document.createElement('div');
      groupDiv.className = 'flex flex-col gap-2';
      section.appendChild(groupDiv);
      container.appendChild(section);
    }

    const badge = best >= max
      ? '<span class="lv-badge bg-green-100 text-green-700">✅ 만점</span>'
      : best > 0 ? `<span class="lv-badge bg-yellow-100 text-yellow-700">최고 ${best}점</span>` : '';
    const lock = unlocked ? '' : '<span class="lv-badge bg-gray-200 text-gray-500">🔒 도전 잠김</span>';
    const kind = cfg.engine === 'choice' ? '⚡ 4지선다' : '📝 단계 풀이';

    const btn = document.createElement('button');
    btn.className = `w-full py-3 ${t.bg} border-2 ${t.border} rounded-2xl ${t.hbg} transition text-left px-4`;
    btn.onclick = () => selectLevel(lv);
    btn.innerHTML = `<span class="font-black ${t.lbl}">${lv}</span>
      <span class="${t.descCls} text-sm">${kind} ${cfg.label} (만점 ${max})</span>${badge}${lock}`;
    groupDiv.appendChild(btn);
  });
}

/* ═══ 모드 선택 ═══ */
function selectLevel(lv) {
  state.level = lv;
  const cfg = L.LEVEL_CONFIGS[lv];
  $('modeTitle').textContent = `${lv} — ${cfg.label}`;
  $('modeDesc').textContent = cfg.desc;

  const unlocked = L.isLevelUnlocked(lv, state.bestScores);
  const btn = $('challengeBtn'), title = $('challengeTitle'), info = $('challengeInfo');
  if (unlocked) {
    btn.disabled = false;
    btn.onclick = () => startPractice('challenge');
    btn.className = 'w-full py-5 bg-red-50 border-2 border-red-200 rounded-2xl hover:bg-red-100 hover:border-red-400 transition text-left px-5';
    title.textContent = '🔥 도전 연습';
    title.className = 'text-lg font-black text-red-800';
    info.textContent = `${cfg.chalQ}문제 · 제한시간 ${cfg.chalTime}초 · 점수 기록됨`;
    info.className = 'text-sm text-red-600 mt-1';
  } else {
    const prev = L.getPrevLevelInfo(lv, state.bestScores);
    btn.disabled = true;
    btn.onclick = null;
    btn.className = 'w-full py-5 bg-gray-100 border-2 border-gray-200 rounded-2xl text-left px-5 opacity-60 cursor-not-allowed';
    title.textContent = '🔒 도전 연습 (잠김)';
    title.className = 'text-lg font-black text-gray-400';
    info.textContent = `${prev.level} 만점(${prev.max}점)에 도달해야 열려요 — 현재 ${prev.best}점`;
    info.className = 'text-sm text-gray-400 mt-1';
  }

  only('modeSelection', 'historyArea', 'rankingArea');
  loadHistoryAndRanking();
}

function startPractice(mode) {
  const cfg = L.LEVEL_CONFIGS[state.level];
  only('practiceArea');
  const back = () => backToLevels();
  if (cfg.engine === 'choice')      Quiz.init(state.level, mode, cfg, back);
  else if (cfg.engine === 'frac')   StepFrac.init(state.level, mode, cfg, back);
  else                              StepInt.init(state.level, mode, cfg, back);
}

function backToLevels() {
  DB.invalidate();
  DB.getBestScores(state.studentNo)
    .then(s => { state.bestScores = s || {}; })
    .catch(() => {})
    .then(() => { renderLevelButtons(); only('levelSelection'); });
}

/* ═══ 성장 그래프 · 랭킹 ═══ */
function loadHistoryAndRanking() {
  $('chartLoading').classList.remove('hidden');
  Promise.all([DB.getHistory(state.studentNo), DB.getRanking(5)]).then(([hist, rank]) => {
    $('chartLoading').classList.add('hidden');
    renderDelta(hist);
    renderChart(hist);
    renderRanking('rankingTableBody', rank, '아직 랭킹이 없습니다.');
  }).catch(() => {
    $('chartLoading').classList.add('hidden');
    renderRanking('rankingTableBody', [], '랭킹을 불러오지 못했습니다.');
  });
}

function renderDelta(hist) {
  const box = $('deltaBox');
  if (hist.length < 2) { box.innerHTML = '<div class="text-center text-sm text-gray-400 mb-2">점수 기록이 쌓이면 변화를 보여드려요!</div>'; return; }
  const cur = hist[hist.length - 1].score, prev = hist[hist.length - 2].score, d = cur - prev;
  const cls = d > 0 ? 'text-red-500' : d < 0 ? 'text-blue-500' : 'text-gray-500';
  const icon = d > 0 ? '▲' : d < 0 ? '▼' : '−';
  box.innerHTML = `<div class="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm mb-2 border-l-4 border-orange-400">
    <div class="text-sm text-gray-500">지난 <b>${prev}</b></div>
    <div class="font-bold text-lg ${cls}">${icon} ${Math.abs(d).toFixed(1)}점</div>
    <div class="text-sm text-gray-800">최근 <b>${cur}</b></div></div>`;
}

function renderChart(hist) {
  if (typeof Chart === 'undefined') return;      // 차트 라이브러리를 못 불러온 경우
  const ctx = $('historyChart').getContext('2d');
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: 'line',
    data: { labels: hist.map(h => h.label),
            datasets: [{ label:'내 점수', data: hist.map(h => h.score),
                         borderColor:'#f97316', backgroundColor:'rgba(249,115,22,0.1)', fill:true, tension:0.3 }] },
    options: { responsive:true, maintainAspectRatio:false }
  });
}

function renderRanking(tbodyId, list, emptyMsg) {
  const tb = $(tbodyId);
  tb.innerHTML = '';
  if (!list.length) { tb.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">${emptyMsg}</td></tr>`; return; }
  list.forEach(it => {
    const medal = { '1등':'🥇', '2등':'🥈', '3등':'🥉' }[it.rank] || it.rank;
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-yellow-50';
    tr.innerHTML = `<td class="px-4 py-3 text-center font-bold text-gray-700">${medal}</td>
      <td class="px-4 py-3 font-medium text-gray-900">${it.name}</td>
      <td class="px-4 py-3 text-center"><span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">${it.level}</span></td>
      <td class="px-4 py-3 text-right font-bold text-orange-600">${it.score}</td>`;
    tb.appendChild(tr);
  });
}

/* ═══ 교사 대시보드 ═══ */
function openTeacherLogin() {
  only('teacherLogin');
  $('teacherPinInput').value = '';
  $('teacherLoginMessage').textContent = '';
}
function closeTeacherLogin() { backToStudents(); }
function closeTeacherDashboard() { state.teacherPin = ''; backToStudents(); }

function submitTeacherPin() {
  const pin = $('teacherPinInput').value.trim();
  const msg = $('teacherLoginMessage');
  msg.textContent = '확인 중...';
  DB.verifyTeacherPin(pin).then(r => {
    if (!r.ok) { msg.textContent = r.message || 'PIN 확인 실패'; return; }
    state.teacherPin = pin;
    msg.textContent = '';
    only('teacherDashboard');
    switchTeacherTab('ranking');
    initCompareDates();
    loadTeacherDashboard();
  }).catch(() => { msg.textContent = 'PIN 확인 중 오류가 발생했습니다.'; });
}

function switchTeacherTab(tab) {
  const tabs = ['ranking','comparison','alerts'];
  const active = 'px-4 py-2 rounded-xl bg-slate-700 text-white font-bold transition relative';
  const idle = 'px-4 py-2 rounded-xl bg-white text-slate-600 font-bold border border-slate-300 transition relative';
  tabs.forEach(t => {
    $(`panel-${t}`).classList.toggle('hidden', t !== tab);
    $(`tab-${t}`).className = t === tab ? active : idle;
  });
}

function initCompareDates() {
  const today = new Date(), yest = new Date(Date.now() - 86400000);
  $('compareDate2').value = DB.dateKey(today);
  $('compareDate1').value = DB.dateKey(yest);
  $('compareDate1').max = DB.dateKey(today);
  $('compareDate2').max = DB.dateKey(today);
  updateCompareHeaders();
}

function updateCompareHeaders() {
  const f = s => { if (!s) return '—'; const p = s.split('-'); return `${+p[1]}/${+p[2]}`; };
  $('compareHeader1').textContent = `${f($('compareDate1').value)} 최고`;
  $('compareHeader2').textContent = `${f($('compareDate2').value)} 최고`;
}

function loadTeacherDashboard(force) {
  const btn = $('teacherRefreshBtn');
  if (btn) { btn.disabled = true; btn.textContent = '갱신 중...'; }
  if (force) DB.invalidate();
  $('teacherRankingBody').innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">불러오는 중...</td></tr>';
  Promise.all([
    DB.getRanking(),
    DB.getComparison($('compareDate1').value, $('compareDate2').value),
    DB.getAccessAlerts()
  ]).then(([rank, comp, alerts]) => {
    renderRanking('teacherRankingBody', rank, '아직 랭킹이 없습니다.');
    renderComparison(comp);
    renderAlerts(alerts);
  }).catch(() => {
    $('teacherRankingBody').innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-red-500">불러오기 실패</td></tr>';
  }).then(() => { if (btn) { btn.disabled = false; btn.textContent = '새로고침'; } });
}

function loadComparison() {
  updateCompareHeaders();
  $('teacherComparisonBody').innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">불러오는 중...</td></tr>';
  DB.getComparison($('compareDate1').value, $('compareDate2').value)
    .then(renderComparison)
    .catch(() => { $('teacherComparisonBody').innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-red-500">불러오기 실패</td></tr>'; });
}

function renderComparison(list) {
  const tb = $('teacherComparisonBody');
  tb.innerHTML = '';
  if (!list.length) { tb.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">비교할 기록이 없습니다.</td></tr>'; return; }
  list.forEach(it => {
    const dc = it.diff === null ? 'text-gray-400' : it.diff > 0 ? 'text-emerald-600' : it.diff < 0 ? 'text-rose-600' : 'text-slate-600';
    const cell = (s, lv) => s === null ? '<span class="text-gray-400">-</span>'
      : `<div class="font-bold text-slate-800">${s}</div><div class="text-xs text-slate-500">${lv}</div>`;
    const diff = it.diff === null ? '-' : it.diff > 0 ? `+${it.diff}` : `${it.diff}`;
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-slate-50';
    tr.innerHTML = `<td class="px-4 py-3 text-center font-bold text-slate-700">${it.studentNo}</td>
      <td class="px-4 py-3 font-medium text-gray-900">${it.name}</td>
      <td class="px-4 py-3 text-right">${cell(it.score1, it.level1)}</td>
      <td class="px-4 py-3 text-right">${cell(it.score2, it.level2)}</td>
      <td class="px-4 py-3 text-right font-bold ${dc}">${diff}</td>`;
    tb.appendChild(tr);
  });
}

function renderAlerts(alerts) {
  const wrap = $('alertsContent'), badge = $('alertBadge');
  if (!alerts.length) {
    badge.classList.add('hidden');
    wrap.innerHTML = `<div class="text-center py-6"><div class="text-3xl mb-2">✅</div>
      <div class="text-sm font-bold text-green-600">이상 접속이 감지되지 않았습니다.</div>
      <div class="text-xs text-gray-400 mt-1">최근 24시간 기준</div></div>`;
    return;
  }
  badge.textContent = alerts.length;
  badge.classList.remove('hidden');
  wrap.innerHTML = alerts.map(a => `
    <div class="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
      <div class="text-red-500 text-xl mt-0.5">⚠️</div>
      <div><div class="font-bold text-red-800">${a.message}</div>
      <div class="text-xs text-red-500 mt-1">최근 24시간 내 총 ${a.count}회 접속</div></div>
    </div>`).join('');
}

return {
  boot,
  get studentNo() { return state.studentNo; },
  get studentName() { return state.studentName; },
  goToPin, submitStudentPin, backToStudents,
  selectLevel, startPractice, backToLevels,
  openTeacherLogin, closeTeacherLogin, closeTeacherDashboard, submitTeacherPin,
  switchTeacherTab, loadTeacherDashboard, loadComparison, updateCompareHeaders
};
})();

document.addEventListener('DOMContentLoaded', App.boot);
