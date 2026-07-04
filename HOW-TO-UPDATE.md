# How to update the website (content changes)

Two ways to publish content changes. Both start with editing the spreadsheet.

---

## Option A — Ask Claude (easiest)
1. Edit the workbook and **save it into the `content/` folder** (e.g. `content/ha-loksewa.xlsx`).
   - Editing in Excel/Numbers on this Mac → just Save (it's already there).
   - Editing in Google Sheets / another device → download as `.xlsx` and put it in `content/`
     with the same filename.
2. Tell Claude: **“I updated the spreadsheet, please update the website.”**
   Claude runs the build, commits, pushes, and confirms it's live.

---

## Option B — Do it yourself (manual)

### 1. Edit the content
Open the book's workbook in `content/` (e.g. `content/ha-loksewa.xlsx`) and edit the sheets:
- **Chapters** — set `ready = TRUE` to make a chapter live.
- **Notes / Flashcards / MCQs / Videos** — add rows; each row's **`chapter`** column = the
  chapter number. (Column details: see `CLAUDE.md §4`.)
Save the file.

### 2. Build (convert the spreadsheet into app data)
Open **Terminal** and run:
```
cd ~/claude_projects/exam_prep_app
./build.sh
```
- First run sets things up automatically; later runs are instant.
- If it reports a problem (e.g. an MCQ missing its correct answer), it prints what to fix and
  writes nothing — fix the spreadsheet and run `./build.sh` again.

### 3. Preview locally (optional)
```
cd docs
python3 -m http.server 8080
```
Open **http://localhost:8080** in your browser. Press **Ctrl+C** in Terminal to stop.

### 4. Publish
```
cd ~/claude_projects/exam_prep_app
git add -A
git commit -m "update content"
git push
```
The site rebuilds automatically (GitHub Actions) and is live at **https://3r.mukeshadhikari.com**
in about 40 seconds.

### 5. Verify
Open **https://3r.mukeshadhikari.com** and hard-refresh (**Cmd+Shift+R**) to see the change.

---

## Quick reference (the whole manual flow)
```
# after editing content/<book>.xlsx and saving:
cd ~/claude_projects/exam_prep_app
./build.sh
git add -A && git commit -m "update content" && git push
```

## Notes & gotchas
- **Backup:** `content/*.xlsx` lives only on this Mac (not on GitHub — it holds the codes).
  Keep a copy on OneDrive; if you edit on another computer, bring the file back into `content/`.
- **New book/course:** copy a workbook to `content/<new-id>.xlsx`, fill the **Book** sheet, add
  content, then build + push (recipe in `CLAUDE.md §4`).
- **Deploy stuck/failed:** GitHub Pages is occasionally flaky — GitHub → **Actions** tab →
  re-run the latest workflow (or just push again).
- **Nothing shows up:** make sure the chapter's `ready` is `TRUE`, you ran `./build.sh`, and you
  did `git push`. Hard-refresh the page.
