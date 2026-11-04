/*
 * 키워드 12개 — "달에서 나는 어떤 모습일까?"
 * 각 키워드가 심볼에 주는 변화
 *   dir/push : 압출(확장) 방향(도, 0=오른쪽, 90=아래)과 세기
 *   slant    : 다리 기울기 (−: 더 눕힘)
 *   legW     : 다리 굵기
 *   bladeW   : 날 폭
 *   bulge    : 곡률
 *   hue      : 색 축 (민트 0 · 블루 1 · 바이올렛 2) 위 이동
 *   line     : 축선이 왼쪽으로 뻗는 길이
 * 문구를 바꾸려면 키(이름)만 바꾸면 됨. supabase/schema.sql의 허용 목록도 함께 수정.
 */
export const KEYWORDS = {
  호기심:   { dir: -45, push: 30, bulge: 0.08, hue: -0.25 },
  용기:     { dir: 0,   push: 34, slant: -5, legW: 3 },
  다정함:   { dir: 30,  push: 18, bulge: 0.1, bladeW: 3, hue: -0.2 },
  자유로움: { dir: 0,   push: 40, line: 12, slant: -3 },
  신중함:   { dir: 90,  push: 16, slant: 5, hue: 0.15 },
  열정:     { dir: 20,  push: 38, legW: 2, hue: -0.3 },
  여유:     { dir: 160, push: 14, bulge: -0.08, slant: 4 },
  상상력:   { dir: -90, push: 32, hue: 0.45, bulge: 0.05 },
  단단함:   { dir: 90,  push: 26, legW: 5, bladeW: 4, slant: 4 },
  유연함:   { dir: -20, push: 20, bulge: 0.12, slant: -4 },
  고요함:   { dir: 120, push: 12, hue: 0.3, line: 6 },
  도전:     { dir: 60,  push: 36, slant: -6, hue: 0.1 },
};

export const KEYWORD_LIST = Object.keys(KEYWORDS);
export const PICK = 5;
