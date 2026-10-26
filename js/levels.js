/* levels.js — 레벨 정의 · 잠금 규칙 · 점수 계산 (37레벨: 분수·소수·분수의 곱셈) */

const LEVEL_ORDER = ['L1','L2','L3','L4','L5','L6','L7','L8','L9','L9-2','L10','L11',
                     'L12','L13','L14','L15','L16','L17','L18','L19','L20','L21','L22',
                     'L23','L24','L25','L26','L27',
                     'L28','L29','L30','L31','L32','L33','L34','L35','L36'];

/** 레벨별 만점 — L1 90점부터 레벨당 +5 (L27 = 220 · L36 = 265)
 *  L9-2 는 나중에 끼워 넣은 레벨이라 기존 기록(레벨 번호·만점)을 건드리지 않도록 L9 와 L10 사이 값(133)으로 고정 */
const LEVEL_MAX = {};
LEVEL_ORDER.filter(lv => lv !== 'L9-2').forEach((lv, i) => { LEVEL_MAX[lv] = 90 + i * 5; });
LEVEL_MAX['L9-2'] = 133;

/** 점수가 기록되지 않는 모드 — 'aborted' 는 도전을 끝까지 풀지 않고 그만둔 경우 */
const PRACTICE_MODES = ['free', 'step_free', 'free_choice', 'aborted'];

const GROUP_LABELS = {
  concept: '🎨 개념 이해',
  convert: '🔁 분수 · 소수 변환',
  same:    '🍕 분모가 같은 분수',
  common:  '🔗 최소공배수와 통분',
  diff:    '➕➖ 분모가 다른 분수',
  mixed:   '🎯 대분수',
  dec:     '🔢 소수 계산',
  mul:     '✖️ 분수의 곱셈 ① — 분수 × 자연수',
  mul2:    '✖️ 분수의 곱셈 ② — 자연수 × 분수 · 분수 × 분수'
};

/* 제한시간 = 문제 수 × 유형별 단가(초)
 *   개념 그림 12초 · 변환 15초 · 동분모 13초 · 통분 18초 · 소수 13~14초
 *   과정형 65~104초 (단계 수가 많아 4지선다보다 넉넉하게)
 *   분수의 곱셈 과정형 45~65초 (통분이 없어 단계가 적음) · 4지선다 16~24초
 *   대분수 × 대분수 과정형은 가분수 2번 + 큰 수 곱셈이라 90초 · 4지선다 30초
 */
const T = (q, per) => q * per;

const LEVEL_CONFIGS = {
  L1:  { group:'concept', engine:'choice', type:'pic-frac',   chalQ:20, chalTime:T(20,12),
         label:'분수 개념 — 그림 보고 맞히기', desc:'색칠된 부분을 분수로 나타내기',
         theme:{bg:'bg-rose-50',   border:'border-rose-200',   hbg:'hover:bg-rose-100',   lbl:'text-rose-800',   descCls:'text-rose-600'} },
  L2:  { group:'concept', engine:'choice', type:'pic-dec',    chalQ:20, chalTime:T(20,12),
         label:'소수 개념 — 그림 보고 맞히기', desc:'색칠된 부분을 소수로 나타내기',
         theme:{bg:'bg-rose-50',   border:'border-rose-300',   hbg:'hover:bg-rose-100',   lbl:'text-rose-900',   descCls:'text-rose-700'} },

  L3:  { group:'convert', engine:'choice', type:'to-mixed',   chalQ:20, chalTime:T(20,15),
         label:'가분수 → 대분수', desc:'나누어 몫과 나머지로 바꾸기',
         theme:{bg:'bg-amber-50',  border:'border-amber-200',  hbg:'hover:bg-amber-100',  lbl:'text-amber-800',  descCls:'text-amber-600'} },
  L4:  { group:'convert', engine:'choice', type:'to-improper',chalQ:20, chalTime:T(20,15),
         label:'대분수 → 가분수', desc:'정수 × 분모 + 분자',
         theme:{bg:'bg-amber-50',  border:'border-amber-300',  hbg:'hover:bg-amber-100',  lbl:'text-amber-900',  descCls:'text-amber-700'} },
  L5:  { group:'convert', engine:'choice', type:'frac-to-dec',chalQ:20, chalTime:T(20,15),
         label:'분수 → 소수', desc:'분모가 10 · 100 · 1000인 분수 · 대분수 포함',
         theme:{bg:'bg-orange-50', border:'border-orange-200', hbg:'hover:bg-orange-100', lbl:'text-orange-800', descCls:'text-orange-600'} },
  L6:  { group:'convert', engine:'choice', type:'dec-to-frac',chalQ:20, chalTime:T(20,15),
         label:'소수 → 분수', desc:'분모가 10 · 100 · 1000인 분수로 · 대분수 포함',
         theme:{bg:'bg-orange-50', border:'border-orange-300', hbg:'hover:bg-orange-100', lbl:'text-orange-900', descCls:'text-orange-700'} },

  L7:  { group:'same',    engine:'choice', type:'same-add',   chalQ:20, chalTime:T(20,13),
         label:'분모가 같은 분수의 덧셈', desc:'분모는 그대로, 분자끼리 더하기',
         theme:{bg:'bg-green-50',  border:'border-green-200',  hbg:'hover:bg-green-100',  lbl:'text-green-800',  descCls:'text-green-600'} },
  L8:  { group:'same',    engine:'choice', type:'same-sub',   chalQ:20, chalTime:T(20,13),
         label:'분모가 같은 분수의 뺄셈', desc:'분모는 그대로, 분자끼리 빼기',
         theme:{bg:'bg-green-50',  border:'border-green-300',  hbg:'hover:bg-green-100',  lbl:'text-green-900',  descCls:'text-green-700'} },

  L9:  { group:'common',  engine:'choice', type:'lcm',        chalQ:20, chalTime:T(20,15),
         label:'최소공배수 구하기', desc:'통분의 준비 운동',
         theme:{bg:'bg-teal-50',   border:'border-teal-200',   hbg:'hover:bg-teal-100',   lbl:'text-teal-800',   descCls:'text-teal-600'} },
  'L9-2': { group:'common', engine:'frac', op:'common-steps', chalQ:10, chalTime:T(10,50),
         label:'통분 과정 연습', desc:'최소공배수 → 분모·분자에 같은 수 곱하기 → 통분한 분수 쓰기',
         theme:{bg:'bg-teal-50',   border:'border-teal-300',   hbg:'hover:bg-teal-100',   lbl:'text-teal-900',   descCls:'text-teal-700'} },
  L10: { group:'common',  engine:'choice', type:'common-denom',chalQ:20, chalTime:T(20,18),
         label:'분수 통분하기', desc:'최소공배수를 공통분모로',
         theme:{bg:'bg-teal-50',   border:'border-teal-300',   hbg:'hover:bg-teal-100',   lbl:'text-teal-900',   descCls:'text-teal-700'} },

  L11: { group:'diff',    engine:'frac',   op:'diff-add1',    chalQ:10, chalTime:T(10,70),
         label:'분모가 다른 분수의 덧셈 (과정)', desc:'합이 1을 넘는 진분수 — 통분 → 계산 → 대분수',
         theme:{bg:'bg-cyan-50',   border:'border-cyan-200',   hbg:'hover:bg-cyan-100',   lbl:'text-cyan-800',   descCls:'text-cyan-600'} },
  L12: { group:'diff',    engine:'choice', type:'diff-add1',  chalQ:20, chalTime:T(20,20),
         label:'분모가 다른 분수의 덧셈', desc:'4지선다로 빠르게 풀기',
         theme:{bg:'bg-cyan-50',   border:'border-cyan-300',   hbg:'hover:bg-cyan-100',   lbl:'text-cyan-900',   descCls:'text-cyan-700'} },
  L13: { group:'diff',    engine:'frac',   op:'diff-sub',     chalQ:10, chalTime:T(10,65),
         label:'분모가 다른 분수의 뺄셈 (과정)', desc:'통분 → 빼기 → 약분',
         theme:{bg:'bg-sky-50',    border:'border-sky-200',    hbg:'hover:bg-sky-100',    lbl:'text-sky-800',    descCls:'text-sky-600'} },
  L14: { group:'diff',    engine:'choice', type:'diff-sub',   chalQ:20, chalTime:T(20,19),
         label:'분모가 다른 분수의 뺄셈', desc:'4지선다로 빠르게 풀기',
         theme:{bg:'bg-sky-50',    border:'border-sky-300',    hbg:'hover:bg-sky-100',    lbl:'text-sky-900',    descCls:'text-sky-700'} },

  L15: { group:'mixed',   engine:'frac',   op:'mixed-add',    chalQ:8,  chalTime:T(8,104),
         label:'대분수의 덧셈 (과정)', desc:'가분수로 → 통분 → 계산 → 대분수',
         theme:{bg:'bg-indigo-50', border:'border-indigo-200', hbg:'hover:bg-indigo-100', lbl:'text-indigo-800', descCls:'text-indigo-600'} },
  L16: { group:'mixed',   engine:'choice', type:'mixed-add',  chalQ:15, chalTime:T(15,26),
         label:'대분수의 덧셈', desc:'4지선다로 빠르게 풀기',
         theme:{bg:'bg-indigo-50', border:'border-indigo-300', hbg:'hover:bg-indigo-100', lbl:'text-indigo-900', descCls:'text-indigo-700'} },
  L17: { group:'mixed',   engine:'frac',   op:'mixed-sub',    chalQ:8,  chalTime:T(8,104),
         label:'대분수의 뺄셈 (과정)', desc:'가분수로 → 통분 → 계산 → 대분수',
         theme:{bg:'bg-violet-50', border:'border-violet-200', hbg:'hover:bg-violet-100', lbl:'text-violet-800', descCls:'text-violet-600'} },
  L18: { group:'mixed',   engine:'choice', type:'mixed-sub',  chalQ:15, chalTime:T(15,26),
         label:'대분수의 뺄셈', desc:'4지선다로 빠르게 풀기',
         theme:{bg:'bg-violet-50', border:'border-violet-300', hbg:'hover:bg-violet-100', lbl:'text-violet-900', descCls:'text-violet-700'} },

  L19: { group:'dec',     engine:'choice', type:'dec-add',    chalQ:20, chalTime:T(20,13),
         label:'소수의 덧셈', desc:'소수점 아래 두 자리까지 · 자릿수 같음',
         theme:{bg:'bg-fuchsia-50',border:'border-fuchsia-200',hbg:'hover:bg-fuchsia-100',lbl:'text-fuchsia-800',descCls:'text-fuchsia-600'} },
  L20: { group:'dec',     engine:'choice', type:'dec-sub',    chalQ:20, chalTime:T(20,13),
         label:'소수의 뺄셈', desc:'소수점 아래 두 자리까지 · 자릿수 같음',
         theme:{bg:'bg-fuchsia-50',border:'border-fuchsia-300',hbg:'hover:bg-fuchsia-100',lbl:'text-fuchsia-900',descCls:'text-fuchsia-700'} },
  L21: { group:'dec',     engine:'choice', type:'dec-add-mix',chalQ:20, chalTime:T(20,14),
         label:'소수의 덧셈 (자릿수 다름)', desc:'소수점 자리를 맞춰 계산하기',
         theme:{bg:'bg-pink-50',   border:'border-pink-200',   hbg:'hover:bg-pink-100',   lbl:'text-pink-800',   descCls:'text-pink-600'} },
  L22: { group:'dec',     engine:'choice', type:'dec-sub-mix',chalQ:20, chalTime:T(20,14),
         label:'소수의 뺄셈 (자릿수 다름)', desc:'소수점 자리를 맞춰 계산하기',
         theme:{bg:'bg-pink-50',   border:'border-pink-300',   hbg:'hover:bg-pink-100',   lbl:'text-pink-900',   descCls:'text-pink-700'} },

  L23: { group:'mul',     engine:'frac',   op:'frac-mul-nat',        chalQ:10, chalTime:T(10,45),
         label:'진분수 × 자연수 (과정)', desc:'분모는 그대로, 분자 × 자연수 → 약분 → 대분수',
         theme:{bg:'bg-lime-50',   border:'border-lime-200',   hbg:'hover:bg-lime-100',   lbl:'text-lime-800',   descCls:'text-lime-600'} },
  L24: { group:'mul',     engine:'choice', type:'frac-mul-nat',      chalQ:20, chalTime:T(20,16),
         label:'진분수 × 자연수 계산하기', desc:'4지선다로 빠르게 풀기 — 보기가 서로 비슷하니 꼼꼼히',
         theme:{bg:'bg-lime-50',   border:'border-lime-300',   hbg:'hover:bg-lime-100',   lbl:'text-lime-900',   descCls:'text-lime-700'} },
  L25: { group:'mul',     engine:'frac',   op:'mixed-mul-nat-split', chalQ:8,  chalTime:T(8,65),
         label:'대분수 × 자연수 (과정 ①)', desc:'자연수 부분과 분수 부분을 따로 곱해서 더하기',
         theme:{bg:'bg-emerald-50',border:'border-emerald-200',hbg:'hover:bg-emerald-100',lbl:'text-emerald-800',descCls:'text-emerald-600'} },
  L26: { group:'mul',     engine:'frac',   op:'mixed-mul-nat-improper', chalQ:8, chalTime:T(8,55),
         label:'대분수 × 자연수 (과정 ②)', desc:'대분수를 가분수로 바꿔서 곱하기',
         theme:{bg:'bg-emerald-50',border:'border-emerald-300',hbg:'hover:bg-emerald-100',lbl:'text-emerald-900',descCls:'text-emerald-700'} },
  L27: { group:'mul',     engine:'choice', type:'mixed-mul-nat',     chalQ:15, chalTime:T(15,24),
         label:'대분수 × 자연수 계산하기', desc:'4지선다로 빠르게 풀기 — 보기가 서로 비슷하니 꼼꼼히',
         theme:{bg:'bg-green-50',  border:'border-green-300',  hbg:'hover:bg-green-100',  lbl:'text-green-900',  descCls:'text-green-700'} },

  L28: { group:'mul2',    engine:'frac',   op:'nat-mul-frac',           chalQ:10, chalTime:T(10,45),
         label:'자연수 × 진분수 (과정)', desc:'분모는 그대로, 자연수 × 분자 → 약분 → 대분수',
         theme:{bg:'bg-yellow-50', border:'border-yellow-200', hbg:'hover:bg-yellow-100', lbl:'text-yellow-800', descCls:'text-yellow-700'} },
  L29: { group:'mul2',    engine:'choice', type:'nat-mul-frac',         chalQ:20, chalTime:T(20,16),
         label:'자연수 × 진분수 계산하기', desc:'4지선다로 빠르게 풀기 — 보기가 서로 비슷하니 꼼꼼히',
         theme:{bg:'bg-yellow-50', border:'border-yellow-300', hbg:'hover:bg-yellow-100', lbl:'text-yellow-900', descCls:'text-yellow-800'} },
  L30: { group:'mul2',    engine:'frac',   op:'nat-mul-mixed-split',    chalQ:8,  chalTime:T(8,65),
         label:'자연수 × 대분수 (과정 ①)', desc:'자연수 부분과 분수 부분에 따로 곱해서 더하기',
         theme:{bg:'bg-orange-50', border:'border-orange-200', hbg:'hover:bg-orange-100', lbl:'text-orange-800', descCls:'text-orange-600'} },
  L31: { group:'mul2',    engine:'frac',   op:'nat-mul-mixed-improper', chalQ:8,  chalTime:T(8,55),
         label:'자연수 × 대분수 (과정 ②)', desc:'대분수를 가분수로 바꿔서 곱하기',
         theme:{bg:'bg-orange-50', border:'border-orange-300', hbg:'hover:bg-orange-100', lbl:'text-orange-900', descCls:'text-orange-700'} },
  L32: { group:'mul2',    engine:'choice', type:'nat-mul-mixed',        chalQ:15, chalTime:T(15,24),
         label:'자연수 × 대분수 계산하기', desc:'4지선다로 빠르게 풀기 — 보기가 서로 비슷하니 꼼꼼히',
         theme:{bg:'bg-orange-50', border:'border-orange-300', hbg:'hover:bg-orange-100', lbl:'text-orange-900', descCls:'text-orange-700'} },
  L33: { group:'mul2',    engine:'frac',   op:'frac-mul-frac',          chalQ:10, chalTime:T(10,50),
         label:'진분수 × 진분수 (과정)', desc:'분자끼리 · 분모끼리 곱하기 → 약분',
         theme:{bg:'bg-red-50',    border:'border-red-200',    hbg:'hover:bg-red-100',    lbl:'text-red-800',    descCls:'text-red-600'} },
  L34: { group:'mul2',    engine:'choice', type:'frac-mul-frac',        chalQ:20, chalTime:T(20,20),
         label:'진분수 × 진분수 계산하기', desc:'4지선다로 빠르게 풀기',
         theme:{bg:'bg-red-50',    border:'border-red-300',    hbg:'hover:bg-red-100',    lbl:'text-red-900',    descCls:'text-red-700'} },
  L35: { group:'mul2',    engine:'frac',   op:'mixed-mul-mixed',        chalQ:8,  chalTime:T(8,90),
         label:'대분수 × 대분수 (과정)', desc:'두 대분수를 가분수로 → 분자끼리 · 분모끼리 곱하기 → 약분 → 대분수',
         theme:{bg:'bg-purple-50', border:'border-purple-200', hbg:'hover:bg-purple-100', lbl:'text-purple-800', descCls:'text-purple-600'} },
  L36: { group:'mul2',    engine:'choice', type:'mixed-mul-mixed',      chalQ:15, chalTime:T(15,30),
         label:'대분수 × 대분수 계산하기', desc:'4지선다로 빠르게 풀기 — 자연수끼리 · 분수끼리 곱하면 안 돼요',
         theme:{bg:'bg-purple-50', border:'border-purple-300', hbg:'hover:bg-purple-100', lbl:'text-purple-900', descCls:'text-purple-700'} }
};

/* ═══ 잠금 ═══
 * 다음 레벨의 '도전 연습'을 열려면 이전 레벨에서 오답을 허용 개수 이하로 하고
 * 시간 감점 없이(제한시간의 80% 이내) 완주해야 한다.
 *   허용 오답: 문제가 10개 이하인 과정형 레벨은 1개, 나머지는 2개
 * 자유 연습은 언제나 열려 있다.
 */
function allowedWrong(level) { return (LEVEL_CONFIGS[level].chalQ <= 10) ? 1 : 2; }

function unlockThreshold(level) { return LEVEL_MAX[level] - allowedWrong(level) * 2; }

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

/* ═══ 나중에 끼워 넣은 레벨의 '통과 인정' ═══
 * L9-2 는 L9 와 L10 사이에 나중에 넣은 레벨이다. 그 전에 이미 L10 이후로 넘어간 학생은
 * L9-2 를 풀 기회가 없었는데도 L10 도전이 잠겨 버린다.
 * 그래서 L9-2 를 통과하지 못했더라도 그 뒤 레벨 점수가 하나라도 있으면 L9-2 를 만점으로 인정한다.
 * (지금은 L9-2 를 통과해야 L10 도전이 열리므로 새로 시작하는 학생에게는 해당되지 않는다)
 */
const BACKFILLED_LEVELS = ['L9-2'];

function applyBackfillPass(best) {
  BACKFILLED_LEVELS.forEach(lv => {
    if ((best[lv] || 0) >= unlockThreshold(lv)) return;
    const idx = LEVEL_ORDER.indexOf(lv);
    if (Object.keys(best).some(l => LEVEL_ORDER.indexOf(l) > idx)) best[lv] = LEVEL_MAX[lv];
  });
  return best;
}

/* ═══ 점수 계산 ═══
 * 만점에서 오답 2점씩 차감. 제한시간의 80%를 넘기면 최대 10점까지 서서히 감점,
 * 제한시간을 초과하면 추가 감점. (4지선다 도전의 오답 +10초 페널티는 duration에 이미 반영됨)
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
  LEVEL_ORDER, LEVEL_MAX, LEVEL_CONFIGS, GROUP_LABELS, PRACTICE_MODES, allowedWrong, unlockThreshold,
  isLevelUnlocked, getPrevLevelInfo, calculateScore, buildScoreOutcome, getLevelLabel,
  applyBackfillPass
};
