import './footer.css';
import footerUrl from './footer/footer.webp';

/*
 * 공통 푸터 — 홈을 제외한 모든 페이지의 마지막 화면
 * 오브제 모션(레퍼런스 영상): 아래로 길게 늘어진 빛줄기가 위로 수축하며 형태로 맺히고,
 * 색이 위에서부터 아래로 채워져 최종 디자인(원본 이미지)과 정확히 같아짐.
 * progress(0→1)로 제어 → 스크롤 연동·되감기 모두 가능
 */
export function mountFooter(el) {
  el.classList.add('ft');
  el.innerHTML = `
    <div class="ft__art" aria-hidden="true">
      <img class="ft__beam" alt="" />
      <img class="ft__img" alt="" />
    </div>
    <p class="ft__copy">© 2048 FORTO ROCKET.</p>
    <p class="ft__rights">All Rights Reserved.</p>`;
  el.querySelectorAll('img').forEach((i) => { i.src = footerUrl; });
  const beam = el.querySelector('.ft__beam');
  const img = el.querySelector('.ft__img');
  const texts = el.querySelectorAll('.ft__copy, .ft__rights');

  const clamp = (v) => Math.min(1, Math.max(0, v));
  const easeOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // 처음엔 길게 머물렀다가 수축
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

  function set(p) {
    p = clamp(p);
    const e = easeOut(p);
    // 1) 빛줄기: 오브제 윗면(높이 16.5%)을 기준으로 길게 늘어났다가 수축, 블러가 걷힘
    beam.style.transform = `scaleY(${(1 + 1.5 * (1 - e)).toFixed(4)})`;
    beam.style.filter = `blur(${(22 * (1 - e)).toFixed(2)}px) brightness(${(1 + 0.9 * (1 - e)).toFixed(3)}) saturate(${(1 + 0.3 * (1 - e)).toFixed(3)})`;
    beam.style.opacity = (1 - smooth(0.82, 1, p)).toFixed(3);
    // 2) 최종 이미지: 위에서 아래로 부드럽게 채워짐
    const r = 12 + 102 * smooth(0.1, 0.95, p);
    const m = `linear-gradient(to bottom, #000 ${(r - 14).toFixed(2)}%, transparent ${r.toFixed(2)}%)`;
    img.style.webkitMaskImage = img.style.maskImage = m;
    // 3) 저작권 문구
    texts.forEach((t, i) => {
      const q = smooth(0.7 + i * 0.05, 1, p);
      t.style.opacity = q.toFixed(3);
      t.style.transform = `translateY(${(10 * (1 - q)).toFixed(2)}px)`;
    });
  }

  set(1);
  return { set };
}
