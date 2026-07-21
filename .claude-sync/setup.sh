#!/usr/bin/env bash
# One-time collaborator setup: installs the git hooks and runs an initial sync.
# Requires js-recon-agentic-files to already be cloned as a sibling directory
# (../js-recon-agentic-files) or JSR_AGENTIC_FILES_PATH to point at it.
set -euo pipefail

JS_RECON_ROOT="$(git rev-parse --show-toplevel)"

chmod +x "$JS_RECON_ROOT/.claude-sync/sync.sh"
chmod +x "$JS_RECON_ROOT/.claude-sync/capture-new.sh"
chmod +x "$JS_RECON_ROOT/.claude-sync/hooks/post-checkout"
chmod +x "$JS_RECON_ROOT/.claude-sync/hooks/pre-commit"

git -C "$JS_RECON_ROOT" config core.hooksPath .claude-sync/hooks

echo "[claude-sync] hooksPath configured, running initial sync..."
"$JS_RECON_ROOT/.claude-sync/sync.sh"
