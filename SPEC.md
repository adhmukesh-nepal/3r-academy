# 3R Academy — App Specification (v1)

> **Brand:** 3R Academy — Health Loksewa & Licensing Prep, founded by Dr. Mukesh Adhikari.
> Study method: **Read · Recall · Rank (3R)**.

---

# BUILD STATUS & ROADMAP (updated 2026-07-04)

## ✅ Live now — v1 + Phase A (accounts)
Everything below is built, deployed, and running at **https://3r.mukeshadhikari.com**.

**Study app (v1):** exams grouped by track (Loksewa · Licensing · Entrance) with filter chips;
flashcards with Anki-style spaced repetition (Again/Good/Easy) + ★ bookmarks; MCQs with Study
(per-option explanations) and Timed mock modes; weak-areas auto-review; progress tracking; notes;
YouTube-placeholder videos; installable **PWA** with offline support. Content is **AES-GCM
encrypted** (key = PBKDF2 of the book access code); the site serves only ciphertext.

**Accounts (Phase A):** optional **email+password** sign-in (primary) with an **email-code**
fallback / password recovery; new-account **onboarding form** capturing name, phone, profession,
exam(s), province, book-status, consent, and an optional access code that unlocks the matching
book; **account-tied unlock** + **cross-device progress sync**. Signed-in users see the sign-up
card slimmed + moved to the bottom.

**Percentile ranking + full-length tests (built; client live):** timed attempts submit a score;
**chapters ranked on most-recent** timed score, **full-length tests on the locked first attempt**;
results screen shows "ahead of X% of N candidates" (min 20); a **"My ranking"** panel on the book
page with a **readiness nudge** at ≥60% avg. Full-length tests exist as `kind=test` chapters
(open straight into timed mode); a coming-soon placeholder is seeded for HA-Loksewa.
⚠️ **Requires running `RANKING-SETUP.md` SQL once** to create `quiz_scores` + functions.

**Design polish (Tier 1 done):** dark mode (auto + top-bar toggle), 3D flashcard flip animation,
**streak + daily goal** (local, home strip), celebratory results (score count-up, "+X% vs last",
confetti ≥80%), all-four-rationales in the timed review, mobile ergonomics, app-icon byline.

### The live stack (facts a future session needs)
- **Frontend/site:** static PWA in `docs/`, hosted on **GitHub Pages**, deployed by **GitHub
  Actions** (`.github/workflows/pages.yml`) on every push to `main`. Repo: `adhmukesh-nepal/3r-academy`.
- **Domain:** `3r.mukeshadhikari.com` (GoDaddy CNAME `3r` → `adhmukesh-nepal.github.io`).
- **Backend:** **Supabase** project `newnrskeprjssplanqlu` (Singapore). Tables `profiles`,
  `entitlements`, `progress` with per-user RLS. Publishable key is in `docs/assets/config.js`
  (public/safe); auth code in `docs/assets/auth.js`.
- **Email:** **Resend** SMTP, sender `noreply@mukeshadhikari.com`; OTP-code templates.
- **Android:** TWA package built (PWABuilder), package id `com.mukeshadhikari.app_3r.twa`,
  assetlinks live; **not yet submitted** to Play.
- **Crypto params (must match across `tools/build_data.py`, `docs/gate.js`, `docs/assets/auth.js`):**
  PBKDF2-HMAC-SHA256, 200000 iters, 16-byte per-book salt `sha256("3r-salt:"+id)[:16]`, AES-256-GCM.
- **Ops/limits/analytics:** see `OPERATIONS.md`, `ANALYTICS.md`, `SUPABASE-SETUP.md`, `EMAIL-SETUP.md`.

### Still author-side / optional
- **Run `RANKING-SETUP.md` SQL once** to activate percentile ranking (only remaining step for it).
- Submit the Android app to Google Play (`TWA-PLAYSTORE.md`, `PLAY-LISTING.md`); after upload add
  the Play App Signing SHA-256 to `assetlinks.json`.
- Set real book codes **with a random suffix** before printing (guessable codes weaken encryption).
- Custom SMTP is configured; export `profiles` to CSV weekly (Free tier = no backups).
- Re-add the iPhone home-screen icon to pick up the "by Dr. Mukesh Adhikari" byline.

## 🔜 Design polish — Tier 2 & Tier 3 — NEXT PHASE (not built)
Tier 1 (dark mode, flip animation, streak/goal, celebratory results, mobile ergonomics) is **done**.
Remaining (full detail in the plan file `~/.claude/plans/i-am-trying-to-expressive-pinwheel.md`):
- **Tier 2:** signed-in **Home dashboard** (continue studying, cards due, streak/goal, ranking
  snapshot, exam countdown — reuse `getProg`, SRS due logic, `book_ranking`); progress rings on
  chapter/book cards; small **SVG icon set**; typography scale pass.
  - **Sync streak + daily goal to the account** (cross-device): today they live only in
    `localStorage` (`tr_streak`, `tr_goal`); persist to a Supabase table so the streak follows the
    student across devices and survives a cache clear. Merge local ↔ server on sign-in like
    progress/entitlements. Recorded in `recordActivity()` (app.js).
- **Tier 3:** exam countdown, badges/achievements, anonymous league tiers (keep percentile-only
  privacy), TikTok-style swipe review mode.

## 🔜 Phase B — server-gated content (stop code-sharing) — NOT built
**Why:** today's gate is client-side. A valid code decrypts content in the browser, and a
**shared code** unlocks for anyone. Phase B moves enforcement to the server so only
**authenticated, entitled** users get content, and codes can be **limited/revoked**.

**Approach (recommended):**
1. Add a **Supabase Edge Function** `unlock(code)` — validates the code server-side, checks a
   per-code use limit (e.g. max N accounts per code), and records an `entitlement` for the user.
   Codes and their max-uses live in a server-only table (not shipped to the client).
2. Add a **Supabase Edge Function** `content(book, chapter)` — checks the caller's entitlement
   (auth token) and returns the chapter content only if entitled. Content is decrypted
   server-side (key held as a function secret), so the browser never receives the key or ciphertext
   it can reuse without auth.
3. Client changes: `gate.js` → calls `unlock`; `app.js` `loadEncrypted()` → calls `content`
   with the user's session token instead of decrypting locally. Sign-in becomes **required** to
   open content (currently optional).
**Schema add:** `codes(code, book_id, max_uses, used_count)`, `entitlements` already exists.
**Effort:** medium–high (2 edge functions + code-admin + client rewiring). **Honest limit:** a
paid, logged-in user can still scrape their own decrypted content; Phase B stops *non-buyers and
casual code-sharing*, and lets you revoke codes — .

## 🔜 Phase C — subscriptions — NOT built (builds on Phase B)
**Approach:** add plans + recurring access; gate content on an **active subscription** (server-side,
reusing Phase B's `content` function to also check subscription state).
- **Payments (Nepal reality):** Stripe/PayPal don't pay out to Nepal well. Use **Google Play
  in-app subscriptions** for the Android app (Google bills; 15–30% cut) and/or **local gateways
  eSewa / Khalti / Fonepay** for web. This choice drives the integration.
- **State:** payment provider webhook → Supabase `subscriptions(user_id, status, plan, expires_at)`;
  `content` function checks it.


- **Effort:** high (payment integration + webhooks + billing UI + subscription checks).

## ✅ Percentile ranking + full-length tests — BUILT (activate with `RANKING-SETUP.md` SQL)
Turns the app into a learning ladder: practise chapters and watch your percentile climb, then
graduate to a one-shot full-length timed exam. **Client shipped & live**; the only remaining step
is running the SQL in `RANKING-SETUP.md` once (creates `quiz_scores` + the 3 SECURITY DEFINER
functions). Design/decisions below are for reference.

**Confirmed decisions**
- Ranking uses **timed attempts only** (Study mode stays unranked practice).
- **Chapter percentile → most-recent timed score** (overwrite each attempt; rewards improvement).
- **Full-length test percentile → first timed attempt, locked** (honest, exam-like; can't be ground).
- Compared **within the same book**; **percentile-only** (no names/leaderboard).
- Show a percentile only once a chapter/test has **≥ 20 candidates**.
- **Soft nudge** (never a hard gate) to the full-length test when the candidate's **average chapter
  percentile ≥ 60** ("top 40% — you're ready for the full-length exam").
- Full-length tests already exist as `kind=test` chapters (open straight into timed mode).

**Data model (Supabase)**
```sql
create table public.quiz_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null,
  chapter int not null,               -- chapter number, or test number (e.g. 101)
  kind text not null default 'chapter', -- 'chapter' | 'test'
  score int not null, total int not null,
  pct numeric not null,               -- score/total*100 (for aggregation)
  taken_at timestamptz not null default now(),
  primary key (user_id, book_id, chapter)
);
alter table public.quiz_scores enable row level security;
-- users may READ only their own rows; WRITES go only through submit_score() (below)
create policy "own scores read" on public.quiz_scores for select using (auth.uid() = user_id);
```

**Functions (SECURITY DEFINER — enforce rules + keep others' rows private)**
- `submit_score(book, chapter, kind, score, total)` — computes pct; **chapter** → upsert (overwrite
  latest); **test** → insert only if no row exists (locks first attempt). Runs as `auth.uid()`.
- `chapter_percentile(book, chapter)` → returns `{count, enough, percentile, your_pct}` for the
  caller ("ahead of X% of N candidates"); `enough=false` when count < 20. Never returns others' rows.
- `book_ranking(book)` → per-chapter `{chapter, your_pct, percentile, count}` for the caller's
  attempted chapters **plus** `avg_percentile` (readiness) — one call powers the "My ranking" panel.

**Converter change**
- Emit `kind` into each chapter's JSON (so `quiz.html` knows chapter-vs-test → which write rule).

**Client (app.js)**
- On a **timed full run finishing** (not weak/starred sub-runs) and **if signed in**: call
  `submit_score(...)`, then `chapter_percentile(...)`, and show it on the results screen
  (e.g. "82% — ahead of 76% of candidates 🎯"; or "Not enough candidates yet — N so far").
  Not signed in → "Sign in to see how you rank."
- **"My ranking" panel** on the book page: call `book_ranking(book)` → per-chapter percentile bars +
  an overall readiness meter; when `avg_percentile ≥ 60`, highlight the full-length test CTA.

**Build order**
1. SQL: `quiz_scores` + RLS + the three functions (run in SQL Editor; documented like SUPABASE-SETUP).
2. Converter: add `kind` to chapter JSON; rebuild.
3. Client: submit score + show percentile on the timed results screen.
4. Client: "My ranking" panel + readiness nudge on the book page.
5. Min-N messaging + positive framing; verify end-to-end.

**Notes / honest limits:** percentile is recomputed live at query time (chapter distributions shift
as everyone improves — intended). Chapters are overwrite (measures current mastery); the full-test
first attempt is server-locked so it can't be ground. Only affects the caller's own displayed rank;
no one can read others' scores.






























## How to resume later
Tell a new session: *"Read SPEC.md → BUILD STATUS & ROADMAP, then start Phase B"* (or C). The
prerequisites, file touch-points, and schema additions are listed above. For now the project runs
on **Phase A**; B and C are optional and only needed if code-sharing hurts revenue (B) or you move
to recurring pricing (C).

---


> **Status:** DRAFT for author review. No app code will be written until this and
> `CLAUDE.md` are reviewed and approved. Author: Mukesh Adhikari, PhD, MPH, MPA.

---

## 1. What we're building & why

Mukesh sells several health-exam-prep books for Nepal's licensing / Loksewa (PSC) exams.
Each printed book carries a unique **access code**. A buyer enters that code — once — on
their **phone or laptop** to unlock that book's digital study materials, then revises with:

1. **Flashcards** (flip decks) — *already on the current site*.
2. **MCQs** — *new*. On answering, the app reveals the correct option **and a 1–2 sentence
   reason why each of the other three options is wrong** (plus a short "why this is correct").
3. **Progress tracker** — *new*. Remembers what's been studied and quiz scores.
4. **Notes** — the "most important things to remember" per chapter (today's "rapid revision").

**Goal:** evolve the existing static site into **one installable app that works on phone
*and* laptop from a single codebase**, works **offline**, and is gated by **per-book codes** —
without changing the author's workflow of *edit a data file → `git push` → it's live*.

### Current state (what exists today)

The site lives in `docs/` (GitHub Pages source), hosted free on **GitHub Pages** at
`3r.mukeshadhikari.com` (see `CNAME`, `404.html`):

| File | Role |
|---|---|
| `index.html` | Home — grid of exams/books (only "Health Assistant — Loksewa" is live) |
| `ha-loksewa/index.html` | Book page — 3R method strip + chapter grid (only Ch.5 live) |
| `ha-loksewa/ch5.html` | Chapter "Revision Station" — videos, flashcard links, rapid revision |
| `ha-loksewa/flashcards.html` | Interactive flip-card viewer, 5 decks, shuffle, keyboard nav |
| `gate.js` | Access-code gate (now content-encryption based, see §5.5), unlock stored in `localStorage` |

Content today lives **inside `<script>` blocks** in each HTML file. The brand is **"3R" —
Read / Recall / Rank**, with accent colours `#1F6F8B` / `#548235` / `#BF8F00`.

---

## 2. Approach: a PWA on the existing host (not a native app)

We build a **Progressive Web App (PWA)** on the current GitHub Pages setup. Rationale:

- The requirement is *phone **or** laptop*. A PWA runs in **any browser** (laptop) **and**
  installs to the **phone home screen** with an app icon + offline support — **one codebase**,
  not a separate app plus website.
- Reuses the existing HTML/CSS/JS design and **free** hosting already in place.
- **No-build, vanilla JS** — no npm / React / Xcode for the app itself. The author keeps editing
  plain data files and pushing to git. HTTPS on GitHub Pages satisfies all PWA requirements.
- **Google Play Store: yes, a v1 target** (author decision). Because the app is a real PWA, the
  cleanest route is a **TWA (Trusted Web Activity)** generated with **PWABuilder** (or
  Bubblewrap) — it wraps the *live hosted PWA URL* into an Android app with **zero changes to
  the app code or content**. One-time Google Play developer fee **US $25**. The TWA is generated
  once and only re-packaged rarely (e.g. icon/name change); day-to-day content edits still just
  go through `git push` and appear in both the web app and the installed Android app. (Capacitor
  is the fallback if we ever need deeper native APIs; not needed for v1. iOS App Store remains
  deferred — the PWA already installs on iPhone via Safari "Add to Home Screen".)

Everything in v1 is achievable in vanilla JS + `localStorage` (for unlock state and progress).
**No backend, no accounts, no server** in v1.

**iPhone note (important):** the same PWA installs on iPhone — via **Safari → Share → "Add to
Home Screen"** — and then launches full-screen, works offline, and behaves like an app; there
is no separate iOS codebase. Caveats vs Android: (a) install is **manual and Safari-only** (no
App Store discovery — buyers are told to open the link in Safari), and (b) iOS may **evict local
storage** after long periods of non-use, occasionally forcing a student to re-enter their book
code and losing local progress. This storage risk is the main motivation for the v2 cloud
progress-sync option. Android, by contrast, gets both the installable PWA and a real Play Store
listing (§7.6).

### Reference apps studied

- **UWorld** — MCQ explanations that teach reasoning incl. *why-wrong*; **Tutor vs Timed**
  modes. Our MCQ design follows this.
- **Anki** — SM-2 **spaced repetition**, Again/Good/Easy ratings. Our progress tracker adopts a
  lightweight version.






---

## 3. Content model — content is separated from code

The core refactor: move all book/chapter/deck/MCQ content out of `<script>` blocks into
**JSON data files**, so the author edits *data*, never app logic. Adding a book = add a folder
+ a JSON entry. (Full editing recipes live in `CLAUDE.md`.)

```
data/
  books.json                # list of books: id, name, board, desc, code (per-book), ready
  ha-loksewa/
    book.json               # book meta + chapter list (n, title, ready)
    ch5.json                # one file per chapter (shape below)
```

**`books.json`** — public catalog only. It carries each ready book's per-book **salt**, never
the code (the code lives only in the spreadsheet and is used at build time to encrypt):
```json
[{ "id":"ha-loksewa", "name":"Health Assistant — Loksewa", "board":"PSC · Government job",
   "desc":"Comprehensive Review (18th ed.)", "category":"loksewa", "ready":true,
   "locked":true, "salt":"<base64 per-book salt>" }]
```

**Chapter file (`ch5.json`)** — one shape covering all four study modes:
```json
{
  "book": "ha-loksewa",
  "number": 5,
  "title": "Epidemiology & Disease Control",

  "videos": [ { "title": "Basic Epidemiology — concepts & study types", "yt": "" } ],

  "notes": [
    "John Snow = father of modern epidemiology.",
    "Case-control → Odds Ratio; cohort → Relative Risk."
  ],

  "decks": [
    { "id": "epi", "name": "Epidemiology core",
      "cards": [ ["John Snow is known as…", "Father of modern epidemiology."] ] }
  ],

  "mcqs": [
    { "q": "Cholera cases (new + old) are termed as",
      "options": [
        { "text": "Prevalence",  "correct": true,  "why": "Correct — prevalence counts ALL existing cases (new + old) at a point in time." },
        { "text": "Incidence",   "correct": false, "why": "Incidence counts only NEW cases over a period." },
        { "text": "Attack rate", "correct": false, "why": "An incidence measure used in outbreaks, not total burden." },
        { "text": "Odds ratio",  "correct": false, "why": "A ratio of odds from case-control studies, not a case count." }
      ] }
  ]
}
```

**Migration:** the existing Ch.5 decks (epi / diseases / confuse / mnemonics / psc) and the
`rapid` array + `CHAPTER` object move into `data/ha-loksewa/ch5.json` **verbatim**. The rich
**PSC past-question deck** is the seed source for the first MCQs.

### 3.1 Authoring: spreadsheet → JSON converter (author decision)

The **spreadsheet is the source of truth**; the JSON in `data/**` is a **generated artifact**.
The author edits one **Excel workbook per book** (kept in `content/`), runs a small local
converter, and the JSON is regenerated — no hand-writing JSON, no comma-syntax risk.

```
content/
  ha-loksewa.xlsx         # ← author edits THIS
tools/
  build_data.py           # converter: reads content/*.xlsx → writes data/**/*.json
```

Workflow: **edit the workbook → run `python3 tools/build_data.py` → `git push`** (Python 3 is
already on the author's Mac). The converter validates as it runs (e.g. "exactly one correct
option per MCQ", "no empty `why`") and reports errors in plain language before writing anything.

**Workbook sheets (one workbook per book):**

| Sheet | Columns | Produces |
|---|---|---|
| `Book` | `id, name, board, desc, code, ready, title, edition, tagline, order, category` | the book's entry in `books.json` (+ `book.json` meta). `category` = exam track: `loksewa` / `license` / `entrance` |
| `Chapters` | `n, title, ready` | chapter list in `book.json` |
| `Notes` | `chapter, note` | `notes[]` per chapter |
| `Flashcards` | `chapter, deck_id, deck_name, deck_desc, front, back` | `decks[]` per chapter |
| `MCQs` | `chapter, question, correct (1–4), option1, why1, … option4, why4` | `mcqs[]` per chapter |
| `Videos` | `chapter, title, yt` | `videos[]` per chapter |

The app **never reads the spreadsheet** — only the generated JSON — so runtime stays no-build.
Hand-editing generated JSON is discouraged (the next converter run overwrites it); the JSON
shapes in §3 remain the reference for what the converter outputs. *(A non-technical fallback:
the same sheets can be maintained in Google Sheets and exported to `.xlsx`/`.csv`.)*

---

## 4. App structure (multi-page, shared assets)

Keep the simple multi-page layout, but remove today's copy-pasted inline CSS/JS by extracting
shared files:

```
index.html            # Home — book grid, reads data/books.json
book.html             # Book page — chapter grid + progress %  (?book=)
chapter.html          # "Revision Station" — videos, notes, links to flashcards & quiz (?book=&ch=)
flashcards.html       # Generalized flip-card viewer (?book=&ch=&deck=)
quiz.html             # NEW — MCQ mode (?book=&ch=)
assets/app.css        # Design system extracted from current inline <style>
assets/app.js         # Shared: data fetch, render helpers, query-param routing, progress store
gate.js               # Generalized per-book code gate (reads code from books.json)
manifest.webmanifest  # PWA manifest (name, icons, theme #16323d, display standalone)
sw.js                 # Service worker — cache app shell + data for offline
icons/                # 192px & 512px PWA icons (3R mark)
```

Design tokens preserved in `app.css` (already defined in current files' `:root`):
`--read:#1F6F8B`, `--recall:#548235`, `--rank:#BF8F00`, ink `#23303a`, header `#16323d`,
card layout, system font stack.

---

## 5. Feature specifications

### 5.1 Flashcards
Port the existing viewer (flip, prev/next, shuffle, keyboard ←/→/Space) into `flashcards.html`,
but load cards from JSON via `?book=&ch=&deck=` instead of the hardcoded array. Add a
**recall rating** on each card that feeds the progress tracker (see 5.3).

### 5.2 MCQ / quiz mode (`quiz.html`) — NEW
Two modes, following the UWorld pattern:

- **Study (tutor) mode** — on tap, lock the choice, colour the correct option **green** and a
  chosen-wrong one **red**, then reveal the `why` line under **every** option: "why correct" on
  the right answer, "why wrong" on the other three (the author's core requirement, plus the
  top-scorer habit of reading the correct rationale too).
- **Mock-test (timed) mode** — a countdown timer, **no feedback until the end**, then a results
  screen: score, %-correct, and a per-question review of all explanations. Matches the Nepali
  exam format and what local competitors offer.

Running score is shown; attempts + best score persist to progress.

### 5.3 Progress tracker — NEW
`localStorage`, keyed `progress:<book>:<ch>`. Two layers:

- **Coverage** — cards reviewed, quiz attempts + best score, % complete. Shown as a progress
  ring/bar on `book.html` (per chapter) and `chapter.html` (per deck/quiz).
- **Spaced repetition (Anki-style)** — each flashcard is rated **Again / Good / Easy**; a
  lightweight SM-2-style scheduler stores a per-card due-date, and a **"Review due"** deck
  resurfaces weak cards first. A **capped daily review queue** avoids Anki's pile-up problem.

All client-side; no backend.

### 5.4 Notes
Render `notes[]` as the **"Most important things to remember"** section on `chapter.html`,
styled like today's `ul.rapid` list under the Rank pill.

### 5.5 Per-book access gate — client-side encryption
The gate is **cryptographic**, not cosmetic. Each book's chapter content is served
**encrypted** (`docs/data/<book>/ch<n>.enc`): AES-256-GCM with a key derived from the book's
access code via PBKDF2-HMAC-SHA256 (200k iterations, per-book salt). The converter
(`build_data.py`) encrypts at build time; the browser (`gate.js` + `app.js`) decrypts at
runtime using the built-in Web Crypto API.

Flow: `gate.js` reads `?book=`, fetches the per-book `salt` from `books.json`, derives the key
from the entered code, and validates it by decrypting `unlock.enc` (a GCM auth-tag failure ⇒
wrong code). On success the code is stored in `localStorage["3r_keys"]` (a `{book: code}` map),
the page reloads, and `app.js` decrypts each chapter's content on the fly. Works offline (the
`.enc` files are cached; decryption is local).

**Codes never leave the spreadsheet.** `books.json` publishes only the catalog + per-book
`salt` — never the code. The plaintext `content/*.xlsx` (which hold the codes and cleartext
content) are **git-ignored / kept off the public repo**. So the public site and repo expose
only ciphertext.

**What this stops / doesn't (honest limits):** it stops non-buyers and bulk scraping — the
served data is unreadable without a valid code. It does **not** stop a legitimate code-holder
from extracting their own decrypted content, nor **code-sharing** (a shared code decrypts for
anyone). Defeating those needs the v2 **server-side gate + per-user accounts** (validate/revoke
codes server-side, per-buyer watermarking) — out of v1 scope, and requires a hosted backend.

### 5.6 Video lessons (YouTube, placeholder-first)
Each chapter's `videos[]` renders as a card grid on `chapter.html`. **This is built
placeholder-first:** when a video's `yt` id is empty (`"yt": ""`) the card shows a friendly
**"🎬 Video coming soon"** state; when the author later fills in a YouTube id, the same card
automatically becomes a responsive 16:9 embedded player — no code change, just a data edit
(recipe in `CLAUDE.md` §4.6). This lets Mukesh add videos to chapters gradually over time.
Embeds use the privacy-friendly `youtube-nocookie.com` domain. (Note: embedded videos require
a network connection — the offline cache covers notes, flashcards and quizzes, not YouTube.)

### 5.7 PWA (offline + installable)
Add `manifest.webmanifest` and register `sw.js` from `app.js`. The service worker precaches the
app shell (HTML/CSS/JS/icons) and caches `data/*.json` on first visit (stale-while-revalidate),
so unlocked content works offline on phone and laptop. Add `<link rel="manifest">`, a
theme-color meta, and an apple-touch-icon to every page's `<head>`.

---

## 6. Recommended feature set (prioritized)

**Core v1 (agreed):** flashcards w/ spaced repetition · MCQ Study + Timed modes · progress
tracker · notes · per-book code unlock · offline PWA (phone + laptop).

**High-value adds — CONFIRMED for v1:**
- ✅ **Bookmark / star** hard cards & questions → a personal review deck.
- ✅ **Weak-areas auto-review** — wrong MCQs collect into a redo list (UWorld's most-praised feature).

**Other high-value adds (fast-follow):**
- **Daily goal + streak** — light gamification; local advice is "~100 MCQs/day".
- **Exam countdown** banner (Loksewa dates are fixed → motivating).
- **Resume where you left off** + in-book **search** (cards / notes / questions).
- **Dark mode** — students revise at night; trivial with existing CSS variables.

**Nice-to-have (small effort):** optional **image per MCQ/card** (epi diagrams/tables);
**bilingual** language field (content already mixes Nepali terms — दादुरा, हैजा).

**Also in v1 (author decision):** **Google Play Store** listing via a TWA wrapper of the hosted
PWA (see §2) — the web/laptop PWA and the Play Store Android app are the same app from one
codebase. **Video lessons** (YouTube) are built placeholder-first (§5.6) so chapters can gain
videos gradually.

**Later / v2 (needs a backend, out of v1 scope):** online code validation / anti-sharing;
cross-device progress sync (student accounts); **analytics for the author** (which questions
students miss most → improve the books); push notifications for new chapters / exam alerts;
iOS App Store listing (PWA already installs on iPhone in the meantime).

---

## 7. Build order

0. **Standards & spec docs (this file + `CLAUDE.md`) — REVIEW GATE.** ← *we are here.*
   No refactor or feature work begins until these are approved.
1. **Refactor to data-driven, no new features.** Extract `app.css`/`app.js`; move Ch.5 content
   into `data/ha-loksewa/*.json`; make `index/book/chapter/flashcards` read JSON. Verify parity
   with the current site.
2. **Spreadsheet → JSON converter.** Build `tools/build_data.py` + seed `content/ha-loksewa.xlsx`
   from the migrated Ch.5 content; confirm it regenerates identical `data/**` JSON (§3.1).
3. **Per-book gate.** Generalize `gate.js` + `books.json` codes; multi-book unlock state.
4. **MCQ mode.** Build `quiz.html`; seed `mcqs` from the PSC past-question deck.
5. **Progress tracker + confirmed extras.** localStorage store + progress UI; **bookmark/star**
   and **weak-areas auto-review** (both confirmed for v1).
6. **PWA.** manifest + service worker + icons; make everything installable and offline.
7. **Google Play packaging.** Generate a TWA from the live PWA (PWABuilder/Bubblewrap), verify
   it launches full-screen and offline, then submit to the Play Store ($25 one-time). Done once;
   content edits thereafter need no re-packaging.

(Other fast-follow adds from §6 — daily streak, exam countdown, search, dark mode — after §7.5.)

---

## 8. Verification (how we'll test each build)

- **Laptop:** `cd docs && python3 -m http.server 8080`; walk every flow —
  unlock with the book's access code, browse book → chapter, flip flashcards, take a quiz (confirm the
  correct answer + all three "why wrong" explanations show), confirm progress persists across
  reload.
- **Phone:** load the served URL, "Add to Home Screen", confirm standalone icon launch.
- **Offline:** with the app open, toggle DevTools "Offline" — confirm unlocked chapters,
  flashcards, and quizzes still load from the service-worker cache.
- **PWA quality:** Chrome DevTools → Lighthouse → PWA audit passes (installable, offline,
  manifest, icons).
- **Gate isolation:** a second book's code does **not** unlock `ha-loksewa`, and vice-versa.

---

## 9. Open decisions (please confirm at review)

1. ~~**Distribution:** PWA only, or also Google Play?~~ **DECIDED:** PWA (phone + laptop) **and**
   Google Play Store via a TWA wrapper (§2, build step §7.6). iOS App Store deferred.
2. ~~**Anti-sharing:** soft vs server-checked codes?~~ **DECIDED:** on-device soft codes for v1.
3. ~~**Which high-value adds in v1?**~~ **DECIDED:** bookmark/star **and** weak-areas auto-review
   are in v1 (build step §7.5); the rest are fast-follows.
4. ~~**Content authoring:** JSON vs spreadsheet?~~ **DECIDED:** spreadsheet → JSON converter (§3.1).

*All open decisions are now resolved. Ready to begin Step 1 on the author's go-ahead.*
