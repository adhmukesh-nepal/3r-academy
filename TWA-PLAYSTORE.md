# Publishing the app to the Google Play Store (TWA)

The app is already a working PWA hosted at **https://3r.mukeshadhikari.com**. To put it on
the Play Store we wrap that live site in a **TWA (Trusted Web Activity)** — a thin Android app
that shows your PWA full-screen with no browser UI. Because it points at the live site,
**anything you `git push` appears in the installed Android app automatically** — you only
re-build/re-submit the app when the icon, name, or start URL changes.

This is a one-time setup. It needs a few things only you can provide (a Google account, a
signing key), so follow these steps on your Mac.

---

## What you need first
- A **Google Play Developer account** — one-time **US $25** at <https://play.google.com/console>.
- The PWA live on HTTPS (already done: `3r.mukeshadhikari.com`).
- **Either** PWABuilder (easiest, web-based) **or** Bubblewrap (command line). Use PWABuilder.

---

## Option A — PWABuilder (recommended, no command line)

1. Go to <https://www.pwabuilder.com> and enter `https://3r.mukeshadhikari.com`.
2. It scores the PWA (manifest, service worker, icons — all already in place) and shows any
   warnings. Fix anything critical (there shouldn't be any).
3. Click **Package for stores → Android → Generate**. Keep these settings:
   - **Package ID:** `com.mukeshadhikari.app_3r.twa`  *(must match `assetlinks.json` — see below)*
   - **App name:** 3R Academy: Health Loksewa Prep
   - **Launcher name:** 3R Academy
   - **Signing key:** choose **"Create new"** the first time. **Download and keep the keystore
     file and its passwords somewhere safe** — you need the *same* key to ship future updates,
     and it cannot be recovered if lost.
4. PWABuilder gives you a zip containing:
   - `app-release-bundle.aab` — this is what you upload to Play.
   - `assetlinks.json` — the Digital Asset Links file with your key's SHA-256 fingerprint.
   - signing key + a readme.

## Option B — Bubblewrap (command line alternative)
Requires Node + a JDK. Then:
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://3r.mukeshadhikari.com/manifest.webmanifest
# answer prompts; set applicationId to com.mukeshadhikari.app_3r.twa
bubblewrap build          # produces app-release-bundle.aab + signing key + assetlinks.json
```

---

## Wire up Digital Asset Links (removes the browser address bar)

A TWA only runs **full-screen without the URL bar** if the website vouches for the app. That's
what `Prep-main/.well-known/assetlinks.json` is for (already added to the repo, served at
`https://3r.mukeshadhikari.com/.well-known/assetlinks.json`).

1. Open the `assetlinks.json` that PWABuilder/Bubblewrap generated and copy the
   **`sha256_cert_fingerprints`** value.
2. Paste it into `Prep-main/.well-known/assetlinks.json`, replacing
   `REPLACE_WITH_SHA256_FINGERPRINT_FROM_PLAY_CONSOLE`. Keep `package_name` as
   `com.mukeshadhikari.app_3r.twa` (or change both to match if you chose a different ID).
3. `git commit` + `git push`. Verify it's live:
   `https://3r.mukeshadhikari.com/.well-known/assetlinks.json` should return the JSON.

> **Play App Signing note:** Google usually re-signs your app with its own key. After you upload
> the first release, Play Console → **Setup → App signing** shows the **"App signing key
> certificate" SHA-256**. Add *that* fingerprint too (you can list more than one in the array),
> then push again — otherwise the address bar may still show for installed users.

*(The repo already includes a `.nojekyll` file so GitHub Pages serves the `.well-known` folder.)*

---

## Upload to Play

1. Play Console → **Create app** → fill name/language/type (App), free.
2. **Production → Create new release** → upload `app-release-bundle.aab`.
3. Complete the required questionnaires: content rating, data safety (this app stores progress
   only on-device, no accounts, no data collection — declare accordingly), target audience, and
   a privacy policy URL (a simple page on your site is fine).
4. Store listing assets you'll need:
   - **App icon** 512×512 (use `Prep-main/icons/icon-512.png`).
   - **Feature graphic** 1024×500.
   - **Screenshots** (phone) — take from the running PWA (home, a chapter, flashcards, a quiz).
   - Short + full description (reuse the SPEC intro; highlight "free lifetime access with the
     book code").
5. Submit for review. First review typically takes a day or two.

---

## After it's live
- **Content updates** (new chapters, decks, MCQs, videos) — just edit the spreadsheet, run
  `tools/build_data.py`, and `git push`. No new app version, no re-review.
- **Re-build the app only** when you change the app icon, name, package ID, or start URL.
- **iPhone users:** point them to `3r.mukeshadhikari.com` in **Safari → Share → Add to Home
  Screen**. (An iOS App Store build is a future option; not required.)
