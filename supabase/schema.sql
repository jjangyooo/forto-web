-- FORTO Plus: 달 위의 사방위표 등록 테이블
-- Supabase 대시보드 → SQL Editor 에 그대로 붙여 넣고 Run

create table if not exists public.fortos (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 20),
  keywords    text[] not null check (
                array_length(keywords, 1) = 5
                and keywords <@ array['호기심','용기','다정함','자유로움','신중함','열정','여유','상상력','단단함','유연함','고요함','도전']
              ),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  created_at  timestamptz not null default now()
);

-- 누구나 보기·등록 가능, 수정·삭제는 불가 (대시보드에서만 관리)
alter table public.fortos enable row level security;

drop policy if exists "fortos are public" on public.fortos;
create policy "fortos are public" on public.fortos
  for select to anon, authenticated using (true);

drop policy if exists "anyone can leave a forto" on public.fortos;
create policy "anyone can leave a forto" on public.fortos
  for insert to anon, authenticated with check (true);
