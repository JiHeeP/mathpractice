/* shapes.js — 도형의 넓이(A1~A6) 문제 그림 (SVG)
 * 길이는 숫자로 적고, 높이는 점선 + 직각 표시. 그림은 대략의 비율만 맞춘다("그림은 실제 크기가 아니에요").
 * 공식만 외워서는 못 풀도록 평행사변형·삼각형·사다리꼴에는 높이가 아닌 옆변 길이(함정 숫자)도 적는다.
 * 옆변 길이는 그린 모양의 실제 길이를 반올림한 값(높이와 같아지면 높이 + 1) — 그림과 숫자가 어긋나지 않게.
 * 모든 함수는 { svg, side? } 를 돌려준다(side = 적은 옆변 길이). 단위 u 는 'cm' 또는 'm'.
 */
(() => {
const W = 300, H = 210, PAD = 34;                 // 그림판 크기와 글자 자리
const FILL = '#EFF4FF', LINE = '#1D4ED8', DASH = '#C2410C', TXT = '#1e293b';

/* 길이(문제 숫자) → 화면 좌표 배율. 너무 가늘거나 납작한 그림이 되지 않게 최소 크기를 둔다 */
function scaleFor(wLen, hLen) {
  const s = Math.min((W - 2 * PAD) / wLen, (H - 2 * PAD) / hLen);
  return { sx: Math.max(s, 70 / wLen), sy: Math.max(s, 60 / hLen) };
}
const pt = p => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const poly = p => `<polygon points="${pt(p)}" fill="${FILL}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/>`;
const dash = (x1, y1, x2, y2) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${DASH}" stroke-width="2" stroke-dasharray="6 4"/>`;
const thin = (x1, y1, x2, y2) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${LINE}" stroke-width="1.5" stroke-dasharray="3 4"/>`;
/** 직각 표시 — (x,y) 꼭짓점에서 dx·dy 방향(±1)으로 작은 네모 */
const right = (x, y, dx, dy) => { const k = 9;
  return `<polyline points="${pt([[x + dx * k, y], [x + dx * k, y + dy * k], [x, y + dy * k]])}" fill="none" stroke="${DASH}" stroke-width="1.5"/>`; };
const label = (x, y, t, anchor = 'middle', color = TXT) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" font-size="15" font-weight="800" fill="${color}" paint-order="stroke" stroke="#fff" stroke-width="4">${t}</text>`;
/** 변 가운데에 길이 글자 — 변 바깥쪽(nx, ny 방향)으로 조금 띄운다 */
const sideLabel = (x1, y1, x2, y2, t, off = 14) => {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (y2 - y1) / len, ny = -(x2 - x1) / len;            // 왼쪽 법선 (점을 시계 방향으로 주면 바깥)
  return label(mx + nx * off, my + ny * off, t);
};
/** 옆변 길이 — 가로 차이 dx, 높이 h 인 변의 실제 길이를 반올림. 높이와 같으면 +1 (옆변은 늘 높이보다 길다) */
const sideLen = (dx, h) => { const s = Math.round(Math.hypot(dx, h)); return s > h ? s : h + 1; };
const wrap = (inner, w = W, h = H) =>
  `<svg class="shape-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">${inner}</svg>`;
/** 그림 전체를 가운데로 옮긴다 — 점들의 범위를 보고 x·y 를 더한다 */
function center(points, extra = []) {
  const xs = points.concat(extra).map(p => p[0]), ys = points.concat(extra).map(p => p[1]);
  const dx = (W - (Math.max(...xs) + Math.min(...xs))) / 2, dy = (H - (Math.max(...ys) + Math.min(...ys))) / 2;
  return ([x, y]) => [x + dx, y + dy];
}

/** 직사각형 · 정사각형 */
function rect(w, h, u, square) {
  const { sx, sy } = scaleFor(w, h), s = square ? Math.min(sx, sy) : 0;
  const pw = square ? w * s : w * sx, ph = square ? h * s : h * sy;
  const m = center([[0, 0], [pw, ph]]);
  const [a, b, c, d] = [[0, 0], [pw, 0], [pw, ph], [0, ph]].map(m);
  let svg = poly([a, b, c, d]) + right(a[0], a[1], 1, 1) + right(c[0], c[1], -1, -1);
  svg += sideLabel(c[0], c[1], d[0], d[1], `${w} ${u}`);
  if (square) {
    // 네 변이 같다는 눈금
    [[a, b], [b, c], [c, d], [d, a]].forEach(([p, q]) => {
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, v = p[1] === q[1];
      svg += `<line x1="${(mx - (v ? 0 : 6)).toFixed(1)}" y1="${(my - (v ? 6 : 0)).toFixed(1)}" x2="${(mx + (v ? 0 : 6)).toFixed(1)}" y2="${(my + (v ? 6 : 0)).toFixed(1)}" stroke="${LINE}" stroke-width="2"/>`;
    });
  } else svg += sideLabel(b[0], b[1], c[0], c[1], `${h} ${u}`);
  return { svg: wrap(svg) };
}

/** 평행사변형 — 밑변 b, 높이 h. 위 변이 오른쪽으로 off 만큼 밀려 있다. 옆변(함정) 길이도 적는다 */
function parallelogram(b, h, u) {
  const off = b * 0.35, side = sideLen(off, h);
  const { sx, sy } = scaleFor(b + off, h);
  const raw = [[off * sx, 0], [(off + b) * sx, 0], [b * sx, h * sy], [0, h * sy]];
  const m = center(raw), [p1, p2, p3, p4] = raw.map(m);
  const foot = [p1[0], p4[1]];
  let svg = poly([p1, p2, p3, p4]) + dash(p1[0], p1[1], foot[0], foot[1]) + right(foot[0], foot[1], 1, -1);
  svg += sideLabel(p3[0], p3[1], p4[0], p4[1], `${b} ${u}`);
  svg += label(p1[0] + 8, (p1[1] + foot[1]) / 2, `${h} ${u}`, 'start', DASH);
  svg += sideLabel(p2[0], p2[1], p3[0], p3[1], `${side} ${u}`);
  return { svg: wrap(svg), side };
}

/** 삼각형 — 밑변 b, 높이 h. apex = 꼭짓점의 가로 위치(밑변 왼쪽 끝 0, 오른쪽 끝 b 기준, 범위 밖이면 둔각) */
function triangle(b, h, apex, u) {
  const minX = Math.min(0, apex), maxX = Math.max(b, apex), out = apex < 0 || apex > b;
  const { sx, sy } = scaleFor((maxX - minX) * (out ? 1.3 : 1), h);   // 높이가 밖에 있으면 높이 글자 자리를 더 둔다
  const raw = [[apex * sx, 0], [b * sx, h * sy], [0, h * sy]];
  const room = apex > b ? [[apex * sx + 52, 0]] : apex < 0 ? [[apex * sx - 52, 0]] : [];
  const m = center(raw, room), [A, B, C] = raw.map(m);
  const side = apex <= b / 2 ? sideLen(b - apex, h) : sideLen(apex, h);   // 아래에서 글자를 적는 옆변
  const foot = [A[0], B[1]];
  let svg = '';
  if (apex < 0) svg += thin(foot[0], foot[1], C[0], C[1]);       // 밑변을 늘인 선 (높이가 밖에 있을 때)
  if (apex > b) svg += thin(B[0], B[1], foot[0], foot[1]);
  svg += poly([A, B, C]) + dash(A[0], A[1], foot[0], foot[1]);
  svg += right(foot[0], foot[1], apex > b ? -1 : 1, -1);
  svg += sideLabel(B[0], B[1], C[0], C[1], `${b} ${u}`);
  // 높이 글자: 밖에 있으면 바깥쪽, 안에 있으면 함정 숫자를 적지 않는 쪽에, 삼각형이 넓은 아래쪽(62%) 높이에
  const leftSide = apex < 0 || (!out && apex <= b / 2);
  const hy = out ? (A[1] + foot[1]) / 2 : A[1] + (foot[1] - A[1]) * 0.62;
  let hx = A[0] + (leftSide ? -8 : 8);
  if (!out) {   // 삼각형 안쪽 자리가 좁으면(글자 폭보다 작으면) 옆변 바깥에 적는다
    const E = leftSide ? C : B, ex = A[0] + (E[0] - A[0]) * (hy - A[1]) / (E[1] - A[1]);
    if (Math.abs(ex - A[0]) < 56) hx = ex + (leftSide ? -6 : 6);
  }
  svg += label(hx, hy, `${h} ${u}`, leftSide ? 'end' : 'start', DASH);
  // 함정 숫자는 높이 글자와 겹치지 않는 옆변에
  svg += apex <= b / 2 ? sideLabel(A[0], A[1], B[0], B[1], `${side} ${u}`) : sideLabel(C[0], C[1], A[0], A[1], `${side} ${u}`);
  return { svg: wrap(svg), side };
}

/** 마름모 — 대각선 d1(가로), d2(세로). 두 대각선은 점선, 가운데 직각 */
function rhombus(d1, d2, u) {
  const { sx, sy } = scaleFor(d1, d2), s = Math.min(sx, sy);
  const pw = Math.max(d1 * s, 120), ph = Math.max(d2 * s, 90);      // 가늘거나 납작하면 글자가 겹쳐서 최소 크기를 둔다
  const raw = [[pw / 2, 0], [pw, ph / 2], [pw / 2, ph], [0, ph / 2]];
  const m = center(raw), [T, R, Bt, Lf] = raw.map(m), O = [T[0], R[1]];
  let svg = poly([T, R, Bt, Lf]) + dash(Lf[0], Lf[1], R[0], R[1]) + dash(T[0], T[1], Bt[0], Bt[1]) + right(O[0], O[1], 1, -1);
  svg += label((Lf[0] + O[0]) / 2, O[1] + 14, `${d1} ${u}`, 'middle', DASH);
  svg += label(O[0] - 8, (T[1] + O[1]) / 2, `${d2} ${u}`, 'end', DASH);
  return { svg: wrap(svg) };
}

/** 사다리꼴 — 윗변 a, 아랫변 b, 높이 h. 윗변은 아랫변 위 가운데쯤. 오른쪽 옆변(함정) 길이도 적는다 */
function trapezoid(a, b, h, u) {
  const off = (b - a) * 0.3, side = sideLen(b - a - off, h);
  const { sx, sy } = scaleFor(b, h);
  const raw = [[off * sx, 0], [(off + a) * sx, 0], [b * sx, h * sy], [0, h * sy]];
  const m = center(raw), [p1, p2, p3, p4] = raw.map(m);
  const foot = [p1[0], p4[1]];
  let svg = poly([p1, p2, p3, p4]) + dash(p1[0], p1[1], foot[0], foot[1]) + right(foot[0], foot[1], 1, -1);
  svg += sideLabel(p1[0], p1[1], p2[0], p2[1], `${a} ${u}`);
  svg += sideLabel(p3[0], p3[1], p4[0], p4[1], `${b} ${u}`);
  svg += label(p1[0] + 8, (p1[1] + foot[1]) / 2, `${h} ${u}`, 'start', DASH);
  svg += sideLabel(p2[0], p2[1], p3[0], p3[1], `${side} ${u}`);
  return { svg: wrap(svg), side };
}

window.Shapes = { rect, parallelogram, triangle, rhombus, trapezoid };
})();
