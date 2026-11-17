/* numpad.js — 화면 숫자판
 * 기초 연산(numinput.js)과 과정형(step-frac.js)이 함께 쓴다.
 * 기기 자판을 띄우지 않고 화면 숫자판으로 칸을 채운다. 태블릿에서 기기 자판이 풀이판·확인 버튼을 덮던 문제를 없앤다.
 *   [1][2][3][4][5][⌫][다음 칸 ▶]
 *   [6][7][8][9][0][  ][  확인   ]   ← ⌫ 와 다음 칸/확인 키는 두 줄 높이
 * '다음 칸' 키는 비어 있는 다음 칸으로 옮기고, 남은 빈칸이 없으면 '확인'으로 바뀐다(엔진이 setGo 로 글자를 정한다).
 * 숫자판 단추는 누를 때 포커스를 가져가지 않는다 — 키보드로 치던 칸이 그대로 선택된 채 남는다.
 */
const NumPad = (() => {
  const KEYS = ['1', '2', '3', '4', '5', 'del', 'go', '6', '7', '8', '9', '0'];

  /** opts.extra = ',' 처럼 숫자 말고 한 개 더 필요한 키(두 줄 높이로 지우기 앞에 붙는다) */
  function html(opts = {}) {
    const keys = opts.extra ? KEYS.slice(0, 5).concat('extra', KEYS.slice(5)) : KEYS;
    return `<div class="np${opts.extra ? ' np-x' : ''}">${keys.map(k =>
      k === 'extra' ? `<button type="button" class="np-key np-extra" data-k="${opts.extra}">${opts.extraLabel || opts.extra}</button>` :
      k === 'del' ? '<button type="button" class="np-key np-del" data-k="del" aria-label="지우기">⌫</button>'
      : k === 'go' ? '<button type="button" class="np-key np-go" data-k="go" id="npGo">다음 칸 ▶</button>'
      : `<button type="button" class="np-key" data-k="${k}">${k}</button>`).join('')}</div>`;
  }

  /** root 안의 숫자판 단추에 onKey(k) 를 연결한다. k = '0'~'9' | 'del' | 'clear'(지우기 길게) | 'go' | extra */
  const HOLD_MS = 550;   // 지우기를 이만큼 누르고 있으면 그 칸을 통째로 지운다 ('clear')

  function bind(root, onKey) {
    root.querySelectorAll('.np-key').forEach(b => {
      let timer = null, held = false;
      b.addEventListener('pointerdown', e => {
        e.preventDefault();                                        // 칸의 포커스를 뺏지 않게
        if (b.dataset.k !== 'del') return;
        held = false;
        timer = setTimeout(() => { held = true; onKey('clear'); }, HOLD_MS);
      });
      const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
      ['pointerup', 'pointercancel'].forEach(t => b.addEventListener(t, stop));
      b.addEventListener('click', () => { if (held) { held = false; return; } onKey(b.dataset.k); });
      b.addEventListener('contextmenu', e => e.preventDefault());  // 길게 누를 때 메뉴가 뜨지 않게
    });
  }

  /** '다음 칸 ▶' ↔ '확인' */
  function setGo(isLast) {
    const b = document.getElementById('npGo');
    if (!b) return;
    b.textContent = isLast ? '확인' : '다음 칸 ▶';
    b.classList.toggle('np-ok', isLast);
  }

  return { html, bind, setGo };
})();
