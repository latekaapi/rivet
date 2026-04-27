#!/usr/bin/env bash
# install.sh — Install the /rivet skill into Claude Code's skills directory.
#
# Default install location: ~/.claude/skills/rivet/
# Override with $CLAUDE_HOME, e.g. CLAUDE_HOME=/opt/claude bash scripts/install.sh
#
# Flags:
#   -f, --force   Overwrite existing install without prompting (for CI / automation).
#   -l, --link    Symlink the source repo into the skills dir (dev mode).
#                 Edits to your dev repo become live for every Claude Code session
#                 with no re-install. Default is to copy.

set -euo pipefail

FORCE=0
LINK=0
for arg in "$@"; do
  case "$arg" in
    -f|--force) FORCE=1 ;;
    -l|--link)  LINK=1 ;;
    -h|--help)  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "install.sh: unknown flag '$arg' (try --help)" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_SRC="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEST_ROOT="${CLAUDE_HOME:-$HOME/.claude}"
DEST="${DEST_ROOT}/skills/rivet"

if [ ! -f "${SKILL_SRC}/SKILL.md" ]; then
  echo "install.sh: SKILL.md not found at ${SKILL_SRC}/SKILL.md — run this from the repo's scripts/ directory." >&2
  exit 1
fi

mkdir -p "${DEST_ROOT}/skills"

# `-e` catches both directories (copy installs) and symlinks (link installs).
if [ -e "${DEST}" ] || [ -L "${DEST}" ]; then
  if [ "${FORCE}" -eq 1 ]; then
    rm -rf "${DEST}"
  else
    echo "install.sh: ${DEST} already exists. Replace it? (y/N)"
    read -r REPLY
    case "${REPLY}" in
      y|Y|yes|YES) rm -rf "${DEST}" ;;
      *) echo "install.sh: aborted, no changes made."; exit 0 ;;
    esac
  fi
fi

if [ "${LINK}" -eq 1 ]; then
  ln -s "${SKILL_SRC}" "${DEST}"
  MODE="symlinked"
else
  cp -R "${SKILL_SRC}" "${DEST}"
  # Strip dev-only artefacts that shouldn't ship to the install location.
  # Skipped in --link mode — those artefacts live in the user's source repo
  # and rm -rf there would be destructive.
  rm -rf "${DEST}/.git" "${DEST}/.github" "${DEST}/scripts/test-fixtures/tmp" 2>/dev/null || true
  MODE="installed"
fi

echo "install.sh: ${MODE} → ${DEST}"
if [ "${LINK}" -eq 1 ]; then
  echo "  (symlink to ${SKILL_SRC} — edits there are live for every Claude Code session)"
fi
echo
echo "Next steps:"
echo "  1. Restart Claude Code (or start a new session) to pick up the skill."
echo "  2. Verify with:  ls ${DEST}"
echo "  3. Optional design-system integration: install impeccable (https://github.com/pbakaus/impeccable)"
echo "     to ~/.agents/skills/impeccable/ or set IMPECCABLE_DIR to its install path."
