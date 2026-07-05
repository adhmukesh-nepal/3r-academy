# 3R Academy — pilot guide (30-student test run)

Everything to run a smooth closed pilot before the formal launch: one-time setup, a hand-out for
testers, what to monitor, and the go-live checklist.

---

## A. One-time setup (before inviting testers)

### 1. Activate ranking + feedback (run SQL once, in Supabase → SQL Editor)
**Ranking:** paste the SQL from **`RANKING-SETUP.md`** and Run (creates `quiz_scores` + functions).

**Feedback + error logging:** paste this and Run:
```sql
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid,
  email text,
  kind text not null default 'feedback',   -- 'feedback' | 'error'
  message text,
  page text,
  ua text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "anyone can submit" on public.feedback;
create policy "anyone can submit" on public.feedback for insert to anon, authenticated with check (true);
grant insert on public.feedback to anon, authenticated;
```
(Insert-only for everyone; **no read policy**, so only you see it — in **Table Editor → feedback**.)

### 2. Content & code
- Upload the chapters you want tested for **HA** and **PHO** (edit `content/*.xlsx` → `./build.sh` → push).
  You don't need 100% — a few complete chapters + one full-length test per book is enough to surface bugs.
- Set a **real access code** with a random suffix in each book's `Book` sheet (e.g. `ADH-HA18-2026-7QK9`)
  and give it to your testers. (The current `ADHHA182026` works too.)

### 3. Sanity check
Confirm live: sign up with a test email → code arrives (check spam) → unlock → do a chapter **timed**
test → ranking line shows "…N so far" → tap **💬 Feedback** → the row appears in Table Editor → feedback.

---

## B. Tester instructions (hand this to your 30 students)

**Welcome to the 3R Academy test! Please spend ~20 minutes and tell us anything that feels off.**

1. **Open** `https://3r.mukeshadhikari.com` in your browser.
2. **Install it** (optional but please try):
   - *iPhone:* open in **Safari** → Share → **Add to Home Screen**.
   - *Android:* Chrome → menu **⋮** → **Install app / Add to Home screen**.
3. **Create an account:** tap **Sign in → Create an account**, use your email + a password.
   You'll get a **code by email** (check spam) — enter it to confirm.
4. **Fill the short profile** (name, exam, province, etc.).
5. **Unlock:** open a chapter, enter the access code we gave you: **`__________`**.
6. **Try everything:**
   - Flashcards — flip a few, rate Again/Good/Easy.
   - MCQs — **Study mode** (read the explanations) and a **Timed test**.
   - A **Full-length mock test** (if available) — see your **ranking** at the end.
   - The **🌙 dark-mode** toggle (top-right).
7. **Tell us anything:** tap the **💬 Feedback** button (bottom-right) whenever something breaks, is
   confusing, or you have an idea. Also share in our **Viber group**.

*Please note: your device (iPhone/Android/laptop) + browser, and anything that didn't work.*

---

## C. What to monitor during the pilot
- **Feedback & errors:** Supabase → **Table Editor → feedback** (kind `feedback` = their comments,
  kind `error` = auto-logged JS errors with page + device). Triage into a fix list.
- **Signups & profiles:** Table Editor → `profiles`; summaries in **`ANALYTICS.md`** (by exam/province).
- **Ranking working:** once ~20 testers take the same timed test, real percentiles appear.
- **Email deliverability:** ask testers if the code email hit **inbox vs spam**; if spam is common,
  verify Resend domain auth (SPF/DKIM) and consider a "check spam" note in the invite.
- **Devices:** make sure the 30 include a mix of **iPhone + Android + laptop** and a few less
  tech-savvy users.

## D. Improve → then launch
Fix the reported bugs/confusions (edit → `./build.sh` / code change → push; live in ~40s). Re-test the
ones that failed. **Go-live gate:**
- [ ] Pilot bugs fixed and re-verified
- [ ] Email reliably lands in inbox (not spam)
- [ ] Enough content live for the exams you're launching
- [ ] Real **codes printed** in the books (random suffix)
- [ ] **Google Play** app submitted/approved (`TWA-PLAYSTORE.md`)
- [ ] Weekly **CSV backup** of `profiles` running (`OPERATIONS.md`)
Then formally launch. 🚀
