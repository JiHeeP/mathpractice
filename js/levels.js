/* levels.js — 레벨 정의 · 잠금 규칙 · 점수 계산
 * 트랙:
 *   기초 연산 B1~B10 — 숫자를 직접 써넣는다. 항상 열려 있다(앞 레벨을 통과하지 않아도 도전 가능).
 *   분수·소수 L1~L36 + L9-2 (37레벨) — 앞 레벨을 통과해야 다음 레벨 도전이 열린다.
 *   소수의 곱셈 D1~D6 — 앞 레벨을 통과해야 열린다(선생님 결정 2026-11-18). D1~D5 숫자 직접 입력, D6 4지선다.
 *     분수·소수 트랙 끝이나 중간에 붙이지 않고 따로 둔다 — 기존 잠금·만점·기록을 건드리지 않으려고.
 *     랭킹·학생 비교에는 넣지 않는다(db.js levelWeight 가 LEVEL_ORDER 만 센다).
 */

/** 분수·소수 트랙의 순서. 잠금·랭킹의 '최고 레벨'이 이 순서를 쓴다. (이름은 예전 그대로 둔다) */
const LEVEL_ORDER = ['L1','L2','L3','L4','L5','L6','L7','L8','L9','L9-2','L10','L11',
                     'L12','L13','L14','L15','L16','L17','L18','L19','L20','L21','L22',
                     'L23','L24','L25','L26','L27',
                     'L28','L29','L30','L31','L32','L33','L34','L35','L36'];

/** 기초 연산 트랙 — 줄(뺄셈·곱셈·나눗셈·약수와 배수)마다 쉬운 것부터 */
const BASIC_LINES = Object.freeze({
  sub: ['B1'],
  mul: ['B2', 'B3', 'B4'],
  div: ['B5', 'B6', 'B7', 'B8'],
  fm:  ['B9', 'B10']
});
const BASIC_ORDER = [].concat(BASIC_LINES.sub, BASIC_LINES.mul, BASIC_LINES.div, BASIC_LINES.fm);

/** 소수의 곱셈 트랙 (5-2 4단원 순서) */
const DMUL_ORDER = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];

/** 트랙 — 화면에 보이는 순서대로. open: true 면 레벨이 모두 항상 열려 있다 */
const TRACKS = Object.freeze({
  basic: { label: '기초 연산', levels: BASIC_ORDER, open: true },
  frac:  { label: '분수 · 소수', levels: LEVEL_ORDER, open: false },
  dmul:  { label: '소수의 곱셈', levels: DMUL_ORDER, open: false }
});
const TRACK_KEYS = ['basic', 'frac', 'dmul'];
/** 모든 레벨 (트랙 순서대로) */
const ALL_LEVELS = [].concat(...TRACK_KEYS.map(k => TRACKS[k].levels));

function trackOf(level) { return TRACK_KEYS.find(k => TRACKS[k].levels.indexOf(level) !== -1) || null; }
/** 같은 트랙에서 바로 앞 레벨 — 트랙의 첫 레벨이면 null */
function prevInTrack(level) {
  const t = trackOf(level); if (!t) return null;
  const list = TRACKS[t].levels, i = list.indexOf(level);
  return i > 0 ? list[i - 1] : null;
}
/** 같은 트랙에서 바로 다음 레벨 — 기초 트랙은 같은 줄 안에서만 (B4 다음은 B5가 아니라 없음) */
function nextInTrack(level) {
  const t = trackOf(level); if (!t) return null;
  let list = TRACKS[t].levels;
  if (t === 'basic') list = Object.values(BASIC_LINES).find(l => l.indexOf(level) !== -1);
  const i = list.indexOf(level);
  return i >= 0 && i + 1 < list.length ? list[i + 1] : null;
}

/** 레벨별 만점 — 숫자로 고정한다. 계산식으로 만들지 말 것.
 *  예전 기록의 점수·통과 판정이 이 값에 묶여 있어서, 레벨을 앞이나 중간에 끼워 넣어도 기존 값은 바뀌면 안 된다.
 *  (예전에는 'LEVEL_ORDER 안의 순서 × 5' 로 계산했다. 아래 값은 그때와 똑같다: L1 90점부터 레벨당 +5, L9-2 = 133)
 *  새 레벨을 넣을 때는 여기에 그 레벨의 만점을 새로 적는다.
 *  ⚠️ firestore.rules 의 validResult 가 score ≤ 300 으로 막고 있으므로 300을 넘는 만점은 규칙도 같이 고쳐야 한다. */
const LEVEL_MAX = Object.freeze({
  'L1': 90,  'L2': 95,  'L3': 100, 'L4': 105, 'L5': 110, 'L6': 115, 'L7': 120, 'L8': 125,
  'L9': 130, 'L9-2': 133, 'L10': 135, 'L11': 140, 'L12': 145, 'L13': 150, 'L14': 155,
  'L15': 160, 'L16': 165, 'L17': 170, 'L18': 175,
  'L19': 180, 'L20': 185, 'L21': 190, 'L22': 195,
  'L23': 200, 'L24': 205, 'L25': 210, 'L26': 215, 'L27': 220,
  'L28': 225, 'L29': 230, 'L30': 235, 'L31': 240, 'L32': 245, 'L33': 250, 'L34': 255, 'L35': 260, 'L36': 265,
  // 기초 연산 — 결과 화면에 보이는 점수만. 랭킹 합계에는 넣지 않는다(db.js getRanking 은 LEVEL_ORDER 레벨만 더함)
  'B1': 100, 'B2': 100, 'B3': 100, 'B4': 100, 'B5': 100, 'B6': 100, 'B7': 100, 'B8': 100, 'B9': 100, 'B10': 100,
  // 소수의 곱셈 — 기초와 같이 100점, 랭킹 합계에 넣지 않는다
  'D1': 100, 'D2': 100, 'D3': 100, 'D4': 100, 'D5': 100, 'D6': 100
});

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
  mul2:    '✖️ 분수의 곱셈 ② — 자연수 × 분수 · 분수 × 분수',
  'b-sub': '➖ 뺄셈',
  'b-mul': '✖️ 곱셈',
  'b-div': '➗ 나눗셈',
  'b-fm':  '🔢 약수와 배수',
  'd-mul': '✖️ 소수의 곱셈',
  'd-mix': '🎯 소수의 곱셈 — 빠르게 풀기'
};

/* 제한시간 = 문제 수 × 유형별 단가(초)
 *   개념 그림 12초 · 변환 15초 · 동분모 13초 · 통분 18초 · 소수 13~14초
 *   과정형 65~104초 (단계 수가 많아 4지선다보다 넉넉하게)
 *   분수의 곱셈 과정형 45~65초 (통분이 없어 단계가 적음) · 4지선다 16~24초
 *   대분수 × 대분수 과정형은 가분수 2번 + 큰 수 곱셈이라 90초 · 4지선다 30초
 */
const T = (q, per) => q * per;

const BTHEME = {bg:'bg-slate-50', border:'border-slate-200', hbg:'hover:bg-slate-100', lbl:'text-slate-800', descCls:'text-slate-600'};

/* 기초 연산 — engine 'num' (js/numinput.js): 보기 없이 숫자를 직접 써넣는다. 문제는 generator.js 의 type 으로 만든다.
 * 제한시간 단가: 한 줄 계산 20~25초 · 두 자리 곱셈 40초 · 큰 곱셈·나눗셈 50~60초 · 구구 나눗셈 8초 */
const BASIC_CONFIGS = {
  B1:  { group:'b-sub', engine:'num', type:'b-sub3',   chalQ:20, chalTime:T(20,25), open:true,
         label:'받아내림 있는 세 자리 뺄셈', desc:'일의 자리부터 — 모자라면 윗자리에서 10을 빌려 와요', theme:BTHEME },
  B2:  { group:'b-mul', engine:'num', type:'b-mul-1',  chalQ:20, chalTime:T(20,20), open:true,
         label:'(두·세 자리) × (한 자리)', desc:'일의 자리부터 곱하고 올림을 더해요', theme:BTHEME },
  B3:  { group:'b-mul', engine:'num', type:'b-mul-22', chalQ:20, chalTime:T(20,40), open:true,
         label:'(두 자리) × (두 자리)', desc:'일의 자리 곱 + 십의 자리 곱(한 칸 왼쪽)', theme:BTHEME },
  B4:  { group:'b-mul', engine:'num', type:'b-mul-32', chalQ:10, chalTime:T(10,60), open:true,
         label:'(세 자리) × (두 자리)', desc:'연습장에 세로로 써서 계산해요', theme:BTHEME },
  B5:  { group:'b-div', engine:'num', type:'b-div-99', chalQ:20, chalTime:T(20,8),  open:true,
         label:'곱셈구구 나눗셈', desc:'21 ÷ 7 = 3 — 곱셈구구를 거꾸로', theme:BTHEME },
  B6:  { group:'b-div', engine:'num', type:'b-div-21', chalQ:20, chalTime:T(20,25), open:true,
         label:'(두 자리) ÷ (한 자리)', desc:'몫과 나머지를 써요 — 나머지는 나누는 수보다 작아요', theme:BTHEME },
  B7:  { group:'b-div', engine:'num', type:'b-div-31', chalQ:20, chalTime:T(20,35), open:true,
         label:'(세 자리) ÷ (한 자리)', desc:'몫과 나머지를 써요', theme:BTHEME },
  B8:  { group:'b-div', engine:'num', type:'b-div-x2', chalQ:10, chalTime:T(10,60), open:true,
         label:'÷ (두 자리)', desc:'몫을 어림해서 곱해 보고 고쳐요 · 몫과 나머지', theme:BTHEME },
  B9:  { group:'b-fm',  engine:'num', type:'b-divisors', chalQ:10, chalTime:T(10,40), open:true,
         label:'약수 모두 쓰기', desc:'1과 자기 자신도 약수 — 짝을 지어 빠짐없이', theme:BTHEME },
  B10: { group:'b-fm',  engine:'num', type:'b-multiples', chalQ:10, chalTime:T(10,30), open:true,
         label:'배수와 공배수', desc:'배수 쓰기 · 공배수 · 최소공배수', theme:BTHEME }
};

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

/* 소수의 곱셈 — D1~D5 는 숫자 직접 입력(소수점 키), D6 는 4지선다(소수점 위치를 잘못 찍은 보기).
 * 제한시간 단가: 소수 × 자연수 25초 · 소수 × 소수 35초 · 자릿수 다른 소수 × 소수 50초 · 소수점 옮기기 15초 · 4지선다 20초
 * 통과는 분수·소수 트랙과 같은 '최근 문제 창'(20문제 중 18개 · 10문제 레벨은 10문제 중 9개) */
const DTHEME = {bg:'bg-sky-50', border:'border-sky-200', hbg:'hover:bg-sky-100', lbl:'text-sky-800', descCls:'text-sky-600'};
const DMUL_CONFIGS = {
  D1: { group:'d-mul', engine:'num', type:'d-mul-dn', chalQ:20, chalTime:T(20,25),
        label:'(소수) × (자연수)', desc:'자연수처럼 곱하고, 곱하는 소수의 자릿수만큼 소수점을 찍어요', theme:DTHEME },
  D2: { group:'d-mul', engine:'num', type:'d-mul-nd', chalQ:20, chalTime:T(20,25),
        label:'(자연수) × (소수)', desc:'자연수처럼 곱하고, 소수의 자릿수만큼 소수점을 찍어요', theme:DTHEME },
  D3: { group:'d-mul', engine:'num', type:'d-mul-11', chalQ:20, chalTime:T(20,35),
        label:'(소수) × (소수)', desc:'소수 한 자리 × 소수 한 자리 = 소수 두 자리 — 자리가 모자라면 앞에 0을 채워요', theme:DTHEME },
  D4: { group:'d-mul', engine:'num', type:'d-mul-21', chalQ:10, chalTime:T(10,50),
        label:'자릿수가 다른 소수의 곱셈', desc:'두 소수의 소수점 아래 자릿수를 더한 만큼 소수점을 찍어요', theme:DTHEME },
  D5: { group:'d-mul', engine:'num', type:'d-mul-shift', chalQ:20, chalTime:T(20,15),
        label:'곱의 소수점 위치', desc:'× 10 · 100 · 1000 은 오른쪽으로, × 0.1 · 0.01 · 0.001 은 왼쪽으로', theme:DTHEME },
  D6: { group:'d-mix', engine:'choice', type:'dec-mul', chalQ:20, chalTime:T(20,20),
        label:'소수의 곱셈 계산하기', desc:'4지선다로 빠르게 풀기 — 소수점 위치가 다른 보기를 조심해요', theme:DTHEME }
};
Object.assign(LEVEL_CONFIGS, BASIC_CONFIGS, DMUL_CONFIGS);

/** 계산 연습장(js/scratch.js)을 붙이는 레벨 — 중간 계산을 종이에 적어야 하는데 화면이 대신 보여 주지 않는 레벨.
 *  선생님 승인 2026-11-17: '필요' 20개. 단계 풀이(과정형)는 풀이판이 중간값을 채워 주므로 넣지 않았다.
 *  B5(구구 나눗셈)·그림·자리 옮기기·동분모처럼 암산으로 되는 레벨도 뺐다. */
const SCRATCH_LEVELS = ['B1', 'B2', 'B3', 'B4', 'B6', 'B7', 'B8', 'B9', 'B10',
                        'L9', 'L10', 'L12', 'L14', 'L16', 'L18', 'L21', 'L22', 'L27', 'L32', 'L36',
                        'D1', 'D2', 'D3', 'D4', 'D6'];   // 소수의 곱셈(2026-11-18): D5 는 소수점만 옮기면 되어 뺐다
SCRATCH_LEVELS.forEach(lv => { LEVEL_CONFIGS[lv].scratch = true; });

/* ═══ 잠금 ═══
 * 다음 레벨의 '도전 연습'은 이전 레벨을 '통과'해야 열린다.
 *
 * 통과 = 그 레벨 도전에서 가장 최근에 푼 문제들 중 정해진 개수 이상을 맞힘
 *   4지선다 레벨(문제 15~20개): 최근 20문제 중 18개
 *   과정형 레벨(문제 8~10개):   최근 10문제 중 9개
 * 도중에 '그만하기'로 나가도 그때까지 푼 문제는 그대로 남는다.
 * 그래서 한 문제 틀렸다고 그만두고 새로 시작해도 틀린 문제가 사라지지 않는다.
 * (예전 규칙: 한 판을 오답 2개 이하로 완주. 틀리면 그만두고 다시 시작하는 일이 기록의 70%를 차지했다)
 *
 * 한 번 통과한 레벨은 계속 통과로 남는다. 시간은 통과 여부에 넣지 않는다(점수에는 그대로 반영).
 * 자유 연습은 언제나 열려 있고 통과 계산에 들어가지 않는다.
 */
function allowedWrong(level) { return (LEVEL_CONFIGS[level].chalQ <= 10) ? 1 : 2; }

/** 통과 판정에 쓰는 '최근 문제' 창 — { size: 보는 문제 수, need: 맞혀야 하는 개수 }
 *  기초 레벨(판 안 규칙)은 한 판의 문제 수 그대로: 20문제 중 18개, 10문제 중 9개 */
function passWindow(level) {
  if (isRunRule(level)) { const size = LEVEL_CONFIGS[level].chalQ; return { size, need: size - allowedWrong(level) }; }
  const size = (LEVEL_CONFIGS[level].chalQ <= 10) ? 10 : 20;
  return { size, need: size - allowedWrong(level) };
}

/* ═══ 기초 레벨은 '한 판 안' 규칙 (선생님 결정 2026-11-17 — 완전 숙달) ═══
 * 여러 판을 이어 붙이지 않는다. 한 판에서
 *   20문제 레벨: 18개 맞히면 그 자리에서 통과 · 3개 틀리면 바로 끝나고 '다시 하기'
 *   10문제 레벨(B4·B8·B9·B10): 9개 맞히면 통과 · 2개 틀리면 바로 다시 하기
 */
function isRunRule(level) { return !!(LEVEL_CONFIGS[level] && LEVEL_CONFIGS[level].open); }
/** 한 판에서 이만큼 틀리면 판이 끝난다 (기초 레벨만) */
function failAt(level) { return allowedWrong(level) + 1; }
function windowCorrect(recent) { return (recent || []).reduce((n, v) => n + (v ? 1 : 0), 0); }
function windowPassed(level, recent) { return windowCorrect(recent) >= passWindow(level).need; }

/** 예전 규칙의 통과 점수 — 문제별 정오(seq)가 없는 예전 기록에만 쓴다 */
function unlockThreshold(level) { return LEVEL_MAX[level] - allowedWrong(level) * 2; }

const SEQ_RE = /^[01]{1,400}$/;

/** 한 학생의 기록 → { passed: {레벨: true}, recent: {레벨: [1,0,1,...]} }
 *  - seq(문제별 정오, '1101…')가 있는 도전·중도 포기 기록: 시간 순서대로 이어 붙여 최근 창으로 판정
 *  - seq 가 없는 예전 기록: 예전 규칙(완주한 판의 점수가 통과 점수 이상)으로 판정 → 이미 통과한 레벨은 그대로 인정
 *  scoreOf(r) 는 점수로 인정되는 기록이면 점수를, 아니면 null 을 돌려주는 함수(db.js)
 */
function computeProgress(rows, scoreOf) {
  const passed = {}, recent = {}, seen = {};
  (rows || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0)).forEach(r => {
    const lv = r && r.level;
    if (!LEVEL_CONFIGS[lv]) return;
    if (r.mode !== 'challenge' && r.mode !== 'aborted') return;
    seen[lv] = true;
    if (typeof r.seq === 'string' && SEQ_RE.test(r.seq) && isRunRule(lv)) {
      // 기초: 판마다 따로 판정. 레벨 화면 막대에는 가장 최근 판을 보여 준다
      const run = recent[lv] = [...r.seq].map(c => (c === '1' ? 1 : 0));
      if (!passed[lv] && windowPassed(lv, run)) passed[lv] = true;
    } else if (typeof r.seq === 'string' && SEQ_RE.test(r.seq)) {
      const size = passWindow(lv).size;
      const h = recent[lv] = recent[lv] || [];
      for (let i = 0; i < r.seq.length; i++) {
        h.push(r.seq[i] === '1' ? 1 : 0);
        if (h.length > size) h.shift();
        if (!passed[lv] && windowPassed(lv, h)) passed[lv] = true;
      }
    } else if (r.seq === undefined || r.seq === null) {
      const s = scoreOf ? scoreOf(r) : null;
      if (s !== null && s >= unlockThreshold(lv)) passed[lv] = true;
    }
  });
  // 나중에 끼워 넣은 레벨: 그 뒤 레벨을 이미 통과한 학생은 통과로 인정 (아래 applyBackfillPass 와 같은 취지)
  BACKFILLED_LEVELS.forEach(lv => {
    if (passed[lv]) return;
    const idx = LEVEL_ORDER.indexOf(lv);
    if (Object.keys(passed).some(l => LEVEL_ORDER.indexOf(l) > idx)) passed[lv] = true;
  });
  return { passed, recent };
}

function isLevelUnlocked(level, passed) {
  const cfg = LEVEL_CONFIGS[level];
  if (cfg && cfg.open) return true;                // 기초 트랙은 항상 열림
  const prev = prevInTrack(level);
  if (!prev) return true;                          // 트랙의 첫 레벨(L1)은 항상 열림
  return !!(passed && passed[prev]);
}
function getPrevLevelInfo(level, progress) {
  if (LEVEL_CONFIGS[level] && LEVEL_CONFIGS[level].open) return null;
  const prev = prevInTrack(level);
  if (!prev) return null;
  const w = passWindow(prev);
  return { level: prev, size: w.size, need: w.need, correct: windowCorrect(progress && progress.recent && progress.recent[prev]) };
}

/* ═══ 나중에 끼워 넣은 레벨의 '통과 인정' ═══
 * L9-2 는 L9 와 L10 사이에 나중에 넣은 레벨이다. 그 전에 이미 L10 이후로 넘어간 학생은
 * L9-2 를 풀 기회가 없었는데도 L10 도전이 잠겨 버린다.
 * 그래서 L9-2 를 통과하지 못했더라도 그 뒤 레벨 점수가 하나라도 있으면 L9-2 를 만점으로 인정한다.
 * (지금은 L9-2 를 통과해야 L10 도전이 열리므로 새로 시작하는 학생에게는 해당되지 않는다)
 * 여기서는 랭킹 합계용 점수(best)를 채우고, 잠금 해제용 통과 여부는 computeProgress 가 같은 방식으로 채운다.
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

/* ═══ 기초 트랙 시작점 (교사 화면 설정 → 반 문서 classes/{code}.basicStart) ═══
 * 한 줄에 한 학생: '번호 뺄셈 곱셈 나눗셈 묶음'  예) 3 B1 B2 B6 가
 *   뺄셈 B1 · 곱셈 B2~B4 · 나눗셈 B5~B8 중 시작할 레벨, 그 줄을 이미 통과했으면 '-' (또는 '통과')
 *   묶음(가·나·다·라)은 '오늘 할 것' 순서를 정한다 — 가: B3 통과 전까지 기초만 · 나: 기초 먼저 · 다·라(또는 없음): 분수 먼저
 *   '#' 뒤는 메모로 무시한다. 학생 이름은 쓰지 않는다(번호만).
 */
const START_LINES = ['sub', 'mul', 'div'];
function parseBasicStart(text) {
  const map = {}, errors = [];
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const t = line.split(/[\s,]+/);
    const no = t[0];
    if (!/^\d{1,3}$/.test(no)) { errors.push(`${i + 1}째 줄: 번호가 숫자가 아니에요`); return; }
    if (t.length < 4) { errors.push(`${i + 1}째 줄: 뺄셈·곱셈·나눗셈 시작점 3개가 필요해요`); return; }
    const e = {};
    for (let k = 0; k < 3; k++) {
      const v = t[k + 1].toUpperCase().replace('통과', '-');
      const line = START_LINES[k];
      if (v !== '-' && BASIC_LINES[line].indexOf(v) === -1) {
        errors.push(`${i + 1}째 줄: '${t[k + 1]}' 는 ${['뺄셈(B1)', '곱셈(B2~B4)', '나눗셈(B5~B8)'][k]} 레벨이 아니에요`); return;
      }
      e[line] = v;
    }
    if (t[4]) {
      if (['가', '나', '다', '라'].indexOf(t[4]) === -1) { errors.push(`${i + 1}째 줄: 묶음은 가·나·다·라 중 하나예요`); return; }
      e.g = t[4];
    }
    map[String(Number(no))] = e;
  });
  return { map, errors };
}
/** 시작점 앞이거나 '-'(통과)로 정한 줄의 레벨인가. start = basicStart[번호] (없으면 false) */
function basicSkipped(start, lv) {
  if (!start) return false;
  const line = Object.keys(BASIC_LINES).find(k => BASIC_LINES[k].indexOf(lv) !== -1);
  if (!line || line === 'fm') return false;
  const st = start[line];
  if (st === '-') return true;
  const list = BASIC_LINES[line];
  return list.indexOf(st) > list.indexOf(lv);
}
/** 기초 트랙에서 다음에 할(아직 통과 못 한) 레벨. 뺄셈 → 곱셈 → 나눗셈 → 약수와 배수 순.
 *  시작점이 없으면 각 줄의 처음부터 본다. 다 통과했으면 null */
function nextBasicLevel(start, passed) {
  return BASIC_ORDER.find(lv => !(passed && passed[lv]) && !basicSkipped(start, lv)) || null;
}
function formatBasicStart(map) {
  return Object.keys(map || {}).sort((a, b) => Number(a) - Number(b))
    .map(no => { const e = map[no]; return [no, e.sub, e.mul, e.div, e.g || ''].join(' ').trim(); }).join('\n');
}

function getLevelLabel(lv) { return lv || '-'; }

window.Levels = {
  LEVEL_ORDER, BASIC_LINES, BASIC_ORDER, DMUL_ORDER, TRACKS, TRACK_KEYS, ALL_LEVELS, SCRATCH_LEVELS,
  trackOf, prevInTrack, nextInTrack, isRunRule, failAt, parseBasicStart, formatBasicStart, basicSkipped, nextBasicLevel, LEVEL_MAX, LEVEL_CONFIGS, GROUP_LABELS, PRACTICE_MODES, allowedWrong, unlockThreshold,
  passWindow, windowCorrect, windowPassed, computeProgress,
  isLevelUnlocked, getPrevLevelInfo, calculateScore, buildScoreOutcome, getLevelLabel,
  applyBackfillPass
};
