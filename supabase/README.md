# Plus 페이지 — Supabase 연결 방법

연결 전에는 **데모 모드**(예시 사방위표 + 내 브라우저에만 저장)로 동작합니다.
아래 순서대로 하면 모든 방문자가 같은 달을 공유합니다.

1. https://supabase.com 가입 → **New project** (Region: Northeast Asia (Seoul))
2. 왼쪽 **SQL Editor** → `supabase/schema.sql` 내용을 붙여 넣고 **Run**
3. **Project Settings → API** 에서 두 값 복사
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` `public` 키 → `VITE_SUPABASE_ANON_KEY`  (service_role 키는 절대 사용 금지)
4. 배포처(Vercel) **Settings → Environment Variables** 에 위 두 값을 추가 → 다시 배포
   - 로컬에서 확인하려면 프로젝트 루트에 `.env.local` 파일을 만들고 같은 두 줄을 적기 (`.env.example` 참고)

## 관리
- 등록된 사방위표 보기·삭제: Supabase **Table Editor → fortos**
- 키워드 문구를 바꾸면 `src/plus/keywords.js` 와 `schema.sql`의 허용 목록을 함께 수정
