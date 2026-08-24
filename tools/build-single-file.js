/* build-single-file.js — CSS·JS를 전부 집어넣은 HTML 한 개를 만든다.
 *
 *   node tools/build-single-file.js              → dist/분수연산마스터.html
 *   node tools/build-single-file.js --fragment   → dist/preview-fragment.html
 *
 * 만들어진 파일은 서버 없이 브라우저로 바로 열 수 있다(USB로 나눠 주기 좋음).
 * Firebase 스크립트는 빼기 때문에 항상 로컬 모드(localStorage)로 동작한다.
 * --fragment 는 <html>/<head>/<body> 껍데기를 뺀 형태로, 껍데기를 직접 씌우는 곳에 쓴다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fragment = process.argv.includes('--fragment');

const CSS = ['vendor/tailwind.css', 'css/app.css'];
const JS = [
  'vendor/chart.umd.js',
  'js/fraction.js', 'js/levels.js', 'js/generator.js', 'js/db.js',
  'js/session.js', 'js/step-frac.js', 'js/step-int.js', 'js/quiz.js', 'js/app.js'
];

const html = read('index.html');
const bodyOpen = html.match(/<body([^>]*)>/);
const bodyClass = (bodyOpen[1].match(/class="([^"]*)"/) || [, ''])[1];
let markup = html.slice(html.indexOf(bodyOpen[0]) + bodyOpen[0].length, html.lastIndexOf('</body>'));
markup = markup.replace(/[ \t]*<script[^>]*src="[^"]*"[^>]*><\/script>\r?\n?/g, '');

// 인라인 <script> 안에서 문서를 조기에 닫아 버리지 않도록 방어
const safe = js => js.replace(/<\/script/gi, '<\\/script');

const styles = CSS.map(read).join('\n');
const scripts = JS.map(f => `/* ── ${f} ── */\n${safe(read(f))}`).join('\n');

/* 뷰어 테마가 어둡더라도 앱 고유의 밝은 배경을 그대로 쓴다 */
const groundCSS = `
:root { color-scheme: light; }
html, body { background: #fffbeb; margin: 0; }
.app-shell { min-height: 100vh; }`;

const head = `<title>분수 연산 마스터</title>
<style>${styles}</style>
<style>${groundCSS}</style>`;

const shell = `<div class="app-shell ${bodyClass.replace('min-h-full', '')}">${markup}</div>
<script>${scripts}</script>`;

const out = fragment
  ? `${head}\n${shell}\n`
  : `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
${head}
</head>
<body>
${shell}
</body>
</html>
`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const file = fragment ? 'dist/preview-fragment.html' : 'dist/분수연산마스터.html';
fs.writeFileSync(path.join(ROOT, file), out);
console.log(`${file} — ${(Buffer.byteLength(out) / 1024).toFixed(0)}KB`);
