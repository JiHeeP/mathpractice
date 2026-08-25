/* teacher.js — 교사 화면 (로그인 · 반 목록 · 학생 관리 · 대시보드 · 접속 카드) */
const Teacher = (() => {
const $ = id => document.getElementById(id);
let authMode = 'signin';          // 'signin' | 'signup'
let currentClass = null;          // { code, name }
let currentTab = 'students';

/* ═══ 라우팅 ═══ */
function autoRoute() {
  DB.auth.ready().then(u => { u ? showHome() : showLogin(); });
}
function showLogin() {
  const u = DB.auth.current();
  if (u) { showHome(); return; }
  App.only('teacherLogin');
  $('tAuthMessage').textContent = '';
  $('tEmail').focus();
}
function exitToStudent() {
  history.replaceState(null, '', location.pathname);
  App.showClassEntry();
}

/* ═══ 로그인/가입 ═══ */
function toggleMode() {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  $('tAuthTitle').textContent = authMode === 'signin' ? '교사 로그인' : '교사 가입';
  $('tAuthBtn').textContent = authMode === 'signin' ? '로그인' : '가입하기';
  $('tAuthToggle').textContent = authMode === 'signin' ? '처음이신가요? 가입하기' : '계정이 있어요. 로그인하기';
  $('tAuthMessage').textContent = '';
}

function submitAuth() {
  const email = $('tEmail').value.trim(), pw = $('tPassword').value;
  const msg = $('tAuthMessage');
  if (!email || !pw) { msg.textContent = '이메일과 비밀번호를 입력해 주세요.'; return; }
  msg.className = 'min-h-6 mt-3 text-sm font-bold text-gray-500';
  msg.textContent = authMode === 'signin' ? '로그인 중...' : '가입 중...';
  const p = authMode === 'signin' ? DB.auth.signIn(email, pw) : DB.auth.signUp(email, pw);
  p.then(() => { msg.textContent = ''; showHome(); })
   .catch(e => { msg.className = 'min-h-6 mt-3 text-sm font-bold text-red-500'; msg.textContent = e.message; });
}

function resetPassword() {
  const email = $('tEmail').value.trim();
  const msg = $('tAuthMessage');
  if (!email) { msg.textContent = '위 칸에 이메일을 먼저 입력해 주세요.'; return; }
  DB.auth.resetPassword(email)
    .then(() => { msg.className = 'min-h-6 mt-3 text-sm font-bold text-emerald-600'; msg.textContent = '재설정 메일을 보냈습니다. 메일함을 확인해 주세요.'; })
    .catch(e => { msg.className = 'min-h-6 mt-3 text-sm font-bold text-red-500'; msg.textContent = e.message; });
}

function logout() {
  DB.auth.signOut().then(() => { currentClass = null; showLogin(); });
}

/* ═══ 교사 홈 (반 목록) ═══ */
function showHome() {
  App.only('teacherHome');
  const u = DB.auth.current();
  $('tHomeEmail').textContent = u ? u.email : '';
  $('tHomeMessage').textContent = '';
  const wrap = $('tClassList');
  wrap.innerHTML = '<div class="text-center text-gray-500 py-4">불러오는 중...</div>';
  DB.listClasses().then(list => {
    wrap.innerHTML = '';
    if (!list.length) {
      wrap.innerHTML = '<div class="text-center text-gray-400 py-4 text-sm">아직 반이 없어요. 아래에서 첫 반을 만들어 보세요!</div>';
      return;
    }
    list.forEach(c => {
      const b = document.createElement('button');
      b.className = 'w-full flex items-center justify-between px-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl hover:bg-slate-50 hover:border-slate-400 transition text-left';
      b.innerHTML = `<span class="font-black text-slate-800">${esc(c.name)}</span>
        <span class="text-xs font-mono tracking-widest text-slate-400">${c.code}</span>`;
      b.onclick = () => openClass(c);
      wrap.appendChild(b);
    });
  }).catch(e => { wrap.innerHTML = `<div class="text-center text-red-500 py-4 text-sm">반 목록을 불러오지 못했습니다.<br>${esc(e.message || '')}</div>`; });
}

function createClass() {
  const name = $('tNewClassName').value.trim();
  const msg = $('tHomeMessage');
  if (!name) { msg.textContent = '반 이름을 입력해 주세요.'; return; }
  msg.className = 'min-h-5 mt-2 text-sm font-bold text-gray-500'; msg.textContent = '만드는 중...';
  DB.createClass(name).then(c => {
    $('tNewClassName').value = '';
    msg.textContent = '';
    openClass(c);
  }).catch(e => { msg.className = 'min-h-5 mt-2 text-sm font-bold text-red-500'; msg.textContent = e.message; });
}

/* ═══ 반 화면 ═══ */
function openClass(c) {
  currentClass = c;
  App.only('teacherClass');
  $('tClassName').textContent = c.name;
  $('tClassCode').textContent = c.code;
  $('tCopyMsg').textContent = '';
  switchTab('students');
}
function backHome() { currentClass = null; showHome(); }

function studentLink(no) {
  const base = location.origin + location.pathname;
  return `${base}?class=${currentClass.code}${no ? '&student=' + encodeURIComponent(no) : ''}`;
}

function copyLink() {
  const url = studentLink('');
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
    .then(() => { $('tCopyMsg').textContent = '✅ 링크가 복사되었습니다 — 학급 게시판·메신저에 붙여넣어 공유하세요'; setTimeout(() => $('tCopyMsg').textContent = '', 3000); })
    .catch(() => { prompt('아래 주소를 복사하세요', url); });
}

function switchTab(tab) {
  currentTab = tab;
  ['students','ranking','comparison','alerts','cards'].forEach(t => {
    $(`tpanel-${t}`).classList.toggle('hidden', t !== tab);
    $(`ttab-${t}`).classList.toggle('ttab-on', t === tab);
  });
  if (tab === 'students') loadStudents();
  if (tab === 'ranking') loadRanking();
  if (tab === 'comparison') { initCompareDates(); loadComparison(); }
  if (tab === 'alerts') loadAlerts();
}

/* ═══ 학생 관리 ═══ */
function loadStudents() {
  const tb = $('tStudentRows');
  tb.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">불러오는 중...</td></tr>';
  DB.getStudents(currentClass.code).then(list => {
    tb.innerHTML = '';
    if (!list.length) { tb.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-gray-400">아직 학생이 없어요. 아래에서 추가하세요.</td></tr>'; return; }
    list.forEach(s => {
      const tr = document.createElement('tr');
      tr.className = 'border-b hover:bg-slate-50';
      tr.innerHTML = `<td class="px-3 py-2.5 text-center font-bold text-slate-700">${esc(s.number)}</td>
        <td class="px-3 py-2.5 font-medium text-gray-900">${esc(s.name)}</td>
        <td class="px-3 py-2.5 text-center">${s.pinHash
          ? '<span class="text-xs font-bold text-emerald-600">설정됨</span>'
          : '<span class="text-xs text-gray-400">없음</span>'}</td>
        <td class="px-3 py-2.5 text-right whitespace-nowrap">
          <button class="text-xs px-2.5 py-1.5 bg-slate-100 rounded-lg font-bold text-slate-600 hover:bg-slate-200" data-act="edit">수정</button>
          <button class="text-xs px-2.5 py-1.5 bg-red-50 rounded-lg font-bold text-red-500 hover:bg-red-100 ml-1" data-act="del">삭제</button>
        </td>`;
      tr.querySelector('[data-act=edit]').onclick = () => { $('tStuNo').value = s.number; $('tStuName').value = s.name; $('tStuPin').value = ''; $('tStuPin').focus(); };
      tr.querySelector('[data-act=del]').onclick = () => removeStudent(s);
      tb.appendChild(tr);
    });
  }).catch(e => { tb.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-red-500">불러오기 실패: ${esc(e.message || '')}</td></tr>`; });
}

function note(id, text, good) {
  const el = $(id);
  el.className = `min-h-6 mt-3 text-sm font-bold ${good ? 'text-emerald-600' : 'text-red-500'}`;
  el.textContent = text;
  if (good) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 2500);
}

function saveStudent() {
  const number = $('tStuNo').value.trim(), name = $('tStuName').value.trim(), pin = $('tStuPin').value.trim();
  DB.upsertStudent(currentClass.code, { number, name, pin })
    .then(() => { $('tStuNo').value = ''; $('tStuName').value = ''; $('tStuPin').value = '';
                  note('tStudentsMessage', '저장했습니다.', true); loadStudents(); })
    .catch(e => note('tStudentsMessage', e.message));
}

function removeStudent(s) {
  if (!confirm(`${s.number}번 ${s.name} 학생을 명단에서 삭제할까요?\n(기록은 남지만 더 이상 접속할 수 없습니다)`)) return;
  DB.deleteStudent(currentClass.code, s.number)
    .then(() => { note('tStudentsMessage', '삭제했습니다.', true); loadStudents(); })
    .catch(e => note('tStudentsMessage', e.message));
}

function bulkImport() {
  const text = $('tBulkText').value;
  if (!text.trim()) { note('tStudentsMessage', '붙여넣을 명단이 비어 있습니다.'); return; }
  note('tStudentsMessage', '등록 중...', true);
  DB.bulkImport(currentClass.code, text)
    .then(n => { $('tBulkText').value = ''; note('tStudentsMessage', `${n}명을 등록했습니다.`, true); loadStudents(); })
    .catch(e => note('tStudentsMessage', e.message));
}

/** 기록 전체 삭제 — 반 이름을 직접 입력해야 실행된다 */
function clearRecords() {
  const btn = $('tClearBtn'), msg = $('tClearMessage');
  if (!confirm(`[${currentClass.name}] 의 모든 연습 기록과 점수를 삭제합니다.\n\n` +
               '· 학생 명단은 남습니다\n· 랭킹과 성장 그래프가 비워집니다\n· 모든 레벨이 다시 잠깁니다\n\n되돌릴 수 없습니다. 계속할까요?')) return;
  const typed = prompt(`확인을 위해 반 이름을 그대로 입력하세요:\n\n${currentClass.name}`);
  if (typed === null) return;
  if (typed.trim() !== currentClass.name) { note('tClearMessage', '반 이름이 일치하지 않아 취소했습니다.'); return; }

  btn.disabled = true;
  msg.className = 'min-h-6 mt-2 text-sm font-bold text-red-700';
  msg.textContent = '삭제 중...';
  DB.clearRecords(currentClass.code, p => { msg.textContent = `삭제 중... 기록 ${p.results}건 · 로그 ${p.logs}건`; })
    .then(r => {
      btn.disabled = false;
      const tail = r.logsBlocked
        ? ' (접속 로그는 보안 규칙에서 삭제가 막혀 있어 남아 있습니다 — 점수와는 무관합니다)'
        : `, 접속 로그 ${r.logs}건`;
      note('tClearMessage', `삭제 완료 — 연습 기록 ${r.results}건${tail}`, true);
      loadStudents();
    })
    .catch(e => { btn.disabled = false; note('tClearMessage', '삭제 실패: ' + (e.message || '')); });
}

/* ═══ 대시보드 ═══ */
function loadRanking() {
  DB.getRanking(currentClass.code)
    .then(list => App.renderRankingTable('tRankingBody', list, '아직 기록이 없습니다.'))
    .catch(() => App.renderRankingTable('tRankingBody', [], '불러오기 실패'));
}

function initCompareDates() {
  const today = new Date(), yest = new Date(Date.now() - 86400000);
  if (!$('compareDate2').value) $('compareDate2').value = DB.dateKey(today);
  if (!$('compareDate1').value) $('compareDate1').value = DB.dateKey(yest);
  $('compareDate1').max = DB.dateKey(today);
  $('compareDate2').max = DB.dateKey(today);
  updateCompareHeaders();
}

function updateCompareHeaders() {
  const f = s => { if (!s) return '—'; const p = s.split('-'); return `${+p[1]}/${+p[2]}`; };
  $('compareHeader1').textContent = `${f($('compareDate1').value)} 최고`;
  $('compareHeader2').textContent = `${f($('compareDate2').value)} 최고`;
}

function loadComparison() {
  updateCompareHeaders();
  const tb = $('tComparisonBody');
  tb.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">불러오는 중...</td></tr>';
  DB.getComparison(currentClass.code, $('compareDate1').value, $('compareDate2').value).then(list => {
    tb.innerHTML = '';
    if (!list.length) { tb.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-gray-500">비교할 기록이 없습니다.</td></tr>'; return; }
    list.forEach(it => {
      const dc = it.diff === null ? 'text-gray-400' : it.diff > 0 ? 'text-emerald-600' : it.diff < 0 ? 'text-rose-600' : 'text-slate-600';
      const cell = (s, lv) => s === null ? '<span class="text-gray-400">-</span>'
        : `<div class="font-bold text-slate-800">${s}</div><div class="text-xs text-slate-500">${lv}</div>`;
      const diff = it.diff === null ? '-' : it.diff > 0 ? `+${it.diff}` : `${it.diff}`;
      const tr = document.createElement('tr');
      tr.className = 'border-b hover:bg-slate-50';
      tr.innerHTML = `<td class="px-4 py-3 text-center font-bold text-slate-700">${esc(it.studentNo)}</td>
        <td class="px-4 py-3 font-medium text-gray-900">${esc(it.name)}</td>
        <td class="px-4 py-3 text-right">${cell(it.score1, it.level1)}</td>
        <td class="px-4 py-3 text-right">${cell(it.score2, it.level2)}</td>
        <td class="px-4 py-3 text-right font-bold ${dc}">${diff}</td>`;
      tb.appendChild(tr);
    });
  }).catch(() => { tb.innerHTML = '<tr><td colspan="5" class="px-4 py-4 text-center text-red-500">불러오기 실패</td></tr>'; });
}

function loadAlerts() {
  const wrap = $('alertsContent'), badge = $('alertBadge');
  wrap.innerHTML = '<div class="text-center text-sm text-gray-500 py-4">불러오는 중...</div>';
  DB.getAccessAlerts(currentClass.code).then(alerts => {
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
        <div><div class="font-bold text-red-800">${esc(a.message)}</div>
        <div class="text-xs text-red-500 mt-1">최근 24시간 내 총 ${a.count}회 접속</div></div>
      </div>`).join('');
  }).catch(() => { wrap.innerHTML = '<div class="text-center text-red-500 py-4 text-sm">불러오기 실패</div>'; });
}

/* ═══ 접속 카드 인쇄 ═══ */
function qrDataURL(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createDataURL(6, 2);
}

function printCards() {
  $('tCardsMessage').textContent = '';
  DB.getStudents(currentClass.code).then(list => {
    if (!list.length) { $('tCardsMessage').textContent = '학생이 없습니다. 먼저 명단을 등록해 주세요.'; return; }
    const cards = list.map(s => `
      <div class="card">
        <div class="head"><span class="no">${esc(s.number)}번</span><span class="name">${esc(s.name)}</span></div>
        <img class="qr" src="${qrDataURL(studentLink(s.number))}" alt="QR"/>
        <div class="url">${location.host}${location.pathname}<br/>반 코드 <b>${currentClass.code}</b> · 내 번호 <b>${esc(s.number)}</b></div>
        <div class="pin">${s.pinHash ? '비밀번호는 선생님이 알려주신 것' : '비밀번호 없음'}</div>
      </div>`).join('');
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"/>
<title>${esc(currentClass.name)} — 접속 카드</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#1f2937;padding:10mm;background:#fff}
h1{font-size:14pt;margin-bottom:2mm}.note{font-size:9pt;color:#6b7280;margin-bottom:5mm}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.card{border:1.5px dashed #d1d5db;border-radius:3mm;padding:4mm;text-align:center;break-inside:avoid}
.head{display:flex;justify-content:center;align-items:baseline;gap:2mm;margin-bottom:2mm}
.no{font-size:9pt;color:#9a3412;font-weight:700}.name{font-size:13pt;font-weight:800}
.qr{width:30mm;height:30mm}.url{font-size:8pt;color:#6b7280;line-height:1.5;margin:1.5mm 0}
.pin{font-size:9pt;color:#374151}
.toolbar{margin-bottom:5mm}.toolbar button{padding:3mm 6mm;font-size:11pt;font-weight:700;border:none;border-radius:2mm;background:#6366f1;color:#fff;cursor:pointer}
@media print{.toolbar{display:none}body{padding:6mm}}
</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨️ 인쇄</button></div>
<h1>${esc(currentClass.name)} — 접속 카드</h1>
<p class="note">잘라서 한 장씩 나눠 주세요. QR을 찍으면 자기 이름 화면으로 바로 들어갑니다.</p>
<div class="grid">${cards}</div>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) { $('tCardsMessage').textContent = '팝업이 차단되었습니다. 이 사이트의 팝업을 허용해 주세요.'; return; }
    w.document.write(html);
    w.document.close();
  }).catch(e => { $('tCardsMessage').textContent = '명단을 불러오지 못했습니다: ' + (e.message || ''); });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

return {
  autoRoute, showLogin, exitToStudent, toggleMode, submitAuth, resetPassword, logout,
  createClass, backHome, copyLink, switchTab,
  saveStudent, bulkImport, clearRecords, loadComparison, updateCompareHeaders, printCards
};
})();
