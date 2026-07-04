# Supabase setup (Phase A — accounts + sync)

One-time setup in your Supabase project (`newnrskeprjssplanqlu`). Two parts: run the SQL, then
set the auth URLs. Takes ~5 minutes.

## 1. Create the tables + security rules
Supabase dashboard → **SQL Editor** → **New query** → paste all of this → **Run**.
(Safe to run more than once.)

```sql
-- 3R Academy — Phase A schema
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
create table if not exists public.entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null,
  code text,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
create table if not exists public.progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null,
  chapter int not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id, chapter)
);

alter table public.profiles    enable row level security;
alter table public.entitlements enable row level security;
alter table public.progress     enable row level security;

drop policy if exists "profiles are self"    on public.profiles;
drop policy if exists "entitlements are self" on public.entitlements;
drop policy if exists "progress is self"      on public.progress;

create policy "profiles are self"    on public.profiles
  for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "entitlements are self" on public.entitlements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "progress is self"      on public.progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- auto-create a profile row when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();
```

Row-level security means each signed-in user can read/write **only their own** rows — no one can
see anyone else's progress or codes.

## 2. Set the auth URLs (so magic-link login redirects back to your site)
Dashboard → **Authentication** → **URL Configuration**:
- **Site URL:** `https://3r.mukeshadhikari.com`
- **Redirect URLs → Add:** `https://3r.mukeshadhikari.com/**`
  (optional, for local testing: also add `http://localhost:8092/**`)
- Save.

Email sign-in is already enabled by default, so nothing else to toggle. Magic-link needs **no
password and no email confirmation step** — the link itself is the login.

## 3. (Recommended soon) Better email delivery
Supabase's built-in email is rate-limited (~a few per hour) and can land in spam. Before you
promote the app widely, add your own SMTP under **Authentication → Emails → SMTP Settings**
(e.g. a free Resend/Brevo/SendGrid account). Fine to skip while testing.

## How to test after setup
1. Open `https://3r.mukeshadhikari.com`, click **Sign in**, enter your email, tap the link in your inbox.
2. Unlock Health Assistant — Loksewa with `ADHHA182026`.
3. Open the site in a **different browser/phone**, sign in with the **same email** → the book is
   already unlocked and your progress is there. That's cross-device sync working.

## What's stored
- `profiles`: your email (for the account).
- `entitlements`: which books you've unlocked, with the code (so other devices can open them).
- `progress`: your flashcard/quiz progress per chapter.

Nothing else is collected. (Phase B will move unlock enforcement fully server-side to stop
code-sharing; Phase C adds subscriptions.)
