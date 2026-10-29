/*
 * Figma "Glass" 이펙트를 WebGL로 재현
 *  - 배경 영상을 텍스처로 받아, 글자/버튼 모양의 거리장(SDF)에서 만든 곡면 노멀로 굴절
 *  - Figma 파라미터: refraction, depth, lightAngle, lightIntensity, dispersion, (frost) radius
 *  - DOM 요소(.glyph, .enter)는 접근성·클릭·GSAP 애니메이션용으로 그대로 두고,
 *    매 프레임 그 위치/투명도를 읽어 셰이더에 전달 → 기존 인트로 모션과 자동으로 동기화
 */
import { LETTERS, WORD_W } from './wordmark.js';

// Figma 노드 값 (1:59 글자, 1:55 ENTER)
const P_LETTER = { depth: 43, refraction: 1, light: 38, intensity: 0.8, dispersion: 1, frost: 0, fill: 0.05 };
const P_ENTER = { depth: 64, refraction: 1, light: 315, intensity: 0.25, dispersion: 0.56, frost: 25.4, fill: 0.06 };

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform sampler2D uBg;
uniform sampler2D uSdf;
uniform vec2 uRes;          // canvas px
uniform vec4 uRegion;       // SDF 영역 (x, y, w, h) canvas px
uniform vec4 uVid;          // 영상 cover 매핑: offset.xy, size.zw (canvas px)
uniform float uMaxD;        // SDF에 저장된 최대 거리 (canvas px)
uniform float uDpr;
uniform float uOff[6];      // 요소별 y 오프셋 (canvas px)
uniform float uAlpha[6];    // 요소별 투명도
uniform vec4 uP0[6];        // depth(px), refraction, lightAngle(rad), intensity
uniform vec4 uP1[6];        // dispersion, frost(px), fill, -

vec3 bg(vec2 p) {
  vec2 uv = (p - uVid.xy) / uVid.zw;
  return texture2D(uBg, clamp(uv, 0.0, 1.0)).rgb;
}
vec3 bgFrost(vec2 p, float r) {
  if (r < 0.5) return bg(p);
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 28; i++) {
    float a = float(i) * 2.39996;
    float rr = r * sqrt((float(i) + 0.5) / 28.0);
    vec2 o = vec2(cos(a), sin(a)) * rr;
    acc += bg(p + o);
    wsum += 1.0;
  }
  return acc / wsum;
}
vec4 sdfAt(vec2 p) {
  vec2 uv = (p - uRegion.xy) / uRegion.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(uSdf, uv);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);

  // 어느 요소 위인지 찾기 (요소마다 오프셋이 달라서 6번 확인)
  int id = -1;
  vec2 q = p;
  vec4 s = vec4(0.0);
  for (int i = 0; i < 6; i++) {
    vec2 qi = p - vec2(0.0, uOff[i]);
    vec4 si = sdfAt(qi);
    if (si.b > 0.002 && abs(si.g * 255.0 - float(i) * 40.0) < 20.0 && uAlpha[i] > 0.001) {
      id = i; q = qi; s = si;
    }
  }
  if (id < 0) { gl_FragColor = vec4(0.0); return; }

  vec4 P0 = vec4(0.0); vec4 P1 = vec4(0.0); float A = 0.0;
  for (int i = 0; i < 6; i++) { if (i == id) { P0 = uP0[i]; P1 = uP1[i]; A = uAlpha[i]; } }
  float depth = P0.x, refr = P0.y, ang = P0.z, inten = P0.w;
  float disp = P1.x, frost = P1.y, fill = P1.z;

  // 안쪽 거리 → 곡면 높이의 기울기
  float px = 2.0;
  float d  = s.r * uMaxD;
  float dx = (sdfAt(q + vec2(px, 0.0)).r - sdfAt(q - vec2(px, 0.0)).r) * uMaxD / (2.0 * px);
  float dy = (sdfAt(q + vec2(0.0, px)).r - sdfAt(q - vec2(0.0, px)).r) * uMaxD / (2.0 * px);
  vec2 g = vec2(dx, dy);
  float gl = length(g);
  vec2 dir = gl > 1e-4 ? g / gl : vec2(0.0);          // 안쪽을 향하는 방향

  // 원형 베벨: 가장자리에서 가파르고 안쪽으로 갈수록 평평
  float t = clamp(d / depth, 0.0, 1.0);
  float slope = (1.0 - t) / sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.015));
  slope = min(slope, 2.6) * 0.75;
  vec3 n = normalize(vec3(-dir * slope, 1.0));

  // 굴절: 가장자리일수록 바깥쪽 배경을 안으로 끌어옴 (볼록 유리)
  vec2 off = n.xy * refr * depth * 0.32;
  float k = disp * 0.18;
  vec3 col;
  col.r = bgFrost(p + off * (1.0 + k), frost).r;
  col.g = bgFrost(p + off, frost).g;
  col.b = bgFrost(p + off * (1.0 - k), frost).b;

  // 유리 자체 색 (흰색 fill)
  col = mix(col, vec3(1.0), fill);

  // 조명: Figma 각도 기준 (0° = 오른쪽, 반시계)
  vec2 L = vec2(cos(ang), -sin(ang));
  float rim = pow(1.0 - n.z, 1.6);
  float lit = max(dot(-dir, L), 0.0);
  float back = max(dot(dir, L), 0.0);
  // 가장자리 띠에만 빛 (표면 전체가 아니라 얇은 림)
  float band = smoothstep(uDpr * 5.0, 0.0, d);
  float edge = smoothstep(uDpr * 1.3, 0.0, d);
  col += vec3(1.0) * band * (lit * 0.35 + back * 0.08) * inten;
  col += vec3(1.0) * edge * (0.22 + 0.55 * lit + 0.15 * back) * inten;
  // 서리 유리(ENTER)는 빛을 더 머금음
  col = mix(col, col * 1.18 + vec3(0.0, 0.02, 0.05), step(0.5, frost));

  float alpha = s.b * A;
  gl_FragColor = vec4(col * alpha, alpha);
}`;

export function createGlass({ canvas, wordmark, glyphs, enter, videos, isActive }) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) return null;

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = (n) => gl.getUniformLocation(prog, n);
  const u = {
    bg: U('uBg'), sdf: U('uSdf'), res: U('uRes'), region: U('uRegion'), vid: U('uVid'), maxD: U('uMaxD'), dpr: U('uDpr'),
    off: U('uOff'), alpha: U('uAlpha'), p0: U('uP0'), p1: U('uP1'),
  };

  const mkTex = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const bgTex = mkTex();
  const sdfTex = mkTex();
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  const items = [...glyphs, enter];         // id 0..4 = 글자, 5 = ENTER
  const paths = LETTERS.map((L) => new Path2D(L.d));
  let dpr = 1;
  let base = [];                            // 요소별 기준 top (CSS px)
  let maxD = 1;
  let ready = false;

  /* ---------- SDF 생성 (리사이즈 때만) ---------- */
  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const wr = wordmark.getBoundingClientRect();
    const sc = wr.width / WORD_W;           // Figma px → CSS px
    // ENTER 기준 위치 (GSAP y 이동 제외)
    const hero = enter.offsetParent.getBoundingClientRect();
    const ew = enter.offsetWidth, eh = enter.offsetHeight;
    const ex = hero.left + enter.offsetLeft - ew / 2;   // translateX(-50%)
    const ey = hero.top + enter.offsetTop;
    const radius = parseFloat(getComputedStyle(enter).borderTopLeftRadius) || 23 * sc;

    const pad = 8;
    const rx = Math.floor(Math.min(wr.left, ex) - pad);
    const ry = Math.floor(wr.top - pad);
    const rw = Math.ceil(Math.max(wr.right, ex + ew) + pad) - rx;
    const rh = Math.ceil(Math.max(wr.bottom, ey + eh) + pad) - ry;
    const S = dpr;                          // SDF 해상도 = 캔버스 해상도
    const cw = Math.max(1, Math.round(rw * S)), ch = Math.max(1, Math.round(rh * S));

    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff';
    LETTERS.forEach((L, i) => {
      x.setTransform(S * sc, 0, 0, S * sc, (wr.left - rx + L.x * sc) * S, (wr.top - ry + L.y * sc) * S);
      x.fill(paths[i]);
    });
    x.setTransform(S, 0, 0, S, (ex - rx) * S, (ey - ry) * S);
    x.beginPath();
    x.roundRect(0, 0, ew, eh, radius);
    x.fill();
    x.setTransform(1, 0, 0, 1, 0, 0);

    const img = x.getImageData(0, 0, cw, ch);
    const cov = new Float32Array(cw * ch);
    for (let i = 0; i < cw * ch; i++) cov[i] = img.data[i * 4 + 3] / 255;

    const dist = smooth(edt(cov, cw, ch), cov, cw, ch, Math.max(1, Math.round(1.5 * S)));  // 안쪽 거리 (px)
    maxD = Math.max(P_LETTER.depth, P_ENTER.depth) * sc * S;

    // 요소 소속(id): x 범위 / ENTER 박스로 판별
    const bounds = LETTERS.map((L, i) => {
      const next = LETTERS[i + 1];
      const left = i === 0 ? -1e9 : (wr.left - rx + ((LETTERS[i - 1].x + LETTERS[i - 1].w + L.x) / 2) * sc) * S;
      const right = next ? (wr.left - rx + ((L.x + L.w + next.x) / 2) * sc) * S : 1e9;
      return [left, right];
    });
    const eTop = (ey - ry) * S - 2;

    const out = new Uint8Array(cw * ch * 4);
    for (let yy = 0; yy < ch; yy++) {
      for (let xx = 0; xx < cw; xx++) {
        const i = yy * cw + xx;
        let id = 5;
        if (yy < eTop) { for (let k = 0; k < 5; k++) if (xx >= bounds[k][0] && xx < bounds[k][1]) { id = k; break; } }
        out[i * 4] = Math.round(Math.min(dist[i] / maxD, 1) * 255);
        out[i * 4 + 1] = id * 40;
        out[i * 4 + 2] = Math.round(cov[i] * 255);
        out[i * 4 + 3] = 255;
      }
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, sdfTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cw, ch, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);

    base = [...glyphs.map((g, i) => wr.top + LETTERS[i].y * sc), ey];

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform4f(u.region, rx * dpr, ry * dpr, rw * dpr, rh * dpr);
    gl.uniform1f(u.maxD, maxD);
    gl.uniform1f(u.dpr, dpr);
    const rad = (deg) => (deg * Math.PI) / 180;
    const p0 = [], p1 = [];
    for (let i = 0; i < 6; i++) {
      const P = i < 5 ? P_LETTER : P_ENTER;
      p0.push(P.depth * sc * S, P.refraction, rad(P.light), P.intensity);
      p1.push(P.dispersion, P.frost * sc * S * 1.7, P.fill, 0);
    }
    gl.uniform4fv(u.p0, p0);
    gl.uniform4fv(u.p1, p1);
    gl.uniform1i(u.bg, 0);
    gl.uniform1i(u.sdf, 1);
    ready = true;
  }

  /* ---------- 매 프레임 ---------- */
  const offs = new Float32Array(6);
  const alphas = new Float32Array(6);
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!ready || !isActive()) { gl.clear(gl.COLOR_BUFFER_BIT); return; }

    // 현재 보이는 배경 영상
    const v = videos.reduce((a, b) => (+getComputedStyle(b).opacity > +getComputedStyle(a).opacity ? b : a));
    if (v.readyState < 2 || !v.videoWidth) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
    } catch (e) { fail(e); return; }

    const W = window.innerWidth, H = window.innerHeight;
    const s = Math.max(W / v.videoWidth, H / v.videoHeight);
    const dw = v.videoWidth * s, dh = v.videoHeight * s;
    gl.uniform4f(u.vid, ((W - dw) / 2) * dpr, ((H - dh) / 2) * dpr, dw * dpr, dh * dpr);

    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      offs[i] = (r.top - base[i]) * dpr;
      alphas[i] = +getComputedStyle(el).opacity * (getComputedStyle(el).visibility === 'hidden' ? 0 : 1);
    });
    gl.uniform1fv(u.off, offs);
    gl.uniform1fv(u.alpha, alphas);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  let onFail = () => {};
  function fail(e) {
    cancelAnimationFrame(raf);
    console.warn('[glass] WebGL 유리 효과를 끄고 CSS로 대체합니다:', e);
    onFail();
  }

  let rt;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(build, 120); };
  window.addEventListener('resize', onResize);
  build();
  frame();

  return {
    rebuild: build,
    onFail(fn) { onFail = fn; },
  };
}

/* ---------- 유클리드 거리 변환 (Felzenszwalb) — 안쪽 픽셀에서 가장 가까운 바깥까지 거리 ---------- */
function edt(cov, w, h) {
  const INF = 1e20;
  const f = new Float64Array(Math.max(w, h));
  const d = new Float64Array(Math.max(w, h));
  const v = new Int32Array(Math.max(w, h));
  const z = new Float64Array(Math.max(w, h) + 1);
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = cov[i] > 0.5 ? INF : 0;

  const pass = (n) => {
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s;
      do {
        const r = v[k];
        s = ((f[q] + q * q) - (f[r] + r * r)) / (2 * q - 2 * r);
      } while (s <= z[k] && --k >= 0);
      k++;
      v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const r = v[k];
      d[q] = (q - r) * (q - r) + f[r];
    }
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    pass(h);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    pass(w);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
  const out = new Float32Array(w * h);
  // 안티앨리어싱 가장자리 보정: 부분 커버리지 픽셀은 0~0.5 사이 거리
  for (let i = 0; i < w * h; i++) out[i] = cov[i] > 0.5 ? Math.sqrt(grid[i]) - 0.5 + (cov[i] - 0.5) : 0;
  return out;
}

/* 거리장 능선(ridge) 완화: 박스 블러 2회 후 바깥은 0으로 */
function smooth(src, cov, w, h, r) {
  const a = Float32Array.from(src);
  const b = new Float32Array(w * h);
  for (let it = 0; it < 2; it++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let acc = 0, n = 0;
        for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) { acc += a[row + k]; n++; }
        b[row + x] = acc / n;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let acc = 0, n = 0;
        for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) { acc += b[k * w + x]; n++; }
        a[y * w + x] = acc / n;
      }
    }
  }
  for (let i = 0; i < w * h; i++) if (cov[i] <= 0.5) a[i] = 0;
  return a;
}
