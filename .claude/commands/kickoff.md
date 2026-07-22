---
description: Rebuild full project context and report current state + next steps
---

You are resuming work on **3R Academy** (this project). Do the following before we start, and do NOT make any changes yet — this is a read-only status briefing.

1. Read `CLAUDE.md` (project standards + the status/roadmap blockquote at the top).
2. Read `SPEC.md` → the **BUILD STATUS & ROADMAP** section and its **How to resume later** note.
3. Read `CHANGELOG.md` and skim the last ~10 `git log --oneline` commits.
4. Recall the `exam-prep-app` memory (repo location, content-build workflow, PHO testing access code, competitor notes, and next steps). Treat memory as point-in-time — verify any file/code claim against the current repo before asserting it as fact.
5. Run a quick health check: `git status`, unpushed commits (`git log origin/main..HEAD --oneline`), and confirm the generated `docs/data/**` is in sync with `content/*.xlsx` (rebuild via `./build.sh` and diff if unsure).

Then give me a concise briefing:
- **Where we are** — what's live, content coverage per book (which chapters are `ready`), and any pending/uncommitted work.
- **Top 3 next steps** — pulled from the roadmap and memory, in priority order.
- **Any flags** — out-of-sync data, unpushed commits, or things that contradict the docs.

Remember the hard rules in `CLAUDE.md` §1 — especially: **this repo is PUBLIC; never commit internal discussion, competitor analysis, strategy, revenue, access codes, or personal data.** Keep those in private memory or a gitignored `notes/` folder.

End by asking me what I want to work on.
