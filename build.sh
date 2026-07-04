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

echo ""
echo "✅ Data rebuilt. To publish it live, run:"
echo "     git add -A && git commit -m \"update content\" && git push"
