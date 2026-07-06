# 3R Academy — video lesson guide (recording standard)

House rules so every lesson feels consistent, teaches well, and slots cleanly into the app.
Recorded via **Zoom screen-share** (slides + your voice). Uploaded to **YouTube**, then the video ID
goes into the chapter's `Videos` sheet (`yt` column).

## Length — keep them short (most important rule)
- **5–10 minutes per video**, hard cap ~12. Engagement on educational video drops sharply after ~6 min.
- **One subtopic per video.** Split a chapter into **3–6 short videos** instead of one long lecture
  (e.g. Ch5 → "Basic epidemiology", "Levels of prevention", "Communicable diseases", …). This matches
  the app's video grid and how students actually study (bite-sized).

## Structure (same every time)
1. **Intro (~10s):** branded title card — "3R Academy · <Book> · Ch<N> — <Topic>", by Dr. Mukesh Adhikari.
2. **Objective (~15s):** "By the end you'll know X, Y, Z."
3. **Teaching:** high-yield only — the exam-relevant points, mnemonics, KEY facts. No filler.
4. **Recap (~30s):** the 3–5 must-remember one-liners.
5. **Outro (~5s):** CTA — "Now lock it in: do this chapter's flashcards & MCQs on 3R Academy."

## Recording settings (Zoom)
- Record **locally to your computer** (not cloud) for full quality; trim the start/end afterward.
- **16:9, 1080p.** Share slides **full screen**; keep any webcam bubble small in a corner (optional).
- **Audio matters more than video** — use a decent mic in a quiet room; speak clearly.
- Turn off notifications; close other windows before sharing.

## Slide template (ready to use)
A branded, editable deck is at **`templates/3R-Academy-Video-Template.pptx`** — open it in
PowerPoint, Keynote, or Google Slides (File → Import). It has 7 layouts in the 3R palette:
1. **Title**, 2. **In this lesson** (objectives), 3. **Topic/content**, 4. **KEY facts** (recall),
5. **Don't confuse** (two-column), 6. **Outro / CTA**, 7. **Thumbnail** (16:9 — edit the text, then
export that slide as a PNG for the YouTube thumbnail: File → Export / Save as picture).
Duplicate the content/KEY-facts slides as many times as you need per video. Replace the placeholder
text; keep the colors, pill, and watermark.

## Slides / on-screen (brand consistency)
- Use the **3R palette**: dark teal `#16323d`, accents Read `#1F6F8B` / Recall `#548235` / Rank `#BF8F00`.
- **Big fonts, minimal text, one idea per slide.** High contrast (works when watched on a phone).
- Put a small **"3R Academy" watermark** in a corner on every slide (light anti-piracy + branding).
- Highlight KEY facts and "don't-confuse" pairs the same way the flashcards do.

## Captions & language
- Turn on **captions** (YouTube auto-generates; fix errors). Helps comprehension and accessibility.
- Teach in your natural mix of **English + Nepali** as you would in class; keep technical terms in English.

## YouTube upload
- **Visibility:** the app's content is free-with-book, so **Public** is fine and doubles as marketing/SEO
  (people find you on YouTube). Use **Unlisted** only if you want a bit of exclusivity — either embeds fine.
- **Title convention:** `3R Academy | <Book> | Ch<N> Part <k> — <Topic>` (consistent, searchable).
- Consistent **thumbnail** style (3R colors + chapter/topic text). A simple template you reuse.
- Note: embedded videos need internet (they won't play offline; notes/flashcards/quizzes still do).

## Putting a video in the app
1. Copy the YouTube **video ID** — the part after `watch?v=` (e.g. `dQw4w9WgXcQ`).
2. In `content/<book>.xlsx` → **Videos** sheet, add a row: `chapter`, `title`, `yt` = that ID.
   (Leave `yt` blank to show a "coming soon" card.)
3. `./build.sh` → `git push`. The card becomes an embedded player automatically.
- Keep to **~3–6 videos per chapter** so the grid stays scannable.

## Quick checklist per video
- [ ] One subtopic, 5–10 min · [ ] Branded intro + outro CTA · [ ] 3R-colored, low-text slides +
  watermark · [ ] Clear audio · [ ] Captions on · [ ] Uploaded, ID added to the Videos sheet · [ ] Built & pushed.
