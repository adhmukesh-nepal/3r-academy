# 3R Academy — analytics queries (Supabase SQL Editor)

Run these in **SQL Editor** (owner access sees all rows). Copy with the code-block copy button
so you don't grab backticks. You can also browse/filter/export in **Table Editor → profiles**.

## Signups — totals
```sql
select
  count(*)                                   as total_signups,
  count(*) filter (where onboarded_at is not null) as completed_profile,
  count(*) filter (where has_book)           as have_the_book
from public.profiles;
```

## Signups by exam
```sql
select coalesce(exam,'(not set)') as exam, count(*) as students
from public.profiles
group by 1 order by students desc;
```

## Signups by province
```sql
select coalesce(province,'(not set)') as province, count(*) as students
from public.profiles
group by 1 order by students desc;
```

## Signups by profession
```sql
select coalesce(profession,'(not set)') as profession, count(*) as students
from public.profiles
group by 1 order by students desc;
```

## Have the book vs not
```sql
select
  case when has_book then 'Has book' when has_book = false then 'No book' else '(not set)' end as book_status,
  count(*) as students
from public.profiles group by 1 order by students desc;
```

## New signups per day (last 30 days)
```sql
select date_trunc('day', created_at)::date as day, count(*) as signups
from public.profiles
where created_at > now() - interval '30 days'
group by 1 order by 1 desc;
```

## Recent signups (latest 50, with details)
```sql
select created_at, full_name, email, phone, exam, profession, province, has_book
from public.profiles
order by created_at desc
limit 50;
```

## Contact list for exam alerts (completed profiles)
```sql
select full_name, email, phone, exam, province
from public.profiles
where onboarded_at is not null
order by exam, province;
```
Export: run it, then use the **Download CSV** button in the results panel.

## Book unlocks (how many students unlocked each book)
```sql
select book_id, count(distinct user_id) as students_unlocked
from public.entitlements
group by 1 order by students_unlocked desc;
```

## Active learners (have any saved progress)
```sql
select count(distinct user_id) as learners_with_progress from public.progress;
```

## Most-studied chapters
```sql
select book_id, chapter, count(distinct user_id) as students
from public.progress
group by 1,2 order by students desc;
```

## (Optional) Save a reusable dashboard view
```sql
create or replace view public.signup_summary as
select exam, province, profession,
       count(*) as students,
       count(*) filter (where has_book) as have_book
from public.profiles
group by exam, province, profession;
-- then just:  select * from public.signup_summary order by students desc;
```

---
**Note:** these read the same tables the app writes to. Personal data (name/email/phone) is
subject to your privacy policy — keep exports private and don't share them.
