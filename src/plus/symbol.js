/*
 * 나만의 사방위표 — FORTO 심볼을 기본형으로, 고른 키워드 5개가 형태를 바꾼다.
 *   - 날(위쪽 곡선 조각)의 폭·곡률
 *   - 다리(사선 조각)의 기울기·굵기
 *   - 압출(SYSTEM 3의 확장) 방향·깊이
 *   - 그라디언트 색 (민트 → 블루 → 바이올렛 축 위의 위치)
 * 같은 키워드 조합이면 언제나 같은 심볼 (순서 무관).
 */
import { KEYWORDS } from './keywords.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// 브랜드 컬러 축: 0 민트 #00D4A2 · 1 블루 #0190FF · 2 바이올렛 #7B6BFF
const PALETTE = [[0, 212, 162], [1, 144, 255], [123, 107, 255]];
function palette(h) {
  h = clamp(h, 0, 2);
  const i = Math.min(1, Math.floor(h));
  const t = h - i;
  return PALETTE[i].map((v, j) => Math.round(lerp(v, PALETTE[i + 1][j], t)));
}
const rgb = (c) => `rgb(${c.join(',')})`;
const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));

export function paramsFor(keys) {
  const ks = [...new Set(keys)].sort();
  const p = { slant: -32.5, legW: 40.4, bladeW: 43.7, bulge: 0.56, hue: 0.7, ext: [0, 0], line: 0 };
  ks.forEach((k) => {
    const d = KEYWORDS[k];
    if (!d) return;
    p.slant += d.slant || 0;
    p.legW += d.legW || 0;
    p.bladeW += d.bladeW || 0;
    p.bulge += d.bulge || 0;
    p.hue += (d.hue || 0);
    p.line += d.line || 0;
    p.ext[0] += Math.cos((d.dir * Math.PI) / 180) * d.push;
    p.ext[1] += Math.sin((d.dir * Math.PI) / 180) * d.push;
  });
  p.slant = clamp(p.slant, -50, -14);
  p.legW = clamp(p.legW, 28, 52);
  p.bladeW = clamp(p.bladeW, 32, 56);
  p.bulge = clamp(p.bulge, 0.3, 0.85);
  p.hue = clamp(p.hue, 0, 2);
  p.line = clamp(p.line, 0, 26);
  // 압출 벡터: 방향은 키워드 방향의 합, 길이는 최소 24 ~ 최대 70
  const len = Math.hypot(...p.ext);
  const L = clamp(24 + len * 0.55, 24, 70);
  const ang = len < 0.001 ? 0 : Math.atan2(p.ext[1], p.ext[0]);
  p.dx = Math.cos(ang) * L;
  p.dy = Math.sin(ang) * L;
  return p;
}

// 심볼 윤곽 (Figma 심볼과 같은 구조: 날 + 축선 + 다리), 약 90×100 박스
function outline(p) {
  const W = 89.6;
  const axisY = 46.35;
  const axisB = 48.67;
  const xR = 84.4;
  const xRt = 83.9;
  const xL = xR - p.bladeW;            // 날 안쪽 곡선의 위 끝
  const bw = p.bladeW;
  const b = p.bulge;
  const P0 = [xR - 36.8 * (bw / 43.7), axisY];   // 바깥 곡선 시작(축선 위)
  const outer = `M ${W} ${axisB} L ${W} ${axisY} L ${P0[0].toFixed(2)} ${axisY} C ${lerp(P0[0], xR, b).toFixed(2)} ${(axisY - 1.3).toFixed(2)} ${xR} ${(axisY * (1 - b * 0.75)).toFixed(2)} ${xR} 6.31 C ${xR} 4.16 ${xR - 0.18} 2.07 ${xRt} 0`;
  const inner = `L ${xL.toFixed(2)} 0 C ${(xL + 0.31).toFixed(2)} 1.98 ${(xL + 0.46).toFixed(2)} 4.02 ${(xL + 0.46).toFixed(2)} 6.06 C ${(xL + 0.46).toFixed(2)} ${(axisY * (0.62 - b * 0.1)).toFixed(2)} ${lerp(xL, 0, 1 - b * 0.55).toFixed(2)} ${(axisY - 0.35).toFixed(2)} 0.63 ${axisY}`;
  const l0 = -p.line;
  const legTop = 89.58;
  const legX0 = legTop - p.legW;
  const axis = `L ${l0} ${axisY} L ${l0} ${axisB} L ${legX0.toFixed(2)} ${axisB}`;
  const leg = `L ${(legX0 + p.slant).toFixed(2)} 99.8 L ${(legTop + p.slant).toFixed(2)} 99.8 L ${legTop} ${axisB} Z`;
  return `${outer} ${inner} ${axis} ${leg}`;
}

/**
 * SVG 문자열 생성
 * @param {string[]} keys 키워드 5개
 * @param {{layers?: number, size?: number, id?: string}} o
 */
export function symbolSVG(keys, { layers = 48, flat = false, id = 's' + Math.random().toString(36).slice(2, 8) } = {}) {
  const p = paramsFor(keys);
  const d = outline(p);
  if (flat) {
    // 핀용: 윗면만 (압출 없이) — 키워드에 따라 형태만 달라짐
    const pad = 6 + p.line;
    return `<svg viewBox="${(-pad).toFixed(1)} -6 ${(102 + pad).toFixed(1)} 112" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
  }
  const c0 = palette(p.hue - 0.45);
  const c1 = palette(p.hue + 0.45);
  const dark = [2, 9, 16];
  const top = mix([151, 249, 255], c1, 0.12);
  // 보기 박스: 심볼 + 압출이 모두 들어오도록
  const minX = Math.min(-p.line, p.slant - 2, p.dx < 0 ? p.dx - p.line : 0) - 6;
  const minY = Math.min(0, p.dy) - 6;
  const maxX = Math.max(92, 92 + p.dx) + 6;
  const maxY = Math.max(102, 102 + p.dy) + 6;
  const w = maxX - minX;
  const h = maxY - minY;
  const side = Math.max(w, h);
  const vx = minX - (side - w) / 2;
  const vy = minY - (side - h) / 2;
  let body = '';
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);                    // 0 = 가장 뒤
    const off = 1 - t;
    const col = t < 0.68 ? mix(dark, c0, t / 0.68) : mix(c0, c1, (t - 0.68) / 0.32);
    body += `<use href="#${id}" x="${(p.dx * off).toFixed(2)}" y="${(p.dy * off).toFixed(2)}" fill="${rgb(col)}"/>`;
  }
  body += `<use href="#${id}" fill="${rgb(top)}"/>`;
  return `<svg viewBox="${vx.toFixed(1)} ${vy.toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><path id="${id}" d="${d}"/></defs>${body}</svg>`;
}

export function symbolColors(keys) {
  const p = paramsFor(keys);
  return { c0: rgb(palette(p.hue - 0.45)), c1: rgb(palette(p.hue + 0.45)) };
}
