import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import './about.css';

import manifestoSvg from './about/manifesto.svg?raw';
import prologueBg from './about/prologue-bg.webp';
import rocketUrl from './about/rocket.webp';
import compassUrl from './about/compass-rotation.mp4';
import compassPoster from './about/compass-poster.jpg';
import esgUrl from './about/esg.png';
import moonUrl from './about/moon.webp';
import colorUrl from './about/color.webp';
import cutoutUrl from './about/cutout.webp';
import cutoutTopUrl from './about/cutout-top.webp';
import gridUrl from './about/construction.png';
import buildingUrl from './about/building.webp';
// 임시: 인트로/다크 섹션 영상 레이어는 원본 수령 전까지 랜딩 마지막 씬 루프로 대체
import introVideoUrl from './media/scene-loop.mp4';

gsap.registerPlugin(ScrollTrigger);

// 리빌 시작 색 (단어마다 순환)
const PASTELS = [[151, 249, 255], [1, 144, 255], [0, 212, 162]];

/* 텍스트 노드를 단어 <span class="w">로 감쌈 (<br>, <strong> 등 구조 유지) */
function splitWords(el) {
  const words = [];
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const w = document.createElement('span');
          w.className = 'w';
          w.textContent = part;
          frag.appendChild(w);
          words.push(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') {
        walk(n);
      }
    });
  };
  walk(el);
  return words;
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/* p(0→1)에 따라 단어들이 왼쪽부터 물결처럼 맺힘. 끝 상태에서는 인라인 스타일을 지워 원래 색을 따름 */
function makeWordRenderer(words, dark, fontSize) {
  const N = words.length;
  const WIN = Math.max(3, Math.round(N * 0.35));        // 동시에 변하는 단어 폭
  const blurMax = Math.min(14, Math.max(5, fontSize * 0.28));
  const mid = dark ? [176, 168, 178] : [118, 104, 112];  // 중간 회보랏빛
  const pastelAlpha = dark ? 0.75 : 0.55;
  return (p) => {
    const head = p * (N + WIN);
    for (let i = 0; i < N; i++) {
      const w = words[i];
      const t = Math.min(1, Math.max(0, (head - i) / WIN));
      if (t >= 1) {
        if (w._done) continue;
        w.style.color = ''; w.style.filter = ''; w.style.opacity = '';
        w._done = true;
        continue;
      }
      w._done = false;
      const base = PASTELS[i % PASTELS.length];
      let rgb, alpha;
      if (t < 0.55) { const k = t / 0.55; rgb = mix(base, mid, k); alpha = pastelAlpha + (0.9 - pastelAlpha) * k; }
      else { const k = (t - 0.55) / 0.45; rgb = mix(mid, dark ? [255, 255, 255] : [0, 0, 0], k); alpha = 0.9 + 0.1 * k; }
      w.style.color = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(3)})`;
      w.style.filter = `blur(${(blurMax * Math.pow(1 - t, 1.3)).toFixed(2)}px)`;
    }
  };
}
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createAbout(root) {
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  /* ---------- 에셋 연결 ---------- */
  $('.ab-manifesto__art').innerHTML = manifestoSvg;
  $('.ab-prologue__bg').src = prologueBg;
  $('.ab-prologue__rocket').src = rocketUrl;
  const compass = $('.ab-one__video');
  compass.src = compassUrl;
  compass.poster = compassPoster;
  $('.ab-two__esg').src = esgUrl;
  $('.ab-two__moon').src = moonUrl;
  $('.ab-color__img').src = colorUrl;
  $('.ab-brand__top').src = cutoutTopUrl;
  const fly = $('.ab-fly');
  fly.src = cutoutUrl;
  $('.ab-dark__grid img').src = gridUrl;
  $('.ab-dark__building img').src = buildingUrl;
  const introVideo = $('.ab-intro__video');
  introVideo.src = introVideoUrl;
  const darkVideo = $('.ab-dark__video video');
  darkVideo.src = introVideoUrl;

  /* ---------- 텍스트를 단어 단위로 분리 (Butter식 블러 리빌) ---------- */
  const wordTargets = $$('.ab-title, .ab-epi__title, .ab-body');
  const wordSets = wordTargets.map((el) => ({ el, words: splitWords(el) }));

  // 일반 페이드업 대상 (라벨·이미지)
  $$('.ab-label, .ab-card, .ab-two__esg').forEach((el) => {
    if (!el.closest('.ab-color, .ab-epi') && !el.classList.contains('ab-dark__building')) el.setAttribute('data-reveal', '');
  });

  let ctx;
  let lenis;
  let openTimer;

  function build() {
    const H = () => $('.ab-color__pin').offsetHeight;
    const W = () => root.clientWidth;
    const a = (n) => (n * W()) / 1440;

    /* 텍스트: 스크롤에 따라 단어가 컬러 블러 → 회색 블러 → 선명한 본문색 (되감기 가능) */
    wordSets.forEach(({ el, words }) => {
      const dark = !!el.closest('.ab-epi, .ab-dark');
      const render = makeWordRenderer(words, dark, parseFloat(getComputedStyle(el).fontSize) || 18);
      const proxy = { p: 0 };
      render(0);
      gsap.to(proxy, {
        p: 1,
        ease: 'none',
        onUpdate: () => render(proxy.p),
        scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 35%', scrub: 0.6 },
      });
    });

    /* 라벨·이미지: 들어올 때 페이드업, 위로 되돌아가면 다시 숨김 */
    $$('[data-reveal]').forEach((el) => {
      gsap.fromTo(el,
        { opacity: 0, y: 40 },
        {
          opacity: el.classList.contains('ab-label') ? 0.5 : 1, y: 0, duration: 1.1, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
        });
    });

    /* 매니페스토: 스크롤에 맞춰 줄별로 올라오고 하이라이트가 왼쪽부터 칠해짐 */
    const lines = $$('.ab-manifesto__art .ln');
    const hls = $$('.ab-manifesto__art .hl');
    gsap.timeline({ scrollTrigger: { trigger: '.ab-manifesto', start: 'top 85%', end: 'center 45%', scrub: 0.6 } })
      .fromTo(lines, { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: 0.18, duration: 0.5, ease: 'power2.out' })
      .fromTo(hls, { scaleX: 0 }, { scaleX: 1, stagger: 0.12, duration: 0.5, ease: 'power2.inOut' }, 0.25);

    /* PROLOGUE: 스크롤할수록 로켓만 상승 */
    gsap.fromTo('.ab-prologue__rocket',
      { yPercent: 6 },
      {
        yPercent: -125,
        ease: 'power2.in',
        scrollTrigger: { trigger: '.ab-prologue__card', start: 'top 65%', end: 'bottom top', scrub: 0.6 },
      });

    /* 01: 스크롤 위치 = 나침반 영상 재생 위치 */
    const seek = { p: 0 };
    let pending = false;
    const applySeek = () => {
      pending = false;
      if (compass.duration) compass.currentTime = seek.p * (compass.duration - 0.05);
    };
    ScrollTrigger.create({
      trigger: '.ab-one__card',
      start: 'top 85%',
      end: 'bottom 20%',
      onUpdate: (st) => {
        seek.p = st.progress;
        if (!pending) { pending = true; requestAnimationFrame(applySeek); }
      },
    });

    /* 컬러: 카드가 오른쪽에서 들어와 중앙 → 화면 가득 (Figma 7:386 → 7:392 → 7:380) */
    const card = $('.ab-color__card');
    const colorTexts = $$('.ab-color__num, .ab-color__title, .ab-color__body');
    gsap.timeline({
      scrollTrigger: {
        trigger: '.ab-color__pin', pin: true, start: 'top top', end: '+=180%', scrub: 0.8,
        invalidateOnRefresh: true,
      },
    })
      .fromTo(card,
        { left: () => a(1167), top: () => a(392), width: () => a(1120), height: () => a(406), borderRadius: () => a(20) },
        { left: () => a(160), duration: 0.45, ease: 'power2.out' })
      .to(card, { left: 0, top: 0, width: () => W(), height: () => H(), borderRadius: 0, duration: 0.45, ease: 'power2.inOut' }, 0.55)
      .to(colorTexts, { '--tc': '#fff', duration: 0.2, ease: 'none' }, 0.72)
      .to({}, { duration: 0.1 });

    /* EPILOGUE → 띠 차오름 → BRAND IDENTITY (pin 앞부분) */
    const bands = $$('.band');
    const startTops = [693, 734, 776, 817, 859];
    const startBottoms = [734, 776, 817, 859, 900];
    const endBottoms = [585, 627, 668, 710, 900];
    bands.forEach((b, i) => gsap.set(b, { '--t': `${(startTops[i] / 900) * 100}%`, '--b': `${(startBottoms[i] / 900) * 100}%` }));

    const brandSpans = $$('.ab-brand__line span');
    const win = $('.ab-brand__window');
    const shape = $('.ab-brand__shape');
    const top = $('.ab-brand__top');
    const bCard = $('.ab-dark__building');
    const dark = $('.ab-dark');
    const pinEl = $('.ab-epi__pin');
    gsap.set(brandSpans, { yPercent: 110, opacity: 0 });
    gsap.set(win, { scale: 0.4, opacity: 0, transformOrigin: '50% 50%' });

    // 고정 구간 전체 = 화면 4개 분량. 앞 70%: 띠·타이포 / 뒤 30%: 심볼 창 확장
    const PIN_LEN = 4;
    dark.style.marginTop = `${-window.innerHeight}px`;
    const SPLIT = 0.7;
    const pinTl = gsap.timeline({
      scrollTrigger: { trigger: pinEl, pin: true, start: 'top top', end: () => `+=${PIN_LEN * 100}%`, scrub: true, invalidateOnRefresh: true },
    })
      .to('.ab-epi__text', { y: () => -a(80), opacity: 0, duration: 0.25, ease: 'power1.in' }, 0.1)
      .to(bands, {
        '--t': '0%',
        '--b': (i) => `${(endBottoms[i] / 900) * 100}%`,
        duration: 0.45, stagger: 0.05, ease: 'power3.inOut',
      }, 0.05)
      .to(brandSpans, { yPercent: 0, opacity: 1, duration: 0.25, stagger: 0.05, ease: 'expo.out' }, 0.5)
      .fromTo(win, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'expo.out', transformOrigin: '50% 60%' }, 0.55)
      // 튀어나온 건물도 창과 같은 기준점에서 함께 커짐
      .fromTo(top, { scale: 0.4, opacity: 0 }, {
        scale: 1, opacity: 1, duration: 0.25, ease: 'expo.out',
        transformOrigin: `${((394 + 322.5 - 565.62) / 440.2) * 100}% ${((305 + 123.6 - 138) / 347.76) * 100}%`,
      }, 0.55);
    pinTl.to({}, { duration: 0.8 / SPLIT - pinTl.duration() });   // 타임라인 길이를 앞 70%에 맞춤

    /*
     * 심볼 창 확장 → 누끼 건물이 다음 섹션 카드 속 건물로 착지 (NY Phil 레퍼런스)
     *  A (pin 뒤 30%): 창이 화면을 덮도록 커지고, 누끼는 창 마스크 안에서 살짝 확대
     *  B (pin 해제 ~ 다크 섹션 상단 도착): 누끼가 카드 속 같은 건물 위치로 이동·회전
     *     착지 변환은 누끼 ↔ 카드 사진 특징점 매칭으로 구함 (scale 1.8467, rotate -3.915°)
     */
    const LAND = { s: 1.8467, r: -3.915, tx: -339.834, ty: -10.721, imgW: 629 };
    const CUT = { x: 411.56, y: 129.85, w: 757, h: 589 };     // Figma 7:88 (브랜드 프레임 좌표)
    const SHAPE_END = { scale: 5.6, dx: -18.5, dy: 214 };       // Figma 7:84 → 7:104 (화면을 확실히 덮도록 조금 더 크게)
    const maskUrl = `url("data:image/svg+xml,${encodeURIComponent(shape.outerHTML.replace('fill="#000"', 'fill="#fff"').replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'))}")`;
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const smooth = (e0, e1, v) => { const t = clamp01((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
    const easeIn = gsap.parseEase('power2.in');
    const easeInOut = gsap.parseEase('power3.inOut');
    const expoOut = gsap.parseEase('expo.out');

    const brandLines = $$('.ab-brand__line');
    const topWrap = $('.ab-brand__topwrap');

    function renderTravel(self) {
      const pinST = pinTl.scrollTrigger;
      const len = pinST.end - pinST.start;
      // A: 창 확장 (고정 구간 70%→90%) / B: 누끼 비행 (85%→100%, 확장 끝과 살짝 겹침)
      // 다크 섹션은 고정 구간 마지막 화면과 겹치게 올려 두어, 화면이 검어질 때 이미 제목·카드가 함께 보임
      const aStart = pinST.start + len * SPLIT;
      const aEnd = pinST.start + len * 0.9;
      const bStart = pinST.start + len * 0.85;
      const bEnd = pinST.end;
      const y = self && self.scroll ? self.scroll() : window.scrollY;
      const pA = clamp01((y - aStart) / (aEnd - aStart));
      const pB = clamp01((y - bStart) / (bEnd - bStart));
      const A = a(1);

      // 고정 구간 기준 위치를 스크롤 값으로 직접 계산 (트리거 실행 순서와 무관하게 정확)
      const pinP = clamp01((y - pinST.start) / (pinST.end - pinST.start));
      const Ptop = y < pinST.start ? pinST.start - y : y > pinST.end ? pinST.end - y : 0;
      const tWin = clamp01((pinP * pinTl.duration() - 0.55) / 0.25);
      const eWin = expoOut(tWin);
      const winScale = 0.4 + 0.6 * eWin;
      const winOp = eWin;

      // 심볼 창 확장 (안쪽 SVG에 적용)
      const eA = easeIn(pA);
      const ss = 1 + (SHAPE_END.scale - 1) * eA;
      const sdx = SHAPE_END.dx * A * eA, sdy = SHAPE_END.dy * A * eA;
      gsap.set(shape, { scale: ss, x: sdx, y: sdy, transformOrigin: '50% 50%' });
      gsap.set([...brandLines, topWrap], { opacity: 1 - smooth(0, 0.35, pA) });
      gsap.set(bands, { opacity: 1 - smooth(0.82, 0.95, pA) });
      // 다음 섹션은 미리 올라와 있다가 심볼이 화면을 다 덮을 때 나타남
      gsap.set(dark, { opacity: smooth(0.86, 1, pA) });

      // 심볼 모양의 화면 위 사각형
      const L = 394 * A, T = 305 * A + Ptop, Wd = 645 * A, Hd = 206 * A;
      const ox = L + Wd / 2, oy = T + Hd * 0.6;           // 창 등장 스케일 기준점
      const scx = L + Wd / 2, scy = T + Hd / 2;           // 확장 기준점
      const map = (px, py) => {
        const qx = scx + (px - scx) * ss + sdx, qy = scy + (py - scy) * ss + sdy;
        return [ox + (qx - ox) * winScale, oy + (qy - oy) * winScale];
      };
      const [r0x, r0y] = map(L, T);
      const [r1x, r1y] = map(L + Wd, T + Hd);

      // 누끼 위치 (다크 섹션 기준 좌표)
      const D = root.getBoundingClientRect();     // .ab-fly의 기준 상자 (.about)
      const C = bCard.getBoundingClientRect();
      const k = C.width / LAND.imgW;
      const zoom = winScale * (1 + 0.12 * eA);
      const s0 = A * zoom;
      const x0 = ox + (CUT.x * A - ox) * zoom - D.left;
      const y0 = oy + (Ptop + CUT.y * A - oy) * zoom - D.top;
      const s1 = k * LAND.s;
      const x1 = C.left - D.left + LAND.tx * k;
      const y1 = C.top - D.top + LAND.ty * k;
      const eB = easeInOut(pB);
      const visible = pB > 0 || winOp > 0.01;
      gsap.set(fly, {
        x: x0 + (x1 - x0) * eB,
        y: y0 + (y1 - y0) * eB,
        scale: s0 + (s1 - s0) * eB,
        rotation: LAND.r * eB,
        visibility: visible ? 'visible' : 'hidden',
        opacity: pB > 0 ? 1 - smooth(0.82, 1, pB) : winOp,
      });
      gsap.set(bCard, { opacity: smooth(0.7, 1, pB) });

      // 착지 전까지 누끼는 심볼 창 모양으로만 보임
      if (visible && pA < 1) {
        // 현재 누끼 변환 기준으로 마스크 좌표 계산 (비행 초반 회전은 무시할 만큼 작음)
        const cs = s0 + (s1 - s0) * eB;
        const fx = x0 + (x1 - x0) * eB + D.left, fy = y0 + (y1 - y0) * eB + D.top;
        fly.style.webkitMaskImage = fly.style.maskImage = maskUrl;
        fly.style.webkitMaskSize = fly.style.maskSize = `${(r1x - r0x) / cs}px ${(r1y - r0y) / cs}px`;
        fly.style.webkitMaskPosition = fly.style.maskPosition = `${(r0x - fx) / cs}px ${(r0y - fy) / cs}px`;
      } else {
        fly.style.webkitMaskImage = fly.style.maskImage = 'none';
      }
    }

    ScrollTrigger.create({
      trigger: pinEl,
      start: () => pinTl.scrollTrigger.start - 2,
      end: () => pinTl.scrollTrigger.end + 2,
      invalidateOnRefresh: true,
      onUpdate: renderTravel,
      onRefresh: renderTravel,
      onLeaveBack: renderTravel,
      onLeave: renderTravel,
    });
    renderTravel();

    /* 인트로 영상 박스 확장: About 진입 0.6s 후 (Figma AFTER_TIMEOUT 0.6s)
       맨 위로 되돌아오면 다시 작은 박스 → 0.6s 후 확장 */
    const intro = $('.ab-intro');
    introVideo.play().catch(() => {});
    const openIntro = () => { clearTimeout(openTimer); openTimer = setTimeout(() => intro.classList.add('is-open'), 600); };
    openIntro();
    ScrollTrigger.create({
      trigger: intro, start: 'top top', end: 'bottom top',
      onLeave: () => clearTimeout(openTimer),
      onEnterBack: () => {},
    });
    ScrollTrigger.create({
      trigger: intro, start: 'top+=2 top',
      onLeaveBack: () => { intro.classList.remove('is-open'); openIntro(); },
    });

    /* 다크 섹션 영상은 보일 때만 재생 */
    ScrollTrigger.create({
      trigger: '.ab-dark__video', start: 'top bottom', end: 'bottom top',
      onToggle: (st) => (st.isActive ? darkVideo.play().catch(() => {}) : darkVideo.pause()),
    });
  }

  function enter() {
    window.scrollTo(0, 0);
    if (reduce) {
      $('.ab-intro').classList.add('is-open');
      gsap.set($$('[data-reveal]'), { opacity: 1 });
      return;
    }
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    ctx = gsap.context(build, root);
    // 이미지 로드 후 위치 재계산
    requestAnimationFrame(() => ScrollTrigger.refresh());
    root.querySelectorAll('img').forEach((img) => img.complete || img.addEventListener('load', () => ScrollTrigger.refresh(), { once: true }));
  }

  function raf(t) { lenis?.raf(t * 1000); }

  function leave() {
    clearTimeout(openTimer);
    $('.ab-intro').classList.remove('is-open');
    introVideo.pause();
    darkVideo.pause();
    ctx?.revert();
    ctx = null;
    gsap.ticker.remove(raf);
    lenis?.destroy();
    lenis = null;
    window.scrollTo(0, 0);
  }

  return { enter, leave };
}
