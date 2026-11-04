import { gsap } from 'gsap';
import './plus.css';
import { createMoon } from './moon.js';
import { symbolSVG } from './symbol.js';
import { KEYWORD_LIST, PICK } from './keywords.js';
import { listFortos, addForto, pickSpot } from './store.js';
import mapUrl from './tex/moon-map.jpg';
import { createKeyboard, isKiosk } from './keyboard.js';
import Hangul from 'hangul-js';

/*
 * PLUS — 사용자 흐름
 * 1 달 탐색 → 2 FIND → 3 이름·키워드 5개 → 4 MAKE로 사방위표 확인(다시 고르기 가능)
 * → 5 달에 남기기(좌표 하나에 등록) → 6 달 위 사방위표·아카이브 필름을 눌러 다른 사람 발견
 */
const pad = (n, l = 3) => String(n).padStart(l, '0');
const fmtLat = (v) => `${v >= 0 ? 'N' : 'S'} ${Math.abs(v).toFixed(2)}°`;
const fmtLng = (v) => `${v >= 0 ? 'E' : 'W'} ${Math.abs(v).toFixed(2)}°`;
const fmtDate = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? '—' : `${d.getFullYear()}.${pad(d.getMonth() + 1, 2)}.${pad(d.getDate(), 2)}`; };
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kwList = (ks) => ks.map((k, i) => `<li><em>${pad(i + 1, 2)}</em>${esc(k)}</li>`).join('');

export function createPlus(root) {
  const $ = (s) => root.querySelector(s);
  const canvas = $('.pl-moon');
  const pinsEl = $('.pl-pins');
  const intro = $('.pl-intro');
  const panel = $('.pl-panel');
  const form = $('.pl-form');
  const nameIn = $('.pl-name');
  const chipsEl = $('.pl-chips');
  const countEl = $('.pl-keys__count');
  const makeBtn = $('.pl-make');
  const result = $('.pl-result');
  const card = $('.pl-card');
  const lead = $('.pl-lead');
  const leadLine = lead.querySelector('line');
  const leadDot = lead.querySelector('circle');
  const map = $('.pl-map');
  const mapDots = $('.pl-map__dots');
  const mapView = $('.pl-map__view');
  const archive = $('.pl-archive');
  const track = $('.pl-film__track');
  const read = $('.pl-read');
  const search = $('.pl-search');
  const chrome = [intro, map, archive, read, search];

  $('.pl-map__img').style.backgroundImage = `url(${mapUrl})`;

  let moon = null;
  let entries = [];
  const pins = new Map();
  let selected = [];
  let draft = null;
  let state = 'explore';
  let focusedId = null;

  /* ---------- 키워드 ---------- */
  chipsEl.innerHTML = KEYWORD_LIST.map((k) => `<button type="button" class="pl-chip" aria-pressed="false" data-k="${k}">${k}</button>`).join('');
  const chips = [...chipsEl.children];
  const syncForm = () => {
    chips.forEach((c) => {
      const i = selected.indexOf(c.dataset.k);
      c.setAttribute('aria-pressed', i >= 0);
      c.dataset.n = i >= 0 ? pad(i + 1, 2) : '';
      c.disabled = i < 0 && selected.length >= PICK;
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

  /* ---------- 터치 화면: FORTO 화면 키보드 ---------- */
  let kb = null;
  if (isKiosk()) {
    root.classList.add('is-kiosk');
    kb = createKeyboard(root);
    kb.attach(nameIn);
    kb.attach($('.pl-search__input'));
    $('.pl-search__input').addEventListener('pointerdown', () => kb.show());
    nameIn.addEventListener('pointerdown', () => kb.show());
    // 패널의 다른 곳(키워드 등)을 누르면 키보드를 내림
    panel.addEventListener('pointerdown', (e) => { if (kb.open && e.target !== nameIn) kb.hide(); });
  }

  /* ---------- 핀 (달 표면) ---------- */
  function addPin(entry) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pl-pin';
    el.setAttribute('aria-label', `${entry.name}의 사방위표`);
    el.innerHTML = `<i class="pl-pin__ret"></i><span class="pl-pin__sym">${symbolSVG(entry.keywords, { flat: true })}</span><span class="pl-pin__tag"><b>${esc(entry.name)}</b>${fmtLat(entry.lat)} ${fmtLng(entry.lng)}</span>`;
    el.addEventListener('click', () => openCard(entry));
    pinsEl.appendChild(el);
    const dot = document.createElement('i');
    dot.style.left = `${((entry.lng + 180) / 360) * 100}%`;
    dot.style.top = `${((90 - entry.lat) / 180) * 100}%`;
    mapDots.appendChild(dot);
    pins.set(entry.id, { el, entry, dot, p: {} });
  }

  let tick = 0;
  let cardRect = null;
  function onFrame() {
    const r = moon.radiusPx();
    const size = Math.max(14, Math.min(30, r * 0.05));
    let focusP = null;
    pins.forEach(({ el, entry, p, dot }) => {
      moon.project(entry.lat, entry.lng, p);
      const f = p.facing;
      const on = entry.id === focusedId;
      if (on) focusP = f > 0.05 ? p : null;
      if (f < 0.05) { if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden'; return; }
      el.style.visibility = 'visible';
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.setProperty('--s', `${(size * (0.5 + 0.5 * f)).toFixed(1)}px`);
      el.style.opacity = Math.min(1, (f - 0.05) * 4).toFixed(2);
      if (on !== el.classList.contains('is-focus')) { el.classList.toggle('is-focus', on); dot.classList.toggle('is-focus', on); }
    });
    // 핀 → 카드 지시선
    if (focusP && cardRect && !card.hidden) {
      const mob = cardRect.top > window.innerHeight * 0.55 && cardRect.width > window.innerWidth * 0.7;
      const x2 = mob ? Math.min(Math.max(focusP.x, cardRect.left + 20), cardRect.right - 20) : cardRect.left;
      const y2 = mob ? cardRect.top : Math.min(Math.max(focusP.y, cardRect.top + 20), cardRect.top + 120);
      leadLine.setAttribute('x1', focusP.x.toFixed(1)); leadLine.setAttribute('y1', focusP.y.toFixed(1));
      leadLine.setAttribute('x2', x2.toFixed(1)); leadLine.setAttribute('y2', y2.toFixed(1));
      leadDot.setAttribute('cx', x2.toFixed(1)); leadDot.setAttribute('cy', y2.toFixed(1));
      lead.classList.add('is-on');
    } else lead.classList.remove('is-on');

    if (++tick % 6) return;
    const c = moon.viewCenter();
    $('.pl-read__lat').textContent = fmtLat(c.lat);
    $('.pl-read__lng').textContent = fmtLng(c.lng);
    $('.pl-read__zoom').textContent = `${moon.zoom().toFixed(2)}x`;
    $('.pl-map__coord').textContent = `${fmtLat(c.lat)} ${fmtLng(c.lng)}`;
    mapView.style.left = `${((c.lng + 180) / 360) * 100}%`;
    mapView.style.top = `${((90 - c.lat) / 180) * 100}%`;
    if (tick % 60 === 0) {
      const now = new Date(Date.now() + 9 * 3600e3);
      $('.pl-read__time').textContent = `${pad(now.getUTCHours(), 2)}:${pad(now.getUTCMinutes(), 2)}`;
    }
  }

  /* ---------- 아카이브 필름 ---------- */
  const film = { x: 0, v: 0, target: 34, w: 0 };
  function renderFilm() {
    const list = [...entries].reverse();               // 최근 것이 먼저
    const frame = (e) => {
      const n = entries.indexOf(e) + 1;
      return `<button type="button" class="pl-frame" data-id="${esc(e.id)}" aria-label="${esc(e.name)}의 사방위표 보기">
        <span class="pl-frame__edge">FORTO ${pad(n)}<i>-</i>${pad(n)}A</span>
        <span class="pl-frame__pic">${symbolSVG(e.keywords, { layers: 26 })}<span class="pl-frame__name">${esc(e.name)}</span></span>
        <span class="pl-frame__edge pl-frame__edge--b">${esc(e.keywords.slice(0, 2).join(' · '))}<i>${fmtDate(e.created_at)}</i></span>
      </button>`;
    };
    const one = list.map(frame).join('');
    track.innerHTML = `<div class="pl-film__set">${one}</div><div class="pl-film__set" aria-hidden="true">${one}</div>`;
    track.querySelectorAll('[aria-hidden="true"] button').forEach((b) => b.setAttribute('tabindex', '-1'));
    $('.pl-archive__n').textContent = `${pad(entries.length)} FRAMES`;
    requestAnimationFrame(() => { film.w = track.firstElementChild?.offsetWidth || 0; });
  }
  track.addEventListener('click', (e) => {
    const b = e.target.closest('.pl-frame');
    if (!b) return;
    const entry = entries.find((x) => String(x.id) === b.dataset.id);
    if (entry) openCard(entry);
  });
  archive.addEventListener('pointerenter', () => { film.target = 0; });
  archive.addEventListener('pointerleave', () => { film.target = 34; });
  $('.pl-archive__toggle').addEventListener('click', () => archive.classList.toggle('is-min'));
  let filmRaf = 0;
  let filmLast = 0;
  function filmLoop(now) {
    filmRaf = requestAnimationFrame(filmLoop);
    const dt = Math.min(0.05, (now - (filmLast || now)) / 1000);
    filmLast = now;
    film.v += (film.target - film.v) * Math.min(1, dt * 4);
    if (!film.w) return;
    film.x -= film.v * dt;
    if (film.x <= -film.w) film.x += film.w;
    track.style.transform = `translate3d(${film.x.toFixed(2)}px,0,0)`;
  }

  /* ---------- 카드 ---------- */
  function openCard(entry, note = '') {
    focusedId = entry.id;
    const n = entries.indexOf(entry) + 1;
    $('.pl-card__id').textContent = `FORTO / ${pad(n, 4)}`;
    $('.pl-card__note').textContent = note;
    $('.pl-card__art').innerHTML = symbolSVG(entry.keywords, { layers: 56 });
    $('.pl-card__name').textContent = entry.name;
    $('.pl-card__tags').innerHTML = kwList(entry.keywords);
    $('.pl-card__coord').textContent = `${fmtLat(entry.lat)}  ${fmtLng(entry.lng)}`;
    $('.pl-card__date').textContent = fmtDate(entry.created_at);
    const first = card.hidden;
    root.classList.add('has-card');
    card.hidden = false;
    cardRect = card.getBoundingClientRect();
    if (first) gsap.fromTo(card, { autoAlpha: 0, x: 16 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'expo.out', onComplete: () => { cardRect = card.getBoundingClientRect(); } });
    else gsap.fromTo(card.querySelectorAll('.pl-card__art, .pl-card__body'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, stagger: 0.05 });
    moon.focus(entry.lat, entry.lng, { duration: 1.4, tilt: state === 'panel' ? 0 : (mobile() ? -0.3 : -0.5) });
  }
  function closeCard() {
    focusedId = null;
    gsap.to(card, { autoAlpha: 0, x: 12, duration: 0.3, ease: 'power2.in', onComplete: () => { card.hidden = true; root.classList.remove('has-card'); } });
  }
  $('.pl-card__close').addEventListener('click', closeCard);
  window.addEventListener('resize', () => { if (!card.hidden) cardRect = card.getBoundingClientRect(); });

  /* ---------- 화면 전환 ---------- */
  const mobile = () => window.matchMedia('(max-width: 800px)').matches;
  const shift = { x: 0, y: 0 };
  function layout(to, dur = 1.2) {
    const target = to === 'panel'
      ? (mobile() ? { x: 0, y: -0.3 } : { x: 0.24, y: 0.02 })
      : (mobile() ? { x: 0, y: 0.14 } : { x: 0, y: 0.54 });
    gsap.to(shift, { ...target, duration: dur, ease: 'expo.out', onUpdate: () => moon?.setViewShift(shift.x, shift.y) });
    moon?.setDist(to === 'panel' ? (mobile() ? 9 : 4.6) : (mobile() ? 4.8 : 3.1), dur === 0);
  }

  function openPanel() {
    state = 'panel';
    closeSearch();
    if (!card.hidden) closeCard();
    root.classList.add('is-panel');
    panel.setAttribute('aria-hidden', 'false');
    showForm(false);
    gsap.to(chrome, { autoAlpha: 0, duration: 0.45, ease: 'power2.in' });
    gsap.fromTo(panel, { xPercent: mobile() ? 0 : -100, yPercent: mobile() ? 100 : 0 }, { xPercent: 0, yPercent: 0, duration: 1, ease: 'expo.out' });
    gsap.fromTo(form.children, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'expo.out', delay: 0.25 });
    layout('panel', 1.3);
    moon?.spin(1.05, -0.12, 1.5);      // 옆으로 가며 휙 돌아 자리 잡음
    // 패널이 자리 잡으면 이름 입력칸 활성화 → 터치 화면에서는 FORTO 키보드가 바로 올라옴
    setTimeout(() => { if (state === 'panel' && !form.hidden) nameIn.focus({ preventScroll: true }); }, 650);
  }
  function closePanel() {
    kb?.hide();
    state = 'explore';
    root.classList.remove('is-panel');
    panel.setAttribute('aria-hidden', 'true');
    gsap.to(panel, { xPercent: mobile() ? 0 : -100, yPercent: mobile() ? 100 : 0, duration: 0.8, ease: 'expo.inOut' });
    gsap.to(chrome, { autoAlpha: 1, duration: 0.8, ease: 'expo.out', delay: 0.35 });
    layout('explore', 1.3);
    moon?.spin(-1.05, 0.12, 1.5);
  }
  $('.pl-intro__find').addEventListener('click', openPanel);
  $('.pl-panel__close').addEventListener('click', closePanel);

  function showForm(animate = true) {
    result.hidden = true;
    form.hidden = false;
    if (animate) gsap.fromTo(form, { autoAlpha: 0, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'expo.out' });
  }

  /* ---------- MAKE ---------- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (makeBtn.disabled) return;
    kb?.hide();
    draft = { name: nameIn.value.trim(), keywords: [...selected] };
    form.hidden = true;
    result.hidden = false;
    $('.pl-result__name').textContent = draft.name;
    $('.pl-result__tags').innerHTML = kwList(draft.keywords);
    $('.pl-result__msg').textContent = '';
    const art = $('.pl-result__art');
    art.querySelector('svg')?.remove();
    art.insertAdjacentHTML('beforeend', symbolSVG(draft.keywords, { layers: 64 }));
    const offs = [...art.querySelectorAll('use')].map((u) => ({ u, x: +u.getAttribute('x') || 0, y: +u.getAttribute('y') || 0 }));
    const st = { k: 0 };
    gsap.timeline()
      .fromTo(result.children, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.05, ease: 'expo.out' }, 0)
      .to(st, { k: 1, duration: 1.6, ease: 'expo.inOut', onUpdate: () => offs.forEach(({ u, x, y }) => { u.setAttribute('x', (x * st.k).toFixed(2)); u.setAttribute('y', (y * st.k).toFixed(2)); }) }, 0.15);
    $('.pl-save').disabled = false;
  });
  $('.pl-redo').addEventListener('click', () => showForm());

  /* ---------- 달에 남기기 ---------- */
  $('.pl-save').addEventListener('click', async () => {
    if (!draft) return;
    const btn = $('.pl-save');
    btn.disabled = true;
    $('.pl-result__msg').textContent = 'TRANSMITTING…  달에 남기는 중';
    try {
      const spot = pickSpot(entries);
      const saved = await addForto({ ...draft, ...spot });
      entries.push(saved);
      addPin(saved);
      renderFilm();
      closePanel();
      setTimeout(() => openCard(saved, 'NEW · 달에 남겨졌어요'), 500);
      const pin = pins.get(saved.id)?.el;
      pin?.classList.add('is-new');
      setTimeout(() => pin?.classList.remove('is-new'), 7000);
      selected = [];
      nameIn.value = '';
      syncForm();
    } catch (err) {
      console.warn('[plus]', err);
      $('.pl-result__msg').textContent = '저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
      btn.disabled = false;
    }
  });

  async function load() {
    try { entries = await listFortos(); } catch (err) { console.warn('[plus] load', err); entries = []; }
    pins.forEach(({ el, dot }) => { el.remove(); dot.remove(); });
    pins.clear();
    entries.forEach(addPin);
    renderFilm();
  }

  /* ---------- 이름 검색 ---------- */
  const sBtn = $('.pl-search__btn');
  const sWin = $('.pl-search__win');
  const sIn = $('.pl-search__input');
  const sList = $('.pl-search__list');
  function runSearch() {
    const q = sIn.value.trim();
    if (!q) { sList.innerHTML = ''; $('.pl-search__n').textContent = ''; return; }
    const ql = q.toLowerCase();
    const hits = [...entries].reverse().filter((e) => e.name.toLowerCase().includes(ql) || Hangul.search(e.name, q) >= 0);
    $('.pl-search__n').textContent = `${pad(hits.length)} FOUND`;
    sList.innerHTML = hits.length
      ? hits.slice(0, 6).map((e) => `<li><button type="button" class="pl-search__hit" data-id="${esc(e.id)}">
          <span class="pl-search__sym">${symbolSVG(e.keywords, { flat: true })}</span>
          <b>${esc(e.name)}</b><em>${fmtLat(e.lat)} ${fmtLng(e.lng)}</em></button></li>`).join('')
      : '<li class="pl-search__none">NO FORTO FOUND<button type="button" class="pl-search__make">FIND로 만들기</button></li>';
  }
  function openSearch() {
    sWin.hidden = false;
    sBtn.setAttribute('aria-expanded', 'true');
    search.classList.add('is-open');
    gsap.fromTo(sWin, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out' });
    sIn.focus({ preventScroll: true });
    runSearch();
  }
  function closeSearch() {
    if (sWin.hidden) return;
    kb?.hide();
    sBtn.setAttribute('aria-expanded', 'false');
    search.classList.remove('is-open');
    gsap.to(sWin, { opacity: 0, y: -6, duration: 0.25, ease: 'power2.in', onComplete: () => { sWin.hidden = true; } });
  }
  sBtn.addEventListener('click', () => (sWin.hidden ? openSearch() : closeSearch()));
  $('.pl-search__close').addEventListener('click', closeSearch);
  sIn.addEventListener('input', runSearch);
  sList.addEventListener('click', (e) => {
    if (e.target.closest('.pl-search__make')) { closeSearch(); openPanel(); return; }
    const b = e.target.closest('.pl-search__hit');
    if (!b) return;
    const entry = entries.find((x) => String(x.id) === b.dataset.id);
    kb?.hide();
    if (entry) openCard(entry);
  });

  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    if (!sWin.hidden) closeSearch();
    else if (!card.hidden) closeCard();
    else if (state === 'panel') closePanel();
  };

  function enter() {
    if (!moon) {
      try { moon = createMoon(canvas, { onFrame }); } catch (err) { console.warn('[plus] webgl', err); root.classList.add('no-gl'); }
      load();
    } else moon.resize();
    state = 'explore';
    root.classList.remove('is-panel');
    gsap.set(panel, { xPercent: mobile() ? 0 : -100, yPercent: mobile() ? 100 : 0 });
    panel.setAttribute('aria-hidden', 'true');
    card.hidden = true;
    root.classList.remove('has-card');
    focusedId = null;
    layout('explore', 0);
    moon?.start();
    filmRaf = requestAnimationFrame(filmLoop);
    window.addEventListener('keydown', onKey);
    gsap.set(chrome, { autoAlpha: 1 });
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .fromTo('.pl-corner', { scale: 1.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.2, stagger: 0.05 }, 0.1)
      .fromTo(intro.children, { autoAlpha: 0, y: 20, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, stagger: 0.1, clearProps: 'filter' }, 0.4)
      .fromTo([map, read], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1 }, 0.9)
      .fromTo(archive, { autoAlpha: 0, yPercent: 40 }, { autoAlpha: 1, yPercent: 0, duration: 1.2 }, 1);
  }

  function leave() {
    moon?.stop();
    cancelAnimationFrame(filmRaf);
    window.removeEventListener('keydown', onKey);
  }

  syncForm();
  return { enter, leave };
}
