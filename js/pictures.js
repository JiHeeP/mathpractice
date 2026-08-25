/* pictures.js — L1·L2 개념 문제용 SVG 그림 생성기
 * 색칠(주황) / 빈칸(연한 미색)으로 "전체 중 얼마"를 보여준다.
 */
(() => {
const FILL = '#fb923c', EMPTY = '#fef3e2', LINE = '#b45309';

/* ── 원형 파이: d조각 중 n조각 색칠 ── */
function pie(n, d) {
  const R = 60, C = 70;
  let paths = '';
  for (let i = 0; i < d; i++) {
    const a0 = (i / d) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 1) / d) * 2 * Math.PI - Math.PI / 2;
    const x0 = C + R * Math.cos(a0), y0 = C + R * Math.sin(a0);
    const x1 = C + R * Math.cos(a1), y1 = C + R * Math.sin(a1);
    const large = 1 / d > 0.5 ? 1 : 0;
    paths += `<path d="M${C},${C} L${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z"
      fill="${i < n ? FILL : EMPTY}" stroke="${LINE}" stroke-width="2"/>`;
  }
  return `<svg viewBox="0 0 140 140" width="140" height="140" role="img">${paths}</svg>`;
}

/* ── 가로 막대: d칸 중 n칸 색칠 ── */
function bar(n, d) {
  const W = 260, H = 46, w = W / d;
  let rects = '';
  for (let i = 0; i < d; i++) {
    rects += `<rect x="${(i * w).toFixed(2)}" y="2" width="${w.toFixed(2)}" height="${H - 4}"
      fill="${i < n ? FILL : EMPTY}" stroke="${LINE}" stroke-width="2"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${rects}</svg>`;
}

/* ── 묶음: d개의 동그라미 중 n개 색칠 ── */
function dots(n, d) {
  const per = Math.min(d, 6), rows = Math.ceil(d / per), R = 15, gap = 38;
  const W = per * gap + 8, H = rows * gap + 8;
  let cs = '';
  for (let i = 0; i < d; i++) {
    const cx = (i % per) * gap + gap / 2 + 4, cy = Math.floor(i / per) * gap + gap / 2 + 4;
    cs += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${i < n ? FILL : EMPTY}" stroke="${LINE}" stroke-width="2"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${cs}</svg>`;
}

/* ── 소수용: 0.1 단위 막대 (10칸 중 k칸) ── */
function tenthsBar(k) { return bar(k, 10); }

/* ── 소수용: 10×10 격자 (100칸 중 k칸) — 위에서부터 줄 단위로 채움 ── */
function hundredthsGrid(k) {
  const cell = 17, W = cell * 10 + 4, H = cell * 10 + 4;
  let rects = '';
  for (let i = 0; i < 100; i++) {
    const x = (i % 10) * cell + 2, y = Math.floor(i / 10) * cell + 2;
    rects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}"
      fill="${i < k ? FILL : EMPTY}" stroke="${LINE}" stroke-width="1"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${rects}</svg>`;
}

window.Pic = { pie, bar, dots, tenthsBar, hundredthsGrid };
})();
