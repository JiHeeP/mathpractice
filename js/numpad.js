/* numpad.js — 화면 숫자판 (과정형 단계 풀이에서 씀)
 * 기기 자판을 띄우지 않고 화면 숫자판으로 칸을 채운다. 태블릿에서 기기 자판이 풀이판·확인 버튼을 덮던 문제를 없앤다.
 *   [1][2][3][4][5][⌫][다음 칸 ▶]
 *   [6][7][8][9][0][  ][  확인   ]   ← ⌫ 와 다음 칸/확인 키는 두 줄 높이
 * '다음 칸' 키는 비어 있는 다음 칸으로 옮기고, 남은 빈칸이 없으면 '확인'으로 바뀐다(엔진이 setGo 로 글자를 정한다).
 * 숫자판 단추는 누를 때 포커스를 가져가지 않는다 — 키보드로 치던 칸이 그대로 선택된 채 남는다.
 */
const NumPad = (() => {
  const KEYS = ['1', '2', '3', '4', '5', 'del', 'go', '6', '7', '8', '9', '0'];

  function html() {
    return `<div class="np">${KEYS.map(k =>
      k === 'del' ? '<button type="button" class="np-key np-del" data-k="del" aria-label="지우기">⌫</button>'
      : k === 'go' ? '<button type="button" class="np-key np-go" data-k="go" id="npGo">다음 칸 ▶</button>'
      : `<button type="button" class="np-key" data-k="${k}">${k}</button>`).join('')}</div>`;
  }

  /** root 안의 숫자판 단추에 onKey(k) 를 연결한다. k = '0'~'9' | 'del' | 'go' */
  function bind(root, onKey) {
    root.querySelectorAll('.np-key').forEach(b => {
      b.addEventListener('pointerdown', e => e.preventDefault());   // 칸의 포커스를 뺏지 않게
      b.addEventListener('click', () => onKey(b.dataset.k));
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
