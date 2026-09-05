#!/usr/bin/env bash
# Publish FIVE to GitHub Pages.
#   -> https://<you>.github.io/<repo>/
#
# Prereqs:
#   - `gh auth login` (one time)
#   - a public repo (GitHub Pages on free plans serves public repos)
#
# Usage:
#   ./publish.sh              # repo name defaults to "take-five"
#   ./publish.sh my-repo      # custom repo name
set -euo pipefail
cd "$(dirname "$0")"

REPO="${1:-take-five}"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh (GitHub CLI) not found." >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "error: not logged in to GitHub. Run:  gh auth login" >&2
  exit 1
fi
GH_USER="$(gh api user --jq .login)"

# Ensure we're in a git repo (initialize + commit if needed).
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init -q
  git config user.name >/dev/null 2>&1 || git config user.name "donnie"
  git config user.email >/dev/null 2>&1 || git config user.email "donnie@local"
  git add -A
  git commit -q -m "FIVE — original Take Five visual homage"
fi

# Detect the branch we're actually on (main or master) so Pages points at it.
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Create + push (or push if the repo already exists).
if git remote get-url origin >/dev/null 2>&1; then
  git add -A
  git commit -m "FIVE: update" || true
  git push -u origin "$BRANCH"
else
  gh repo create "$REPO" --public --source=. --remote=origin --push
fi

# (Re)configure GitHub Pages to the current branch, site root.
# DELETE first so an existing (possibly wrong-branch) config gets replaced.
gh api -X DELETE "repos/${GH_USER}/${REPO}/pages" >/dev/null 2>&1 || true
if ! gh api -X POST "repos/${GH_USER}/${REPO}/pages" \
  -f "source[branch]=$BRANCH" -f "source[path]=/" >/dev/null 2>&1; then
  echo "note: could not set Pages via API. Verify the branch at:"
  echo "      https://github.com/${GH_USER}/${REPO}/settings/pages"
fi

echo
echo "Published. Live in ~1 minute at:"
echo "  https://${GH_USER}.github.io/${REPO}/"
