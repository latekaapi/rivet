# Changelog

All notable changes to the `/rivet` skill will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`/rivet plan` senior plan-review pass (Step 5.5)** — every `/rivet plan` invocation now runs a second Opus instance, framed as a senior reviewer, against the freshly generated sub-plans before Step 6 (design enrichment). The reviewer (a `Plan`-type subagent — read-only by tool design) judges three lenses: (1) executor-friendliness — no ambiguous instructions, no decisions left to the executor, exact paths, complete code; (2) architecture & dependency correctness — acyclic `depends_on`, parallelism marked correctly, integration test wires the right components, File Map matches Tasks; (3) spec alignment & scope discipline — exit criteria delivered, no scope creep, no premature abstraction, domain language matches the spec, cross-spec collisions actually acted on. Findings are tagged `blocker | major | minor`. The parent Opus applies `proposed_fix` for blocker/major findings via Edit (true judge/patcher separation since the Plan subagent type cannot write), then re-launches the reviewer for pass 2. Hard cap: 2 passes. Pass-2 verdict `approved` proceeds; major-only residuals warn and proceed; **residual blockers hard-gate** with a `--refresh` / `--no-review` retry prompt. Reports save to `docs/plans/{spec}/{phase}/plan-review.md` (or `docs/plans/adhoc/{name}/plan-review.md`) with both passes and a YAML frontmatter (`review_pass`, `verdict`, `finding_counts`, `findings[]`). Each reviewed sub-plan gets a `plan_review:` block in its frontmatter for downstream tooling. All modes by default (spec, ad-hoc, refresh, regenerate, review-source); refresh scopes to stale tasks only, regenerate to the regenerated sub-plan only. Opt-out: `--no-review` (positional-agnostic; works on any mode). Subagent failure is non-fatal — pipeline continues without review and notes the skip.
- **`/rivet plan` review-source mode** — `/rivet plan --from-review reviews/<path>.md` (or any path under `reviews/` ending in `.md`) generates an executable fix-plan from a saved review file. One sub-plan per priority bucket (`01-p0`, `02-p1`, `03-p2`, `04-p3`); empty buckets skipped, output renumbered contiguously. Each finding becomes a task with `origin: review`, `priority`, `review_point`, `review_source`, and `lineage_*` frontmatter for traceability. Removal Candidates fold into `02-p1` ("safe to delete now") / `03-p2` ("defer with plan"). Filter flags: `--max-priority p0|p1|p2|p3`, `--items 3,7,9`, `--include-removal=false`. Lineage is detected from the review's `branch:` frontmatter — when it matches `rivet/{spec}/{phase}`, the fix-plan nests under `docs/plans/{spec}/{phase}/reviews/{slug}/`; otherwise it falls back to `docs/plans/adhoc/review-{slug}/`. Targeted research only (focused codebase agent + cross-spec agent); no broad ad-hoc clarification questions.
- **`/rivet run {spec} {phase} review {slug}` natural-language tail** — executes a review-driven fix-plan nested under a phase, reading from `docs/plans/{spec}/{phase}/reviews/{slug}/*.md`. All standard run behavior applies (subagent dispatch, verify.md Stage 0–2, checkpoint tags as `rivet/{spec}/{phase}/reviews/{slug}/ckpt-{n}`, rollback, resumability, learnings-scratch). Any further natural-language tail (`task 3`, `rollback`, etc.) applies to the fix-plan. Ad-hoc-located review fix-plans use the standard `adhoc/review-{slug}` target — no tail needed.
- **`/rivet review` Step 7 chains into plan/run** — the "Fix all / Fix P0/P1 / Fix specific" menu now invokes `/rivet plan --from-review` (with the matching `--max-priority` or `--items` filter), then offers to start `/rivet run` against the generated fix-plan. The previous inline "fix each issue, re-run tests, commit" loop is replaced — review fixes now flow through the full pipeline (verification stages, checkpoints, rollback, resumability, learnings).
- **`/rivet review` Step 6 stratifies the report path by detected lineage.** When the reviewed branch matches `rivet/{spec}/{phase}`, the report saves to `reviews/{spec}/{phase}/{filename}.md`; ad-hoc branches go to `reviews/adhoc/{name}/`; otherwise `reviews/{full|files|branch|default}/`. Existing flat `reviews/*.md` files keep working — both the legacy and stratified locations are accepted as `/rivet plan --from-review` inputs (glob: `reviews/**/*.md`). The save frontmatter now includes `lineage_kind` plus optional `lineage_spec` / `lineage_phase` / `lineage_adhoc` for downstream tooling.
- **`/rivet status` recurses into nested review fix-plans.** `docs/plans/{spec}/{phase}/reviews/{slug}/` directories surface as nested progress lines under their parent phase. Ad-hoc-located review fix-plans (`docs/plans/adhoc/review-{slug}/`) appear under the Ad-hoc section with a `(review)` label.
- **`/rivet review` PR scope** — accepts `pr <n>`, `pr-<n>`, `#<n>`, or `--pr <n>`. Fetches the PR via `gh pr view <n> --json number,title,headRefName,baseRefName` and `gh pr diff <n>`, then runs the standard 16+1 review against the PR's diff. Stops with a clear error if `gh` isn't installed or the PR isn't accessible — no silent degradation.
- **`/rivet review` always persists the report** under `reviews/`, stratified by detected lineage (see the dedicated stratification entry above). PR scope → `reviews/{spec}/{phase}/pr-{n}-{kebab-title}.md` when the PR's branch matches `rivet/{spec}/{phase}`; otherwise `reviews/{adhoc|full|files|branch|default}/...`. Patterns for branch / files / `--full` / no-args are documented in [README.md §4.4](README.md#44-rivet-review). Each saved report includes a YAML frontmatter block (scope, PR/branch metadata, date, verdict, finding counts by severity, lineage fields) so future tooling can index them. Collisions auto-suffix (`-2`, `-3`, …); existing files are never overwritten. `reviews/` is committed by default — opt out via `.gitignore`.
- **`/rivet spec` subcommand** — produces a strategic execution document at `docs/specs/{name}.md` from a braindump, attached file, conversation context, or existing draft. Three internal phases tracked by a `Status:` field (`Validating | Validated | Architecting | Drafting | Complete | Killed | Pivoted`). Validation rigor includes four-register extraction (Known Facts / Stated Assumptions / Open Questions / Risks), bounded competitive scout via parallel subagents, kill criteria with dates, bet sizing + reversibility analysis, and an adversarial pass producing an Opposition Register. Architecture phase requires 2–3 alternatives per decision with explicit tradeoffs, capability decomposition (primary; phases derived), pricing + GTM + operating-model + non-goals as first-class sections. Synthesis emits `## Phase N` headings that `/rivet plan` consumes. Soft quality gates with `--force` bypass; refresh is additive (`--refresh` walks registers and research, decisions stay locked unless `--decision-revisit D{n}`). Multi-spec capable: Step 1.3 proposes decomposition when independent subsystems are detected. Auto-detects attached files in Claude Code / VS Code (5 input sources priority-ordered).
- `references/` folder with six supporting docs: `assumption-register-format.md`, `decision-log-format.md`, `question-frameworks.md`, `research-playbook.md`, `decision-categories.md`, `quality-rubric.md`.
- `examples/headturn-spec.md` — structural placeholder demonstrating the canonical output shape with a "Worked snippets" appendix.
- README §4.7 documenting `/rivet spec`; SKILL.md router updated; subcommand listing in usage help expanded.
- `scripts/test-fixtures/impeccable/scripts/design-parser.mjs` — vendored YAML-frontmatter-only stub of impeccable's parser so `scripts/test-integration.sh` is genuinely self-contained (verified by physically moving impeccable aside and re-running: 10/10 PASS).
- `scripts/install.sh` `-f` / `--force` flag for non-interactive overwrites; `-h` / `--help` prints usage.
- `scripts/install.sh` `-l` / `--link` flag for dev-mode symlink install. Edits to your source repo become live for every Claude Code session with no re-install. Mode-switches handled (`--force` swaps a symlink for a copy and vice versa).
- `scripts/uninstall.sh` companion script with the same flag shape.
- README "Permissions You're Granting" section + uninstall mention; impeccable section now documents `IMPECCABLE_DIR` for non-default install paths (e.g., `~/.claude/skills/impeccable/`).
- New comprehensive `README.md` covering every subcommand, flag, NL intent, file convention, helper script, configuration knob, plus 14 common workflows and ~25 troubleshooting scenarios.
- Hero mascot image at `docs/assets/rivet-hero.webp`, embedded near the top of the README. Optimised for web with ImageMagick: 1200 × 729, WebP q=85, 148 KB (down from a 2.3 MB unoptimised PNG — a 94 % reduction).

### Changed
- **Token-optimised skill files (no behavior change).** Conditional design-integration content now lives in a new `design.md` sibling file, loaded only when `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/SKILL.md` + `PRODUCT.md` + `DESIGN.md` are all present. Affected sections: `spec.md` 2.9 (Co-founder alignment, gated only on PRODUCT.md), `plan.md` Step 1.5 + Surface inference, `plan.md` Step 6 (full Design Enrichment, sub-steps 6.1–6.7), `run.md` Sub-Plan Design Verification, `review.md` Point 17. Each source file now contains a short conditional-read pointer in place of the moved block; content is preserved verbatim — when the gate passes, the model reads exactly what it read before. SKILL.md also trimmed: collapsed the `review` row and the duplicated "Subcommands:" prose in Usage Help, and dropped the per-subcommand path/checkpoint/branch conventions (already documented inside their respective subcommand files). Net effect: ~5K tokens saved per `/rivet plan` + `/rivet run` session for projects without impeccable; impeccable-equipped projects pay one extra Read tool call per session and see no functional difference. Users updating in place must pull the new `design.md` alongside the modified subcommand files.
- **Documentation reorganisation.** The previous README (elevator pitch + supported stacks + FAQ + file structure) moved to `docs/overview.md`. The repo's `README.md` is now the comprehensive guide, since it's the document most readers will want to land on first.
- `VERIFICATION.md` (24 manual end-to-end test scenarios for contributors) moved to `docs/verification-scenarios.md`. Same content; the rename clarifies its purpose vs the still-at-root `verify.md` (which is the runtime subagent verification protocol — a different file with a similar name). README and CONTRIBUTING references updated.
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
