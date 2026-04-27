# Changelog

All notable changes to the `/rivet` skill will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `scripts/test-fixtures/impeccable/scripts/design-parser.mjs` — vendored YAML-frontmatter-only stub of impeccable's parser so `scripts/test-integration.sh` is genuinely self-contained (verified by physically moving impeccable aside and re-running: 10/10 PASS).
- `scripts/install.sh` `-f` / `--force` flag for non-interactive overwrites; `-h` / `--help` prints usage.
- `scripts/install.sh` `-l` / `--link` flag for dev-mode symlink install. Edits to your source repo become live for every Claude Code session with no re-install. Mode-switches handled (`--force` swaps a symlink for a copy and vice versa).
- `scripts/uninstall.sh` companion script with the same flag shape.
- README "Permissions You're Granting" section + uninstall mention; impeccable section now documents `IMPECCABLE_DIR` for non-default install paths (e.g., `~/.claude/skills/impeccable/`).
- New comprehensive `README.md` covering every subcommand, flag, NL intent, file convention, helper script, configuration knob, plus 14 common workflows and ~25 troubleshooting scenarios.
- Hero mascot image at `docs/assets/rivet-hero.webp`, embedded near the top of the README. Optimised for web with ImageMagick: 1200 × 729, WebP q=85, 148 KB (down from a 2.3 MB unoptimised PNG — a 94 % reduction).

### Changed
- **Documentation reorganisation.** The previous README (elevator pitch + supported stacks + FAQ + file structure) moved to `docs/overview.md`. The repo's `README.md` is now the comprehensive guide, since it's the document most readers will want to land on first.
- `CONTRIBUTING.md` smoke-test claim tightened to mention the vendored stub (was technically inaccurate before this release).
- `run.md` Step 0 branch-convention pointer updated to reference `docs/overview.md` (where the original "Branch Strategy" section now lives) alongside the new README's section 5.

## [2.0.0] — 2026-04-25

First public release. Open-sourced from a personal Laravel-shaped working tool to a stack-agnostic skill, and renamed from the internal codename `/build` to `/rivet` ahead of publishing.

### Renamed (from internal codename)
- Skill name: `/build` → `/rivet` (every slash command, e.g., `/rivet plan`, `/rivet run`).
- Branch convention: `build/{spec}/{phase-id}` → `rivet/{spec}/{phase-id}`.
- Checkpoint tag prefix: `build/.../ckpt-{n}` → `rivet/.../ckpt-{n}`.
- Install path: `~/.claude/skills/build/` → `~/.claude/skills/rivet/`.
- Config file: `build.config.json` → `rivet.config.json`.

### Added
- Component-root auto-detection in `scripts/catalog-components.mjs` (Laravel paths added when `composer.json` or `resources/js/` is present).
- `--roots` CLI flag and `rivet.config.json` (`{ "componentRoots": [...] }`) for overriding component-root detection on unusual layouts.
- `IMPECCABLE_DIR` environment variable to override the impeccable install location (defaults to `~/.agents/skills/impeccable`).
- `${CLAUDE_SKILL_DIR}` is now used in all script invocation paths inside instruction files (no more hardcoded `~/.claude/skills/rivet/scripts/...`).
- TypeScript/Vitest TDD walkthrough in `plan.md` alongside the existing Laravel/Pest example, so the planner sees both stack shapes.
- `scripts/install.sh` for one-command installation.
- `LICENSE`, `CONTRIBUTING.md`, `CHANGELOG.md`.
- Supported-stacks table and FAQ in `README.md`.
- `.astro` added to the design-system frontend file-extension list.

### Changed
- README hero is now stack-agnostic; Laravel content is documented as the battle-tested stack rather than the assumed one.
- Impeccable dependency is now explicitly soft-optional. Each impeccable-gated section in `plan.md`, `run.md`, and `review.md` declares the skip-conditions up front and emits a one-line note when skipping.
- Cross-spec collision example in `plan.md` swapped from Filament/Polar specifics to stack-neutral phrasing.
- `php artisan test` drive-by examples in `run.md` and `plan.md` rules section flipped to neutral `<project test command>` with multi-stack equivalents.
- Recommended model usage in README softened to model families (Opus/Sonnet/Haiku families) so it stays current across model versions.

### Removed
- `.claude/settings.local.json` (personal Claude Code permissions cache, gitignored going forward).
- Internal v2 design notes (`docs/multi-spec-implementation-plan.md`, `docs/usage-and-gaps.md`) — historical context lives in git history of the original personal repo.

## [1.0.0] — Pre-release (private)

Initial private version on the author's machine. Not publicly released.

### Features
- `/rivet plan`, `/rivet run`, `/rivet rollback`, `/rivet review`, `/rivet status`, `/rivet learnings`.
- YAML frontmatter for machine-readable task tracking.
- Stage 0 test re-run, checkpoint tags, parallel dispatch up to 3 subagents.
- In-flight learnings scratch file.
- 16-point senior code review (+ optional Point 17 design audit).
- Optional design-system integration via impeccable.
