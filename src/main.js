import { gsap } from 'gsap';
import './fonts.css';
import './style.css';
import { buildWordmark } from './wordmark.js';
import logoUrl from './assets/forto-logo.svg';
import loopUrl from './media/hero-loop.mp4';
import enterUrl from './media/hero-enter.mp4';
import posterUrl from './media/hero-poster.jpg';

document.querySelector('.header__logo img').src = logoUrl;

const loopVideo = document.querySelector('.stage__video--loop');
const enterVideo = document.querySelector('.stage__video--enter');
const header = document.querySelector('.header');
const glyphs = buildWordmark(document.querySelector('.wordmark'));
const tagline = document.querySelector('.tagline');
const enter = document.querySelector('.enter');
const ui = [header, ...glyphs, tagline, enter];

loopVideo.poster = posterUrl;
loopVideo.src = loopUrl;
enterVideo.src = enterUrl;

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let intro;

/*
 * 랜딩 시퀀스 (Figma 프레임 1:15 → 1:33 → 1:51)
 *  1. 검은 화면에서 심볼 영상(0–4.8초 루프)이 켜짐
 *  2. 헤더가 위(-88px)에서 내려옴
 *  3. FORTO 유리 글자가 맺히고, 카피와 ENTER가 따라 올라옴
 */
function playIntro() {
  loopVideo.currentTime = 0;
  loopVideo.play().catch(() => {});

  intro = gsap.timeline({ defaults: { ease: 'expo.out' } })
    .fromTo(loopVideo, { autoAlpha: 0, scale: 1.06 },
      { autoAlpha: 1, scale: 1, duration: 2.4, ease: 'power2.out' }, 0)
    .fromTo(header, { autoAlpha: 1, yPercent: -150 },
      { yPercent: 0, duration: 1.2, ease: 'power3.out' }, 1.2)
    .fromTo(glyphs, { autoAlpha: 0, y: 24, scale: 0.96, filter: 'blur(10px)' },
      { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.4, stagger: 0.09,
        onComplete: () => gsap.set(glyphs, { clearProps: 'filter,transform' }) }, 1.8)
    .fromTo(tagline, { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 1.1 }, 2.35)
    // 1:31 → 1:55 : top 769 → 573 (196px 상승), opacity 0 → 1
    .fromTo(enter, { autoAlpha: 0, y: () => 196 * unit() },
      { autoAlpha: 1, y: 0, duration: 1.4, ease: 'power4.out' }, 2.45);
}

/* ENTER: UI가 걷히고 영상 후반부(3D 심볼 씬)로 이어짐 */
function playEnter(e) {
  e.preventDefault();
  if (document.body.classList.contains('is-entering')) return;
  document.body.classList.add('is-entering');
  intro?.progress(1);

  enterVideo.currentTime = 0;
  enterVideo.play().catch(() => {});

  gsap.timeline()
    .to(enter, { scale: 0.94, duration: 0.15, ease: 'power2.out' })
    .to(ui, { autoAlpha: 0, y: -12, filter: 'blur(8px)', duration: 0.7, stagger: 0.03, ease: 'power2.in' }, 0.1)
    .to(enterVideo, { autoAlpha: 1, duration: 0.6, ease: 'power1.inOut' }, 0.35)
    .set(loopVideo, { autoAlpha: 0 });
}

function reset() {
  gsap.killTweensOf([loopVideo, enterVideo, ...ui]);
  document.body.classList.remove('is-entering');
  enterVideo.pause();
  gsap.set(enterVideo, { autoAlpha: 0 });
  gsap.set(ui, { clearProps: 'filter,scale' });
  playIntro();
}

function unit() {
  const u = parseFloat(getComputedStyle(enter).width) / 143;
  return Number.isFinite(u) ? u : 1;
}

enter.addEventListener('click', playEnter);

if (reduce) {
  gsap.set([loopVideo, ...ui], { autoAlpha: 1 });
  loopVideo.play().catch(() => {});
} else {
  (document.fonts?.ready ?? Promise.resolve()).then(playIntro);
}

// 미리보기용: R 키로 처음부터 다시 재생
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' && !e.metaKey && !e.ctrlKey) reset();
});
