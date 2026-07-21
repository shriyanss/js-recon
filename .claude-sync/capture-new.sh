#!/usr/bin/env bash
# Intercepts newly-added real CLAUDE.md files at commit time, redirects their
# content into the sibling js-recon-agentic-files repo on the current branch,
# and replaces them with a symlink — so they never land in this repo's history.
set -euo pipefail

JS_RECON_ROOT="$(git rev-parse --show-toplevel)"
AGENTIC_REPO_PATH="${JSR_AGENTIC_FILES_PATH:-$JS_RECON_ROOT/../js-recon-agentic-files}"
CURRENT_BRANCH="$(git -C "$JS_RECON_ROOT" symbolic-ref --short HEAD)"

cd "$JS_RECON_ROOT"

staged_real_claude_md="$(git diff --cached --name-only --diff-filter=ACM | grep -E '(^|/)CLAUDE\.md$' || true)"

if [ -z "$staged_real_claude_md" ]; then
    exit 0
fi

captured=0
while IFS= read -r f; do
    [ -z "$f" ] && continue

    if [ -L "$f" ]; then
        continue
    fi

    dest="$AGENTIC_REPO_PATH/$f"
    mkdir -p "$(dirname "$dest")"
    cp "$JS_RECON_ROOT/$f" "$dest"

    (
        cd "$AGENTIC_REPO_PATH"
        if ! git show-ref --verify --quiet "refs/heads/$CURRENT_BRANCH"; then
            git fetch origin --quiet || true
            if git show-ref --verify --quiet "refs/remotes/origin/$CURRENT_BRANCH"; then
                git checkout -q "$CURRENT_BRANCH"
            else
                git checkout -q -b "$CURRENT_BRANCH"
            fi
        else
            git checkout -q "$CURRENT_BRANCH"
        fi
        git add "$f"
        git commit -q -m "sync: capture $f from js-recon@$CURRENT_BRANCH"
        git push -q origin "$CURRENT_BRANCH"
    )

    git reset -q HEAD -- "$f" >/dev/null 2>&1 || true
    rm -f "$JS_RECON_ROOT/$f"
    ln -s "$dest" "$JS_RECON_ROOT/$f"
    echo "[claude-sync] captured $f into js-recon-agentic-files (branch $CURRENT_BRANCH), replaced with symlink"
    captured=1
done <<< "$staged_real_claude_md"

if [ "$captured" -eq 1 ]; then
    echo "[claude-sync] commit aborted — CLAUDE.md file(s) were redirected to js-recon-agentic-files."
    echo "[claude-sync] please 'git add' any remaining changes and re-run 'git commit'."
    exit 1
fi

exit 0
