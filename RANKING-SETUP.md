# Percentile ranking — database setup (run once)

Adds the `quiz_scores` table and three functions that power per-chapter and full-length-test
percentiles. Privacy-safe: each student can read only their own row, and the functions return
**only aggregates + your own numbers** — never anyone else's scores.

Supabase → **SQL Editor** → New query → paste all of this (use the copy button) → **Run**.
Safe to run more than once.

```sql
-- 1. Scores table (one row per user per chapter/test)
create table if not exists public.quiz_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null,
  chapter int not null,
  kind text not null default 'chapter',   -- 'chapter' | 'test'
  score int not null,
  total int not null,
  pct numeric not null,                    -- score/total*100
  taken_at timestamptz not null default now(),
  primary key (user_id, book_id, chapter)
);
alter table public.quiz_scores enable row level security;
drop policy if exists "own scores read" on public.quiz_scores;
create policy "own scores read" on public.quiz_scores
  for select using (auth.uid() = user_id);
-- (no insert/update policy — writes happen only via submit_score() below)

-- 2. Record a timed attempt: chapters overwrite (recent); tests lock the first attempt.
create or replace function public.submit_score(p_book text, p_chapter int, p_kind text, p_score int, p_total int)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p numeric;
begin
  if uid is null or p_total is null or p_total <= 0 then return; end if;
  p := round((p_score::numeric / p_total) * 100, 1);
  if p_kind = 'test' then
    insert into public.quiz_scores(user_id, book_id, chapter, kind, score, total, pct)
    values (uid, p_book, p_chapter, 'test', p_score, p_total, p)
    on conflict (user_id, book_id, chapter) do nothing;          -- first attempt locked
  else
    insert into public.quiz_scores(user_id, book_id, chapter, kind, score, total, pct)
    values (uid, p_book, p_chapter, 'chapter', p_score, p_total, p)
    on conflict (user_id, book_id, chapter)
    do update set score = excluded.score, total = excluded.total, pct = excluded.pct, taken_at = now();
  end if;
end; $$;

-- 3. One chapter/test percentile for the caller (min 20 candidates).
create or replace function public.chapter_percentile(p_book text, p_chapter int)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int; mine numeric; below int;
begin
  if uid is null then return json_build_object('signedIn', false); end if;
  select pct into mine from public.quiz_scores where user_id=uid and book_id=p_book and chapter=p_chapter;
  select count(*) into n from public.quiz_scores where book_id=p_book and chapter=p_chapter;
  if mine is null then return json_build_object('signedIn', true, 'attempted', false, 'count', n); end if;
  if n < 20 then
    return json_build_object('signedIn', true, 'attempted', true, 'enough', false, 'count', n, 'your_pct', mine);
  end if;
  select count(*) into below from public.quiz_scores where book_id=p_book and chapter=p_chapter and pct < mine;
  return json_build_object('signedIn', true, 'attempted', true, 'enough', true, 'count', n, 'your_pct', mine,
    'percentile', round(below::numeric / nullif(n-1,0) * 100));   -- % of candidates you're ahead of
end; $$;

-- 4. Whole-book ranking for the caller: per chapter + average (readiness) across chapters.
create or replace function public.book_ranking(p_book text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); res json; avgp numeric;
begin
  if uid is null then return json_build_object('signedIn', false); end if;
  with mine as (
    select chapter, kind, pct from public.quiz_scores where user_id = uid and book_id = p_book
  ),
  calc as (
    select m.chapter, m.kind, m.pct as your_pct,
      (select count(*) from public.quiz_scores q where q.book_id=p_book and q.chapter=m.chapter) as cnt,
      (select count(*) from public.quiz_scores q where q.book_id=p_book and q.chapter=m.chapter and q.pct < m.pct) as below
    from mine m
  )
  select
    coalesce(json_agg(json_build_object(
      'chapter', chapter, 'kind', kind, 'your_pct', your_pct, 'count', cnt,
      'enough', cnt >= 20,
      'percentile', case when cnt >= 20 then round(below::numeric / nullif(cnt-1,0) * 100) else null end
    ) order by chapter), '[]'::json),
    avg(round(below::numeric / nullif(cnt-1,0) * 100)) filter (where kind = 'chapter' and cnt >= 20)
  into res, avgp
  from calc;
  return json_build_object('signedIn', true, 'chapters', res, 'avg_percentile', avgp);
end; $$;

-- 5. Allow signed-in users to call the functions
grant execute on function public.submit_score(text,int,text,int,int) to authenticated;
grant execute on function public.chapter_percentile(text,int) to authenticated;
grant execute on function public.book_ranking(text) to authenticated;
```

Expect **"Success. No rows returned."**

## What you'll see while testing
- A percentile only appears once a chapter/test has **≥ 20 candidates**. Until then, after a timed
  test you'll see **"Not enough candidates yet — N so far"** (this confirms your score was recorded).
- Ranking only works when **signed in** (scores are tied to the account).
- Chapters use your **most recent** timed score; full-length tests lock your **first** attempt.
