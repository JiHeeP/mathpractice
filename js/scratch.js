/* scratch.js — 계산 연습장: 손가락·펜·마우스로 쓰는 그림판
 * 종이 계산이 필요한 레벨(levels.js 의 cfg.scratch)에서만 풀이 화면에 붙는다.
 *   넓은 화면(가로 900px 이상)은 문제 오른쪽, 좁은 화면은 아래.
 * 저장·전송하지 않는다(기록 아님). 다음 문제로 넘어가면 엔진이 clear() 를 불러 지운다.
 */
const Scratch = (() => {
  let cv = null, ctx = null, drawing = false, last = null;

  /** 문제 카드 HTML 을 연습장과 나란히 감싼다. 연습장이 없는 레벨이면 그대로 돌려준다 */
  function wrap(cfg, cardHTML) {
    if (!cfg || !cfg.scratch) { cv = null; return cardHTML; }
    return `<div class="num-layout">${cardHTML}
      <div class="scratch">
        <div class="scratch-head"><span>✏️ 계산 연습장</span><button id="scratchClear" class="scratch-clear">지우기</button></div>
        <canvas id="scratchCanvas"></canvas>
      </div></div>`;
  }
  /** wrap 한 HTML 을 화면에 넣은 뒤 부른다 */
  function mount() {
    const el = document.getElementById('scratchCanvas');
    setWide(!!el);
    if (!el) { cv = null; return; }
    attach(el);
    document.getElementById('scratchClear').onclick = clear;
  }

  /* 연습장을 옆에 두려고 넓은 화면에서는 앱 틀을 넓힌다. 풀이 화면을 떠나면 원래대로 */
  function setWide(on) { document.body.classList.toggle('num-wide', on); }
  new MutationObserver(() => {
    const area = document.getElementById('practiceArea');
    if (area && (area.classList.contains('hidden') || !document.getElementById('scratchCanvas'))) setWide(false);
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });

  function fit() {
    if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!r.width) return;
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (cv.width === w && cv.height === h) return;
    const keep = cv.width ? ctx.getImageData(0, 0, cv.width, cv.height) : null;
    cv.width = w; cv.height = h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#1f2937';
    if (keep) ctx.putImageData(keep, 0, 0);
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function down(e) { fit(); drawing = true; last = pos(e); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); dot(last); e.preventDefault(); }
  function move(e) {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p; e.preventDefault();
  }
  function up() { drawing = false; last = null; }
  function dot(p) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#1f2937'; ctx.fill(); }
  function attach(el) {
    cv = el; ctx = cv.getContext('2d'); cv.width = 0;
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => cv.addEventListener(t, up));
    requestAnimationFrame(fit);
  }
  function clear() { if (!cv || !ctx) return; fit(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore(); }
  window.addEventListener('resize', fit);
  function clearIfAny() { if (cv && document.body.contains(cv)) clear(); }
  return { wrap, mount, clear: clearIfAny };
})();
