#!/usr/bin/env bash
# Mirrors a js-recon branch merge/pull onto the corresponding branches in the
# sibling js-recon-agentic-files repo, since CLAUDE.md files are gitignored
# symlinks here and never participate in this repo's own merges.
set -euo pipefail

JS_RECON_ROOT="$(git rev-parse --show-toplevel)"
AGENTIC_REPO_PATH="${JSR_AGENTIC_FILES_PATH:-$JS_RECON_ROOT/../js-recon-agentic-files}"

TARGET_BRANCH="$(git -C "$JS_RECON_ROOT" symbolic-ref --short HEAD 2>/dev/null || echo "")"

if [ -z "$TARGET_BRANCH" ]; then
    echo "[claude-sync] detached HEAD, skipping agentic-files merge"
    exit 0
fi

if [ ! -d "$AGENTIC_REPO_PATH/.git" ]; then
    echo "[claude-sync] agentic-files repo not found at $AGENTIC_REPO_PATH — see js-recon-agentic-files/README.md for setup"
    exit 0
fi

# git gives post-merge no argument naming the branch that was merged in, and
# this fires for both fast-forward and real merges (plus `git pull`). The
# reflog message git writes for the merge is the one place that reliably
# names the source branch in both cases:
#   "merge <branch>: Fast-forward"
#   "merge <branch>: Merge made by the 'ort' strategy."
#   "pull <remote> <branch>: Fast-forward" (or similar, from `git pull`)
REFLOG_MSG="$(git -C "$JS_RECON_ROOT" reflog -1 --format=%gs HEAD 2>/dev/null || echo "")"

SOURCE_BRANCH=""
if [[ "$REFLOG_MSG" =~ ^merge\ ([^:]+): ]]; then
    SOURCE_BRANCH="${BASH_REMATCH[1]}"
elif [[ "$REFLOG_MSG" =~ ^pull\ [^\ ]+\ ([^:]+): ]]; then
    SOURCE_BRANCH="${BASH_REMATCH[1]}"
fi

# Strip a remote prefix (e.g. "origin/dev" -> "dev") to match agentic-files'
# bare branch naming.
SOURCE_BRANCH="${SOURCE_BRANCH#origin/}"

if [ -z "$SOURCE_BRANCH" ]; then
    echo "[claude-sync] could not determine merged-in branch from reflog ('$REFLOG_MSG') — skipping agentic-files merge"
    exit 0
fi

if [ "$SOURCE_BRANCH" = "$TARGET_BRANCH" ]; then
    exit 0
fi

(
    cd "$AGENTIC_REPO_PATH"
    git fetch origin --quiet

    if git show-ref --verify --quiet "refs/remotes/origin/$TARGET_BRANCH"; then
        git checkout -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH" --quiet
    else
        echo "[claude-sync] WARNING: no 'origin/$TARGET_BRANCH' branch in agentic-files repo — skipping merge"
        exit 0
    fi

    if ! git show-ref --verify --quiet "refs/remotes/origin/$SOURCE_BRANCH"; then
        echo "[claude-sync] WARNING: no 'origin/$SOURCE_BRANCH' branch in agentic-files repo — nothing to merge"
        exit 0
    fi

    if git merge --no-edit "origin/$SOURCE_BRANCH" --quiet; then
        git push --quiet origin "$TARGET_BRANCH"
        echo "[claude-sync] merged agentic-files '$SOURCE_BRANCH' into '$TARGET_BRANCH' and pushed"
    else
        git merge --abort
        echo "[claude-sync] WARNING: merging agentic-files '$SOURCE_BRANCH' into '$TARGET_BRANCH' conflicted — aborted automatically."
        echo "[claude-sync] resolve manually: cd $AGENTIC_REPO_PATH && git checkout $TARGET_BRANCH && git merge origin/$SOURCE_BRANCH"
    fi
)

"$JS_RECON_ROOT/.claude-sync/sync.sh"
