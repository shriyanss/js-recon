#!/usr/bin/env bash
# Walks the working tree for real (non-symlink) CLAUDE.md / .claude/skills /
# .claude/agents files and captures each into the sibling js-recon-agentic-files
# repo on the current branch, replacing it with a symlink. This is the primary
# "new file" trigger — .gitignore refuses `git add` on these paths outright, so
# a git-staged-diff-based hook (see capture-new.sh) never sees them; a
# filesystem scan is required.
set -euo pipefail

JS_RECON_ROOT="$(git rev-parse --show-toplevel)"
AGENTIC_REPO_PATH="${JSR_AGENTIC_FILES_PATH:-$JS_RECON_ROOT/../js-recon-agentic-files}"

# Optional $1: attribute captures to this branch instead of the current HEAD.
# Used by the post-checkout hook, which only runs *after* HEAD has already
# moved to the new branch — git has no pre-checkout hook, so any real file
# left over from the branch being switched away from must be attributed to
# that branch explicitly, or it would be mis-captured onto the new branch.
CURRENT_BRANCH="${1:-$(git -C "$JS_RECON_ROOT" symbolic-ref --short HEAD 2>/dev/null || echo "")}"

if [ -z "$CURRENT_BRANCH" ] || [ ! -d "$AGENTIC_REPO_PATH/.git" ]; then
    exit 0
fi

captured=0
while IFS= read -r f; do
    [ -z "$f" ] && continue
    rel="${f#$JS_RECON_ROOT/}"
    dest="$AGENTIC_REPO_PATH/$rel"

    mkdir -p "$(dirname "$dest")"
    cp "$f" "$dest"

    (
        cd "$AGENTIC_REPO_PATH"
        if git show-ref --verify --quiet "refs/heads/$CURRENT_BRANCH"; then
            git checkout -q "$CURRENT_BRANCH"
        elif git show-ref --verify --quiet "refs/remotes/origin/$CURRENT_BRANCH"; then
            git checkout -q "$CURRENT_BRANCH"
        else
            git checkout -q -b "$CURRENT_BRANCH"
        fi
        git add "$rel"
        git commit -q -m "sync: capture $rel from js-recon@$CURRENT_BRANCH"
        git push -q origin "$CURRENT_BRANCH" 2>/dev/null || echo "[claude-sync] WARNING: push failed for $rel (branch may need 'git push -u origin $CURRENT_BRANCH' manually)"
    )

    rm -f "$f"
    ln -s "$dest" "$f"
    echo "[claude-sync] captured $rel into js-recon-agentic-files (branch $CURRENT_BRANCH), replaced with symlink"
    captured=1
done < <(find "$JS_RECON_ROOT" \( -name "CLAUDE.md" -o -path "*/.claude/skills/*" -o -path "*/.claude/agents/*" \) -not -path "*/.git/*" -not -path "*/node_modules/*" -not -path "*/build/*" -not -path "$AGENTIC_REPO_PATH/*" -type f)

if [ "$captured" -eq 0 ]; then
    exit 0
fi
