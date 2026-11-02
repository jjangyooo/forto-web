/*
 * About · SYSTEM 3 (Figma 30:181) — 심볼의 확장
 * Figma 원본은 심볼 298장을 조금씩 밀어 쌓은 "압출(extrusion)" 그래픽.
 * 같은 구조를 캔버스로 다시 그려서, 압출 길이 k(0→1)를 움직여 모션을 만든다.
 *   EXPANSION  : 심볼에서 오른쪽으로 빛의 꼬리가 길게 뻗어 나감
 *   TRANSITION : 심볼 아래로 깊이가 생기며 내려감
 *   OPEN       : 왼쪽 심볼 끝에서 가로 띠가 펼쳐지고 오른쪽 끝 심볼이 따라감
 * 모든 좌표는 카드(411×491) 기준 Figma 단위.
 */
const CARD_W = 411;
const CARD_H = 491;

// 압출 레이어 색: #020910 → #00D4A2 (203단계) → #0190FF (94단계), 맨 위 면 #97F9FF
const N = 298;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const C0 = hex('#020910'), C1 = hex('#00d4a2'), C2 = hex('#0190ff');
const COLORS = Array.from({ length: N }, (_, i) => {
  const [a, b, t] = i <= 203 ? [C0, C1, i / 203] : [C1, C2, (i - 203) / 94];
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * t)).join(',')})`;
});
const TOP = '#97f9ff';

// 레이어별 밀림 거리 (Figma 샘플: 0,25,…,275, 296, 297번째)
const SAMPLE_I = [0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 296, 297];
const offsets = (vals) => {
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    while (s < SAMPLE_I.length - 2 && i > SAMPLE_I[s + 1]) s++;
    const t = (i - SAMPLE_I[s]) / (SAMPLE_I[s + 1] - SAMPLE_I[s]);
    out[i] = vals[s] + (vals[s + 1] - vals[s]) * Math.min(1, Math.max(0, t));
  }
  return out;
};
const EXP_OFF = offsets([118.39, 111.28, 104.2, 97.09, 89.98, 82.87, 75.76, 68.66, 61.55, 46.5, 30.34, 14.22, 0.66, 0]);
const TRN_OFF = offsets([74.26, 69.56, 64.86, 60.16, 55.45, 50.78, 46.08, 41.38, 36.67, 27.66, 18.06, 8.46, 0.39, 0]);

// 심볼 경로 (Figma vectorPaths)
const SYM_EXP = 'M 89.611 48.667 L 89.611 46.345 L 47.589 46.345 C 67.886 45.043 84.415 26.952 84.415 6.313 C 84.415 4.162 84.244 2.067 83.901 0 L 40.195 0 C 40.509 1.982 40.652 4.02 40.652 6.059 C 40.652 28.113 22.781 46.006 0.628 46.345 L 0 46.345 L 0 48.667 L 49.159 48.667 L 16.7 99.797 L 57.124 99.797 L 89.582 48.667 L 89.611 48.667 Z';
const SYM_EXP_TOP = 'M 89 48.278 L 89 45.975 L 47.251 45.975 C 67.417 44.683 83.838 26.737 83.838 6.263 C 83.838 4.129 83.668 2.05 83.328 0 L 39.905 0 C 40.217 1.966 40.359 3.988 40.359 6.01 C 40.359 27.889 22.605 45.638 0.596 45.975 L 0 45.975 L 0 48.278 L 48.839 48.278 L 16.592 99 L 56.752 99 L 89 48.278 Z';
const SYM_TRN = 'M 88 48.125 L 88 45.829 L 46.714 45.829 C 66.651 44.557 82.877 26.662 82.877 6.223 C 82.877 4.093 82.711 2.019 82.379 0 L 39.431 0 C 39.736 1.964 39.874 3.955 39.874 6.002 C 39.874 27.824 22.318 45.525 0.581 45.857 L 0 45.857 L 0 48.152 L 48.292 48.152 L 16.42 98.739 L 56.128 98.739 L 88 48.152 L 88 48.125 Z';
const OPEN_BAR = 'M 208.65 46.47 C 50.9 46.47 170.68 46.49 12.92 46.5 C 17.95 38.42 22.97 30.35 27.99 22.27 C 21.17 22.08 14.35 21.9 7.53 21.71 C 8.33 21.73 16.57 21.79 21.79 14.86 C 26.72 8.32 24.9 0.94 24.66 0.04 C 183.82 0.03 65.45 0.01 224.6 0 C 224.29 1.78 222.13 13.08 211.98 18.68 C 207.74 21.02 203.63 21.52 201.03 21.6 C 208.29 21.89 215.56 22.19 222.82 22.48 C 218.1 30.48 213.37 38.47 208.65 46.47 Z';
const OPEN_TIP = 'M 28.13 22.68 V 21.59 H 9.83 C 18.67 20.99 25.86 12.56 25.86 2.94 C 25.86 1.94 25.78 0.96 25.64 0.01 H 17.48 C 17.61 0.93 17.68 1.88 17.68 2.84 C 17.68 13.11 9.9 21.45 0.26 21.6 H 0 V 22.68 H 21.4 L 7.27 46.5 H 13.99 L 28.12 22.68 Z';

const clamp = (v) => Math.min(1, Math.max(0, v));

export function mountSystem3(card) {
  const kind = card.dataset.kind;
  const canvas = card.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const paths = {};
  const P = (d) => (paths[d] ||= new Path2D(d));
  let k = 0;

  function resize() {
    const r = card.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    draw();
  }

  function draw() {
    const s = canvas.width / CARD_W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, (canvas.height - CARD_H * s) / 2);
    const appear = clamp(k / 0.12);            // 처음 12% 동안 심볼 면이 떠오름
    if (kind === 'expansion' || kind === 'transition') {
      const exp = kind === 'expansion';
      const off = exp ? EXP_OFF : TRN_OFF;
      const [ox, oy] = exp ? [102, 196] : [161, 159];
      const ext = clamp((k - 0.04) / 0.96);      // 압출 길이
      ctx.globalAlpha = appear;
      const sym = P(exp ? SYM_EXP : SYM_TRN);
      for (let i = 0; i < N; i++) {
        const d = off[i] * ext;
        ctx.save();
        ctx.translate(ox + (exp ? d : 0.03), oy + (exp ? 0 : d));
        ctx.fillStyle = COLORS[i];
        ctx.fill(sym);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(ox, oy + (exp ? 0.24 : 0));
      ctx.fillStyle = TOP;
      ctx.fill(P(exp ? SYM_EXP_TOP : SYM_TRN));
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }
    // OPEN: 띠가 왼쪽 끝에서 오른쪽으로 펼쳐짐, 오른쪽 끝 심볼이 띠 끝을 따라감
    const [ox, oy] = [92, 222];
    const w = 25.4 + (224.6 - 25.4) * clamp((k - 0.05) / 0.95);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.beginPath();
    ctx.rect(0, -2, w, 52);
    ctx.clip();
    const g = ctx.createLinearGradient(7.53, 0, 224.6, 0);
    g.addColorStop(0, '#00D4A2');
    g.addColorStop(1, '#0190FF');
    ctx.globalAlpha = 0.7 * appear;
    ctx.fillStyle = g;
    ctx.fill(P(OPEN_BAR));
    ctx.restore();
    ctx.globalAlpha = appear;
    ctx.fillStyle = '#97feff';
    ctx.save(); ctx.translate(ox, oy); ctx.fill(P(OPEN_TIP)); ctx.restore();
    // 오른쪽 끝 심볼 (Figma 30:967: 카드 기준 291.19, 221.01) — 펼쳐짐에 맞춰 이동
    const tipX = ox + 199.19 - (224.6 - w);
    ctx.save(); ctx.translate(tipX, 221.01); ctx.fill(P(OPEN_TIP)); ctx.restore();
    ctx.globalAlpha = 1;
  }

  resize();
  return {
    resize,
    set(v) { k = clamp(v); draw(); },
  };
}
