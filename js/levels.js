/* levels.js — 레벨 정의 · 잠금 규칙 · 점수 계산 */

const LEVEL_ORDER = ['L1','L2','L3','L4','L5','L6','L7','L8','L9','L10','L11','L12','L13','L14','L15'];

/** 레벨별 만점 (이전 레벨 만점 도달 시 다음 레벨 도전 해금) */
const LEVEL_MAX = {
  L1:90, L2:95, L3:100, L4:105, L5:110, L6:115, L7:120, L8:125,
  L9:130, L10:135, L11:140, L12:145, L13:150, L14:155, L15:160
};

/** 점수가 기록되지 않는 연습 모드 */
const PRACTICE_MODES = ['free', 'step_free', 'free_choice'];

const GROUP_LABELS = {
  int:    '✖️➗ 정수 곱셈·나눗셈',
  same:   '🍕 분모가 같은 분수',
  diff:   '🔗 분모가 다른 분수 (통분)',
  muldiv: '⚡ 분수의 곱셈·나눗셈',
  mixed:  '🎯 대분수'
};

/**
 * engine: 'int-mult' | 'int-div' | 'frac' | 'choice'
 * op    : frac 엔진의 연산 종류
 * chalQ / chalTime : 도전 모드 문제 수 / 제한시간(초)
 */
const LEVEL_CONFIGS = {
  L1:  { group:'int',    engine:'int-mult', type:'2x1',       chalQ:15, chalTime:450,
         label:'두자리수 × 한자리수',  desc:'세로셈 — 일의 자리 올림을 한 단계씩',
         theme:{bg:'bg-amber-50',  border:'border-amber-200',  hbg:'hover:bg-amber-100',  lbl:'text-amber-800',  descCls:'text-amber-600'} },
  L2:  { group:'int',    engine:'int-div',  type:'2d1',       chalQ:10, chalTime:390,
         label:'두자리수 ÷ 한자리수',  desc:'세로셈 — 나눗셈 과정을 한 단계씩',
         theme:{bg:'bg-amber-50',  border:'border-amber-300',  hbg:'hover:bg-amber-100',  lbl:'text-amber-900',  descCls:'text-amber-700'} },
  L3:  { group:'int',    engine:'choice',   type:'int-mixed', chalQ:20, chalTime:230,
         label:'정수 곱셈·나눗셈 종합', desc:'4지선다로 빠르게 풀기',
         theme:{bg:'bg-orange-50', border:'border-orange-200', hbg:'hover:bg-orange-100', lbl:'text-orange-800', descCls:'text-orange-600'} },

  L4:  { group:'same',   engine:'frac',     op:'same-add',    chalQ:12, chalTime:330,
         label:'분모가 같은 분수의 덧셈', desc:'분자끼리 더하고 약분하기',
         theme:{bg:'bg-green-50',  border:'border-green-200',  hbg:'hover:bg-green-100',  lbl:'text-green-800',  descCls:'text-green-600'} },
  L5:  { group:'same',   engine:'frac',     op:'same-sub',    chalQ:12, chalTime:330,
         label:'분모가 같은 분수의 뺄셈', desc:'분자끼리 빼고 약분하기',
         theme:{bg:'bg-green-50',  border:'border-green-300',  hbg:'hover:bg-green-100',  lbl:'text-green-900',  descCls:'text-green-700'} },
  L6:  { group:'same',   engine:'choice',   type:'same-mixed',chalQ:20, chalTime:270,
         label:'분모가 같은 분수 종합',   desc:'4지선다로 빠르게 풀기',
         theme:{bg:'bg-emerald-50',border:'border-emerald-200',hbg:'hover:bg-emerald-100',lbl:'text-emerald-800',descCls:'text-emerald-600'} },

  L7:  { group:'diff',   engine:'frac',     op:'diff-add',    chalQ:10, chalTime:480,
         label:'분모가 다른 분수의 덧셈', desc:'최소공배수로 통분 → 더하기 → 약분',
         theme:{bg:'bg-teal-50',   border:'border-teal-200',   hbg:'hover:bg-teal-100',   lbl:'text-teal-800',   descCls:'text-teal-600'} },
  L8:  { group:'diff',   engine:'frac',     op:'diff-sub',    chalQ:10, chalTime:480,
         label:'분모가 다른 분수의 뺄셈', desc:'최소공배수로 통분 → 빼기 → 약분',
         theme:{bg:'bg-teal-50',   border:'border-teal-300',   hbg:'hover:bg-teal-100',   lbl:'text-teal-900',   descCls:'text-teal-700'} },
  L9:  { group:'diff',   engine:'choice',   type:'diff-mixed',chalQ:20, chalTime:390,
         label:'분모가 다른 분수 종합',   desc:'4지선다로 빠르게 풀기',
         theme:{bg:'bg-cyan-50',   border:'border-cyan-200',   hbg:'hover:bg-cyan-100',   lbl:'text-cyan-800',   descCls:'text-cyan-600'} },

  L10: { group:'muldiv', engine:'frac',     op:'mul',         chalQ:12, chalTime:360,
         label:'분수 × 분수',            desc:'분자끼리 · 분모끼리 곱하고 약분',
         theme:{bg:'bg-blue-50',   border:'border-blue-200',   hbg:'hover:bg-blue-100',   lbl:'text-blue-800',   descCls:'text-blue-600'} },
  L11: { group:'muldiv', engine:'frac',     op:'div',         chalQ:12, chalTime:390,
         label:'분수 ÷ 분수',            desc:'뒤 분수를 뒤집어 곱셈으로 바꾸기',
         theme:{bg:'bg-blue-50',   border:'border-blue-300',   hbg:'hover:bg-blue-100',   lbl:'text-blue-900',   descCls:'text-blue-700'} },
  L12: { group:'muldiv', engine:'choice',   type:'muldiv',    chalQ:20, chalTime:360,
         label:'분수 곱셈·나눗셈 종합',   desc:'4지선다로 빠르게 풀기',
         theme:{bg:'bg-indigo-50', border:'border-indigo-200', hbg:'hover:bg-indigo-100', lbl:'text-indigo-800', descCls:'text-indigo-600'} },

  L13: { group:'mixed',  engine:'frac',     op:'convert',     chalQ:14, chalTime:300,
         label:'가분수 ↔ 대분수',        desc:'나누어 몫과 나머지로 바꾸기',
         theme:{bg:'bg-violet-50', border:'border-violet-200', hbg:'hover:bg-violet-100', lbl:'text-violet-800', descCls:'text-violet-600'} },
  L14: { group:'mixed',  engine:'frac',     op:'mixed-addsub',chalQ:8,  chalTime:600,
         label:'대분수의 덧셈·뺄셈',      desc:'가분수로 고쳐 통분 → 계산 → 대분수',
         theme:{bg:'bg-violet-50', border:'border-violet-300', hbg:'hover:bg-violet-100', lbl:'text-violet-900', descCls:'text-violet-700'} },
  L15: { group:'mixed',  engine:'frac',     op:'mixed-muldiv',chalQ:8,  chalTime:600,
         label:'대분수의 곱셈·나눗셈',    desc:'가분수로 고쳐 계산 → 대분수로 되돌리기',
         theme:{bg:'bg-fuchsia-50',border:'border-fuchsia-300',hbg:'hover:bg-fuchsia-100',lbl:'text-fuchsia-900',descCls:'text-fuchsia-700'} }
};

/* ═══ 잠금 ═══
 * 이전 레벨에서 (만점 × UNLOCK_RATIO) 이상을 받아야 다음 레벨의 '도전 연습'이 열린다.
 * 자유 연습은 언제나 열려 있다. 1.0 이면 만점을 요구하고, 예컨대 0.9 로 낮추면 완화된다.
 */
const UNLOCK_RATIO = 1.0;

function unlockThreshold(level) { return LEVEL_MAX[level] * UNLOCK_RATIO; }

function isLevelUnlocked(level, bestScores) {
  const idx = LEVEL_ORDER.indexOf(level);
  if (idx <= 0) return true;                       // L1은 항상 열림
  const prev = LEVEL_ORDER[idx - 1];
  return (bestScores[prev] || 0) >= unlockThreshold(prev);
}
function getPrevLevelInfo(level, bestScores) {
  const idx = LEVEL_ORDER.indexOf(level);
  if (idx <= 0) return null;
  const prev = LEVEL_ORDER[idx - 1];
  return { level: prev, max: LEVEL_MAX[prev], need: unlockThreshold(prev), best: bestScores[prev] || 0 };
}

/* ═══ 점수 계산 ═══
 * 만점에서 오답 2점씩 차감. 제한시간의 80%를 넘기면 최대 10점까지 서서히 감점,
 * 제한시간을 초과하면 추가 감점.
 */
function calculateScore(d) {
  if (PRACTICE_MODES.indexOf(d.mode) !== -1) return null;

  const incorrect = Number(d.incorrect) || 0;
  const duration  = Number(d.durationSec) || 0;
  const timeLimit = Number(d.timeLimit) || 0;
  const maxScore  = LEVEL_MAX[d.level] || 85;
  const isOvertime = d.isOvertime === true || d.resultStatus === 'failed_overtime';

  let score = maxScore - incorrect * 2;

  if (timeLimit > 0) {
    const pt = timeLimit * 0.8;
    if (duration > pt && duration <= timeLimit) score -= ((duration - pt) / (timeLimit - pt)) * 10;
    else if (duration > timeLimit) score -= 10;
  }
  if (isOvertime && timeLimit > 0) {
    const over = Math.max(0, duration - timeLimit);
    score -= 12 + Math.min(3, (over / timeLimit) * 12);
  }
  return parseFloat(Math.min(maxScore, Math.max(0, score)).toFixed(1));
}

function buildScoreOutcome(d) {
  const s = calculateScore(d);
  if (s === null) return { displayScore: null, recordedScore: null, scoreRecorded: false, message: '연습 모드는 점수가 기록되지 않습니다.' };
  return { displayScore: s, recordedScore: s, scoreRecorded: true, message: '점수가 기록되었습니다.' };
}

function getLevelLabel(lv) { return lv || '-'; }

window.Levels = {
  LEVEL_ORDER, LEVEL_MAX, LEVEL_CONFIGS, GROUP_LABELS, PRACTICE_MODES, UNLOCK_RATIO, unlockThreshold,
  isLevelUnlocked, getPrevLevelInfo, calculateScore, buildScoreOutcome, getLevelLabel
};
