import { gsap } from 'gsap';
import './fonts.css';
import './style.css';
import { buildWordmark } from './wordmark.js';
import { createAbout } from './about.js';
import logoUrl from './assets/forto-logo.svg';
import landingUrl from './media/landing.mp4';
import loopUrl from './media/scene-loop.mp4';

document.querySelector('.header__logo img').src = logoUrl;

const landingVideo = document.querySelector('.stage__video--landing');
const loopVideo = document.querySelector('.stage__video--loop');
const header = document.querySelector('.header');
const navLinks = [...document.querySelectorAll('.header__nav a')];
const home = document.querySelector('[data-view="home"]');
const aboutEl = document.querySelector('[data-view="about"]');
const glyphs = buildWordmark(document.querySelector('.wordmark'));
const tagline = document.querySelector('.tagline');
const enter = document.querySelector('.enter');
const homeUI = [...glyphs, tagline, enter];
const about = createAbout(aboutEl);

landingVideo.src = landingUrl;
loopVideo.src = loopUrl;

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 영상 속 마지막 3D 씬에서 심볼이 들어오기 시작하는 시점(초)
const UI_CUE = 6.9;

let uiShown = false;
let introDone = false;

/* ---------- 배경 영상: 랜딩(0–9s) 1회 → 마지막 씬 루프 ---------- */
function startLoop() {
  loopVideo.currentTime = 0;
  loopVideo.play().catch(() => {});
  gsap.set(loopVideo, { autoAlpha: 1 });
  gsap.set(landingVideo, { autoAlpha: 0 });
  landingVideo.pause();
}

function playLanding() {
  gsap.set(landingVideo, { autoAlpha: 1 });
  landingVideo.currentTime = 0;
  const p = landingVideo.play();
  if (p) p.catch(() => skipIntro());   // 자동재생이 막히면 바로 최종 상태로
  watchCue();
}

landingVideo.addEventListener('ended', startLoop);

// 영상 시간을 기준으로 UI 등장 타이밍을 맞춤 (영상이 늦게 로드돼도 싱크 유지)
function watchCue() {
  const tick = () => {
    if (uiShown) return;
    if (landingVideo.currentTime >= UI_CUE) showUI();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- UI 등장: 헤더 → FORTO → 카피 → ENTER ---------- */
function showUI() {
  uiShown = true;
  gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: () => { introDone = true; } })
    .fromTo(header, { autoAlpha: 1, yPercent: -150 },
      { yPercent: 0, duration: 1.2, ease: 'power3.out' }, 0)
    .fromTo(glyphs, { autoAlpha: 0, y: 24, scale: 0.96, filter: 'blur(10px)' },
      { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.4, stagger: 0.09,
        // filter가 남아 있으면 유리 효과(backdrop-filter)가 끊기므로 정리
        onComplete: () => gsap.set(glyphs, { clearProps: 'filter,transform' }) }, 0.5)
    .fromTo(tagline, { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 1.1 }, 1.05)
    // Figma 1:31 → 1:55 : top 769 → 573 (196px 상승), opacity 0 → 1
    .fromTo(enter, { autoAlpha: 0, y: () => 196 * unit() },
      { autoAlpha: 1, y: 0, duration: 1.4, ease: 'power4.out' }, 1.15);
}

function skipIntro() {
  uiShown = true;
  introDone = true;
  startLoop();
  gsap.set([header, ...homeUI], { autoAlpha: 1, clearProps: 'transform,filter' });
}

function unit() {
  const u = parseFloat(getComputedStyle(enter).width) / 143;
  return Number.isFinite(u) ? u : 1;
}

/* ---------- 라우팅: #home / #about ---------- */
const VIEWS = { home, about: aboutEl };
let current = 'home';

function viewFromHash() {
  const key = location.hash.replace('#', '');
  return VIEWS[key] ? key : 'home';
}

function setNav(key) {
  navLinks.forEach((a) => {
    if (a.getAttribute('href') === `#${key}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function showView(key) {
  if (key === 'about') {
    document.documentElement.classList.add('is-about');
    about.enter();
  }
}

function hideView(key) {
  if (key === 'about') {
    about.leave();
    document.documentElement.classList.remove('is-about');
    loopVideo.play().catch(() => {});
  }
}

function go(key, { instant = false } = {}) {
  if (key === current) return;
  const from = VIEWS[current];
  const to = VIEWS[key];
  const prev = current;
  current = key;
  setNav(key);

  // 인트로 도중 이동하면 인트로를 마무리하고 진행
  if (!introDone) skipIntro();

  const outTargets = prev === 'home' ? homeUI : [from];
  const swap = () => {
    hideView(prev);
    from.hidden = true;
    gsap.set(outTargets, { clearProps: 'filter,y,opacity,visibility' });
    to.hidden = false;
    showView(key);
  };

  if (instant || reduce) {
    swap();
    gsap.set(key === 'home' ? homeUI : to, { autoAlpha: 1 });
    return;
  }

  const tl = gsap.timeline();
  tl.to(outTargets, { autoAlpha: 0, y: -12, filter: 'blur(8px)', duration: 0.6, stagger: 0.03, ease: 'power2.in' })
    .add(swap);
  if (key === 'home') {
    tl.fromTo(homeUI,
      { autoAlpha: 0, y: 16, filter: 'blur(8px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.05, ease: 'expo.out',
        onComplete: () => gsap.set(glyphs, { clearProps: 'filter,transform' }) });
  } else {
    // About 루트에는 transform/filter를 남기지 않음 (스크롤 고정(pin)이 깨지지 않도록)
    tl.fromTo(to, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out', clearProps: 'opacity' });
  }
}

window.addEventListener('hashchange', () => go(viewFromHash()));

/* ---------- 시작 ---------- */
gsap.set([header, ...homeUI], { autoAlpha: 0 });
gsap.set([landingVideo, loopVideo], { autoAlpha: 0 });

const initial = viewFromHash();
if (reduce || initial !== 'home') {
  skipIntro();
  if (initial !== 'home') go(initial, { instant: true });
} else {
  playLanding();
}
setNav(current);

// 미리보기용: R 키로 랜딩부터 다시 재생
window.addEventListener('keydown', (e) => {
  if (e.key !== 'r' || e.metaKey || e.ctrlKey || reduce) return;
  gsap.killTweensOf([header, ...homeUI, landingVideo, loopVideo]);
  if (current !== 'home') { history.replaceState(null, '', '#home'); go('home', { instant: true }); }
  uiShown = false; introDone = false;
  loopVideo.pause();
  gsap.set([header, ...homeUI, loopVideo], { autoAlpha: 0 });
  playLanding();
});
