import { gsap } from 'gsap';
import './plus.css';
import { createMoon } from './moon.js';
import { symbolSVG } from './symbol.js';
import { KEYWORD_LIST, PICK } from './keywords.js';
import { LIVE, listFortos, addForto, pickSpot } from './store.js';

/*
 * PLUS — 사용자 흐름
 * 1 달 탐색 → 2 FIND → 3 이름·키워드 5개 → 4 MAKE로 사방위표 확인(다시 고르기 가능)
 * → 5 달에 남기기(좌표 하나에 등록) → 6 달 위 사방위표를 눌러 다른 사람 발견
 */
const fmtCoord = (lat, lng) => `${lat >= 0 ? 'N' : 'S'} ${Math.abs(lat).toFixed(2)}° · ${lng >= 0 ? 'E' : 'W'} ${Math.abs(lng).toFixed(2)}°`;
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createPlus(root) {
  const $ = (s) => root.querySelector(s);
  const canvas = $('.pl-moon');
  const pinsEl = $('.pl-pins');
  const intro = $('.pl-intro');
  const meta = $('.pl-meta');
  const panel = $('.pl-panel');
  const form = $('.pl-form');
  const nameIn = $('.pl-name');
  const chipsEl = $('.pl-chips');
  const countEl = $('.pl-keys__count');
  const makeBtn = $('.pl-make');
  const result = $('.pl-result');
  const card = $('.pl-card');

  let moon = null;
  let entries = [];
  const pins = new Map();          // id → { el, entry }
  let selected = [];
  let draft = null;
  let state = 'explore';           // explore | panel
  let focusedId = null;

  /* ---------- 키워드 칩 ---------- */
  chipsEl.innerHTML = KEYWORD_LIST.map((k) => `<button type="button" class="pl-chip" aria-pressed="false" data-k="${k}">${k}</button>`).join('');
  const chips = [...chipsEl.children];
  const syncForm = () => {
    chips.forEach((c) => {
      const on = selected.includes(c.dataset.k);
      c.setAttribute('aria-pressed', on);
      c.disabled = !on && selected.length >= PICK;
    });
    countEl.textContent = `${selected.length} / ${PICK}`;
    makeBtn.disabled = !(nameIn.value.trim() && selected.length === PICK);
  };
  chipsEl.addEventListener('click', (e) => {
    const c = e.target.closest('.pl-chip');
    if (!c) return;
    const k = c.dataset.k;
    selected = selected.includes(k) ? selected.filter((x) => x !== k) : selected.length < PICK ? [...selected, k] : selected;
    syncForm();
  });
  nameIn.addEventListener('input', syncForm);

  /* ---------- 핀 ---------- */
  function addPin(entry) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pl-pin';
    el.setAttribute('aria-label', `${entry.name}의 사방위표`);
    el.innerHTML = `<span class="pl-pin__glow"></span><span class="pl-pin__sym">${symbolSVG(entry.keywords, { layers: 10 })}</span><span class="pl-pin__name">${esc(entry.name)}</span>`;
    el.addEventListener('click', () => openCard(entry));
    pinsEl.appendChild(el);
    pins.set(entry.id, { el, entry, p: {} });
  }
  const R_PX = () => moon.radiusPx();
  function placePins() {
    const r = R_PX();
    const size = Math.max(16, Math.min(46, r * 0.075));
    pins.forEach(({ el, entry, p }) => {
      moon.project(entry.lat, entry.lng, p);
      const f = p.facing;
      if (f < 0.05) { if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden'; return; }
      el.style.visibility = 'visible';
      const s = size * (0.45 + 0.55 * f);
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.setProperty('--s', `${s.toFixed(1)}px`);
      el.style.opacity = Math.min(1, (f - 0.05) * 5).toFixed(2);
      el.classList.toggle('is-focus', entry.id === focusedId);
    });
  }

  /* ---------- 카드 (다른 사람의 사방위표) ---------- */
  function openCard(entry, note = '') {
    focusedId = entry.id;
    $('.pl-card__art').innerHTML = symbolSVG(entry.keywords, { layers: 56 });
    $('.pl-card__note').textContent = note;
    $('.pl-card__note').hidden = !note;
    $('.pl-card__name').textContent = entry.name;
    $('.pl-card__tags').innerHTML = entry.keywords.map((k) => `<li>${esc(k)}</li>`).join('');
    $('.pl-card__coord').textContent = fmtCoord(entry.lat, entry.lng);
    if (card.hidden) {
      card.hidden = false;
      gsap.fromTo(card, { autoAlpha: 0, y: 24, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out', clearProps: 'filter' });
    } else {
      gsap.fromTo(card.children, { autoAlpha: 0.2 }, { autoAlpha: 1, duration: 0.4, stagger: 0.03 });
    }
    moon.focus(entry.lat, entry.lng, { duration: 1.4, tilt: state === 'panel' ? 0 : (mobile() ? -0.3 : -0.5) });
  }
  function closeCard() {
    focusedId = null;
    gsap.to(card, { autoAlpha: 0, y: 16, duration: 0.35, ease: 'power2.in', onComplete: () => { card.hidden = true; } });
  }
  $('.pl-card__close').addEventListener('click', closeCard);

  /* ---------- 화면 전환 ---------- */
  const mobile = () => window.matchMedia('(max-width: 800px)').matches;
  const shift = { x: 0, y: 0 };
  function layout(to, dur = 1.2) {
    const target = to === 'panel'
      ? (mobile() ? { x: 0, y: -0.3 } : { x: 0.24, y: 0.02 })
      : (mobile() ? { x: 0, y: 0.2 } : { x: 0, y: 0.5 });
    gsap.to(shift, { ...target, duration: dur, ease: 'expo.inOut', onUpdate: () => moon?.setViewShift(shift.x, shift.y) });
    moon?.setDist(to === 'panel' ? (mobile() ? 9 : 4.6) : (mobile() ? 4.6 : 2.95));
  }

  function openPanel() {
    state = 'panel';
    if (!card.hidden) closeCard();
    root.classList.add('is-panel');
    panel.setAttribute('aria-hidden', 'false');
    showForm(false);
    gsap.to([intro, meta], { autoAlpha: 0, y: -14, duration: 0.5, ease: 'power2.in' });
    gsap.fromTo(panel, { xPercent: mobile() ? 0 : -100, yPercent: mobile() ? 100 : 0, autoAlpha: 1 }, { xPercent: 0, yPercent: 0, duration: 1, ease: 'expo.out' });
    gsap.fromTo(form.children, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'expo.out', delay: 0.25 });
    layout('panel');
    setTimeout(() => nameIn.focus({ preventScroll: true }), 700);
  }
  function closePanel() {
    state = 'explore';
    root.classList.remove('is-panel');
    panel.setAttribute('aria-hidden', 'true');
    gsap.to(panel, { xPercent: mobile() ? 0 : -100, yPercent: mobile() ? 100 : 0, duration: 0.8, ease: 'expo.inOut' });
    gsap.to([intro, meta], { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', delay: 0.35 });
    layout('explore');
  }
  $('.pl-intro__find').addEventListener('click', openPanel);
  $('.pl-panel__close').addEventListener('click', closePanel);

  function showForm(animate = true) {
    result.hidden = true;
    form.hidden = false;
    if (animate) gsap.fromTo(form, { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'expo.out' });
  }

  /* ---------- MAKE: 사방위표 생성 ---------- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (makeBtn.disabled) return;
    draft = { name: nameIn.value.trim(), keywords: [...selected] };
    form.hidden = true;
    result.hidden = false;
    $('.pl-result__name').textContent = draft.name;
    $('.pl-result__tags').innerHTML = draft.keywords.map((k) => `<li>${esc(k)}</li>`).join('');
    $('.pl-result__msg').textContent = '';
    const art = $('.pl-result__art');
    art.innerHTML = symbolSVG(draft.keywords, { layers: 64 });
    const uses = [...art.querySelectorAll('use')];
    // 압출이 뒤에서부터 차오르며 심볼이 맺힘
    const offs = uses.map((u) => ({ u, x: +u.getAttribute('x') || 0, y: +u.getAttribute('y') || 0 }));
    const st = { k: 0 };
    gsap.timeline()
      .fromTo(result.children, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.06, ease: 'expo.out' }, 0)
      .fromTo(art, { scale: 0.86, filter: 'blur(10px)' }, { scale: 1, filter: 'blur(0px)', duration: 1, ease: 'expo.out', clearProps: 'filter' }, 0)
      .to(st, { k: 1, duration: 1.6, ease: 'expo.inOut', onUpdate: () => offs.forEach(({ u, x, y }) => { u.setAttribute('x', (x * st.k).toFixed(2)); u.setAttribute('y', (y * st.k).toFixed(2)); }) }, 0.1);
    $('.pl-save').disabled = false;
  });
  $('.pl-redo').addEventListener('click', () => showForm());

  /* ---------- 달에 남기기 ---------- */
  $('.pl-save').addEventListener('click', async () => {
    if (!draft) return;
    const btn = $('.pl-save');
    btn.disabled = true;
    $('.pl-result__msg').textContent = '달에 남기는 중…';
    try {
      const spot = pickSpot(entries);
      const saved = await addForto({ ...draft, ...spot });
      entries.push(saved);
      addPin(saved);
      updateCount();
      closePanel();
      // 새 핀으로 달을 돌리고 카드 열기
      setTimeout(() => openCard(saved, '달에 남겨졌어요'), 500);
      const pin = pins.get(saved.id)?.el;
      pin?.classList.add('is-new');
      setTimeout(() => pin?.classList.remove('is-new'), 6000);
      selected = [];
      nameIn.value = '';
      syncForm();
    } catch (err) {
      console.warn('[plus]', err);
      $('.pl-result__msg').textContent = '저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
      btn.disabled = false;
    }
  });

  function updateCount() { $('.pl-count').textContent = entries.length.toLocaleString(); }

  async function load() {
    try {
      entries = await listFortos();
    } catch (err) {
      console.warn('[plus] load', err);
      entries = [];
    }
    pins.forEach(({ el }) => el.remove());
    pins.clear();
    entries.forEach(addPin);
    updateCount();
    $('.pl-meta__demo').hidden = LIVE;
  }

  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    if (!card.hidden) closeCard();
    else if (state === 'panel') closePanel();
  };

  function enter() {
    if (!moon) {
      try {
        moon = createMoon(canvas, { onFrame: placePins });
      } catch (err) {
        console.warn('[plus] webgl', err);
        root.classList.add('no-gl');
      }
      load();
    } else {
      moon.resize();
    }
    state = 'explore';
    root.classList.remove('is-panel');
    gsap.set(panel, { xPercent: mobile() ? 0 : -100, yPercent: mobile() ? 100 : 0 });
    panel.setAttribute('aria-hidden', 'true');
    card.hidden = true;
    layout('explore', 0);
    moon?.start();
    window.addEventListener('keydown', onKey);
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .fromTo(canvas, { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: 2.2, clearProps: 'transform' }, 0)
      .fromTo(intro.children, { autoAlpha: 0, y: 24, filter: 'blur(10px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, stagger: 0.1, clearProps: 'filter' }, 0.5)
      .fromTo(meta, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 1.1);
    gsap.set(intro, { autoAlpha: 1, y: 0 });
  }

  function leave() {
    moon?.stop();
    window.removeEventListener('keydown', onKey);
  }

  syncForm();
  return { enter, leave };
}
