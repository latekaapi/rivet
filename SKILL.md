---
name: rivet
description: "Spec-driven development pipeline — produce a strategic spec from a braindump, then plan, run, review, and track implementation. Where intent gets shaped into shipped code. Subcommands: spec, plan, run, rollback, review, status, learnings."
argument-hint: [subcommand] [args]
disable-model-invocation: true
allowed-tools: Read Write Edit Bash Grep Glob Agent TodoWrite
---

# Rivet — Spec-Driven Development Pipeline

Parse the first word of `$ARGUMENTS` to determine the subcommand. Then read the corresponding instruction file from this skill's directory (`${CLAUDE_SKILL_DIR}`) before proceeding.

## Subcommand Routing

| First word | Action |
|---|---|
| `spec` | Read `${CLAUDE_SKILL_DIR}/spec.md`, then execute. Args = `<braindump>` OR `--from <file>` OR `{name}` (existing spec, continue from current `Status:`) OR `{name} --refresh` (additive re-validation) OR none (synthesize from conversation context). Optional flags: `--lite` / `--deep`, `--force` (bypass quality gates), `--name <n>`. |
| `plan` | Read `${CLAUDE_SKILL_DIR}/plan.md`, then execute. Args = `{spec} {phase}` OR `--from-review reviews/<path>.md` (or any path under `reviews/` ending in `.md`) to generate a plan from a saved review file OR free-text ad-hoc task description OR `{spec} {phase} --refresh` to re-validate an existing plan OR `{spec} {phase} regenerate sub-plan N` to rewrite one sub-plan. Positional-agnostic flag: `--no-review` skips the Step 5.5 senior plan-review pass on any mode. |
| `run` | Read `${CLAUDE_SKILL_DIR}/run.md`, then execute. Args = `{spec} {phase}` or `adhoc/{name}` + optional natural language (e.g., `task 3`, `expand task 4`, `revise task 5 "reason"`, `rollback`, `start from task 5`, or `review {slug}` to run a review-driven fix-plan nested under the phase). |
| `rollback` | Read `${CLAUDE_SKILL_DIR}/run.md`'s Rollback section. Args = `{spec} {phase}` + optional target tag. Shortcut for `run {spec} {phase} rollback`. |
| `review` | Read `${CLAUDE_SKILL_DIR}/review.md`, then execute. Optional args = scope (file paths, branch name, `pr <number>` / `pr-<number>` / `#<number>` / `--pr <number>`, or `--full`). |
| `status` | Read `${CLAUDE_SKILL_DIR}/status.md`, then execute. Optional args = spec name (e.g. `main`) to scope output to one spec. |
| `learnings` | Read `${CLAUDE_SKILL_DIR}/learnings.md`, then execute. No args expected. |
| `redesign` | Read `${CLAUDE_SKILL_DIR}/redesign.md`, then execute. Args = optional `{spec} {phase}` + `--surface {name}`, `--tasks {n,m,p}`, `--dry-run`. Scans all plans if no spec/phase given. Single-spec shorthand applies. |
| (empty) | Show usage help below. |
| (unrecognized) | Show usage help below. |

## Usage Help

```
/rivet — Development Pipeline

(Subcommand argument forms are in the Subcommand Routing table above.)

Spec creation:
  /rivet spec "founders waste hours writing weekly investor updates..."  → drafts docs/specs/main.md from braindump
  /rivet spec --from braindump.md                                         → drafts from a file
  /rivet spec                                                             → synthesizes from current conversation
  /rivet spec main --refresh                                              → additive re-validation (registers + research, decisions stay locked)
  /rivet spec main --refresh --decision-revisit D2                        → re-open one locked decision
  /rivet spec --lite "internal tool for ops team"                         → smaller bet, briefer questions

Spec workflow (multi-spec: every spec command takes {spec} {phase}):
  /rivet plan main phase-0                          → generates sub-plans from main spec's Phase 0
  /rivet plan admin phase-0                         → plans from admin spec's Phase 0

Single-spec shorthand (when only one spec exists, in docs/specs/ OR a bare spec.md at root):
  /rivet plan phase-0                               → infers the single spec; same as /rivet plan {only-spec} phase-0
  /rivet run phase-0 task 3                         → same inference for run
  /rivet status                                     → same scan layout

  /rivet plan main phase-0 --refresh                → re-validate existing plan vs current codebase
  /rivet plan main phase-0 regenerate sub-plan 2    → rewrite one sub-plan only
  /rivet plan main phase-0 --no-review              → skip the senior plan-review pass (faster, lower safety)
  /rivet run main phase-0                           → resume from next incomplete task
  /rivet run main phase-0 task 3                    → jump to a specific task
  /rivet run admin phase-0 start from task 5        → same, natural language
  /rivet run main phase-0 just task 3               → run only that task
  /rivet run admin phase-0 expand task 4            → break a complex task into sub-tasks
  /rivet run main phase-0 revise task 5 "reason"    → rewrite a task (and downstream) mid-run
  /rivet run main phase-0 rollback                  → reset to last checkpoint tag
  /rivet rollback main phase-0 rivet/main/phase-0/ckpt-2  → reset to specific checkpoint

Ad-hoc workflow (no spec name — work not in any spec):
  /rivet plan "add webhook signing verification"   → plan from description
  /rivet run adhoc/webhook-signing-verification      → execute ad-hoc plan

Review-driven workflow (turn /rivet review findings into executable plans):
  /rivet plan --from-review reviews/main/phase-2/pr-42-fix-webhook-signing.md
                                                     → plan all findings (lineage detected: nested under main/phase-2)
  /rivet plan --from-review reviews/full/full-2026-04-27.md
                                                     → plan all findings (no lineage: ad-hoc plan)
  /rivet plan reviews/.../pr-42-...md --max-priority p1
                                                     → plan only P0+P1 findings
  /rivet plan reviews/.../pr-42-...md --items 3,7,9
                                                     → plan only listed finding numbers
  /rivet run main phase-2 review pr-42-fix-webhook-signing
                                                     → execute spec-scoped review fix-plan (explicit slug)
  /rivet run main phase-2 review                     → infer slug (uses the one in-progress fix-plan,
                                                       or prompts if ambiguous)
  /rivet run adhoc/review-full-2026-04-27             → execute ad-hoc review fix-plan (explicit slug)

Other:
  /rivet status                            → see progress across all specs + ad-hoc
  /rivet status main                       → drill into just one spec
  /rivet review                            → deep code review on changed files
  /rivet learnings                         → capture what was learned this session
  /rivet redesign                          → re-apply updated DESIGN.md to already-built components
  /rivet redesign main phase-0             → scope to one phase
  /rivet redesign --dry-run                → preview stale surfaces without touching files

Both plan and run understand natural language — say what you mean.
```

## Conventions (apply to all subcommands)

- **Spec location:** `docs/specs/{spec}.md` (one file per spec — e.g. `main.md`, `admin.md`, `agency.md`; source of truth, never modified by this skill). **Single-spec fallback:** if `docs/specs/` is missing or empty, the skill also accepts a bare `spec.md` at the project root with implicit name `spec` (plans then live at `docs/plans/spec/{phase}/...`, branch `rivet/spec/{phase}`). See "spec discovery" below.
- **Spec discovery (used by every subcommand):** (1) list `docs/specs/*.md`; (2) if that's empty, look for `spec.md` at project root and treat it as a single spec named `spec`; (3) if both are empty, only ad-hoc mode works. When exactly one spec is discovered (either source), the user may omit the spec name from any subcommand — `/rivet plan phase-0`, `/rivet run phase-0 task 3`, `/rivet status` all infer it. With multiple specs, the name is required and an unrecognized first arg triggers a "which spec did you mean?" prompt.
- **Plan / review output, branch naming, checkpoint tags:** documented inside the relevant subcommand file (plan.md, run.md, review.md). Each subcommand owns its own paths.
- **Senior plan review:** `/rivet plan` runs a second Opus pass (Step 5.5 in [plan.md](plan.md)) that reviews the generated plan for executor-friendliness, dependency correctness, and spec alignment, auto-revises blocker/major findings, then re-reviews. Hard cap: 2 passes. Hard-gates only on residual blockers; major/minor findings warn and continue. Skip via `--no-review`. Report saved alongside the plan at `docs/plans/{spec}/{phase}/plan-review.md` (or `docs/plans/adhoc/{name}/plan-review.md`).
- **Progress:** tracked in YAML frontmatter inside each plan file (per-task `status:` field). See [plan.md](plan.md) for the schema.
- **Learnings scratch:** `docs/plans/{spec}/{phase}/learnings-scratch.md` (or `docs/plans/adhoc/{name}/learnings-scratch.md`) is written during `/rivet run` and consumed by `/rivet learnings`.
- **Verification protocol:** subagents follow [verify.md](verify.md); the coordinator re-runs each task's test command (Stage 0) before trusting a subagent's report.
- **Project context:** always read `CLAUDE.md` if it exists before any subcommand
- **Domain language:** use the same vocabulary as the spec — if the spec says "enrichment," the plan says "enrichment," the code says "enrichment"
- **Design integration (optional, requires impeccable):** when the [impeccable](https://github.com/pbakaus/impeccable) skill + `PRODUCT.md` + `DESIGN.md` are present, plan/run/review subcommands enrich UI work with per-surface briefs, per-task Design Specs, mechanical token-lint + reuse checks, and end-of-sub-plan audit/critique/harden passes. Full mechanics live in `${CLAUDE_SKILL_DIR}/design.md`, loaded conditionally by plan.md / run.md / review.md when those subcommands run. Missing impeccable or PRODUCT.md or DESIGN.md → enrichment + verification skip with a one-line note; pipeline never blocks. `--skip-verify` on `/rivet run` opts out of the verification pass even when impeccable is present. When DESIGN.md changes after components are built, `/rivet redesign` re-applies the visual layer to done tasks and updates `design_hashes` without re-running the TDD cycle.
