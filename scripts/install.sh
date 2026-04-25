#!/usr/bin/env bash
# install.sh — Copy the /rivet skill into Claude Code's skills directory.
#
# Default install location: ~/.claude/skills/rivet/
# Override with $CLAUDE_HOME, e.g. CLAUDE_HOME=/opt/claude bash scripts/install.sh
#
# Flags:
#   -f, --force   Overwrite existing install without prompting (for CI / automation).

set -euo pipefail

FORCE=0
for arg in "$@"; do
  case "$arg" in
    -f|--force) FORCE=1 ;;
    -h|--help)  sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
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

if [ -d "${DEST}" ]; then
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

cp -R "${SKILL_SRC}" "${DEST}"

# Strip dev-only artefacts that shouldn't ship to the install location.
rm -rf "${DEST}/.git" "${DEST}/.github" "${DEST}/scripts/test-fixtures/tmp" 2>/dev/null || true

echo "install.sh: installed → ${DEST}"
echo
echo "Next steps:"
echo "  1. Restart Claude Code (or start a new session) to pick up the skill."
echo "  2. Verify with:  ls ${DEST}"
echo "  3. Optional design-system integration: install impeccable (https://github.com/pbakaus/impeccable)"
echo "     to ~/.agents/skills/impeccable/ or set IMPECCABLE_DIR to its install path."
