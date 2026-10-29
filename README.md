# FORTO Web

FORTO 브랜드 웹사이트. Figma 디자인을 Vite + GSAP으로 구현.

## 개발
```bash
npm install
npm run dev      # 로컬 개발 서버
npm run build    # 배포용 빌드 → dist/
```

## 구조
- `index.html` — 마크업
- `src/main.js` — 랜딩 모션(GSAP), ENTER 전환
- `src/wordmark.js` — 유리(glass) FORTO 워드마크
- `src/style.css` — 레이아웃·토큰 (1440×900 아트보드 기준 `--u` 단위)
- `src/fonts.css` — Aktiv Grotesk VF, NG Monopol (Polymath는 Adobe Fonts 키트)
- `src/media/` — 배경 영상 (홈 루프 0–4.8s / ENTER 전환 4.8s~)

## 배포
Vercel: Framework preset `Vite`, Build `npm run build`, Output `dist`.
