#!/usr/bin/env bash
# 3R Academy — rebuild the app's data from the content spreadsheets.
# Usage:  ./build.sh      (run from the project folder, after editing content/*.xlsx)
# First run auto-creates a local Python environment; later runs just convert.
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "First run — setting up the converter (one time)…"
  python3 -m venv .venv
  .venv/bin/pip install -q --upgrade pip
  .venv/bin/pip install -q -r tools/requirements.txt
fi

echo "Converting spreadsheets → app data…"
.venv/bin/python tools/build_data.py

# --- Auto-backup (best-effort) -----------------------------------------------
# A successful build marks the end of an edit round, so snapshot each source
# workbook (code included) into the gitignored content/backups/auto/, keeping the
# 8 most recent per book. Never allowed to fail the build.
set +e
ts="$(date +%Y%m%d-%H%M)"
mkdir -p content/backups/auto
n=0
for f in content/*.xlsx; do
  [ -e "$f" ] || continue
  base="$(basename "$f" .xlsx)"
  cp "$f" "content/backups/auto/${base}-${ts}.xlsx" && n=$((n+1))
  # prune: keep only the 8 newest auto-backups of this workbook
  ls -t "content/backups/auto/${base}-"*.xlsx 2>/dev/null | tail -n +9 | while read -r old; do rm -f "$old"; done
done
echo "🗄  Auto-backed up ${n} workbook(s) → content/backups/auto/ (${ts})"
set -e
# -----------------------------------------------------------------------------

echo ""
echo "✅ Data rebuilt. To publish it live, run:"
echo "     git add -A && git commit -m \"update content\" && git push"
