#!/usr/bin/env bash
# uninstall.sh — Remove the /rivet skill from Claude Code's skills directory.
#
# Default removal target: ~/.claude/skills/rivet/
# Override with $CLAUDE_HOME, e.g. CLAUDE_HOME=/opt/claude bash scripts/uninstall.sh
#
# Flags:
#   -f, --force   Remove without prompting (for CI / automation).

set -euo pipefail

FORCE=0
for arg in "$@"; do
  case "$arg" in
    -f|--force) FORCE=1 ;;
    -h|--help)  sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "uninstall.sh: unknown flag '$arg' (try --help)" >&2; exit 2 ;;
  esac
done

DEST_ROOT="${CLAUDE_HOME:-$HOME/.claude}"
DEST="${DEST_ROOT}/skills/rivet"

if [ ! -d "${DEST}" ]; then
  echo "uninstall.sh: nothing to do — ${DEST} does not exist."
  exit 0
fi

if [ "${FORCE}" -ne 1 ]; then
  echo "uninstall.sh: remove ${DEST}? (y/N)"
  read -r REPLY
  case "${REPLY}" in
    y|Y|yes|YES) ;;
    *) echo "uninstall.sh: aborted, no changes made."; exit 0 ;;
  esac
fi

rm -rf "${DEST}"

echo "uninstall.sh: removed → ${DEST}"
echo
echo "Restart Claude Code (or start a new session) to drop the skill from active sessions."
