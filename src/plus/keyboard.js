/*
 * FORTO 화면 키보드 — 윈도우 터치 모니터(크롬) 키오스크용
 * - 터치 화면에서는 OS 키보드 대신 이 키보드를 사용 (input에 inputmode="none")
 * - 한글 두벌식 + 영문 + 숫자, 받침 조합 (hangul-js)
 * - 이름 입력칸뿐 아니라 이후 검색창에도 그대로 붙일 수 있게 attach(input) 구조
 */
import Hangul from 'hangul-js';

const KO = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
  ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
  ['⇧', 'ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ', '⌫'],
];
const KO_SHIFT = { ㅂ: 'ㅃ', ㅈ: 'ㅉ', ㄷ: 'ㄸ', ㄱ: 'ㄲ', ㅅ: 'ㅆ', ㅐ: 'ㅒ', ㅔ: 'ㅖ' };
const EN = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'],
];

// 키오스크(터치 화면)인지: 거친 포인터가 있고 휴대폰 크기가 아님, 또는 주소에 ?kiosk
export const isKiosk = () => {
  const q = new URLSearchParams(location.search);
  if (q.has('kiosk')) return q.get('kiosk') !== '0';
  return window.matchMedia('(any-pointer: coarse)').matches && window.innerWidth > 800;
};

export function createKeyboard(host) {
  const el = document.createElement('div');
  el.className = 'kb';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', '화면 키보드');
  el.hidden = true;
  host.appendChild(el);

  let lang = 'ko';
  let shift = false;
  let input = null;
  let onDone = null;

  const label = (k) => (k === '⇧' ? 'SHIFT' : k === '⌫' ? '지우기' : k);
  function render() {
    const rows = lang === 'ko' ? KO : EN;
    const key = (k) => {
      let v = k;
      if (shift && lang === 'ko' && KO_SHIFT[k]) v = KO_SHIFT[k];
      if (shift && lang === 'en' && k.length === 1 && /[a-z]/.test(k)) v = k.toUpperCase();
      const cls = k === '⇧' ? 'kb__key kb__key--mod kb__shift' + (shift ? ' is-on' : '') : k === '⌫' ? 'kb__key kb__key--mod kb__del' : 'kb__key';
      return `<button type="button" class="${cls}" data-k="${k === '⇧' || k === '⌫' ? k : v}" aria-label="${label(k === '⇧' || k === '⌫' ? k : v)}">${k === '⌫' ? '<i></i>' : k === '⇧' ? '<i></i>' : v}</button>`;
    };
    el.innerHTML = `
      <div class="kb__bar"><span>KEYBOARD</span><span class="kb__lang">${lang === 'ko' ? '한글' : 'ENGLISH'}</span></div>
      ${rows.map((r, i) => `<div class="kb__row kb__row--${i}">${r.map(key).join('')}</div>`).join('')}
      <div class="kb__row kb__row--x">
        <button type="button" class="kb__key kb__key--mod kb__toggle" data-k="lang">${lang === 'ko' ? 'ABC' : '한/영'}</button>
        <button type="button" class="kb__key kb__space" data-k=" " aria-label="띄어쓰기">SPACE</button>
        <button type="button" class="kb__key kb__done" data-k="done">DONE</button>
      </div>`;
  }

  function write(next) {
    if (!input) return;
    const max = +input.getAttribute('maxlength') || Infinity;
    if (next.length > max) return;
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function press(k) {
    if (!input) return;
    if (k === 'lang') { lang = lang === 'ko' ? 'en' : 'ko'; shift = false; render(); return; }
    if (k === '⇧') { shift = !shift; render(); return; }
    if (k === 'done') { hide(); onDone?.(); return; }
    const jamo = Hangul.disassemble(input.value);
    if (k === '⌫') { jamo.pop(); write(Hangul.assemble(jamo)); return; }
    write(Hangul.assemble([...jamo, k]));
    if (shift) { shift = false; render(); }
  }

  // 누르는 순간 반응 (터치에서 지연 없이), 입력칸의 포커스는 유지
  el.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.kb__key');
    e.preventDefault();
    if (!b) return;
    b.classList.add('is-down');
    setTimeout(() => b.classList.remove('is-down'), 120);
    press(b.dataset.k);
    if (b.dataset.k === '⌫') {
      // 길게 누르면 계속 지우기
      let rep;
      const hold = setTimeout(() => { rep = setInterval(() => press('⌫'), 70); }, 420);
      const stop = () => { clearTimeout(hold); clearInterval(rep); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
    }
  });

  function show() {
    if (!el.hidden) return;
    render();
    el.hidden = false;
    el.classList.remove('is-in');
    requestAnimationFrame(() => el.classList.add('is-in'));
  }
  function hide() {
    if (el.hidden) return;
    el.classList.remove('is-in');
    setTimeout(() => { if (!el.classList.contains('is-in')) el.hidden = true; }, 360);
    input?.blur();
  }

  /** 입력칸에 연결: 탭(포커스)하면 키보드가 올라옴 */
  function attach(target, { done } = {}) {
    target.setAttribute('inputmode', 'none');       // OS 터치 키보드는 띄우지 않음
    target.setAttribute('autocomplete', 'off');
    target.addEventListener('focus', () => { input = target; onDone = done; show(); });
  }

  return { attach, show, hide, el, get open() { return !el.hidden; } };
}
