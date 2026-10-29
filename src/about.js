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
import brandWindowUrl from './about/brand-window.webp';
import gridUrl from './about/construction.png';
import buildingUrl from './about/building.webp';
// 임시: 인트로/다크 섹션 영상 레이어는 원본 수령 전까지 랜딩 마지막 씬 루프로 대체
import introVideoUrl from './media/scene-loop.mp4';

gsap.registerPlugin(ScrollTrigger);

const ECHO_COLORS = ['#97F9FF', '#0190FF', '#00D4A2', '#97F9FF', '#0190FF', '#00D4A2'];
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
  $('.ab-brand__img').src = brandWindowUrl;
  $('.ab-dark__grid img').src = gridUrl;
  $('.ab-dark__building img').src = buildingUrl;
  const introVideo = $('.ab-intro__video');
  introVideo.src = introVideoUrl;
  const darkVideo = $('.ab-dark__video video');
  darkVideo.src = introVideoUrl;

  /* ---------- 타이틀 잔상 레이어 생성 ---------- */
  $$('.echo').forEach((el) => {
    const html = el.innerHTML;
    el.innerHTML = '';
    ECHO_COLORS.forEach((c) => {
      const l = document.createElement('span');
      l.className = 'echo__layer';
      l.setAttribute('aria-hidden', 'true');
      l.style.color = c;
      l.innerHTML = html;
      el.appendChild(l);
    });
    const main = document.createElement('span');
    main.className = 'echo__main';
    main.innerHTML = html;
    el.appendChild(main);
  });

  // 일반 페이드업 대상
  $$('.ab-label, .ab-body, .ab-card, .ab-two__esg').forEach((el) => {
    if (!el.closest('.ab-color, .ab-epi')) el.setAttribute('data-reveal', '');
  });

  let ctx;
  let lenis;
  let openTimer;

  /* ---------- 등장 모션: Butter식 컬러 잔상 ---------- */
  function echoIn(el, delay = 0) {
    const main = el.querySelector('.echo__main');
    const layers = [...el.querySelectorAll('.echo__layer')];
    const fs = parseFloat(getComputedStyle(el).fontSize) || 40;
    const tl = gsap.timeline({ delay });
    tl.fromTo(layers,
      { opacity: 0, y: fs * 1.1, filter: 'blur(14px)' },
      {
        opacity: (i) => 0.9 - i * 0.08,
        y: (i) => fs * 0.07 * (i + 1),
        filter: (i) => `blur(${2 + i * 1.6}px)`,
        duration: 0.75, stagger: 0.045, ease: 'power3.out',
      }, 0)
      .fromTo(main,
        { opacity: 0, y: fs * 0.7 },
        { opacity: 1, y: 0, duration: 0.95, ease: 'expo.out' }, 0.18)
      .to(layers,
        { opacity: 0, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: { each: 0.04, from: 'end' }, ease: 'power2.inOut' }, 0.85);
    return tl;
  }

  function onEnter(el, fn, start = 'top 82%') {
    ScrollTrigger.create({ trigger: el, start, once: true, onEnter: () => fn(el) });
  }

  function build() {
    const H = () => $('.ab-color__pin').offsetHeight;
    const W = () => root.clientWidth;
    const a = (n) => (n * W()) / 1440;

    /* 타이틀 */
    $$('.echo').forEach((el) => {
      gsap.set(el.querySelector('.echo__main'), { opacity: 0 });
      onEnter(el, (t) => echoIn(t));
    });

    /* 일반 페이드업 */
    $$('[data-reveal]').forEach((el) => {
      onEnter(el, (t) => gsap.fromTo(t,
        { opacity: 0, y: 40 },
        { opacity: (t.classList.contains('ab-label') ? 0.5 : 1), y: 0, duration: 1.1, ease: 'expo.out' }));
    });

    /* 매니페스토: 줄별로 올라오고 하이라이트가 왼쪽부터 칠해짐 */
    const lines = $$('.ab-manifesto__art .ln');
    const hls = $$('.ab-manifesto__art .hl');
    gsap.set(lines, { opacity: 0, y: 30 });
    gsap.set(hls, { scaleX: 0 });
    onEnter($('.ab-manifesto'), () => {
      gsap.timeline()
        .to(lines, { opacity: 1, y: 0, duration: 1, stagger: 0.14, ease: 'expo.out' })
        .to(hls, { scaleX: 1, duration: 0.9, stagger: 0.1, ease: 'expo.inOut' }, 0.35);
    }, 'top 75%');

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

    /* EPILOGUE → 띠 차오름 → BRAND IDENTITY → 심볼 줌 */
    const bands = $$('.band');
    const startTops = [693, 734, 776, 817, 859];
    const startBottoms = [734, 776, 817, 859, 900];
    const endBottoms = [585, 627, 668, 710, 900];
    bands.forEach((b, i) => gsap.set(b, { '--t': `${(startTops[i] / 900) * 100}%`, '--b': `${(startBottoms[i] / 900) * 100}%` }));

    const brandSpans = $$('.ab-brand__line span');
    const win = $('.ab-brand__window');
    const winImg = $('.ab-brand__img');
    gsap.set(brandSpans, { yPercent: 110, opacity: 0 });
    gsap.set(win, { scale: 0.4, opacity: 0, transformOrigin: '50% 50%' });

    gsap.timeline({
      scrollTrigger: { trigger: '.ab-epi__pin', pin: true, start: 'top top', end: '+=320%', scrub: 0.8 },
    })
      .to('.ab-epi__text', { y: () => -a(80), opacity: 0, duration: 0.25, ease: 'power1.in' }, 0.1)
      .to(bands, {
        '--t': '0%',
        '--b': (i) => `${(endBottoms[i] / 900) * 100}%`,
        duration: 0.45, stagger: 0.05, ease: 'power3.inOut',
      }, 0.05)
      .to(brandSpans, { yPercent: 0, opacity: 1, duration: 0.25, stagger: 0.05, ease: 'expo.out' }, 0.5)
      .to(win, { scale: 1, opacity: 1, duration: 0.25, ease: 'expo.out' }, 0.55)
      // 심볼 창이 화면을 덮을 만큼 커지며 검정으로 전환 → 다크 섹션으로 이어짐
      .to(brandSpans, { opacity: 0, duration: 0.12 }, 1.0)
      .to(winImg, { opacity: 0, duration: 0.15 }, 1.0)
      .to(win, { scale: 16, duration: 0.45, ease: 'power3.in' }, 1.0);

    /* 인트로 영상 박스 확장: About 진입 0.6s 후 (Figma AFTER_TIMEOUT 0.6s) */
    introVideo.play().catch(() => {});
    openTimer = setTimeout(() => $('.ab-intro').classList.add('is-open'), 600);

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
