# 3R Academy — operations & limits

Where everything runs, the free-tier limits, and the few routine tasks to keep it healthy.

## What runs where
| Piece | Service | Cost |
|---|---|---|
| Website / app (the PWA in `docs/`) | GitHub Pages (deployed by GitHub Actions on each push) | Free |
| Android app | Google Play (TWA wrapping the site) | $25 one-time |
| User accounts + data (`profiles`, `entitlements`, `progress`) | Supabase (Postgres + Auth), Singapore region | Free tier |
| Sign-in emails (one-time codes) | Resend (SMTP), from `noreply@mukeshadhikari.com` | Free tier |
| Domain `3r.mukeshadhikari.com` | GoDaddy DNS → GitHub Pages | Existing |

## Free-tier limits
**Supabase (Free):**
- Auth: **50,000 monthly active users**
- Database: **500 MB** (holds thousands–tens of thousands of users; profiles/progress are tiny)
- Egress: ~5 GB/month · 2 projects · **no automatic backups**
- **Pauses after ~7 days of no activity** (one-click restore; irrelevant once you have daily users)

**Resend (Free) — usually the tighter limit:**
- **~100 emails/day, 3,000/month.** Each sign-in = 1 email, so ~100 new sign-ins/day.
- A big launch-day surge hits this first → upgrade Resend or stagger signups.

## When to upgrade (only when you grow)
- **Supabase Pro ~$25/mo:** 100k MAU, 8 GB DB, **daily backups**, no pausing.
- **Resend paid:** higher email volume (e.g. 50k/month).

## Routine tasks
- **Weekly (or after big signup pushes): export `profiles` to CSV.** Supabase → Table Editor →
  `profiles` → Export. Free tier has **no auto-backup**, so this is your safety copy of the
  student list. (Pro adds daily backups.)
- **Add/update content:** edit `content/<book>.xlsx` → `./build.sh` →
  `git add -A && git commit && git push`. Live in ~40s via GitHub Actions.
- **Watch usage:** Supabase → Reports/Usage (DB size, MAU); Resend → dashboard (emails sent,
  delivery/spam); GitHub → Actions tab (deploy success).

## Keep private (never commit / never share)
- Google Play **signing keystore** + its passwords (in the git-ignored Play package folder) —
  back these up; losing them blocks app updates forever.
- **Resend API key** (`re_…`) and Supabase **secret key** (`sb_secret_…`).
- Book **access codes** (live only in the spreadsheets; add a random suffix before printing).
- Only public value in the app is the Supabase **publishable** key in `docs/assets/config.js` (safe).

## If something breaks
- **Sign-in email not arriving:** Resend dashboard → Logs (bounces/spam); check the daily cap.
- **"column not found" on save:** a new profile field wasn't added — run the ALTER in `SUPABASE-SETUP.md`.
- **Deploy failed (Actions):** GitHub Pages is occasionally flaky — re-run the workflow
  (Actions tab → re-run) or `gh workflow run pages.yml`.
- **Supabase project paused:** dashboard → Restore (happens only after long inactivity).
