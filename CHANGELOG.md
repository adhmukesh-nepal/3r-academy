# 3R Academy — build log & decisions

A running record of what was built and the key decisions behind it, so anyone (or a future
session) can catch up fast. Newest first. The full commit history (`git log`) is the detailed log;
this is the human summary. Live at **https://3r.mukeshadhikari.com**.

## 2026-07-05

### Tier-1 design polish (done)
- **Dark mode** — auto by OS + a top-bar toggle (remembered per device); no-flash head script sets
  `data-theme`; components follow CSS tokens.
- **Flashcard flip animation** (3D-style), replacing the instant text swap.
- **Streak + daily goal** (local, no backend): recorded on card ratings & quizzes; shown as a home strip.
- **Celebratory results:** score count-up, "+X% vs your last attempt", confetti on ≥80%.
- **All four rationales** shown in the timed-test review (previously only correct + your pick).
- Mobile ergonomics (bigger tap targets), button press micro-interactions, app-icon byline
  "by Dr. Mukesh Adhikari".
- *Design review benchmarked vs Quizlet/Anki/UWorld/Duolingo; Tier 2/3 documented.*

### Percentile ranking + full-length tests (client shipped; needs `RANKING-SETUP.md` SQL)
- **Decisions:** timed attempts only; **chapters ranked on most-recent** score, **full-length tests
  on locked first attempt**; percentile-only (no names); min **20** candidates; **soft nudge** to the
  full test at **≥60%** avg chapter percentile.
- Full-length tests modelled as `kind=test` chapters (open straight into timed mode); HA-Loksewa has
  a coming-soon placeholder (n=101). "My ranking" panel on the book page + percentile on results.
- Privacy via Supabase `SECURITY DEFINER` functions (`submit_score`, `chapter_percentile`, `book_ranking`).

### Sign-in improvements
- Switched to **email + password** (primary) with **email-code** fallback / password recovery;
  handles the confirm-email code in-app. Kept **Confirm email ON** (verified, reachable emails).
- In-app **sign-up onboarding** matching the old Google Form (retired the form); optional code unlocks.
- Signed-in users: sign-up card slimmed to a Viber invite and moved to the bottom.

## 2026-07-04

### v1 — the study app (done)
- Rebuilt the static site into a **data-driven, installable PWA** (one codebase for phone + laptop).
- **Flashcards** (flip decks) + **spaced repetition** (Again/Good/Easy), **★ bookmarks**.
- **MCQs**: Study mode (per-option "why right/wrong") + **Timed mock** mode; **weak-areas auto-review**.
- **Progress tracking**, chapter **notes**, YouTube **video** placeholders.
- **Content model:** authored in Excel (`content/*.xlsx`) → `tools/build_data.py` (`./build.sh`) →
  JSON in `docs/data/`. Home **track filter** (Loksewa · Licensing · Entrance).
- **Content protection:** AES-256-GCM **encryption**, key = PBKDF2 of the book access code; the site
  serves only ciphertext; `gate.js` validates by decrypting. Codes live only in the spreadsheets.
- **PWA:** manifest + service worker (offline), 3R icons. **Play Store** TWA package + listing assets ready.

### Phase A — accounts & sync (done)
- **Supabase** backend (project `newnrskeprjssplanqlu`): `profiles`, `entitlements`, `progress` (RLS).
- **Resend** SMTP from `noreply@mukeshadhikari.com`. Account-tied unlock + cross-device progress sync.

### Infra / branding
- Named the app **3R Academy** (checked availability; differentiated from other "Adhikari"/"3R" names).
- GitHub repo `adhmukesh-nepal/3r-academy`; **GitHub Actions** Pages deploy from `docs/` (reliable);
  domain **3r.mukeshadhikari.com** via GoDaddy CNAME + HTTPS.

## Not built yet (next phases)
- **Run `RANKING-SETUP.md` SQL** to activate percentile ranking.
- **Tier 2/3 design:** signed-in dashboard, progress rings, SVG icon set, badges, swipe-review.
- **Phase B:** server-gated content (stop code-sharing). **Phase C:** subscriptions (eSewa/Khalti/Play).
- Submit the Android app to Google Play.

## Where things are documented
`SPEC.md` (spec + roadmap) · `CLAUDE.md` (standards + authoring) · `HOW-TO-UPDATE.md` ·
`SUPABASE-SETUP.md` · `RANKING-SETUP.md` · `EMAIL-SETUP.md` · `ANALYTICS.md` · `OPERATIONS.md` ·
`TWA-PLAYSTORE.md` · `PLAY-LISTING.md` · plan file `~/.claude/plans/i-am-trying-to-expressive-pinwheel.md`.
