import { gsap } from 'gsap';
import './experience.css';
import jejuVideo from './experience/jeju-terminal.mp4';
import jejuPoster from './experience/jeju-terminal.jpg';
import lunarVideo from './experience/rocket-to-lunar.mp4';
import lunarPoster from './experience/rocket-to-lunar.jpg';

/*
 * Experience — Figma page "experience" (15:864)
 * 화면 전체를 덮는 검정 프레임에 FORTO 심볼 모양 창이 뚫려 있고, 그 안에서 프로젝트 영상이 재생됨.
 * 스크롤(휠·스와이프·방향키) 한 번 = 다음/이전 프로젝트 (milledollars.fr 문법)
 *   1) 재생 중인 영상이 그 프레임에서 멈춤 (이미지 상태)
 *   2) 심볼 창이 좁아짐 (16:1083 → 16:1147) + 제목이 빠짐
 *   3) 좁아진 창 안으로 다음 프로젝트 정지 화면이 아래에서 밀고 올라옴
 *   4) 창이 다시 활짝 열림 (16:1147 → 16:1200 → 16:1083) + 새 제목 등장
 *   5) 정지 화면이 다시 영상으로 재생
 */
const PROJECTS = [
  { title: 'FORTO JEJU TERMINAL', sub: 'First Encounter', video: jejuVideo, poster: jejuPoster },
  { title: 'FORTO ROCKET TO LUNAR', sub: 'First Encounter', video: lunarVideo, poster: lunarPoster },
];

// Figma 벡터 (1440×810 프레임 좌표). 세 경로 모두 같은 명령 구조라 숫자끼리 보간 가능
const P_FULL = 'M 1439.0269775390625 395.007916033402 L 1439.0269775390625 376.0824547901739 L 1062.787353515625 376.0824547901739 C 1244.5759887695312 365.5830258991238 1392.5 218.81160544048586 1392.5 51.12956887425816 C 1392.5 33.74816226950918 1390.9295966625214 16.67556247258287 1388.033935546875 0 L 359.65093994140625 0 C 362.35028529167175 16.057950573551338 363.8226318359375 32.512935038218494 363.8226318359375 49.27672802732213 C 363.8226318359375 228.16405049136964 203.92325353622437 373.4355399382812 5.595006465911865 376.0824547901739 L 0 376.0824547901739 L 0 376.52361080600537 L 0 395.05202614182093 L 440.1896057128906 395.05202614182093 L 149.6909637451172 810.0441284179688 L 1148.5283203125 810.0441284179688 L 1439.0269775390625 395.05202614182093 L 1439.0269775390625 395.007916033402 Z';
const P_NARROW_LOCAL = 'M 796.71630859375 395.0079345703125 L 796.71630859375 376.08245849609375 L 420.4769592285156 376.08245849609375 C 602.2655944824219 365.5830297470093 750.189453125 218.81160736083984 750.189453125 51.12957000732422 C 750.189453125 33.7481632232666 748.6190497875214 16.675561904907227 745.723388671875 0 L 359.65093994140625 0 C 362.35028529167175 16.057950973513016 363.8226318359375 32.512935638427734 363.8226318359375 49.276729583740234 C 363.8226318359375 228.16405868530273 203.92325353622437 373.4355435371399 5.595006465911865 376.08245849609375 L 0 376.08245849609375 L 0 376.52362060546875 L 0 395.0520324707031 L 440.1896057128906 395.0520324707031 L 149.6909637451172 810.0441284179688 L 506.218017578125 810.0441284179688 L 796.71630859375 395.0520324707031 L 796.71630859375 395.0079345703125 Z';
const P_OVER_LOCAL = 'M 1440.0267333984375 405.41473388671875 L 1440.0267333984375 386.4892578125 L 1063.787353515625 386.4892578125 C 1245.5759887695312 375.9898290634155 1393.4998779296875 229.21842193603516 1393.4998779296875 61.53638458251953 C 1393.4998779296875 44.154977798461914 1391.9294745922089 27.08237648010254 1389.0338134765625 10.406814575195312 L 368.8919677734375 0 C 371.66067123413086 16.470550537109375 373.17083740234375 33.34833526611328 373.17083740234375 50.54286575317383 C 373.17083740234375 234.0265998840332 209.16294622421265 383.03074049949646 5.738767147064209 385.74566650390625 L 0 385.74566650390625 L 0 386.19818115234375 L 0 405.20269775390625 L 451.5000305175781 405.20269775390625 L 153.5371856689453 830.8577270507812 L 1149.5284423828125 820.450927734375 L 1440.0267333984375 405.4588623046875 L 1440.0267333984375 405.41473388671875 Z';

const tokens = (d) => d.split(/\s+/);
// 경로 숫자에 프레임 내 위치(dx, dy)를 더해 절대 좌표로
function absolute(d, dx, dy) {
  let i = 0;
  return tokens(d).map((t) => {
    if (/^[A-Za-z]$/.test(t)) return t;
    const v = +t + (i++ % 2 === 0 ? dx : dy);
    return v;
  });
}
const A_FULL = absolute(P_FULL, 0, 0);
const A_NARROW = absolute(P_NARROW_LOCAL, 602.3104248046875, 0);
const A_OVER = absolute(P_OVER_LOCAL, -1, -10.406814575195312);
const lerpPath = (a, b, t) => a.map((v, i) => (typeof v === 'number' ? (v + (b[i] - v) * t).toFixed(2) : v)).join(' ');
const FRAME = 'M -2000 -2000 H 3440 V 2810 H -2000 Z ';   // 화면을 넉넉히 덮는 바깥 사각형 (evenodd로 창을 뚫음)

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createExperience(root) {
  const $ = (s) => root.querySelector(s);
  const layers = [$('.xp-layer--a'), $('.xp-layer--b')];
  const maskPath = $('.xp-mask path');
  const titleEl = $('.xp-title');
  const subEl = $('.xp-sub');
  let index = 0;
  let front = 0;            // 지금 보이는 레이어
  let busy = false;
  let active = false;
  let wheelAcc = 0;
  let wheelTimer;
  let touchY = null;
  const shape = { t: 0, o: 0 }; // t: full→narrow, o: full→over

  const setMask = () => {
    const base = shape.o > 0 ? lerpPath(A_FULL, A_OVER, shape.o) : lerpPath(A_FULL, A_NARROW, shape.t);
    maskPath.setAttribute('d', FRAME + base);
  };

  function load(layer, p, { play = false } = {}) {
    const v = layer.querySelector('video');
    if (v.dataset.src !== p.video) {
      v.dataset.src = p.video;
      v.src = p.video;
      v.poster = p.poster;
    }
    v.currentTime = 0;
    if (play) v.play().catch(() => {});
    else v.pause();
  }

  function setText(p) {
    titleEl.textContent = p.title;
    subEl.textContent = p.sub;
  }

  function go(dir) {
    if (busy || !active) return;
    const next = index + dir;
    if (next < 0 || next >= PROJECTS.length) return;
    busy = true;

    const cur = layers[front];
    const nxt = layers[1 - front];
    const curV = cur.querySelector('video');
    curV.pause();                                     // 1) 현재 영상 정지 (이미지 상태)
    load(nxt, PROJECTS[next]);                        // 다음 영상은 첫 프레임에 정지
    gsap.set(nxt, { zIndex: 2, yPercent: dir > 0 ? 100 : -100, scale: 1.18 });
    gsap.set(cur, { zIndex: 1 });

    const textOut = [titleEl, subEl];
    gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        index = next;
        front = 1 - front;
        gsap.set(cur, { yPercent: 0, scale: 1, zIndex: 0 });
        nxt.querySelector('video').play().catch(() => {});   // 5) 다시 영상으로
        busy = false;
      },
    })
      // 2) 창이 좁아지고, 정지된 현재 장면은 살짝 밀려남
      .to(shape, { t: 1, duration: 0.7, onUpdate: setMask }, 0)
      .to(cur, { yPercent: dir > 0 ? -18 : 18, scale: 1.06, duration: 1.1, ease: 'power2.inOut' }, 0)
      .to(textOut, { y: dir > 0 ? -18 : 18, opacity: 0, filter: 'blur(6px)', duration: 0.4, ease: 'power2.in' }, 0)
      // 3) 다음 프로젝트 정지 화면이 좁은 창 안으로 밀고 올라옴
      .to(nxt, { yPercent: 0, duration: 0.85, ease: 'expo.out' }, 0.45)
      .add(() => { index = next; setText(PROJECTS[next]); }, 0.75)
      // 4) 창이 살짝 넘치게 열렸다가 제자리 (16:1147 → 16:1200 → 16:1083)
      .to(shape, { t: 0, duration: 0.6, ease: 'expo.out', onUpdate: setMask }, 0.85)
      .to(shape, { o: 1, duration: 0.3, ease: 'power2.out', onUpdate: setMask }, 0.95)
      .to(shape, { o: 0, duration: 0.5, ease: 'power2.inOut', onUpdate: setMask }, 1.25)
      .to(nxt, { scale: 1, duration: 1.2, ease: 'expo.out' }, 0.85)
      .fromTo(textOut, { y: dir > 0 ? 18 : -18, opacity: 0, filter: 'blur(6px)' },
        { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out', stagger: 0.06 }, 0.95);
  }

  /* ---------- 입력: 휠·터치·키보드 ---------- */
  const onWheel = (e) => {
    e.preventDefault();
    if (busy) { wheelAcc = 0; return; }
    wheelAcc += e.deltaY;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelAcc = 0; }, 160);
    if (Math.abs(wheelAcc) > 40) { go(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
  };
  const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
  const onTouchMove = (e) => { if (touchY != null) e.preventDefault(); };
  const onTouchEnd = (e) => {
    if (touchY == null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) > 40) go(dy > 0 ? 1 : -1);
  };
  const onKey = (e) => {
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(1); }
    if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); go(-1); }
  };

  function enter() {
    active = true;
    index = 0;
    front = 0;
    shape.t = 0; shape.o = 0;
    setMask();
    setText(PROJECTS[0]);
    gsap.set(layers, { yPercent: 0, scale: 1, zIndex: 0 });
    gsap.set(layers[0], { zIndex: 1 });
    load(layers[0], PROJECTS[0], { play: true });
    load(layers[1], PROJECTS[1]);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('keydown', onKey);

    if (!reduce) {
      // 진입: 좁은 창에서 시작해 열리며 제목 등장
      shape.t = 1; setMask();
      gsap.timeline()
        .to(shape, { t: 0, duration: 1.1, ease: 'expo.out', onUpdate: setMask }, 0.15)
        .fromTo(layers[0], { scale: 1.15 }, { scale: 1, duration: 1.4, ease: 'expo.out' }, 0.15)
        .fromTo([titleEl, subEl], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: 'expo.out' }, 0.45);
    }
  }

  function leave() {
    active = false;
    busy = false;
    gsap.killTweensOf([shape, ...layers, titleEl, subEl]);
    layers.forEach((l) => l.querySelector('video').pause());
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('keydown', onKey);
  }

  setMask();
  return { enter, leave };
}
