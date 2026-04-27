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
| `plan` | Read `${CLAUDE_SKILL_DIR}/plan.md`, then execute. Args = `{spec} {phase}` OR free-text ad-hoc task description OR `{spec} {phase} --refresh` to re-validate an existing plan OR `{spec} {phase} regenerate sub-plan N` to rewrite one sub-plan. |
| `run` | Read `${CLAUDE_SKILL_DIR}/run.md`, then execute. Args = `{spec} {phase}` or `adhoc/{name}` + optional natural language (e.g., `task 3`, `expand task 4`, `revise task 5 "reason"`, `rollback`, `start from task 5`). |
| `rollback` | Read `${CLAUDE_SKILL_DIR}/run.md`'s Rollback section. Args = `{spec} {phase}` + optional target tag. Shortcut for `run {spec} {phase} rollback`. |
| `review` | Read `${CLAUDE_SKILL_DIR}/review.md`, then execute. Optional args = scope (file paths, branch name, or `--full`). Point 17 (Design System Compliance) runs when frontend files are in scope AND `PRODUCT.md` + `DESIGN.md` exist. |
| `status` | Read `${CLAUDE_SKILL_DIR}/status.md`, then execute. Optional args = spec name (e.g. `main`) to scope output to one spec. |
| `learnings` | Read `${CLAUDE_SKILL_DIR}/learnings.md`, then execute. No args expected. |
| (empty) | Show usage help below. |
| (unrecognized) | Show usage help below. |

## Usage Help

```
/rivet — Development Pipeline

Subcommands:
  /rivet spec [braindump | --from file | {name} | (none)]
                                    Produce a strategic spec at docs/specs/{name}.md (Validation → Architecture → Synthesis)
  /rivet plan [spec phase | task]   Generate micro-step plan from a spec phase or ad-hoc task
  /rivet run [spec phase | adhoc/x] Execute plan via subagents with review + checkpoints
  /rivet rollback [spec phase]      Reset to a checkpoint tag (destructive; confirms first)
  /rivet review [scope]            Run senior code review (16 points + impeccable design audit when frontend files are in scope)
  /rivet status [spec]              Show progress across all specs + ad-hoc (optional spec filter)
  /rivet learnings                 End-of-session CLAUDE.md/README.md sweep

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

Other:
  /rivet status                            → see progress across all specs + ad-hoc
  /rivet status main                       → drill into just one spec
  /rivet review                            → deep code review on changed files
  /rivet learnings                         → capture what was learned this session

Both plan and run understand natural language — say what you mean.
```

## Conventions (apply to all subcommands)

- **Spec location:** `docs/specs/{spec}.md` (one file per spec — e.g. `main.md`, `admin.md`, `agency.md`; source of truth, never modified by this skill). **Single-spec fallback:** if `docs/specs/` is missing or empty, the skill also accepts a bare `spec.md` at the project root with implicit name `spec` (plans then live at `docs/plans/spec/{phase}/...`, branch `rivet/spec/{phase}`). See "spec discovery" below.
- **Spec discovery (used by every subcommand):** (1) list `docs/specs/*.md`; (2) if that's empty, look for `spec.md` at project root and treat it as a single spec named `spec`; (3) if both are empty, only ad-hoc mode works. When exactly one spec is discovered (either source), the user may omit the spec name from any subcommand — `/rivet plan phase-0`, `/rivet run phase-0 task 3`, `/rivet status` all infer it. With multiple specs, the name is required and an unrecognized first arg triggers a "which spec did you mean?" prompt.
- **Plan output (spec):** `docs/plans/{spec}/{phase-id}/{nn}-{sub-plan-name}.md`
- **Plan output (ad-hoc):** `docs/plans/adhoc/{name}.md` or `docs/plans/adhoc/{name}/{nn}-{sub}.md`
- **Progress:** tracked in YAML frontmatter inside each plan file (per-task `status:` field). See [plan.md](plan.md) for the schema.
- **Checkpoint tags:** `rivet/{spec}/{phase-id}/ckpt-{n}` created automatically after each checkpoint. Rollback targets. (Ad-hoc uses `rivet/adhoc/{name}/ckpt-{n}`.)
- **Branch naming:** `rivet/{spec}/{phase-id}` for spec work, `rivet/adhoc/{name}` for ad-hoc.
- **Learnings scratch:** `docs/plans/{spec}/{phase}/learnings-scratch.md` (or `docs/plans/adhoc/{name}/learnings-scratch.md`) is written during `/rivet run` and consumed by `/rivet learnings`.
- **Verification protocol:** subagents follow [verify.md](verify.md); the coordinator re-runs each task's test command (Stage 0) before trusting a subagent's report.
- **Project context:** always read `CLAUDE.md` if it exists before any subcommand
- **Domain language:** use the same vocabulary as the spec — if the spec says "enrichment," the plan says "enrichment," the code says "enrichment"
- **Design integration (optional, requires impeccable):** if the [impeccable](https://github.com/pbakaus/impeccable) skill is installed at `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/` AND `PRODUCT.md` + `DESIGN.md` exist at the project root, `/rivet plan` writes a canonical per-surface design brief to `docs/design/brief-{surface}.md` (surfaces are project-wide so the canonical brief is shared across every spec; optional per-phase override at `docs/plans/{spec}/{phase}/design-brief-{surface}.md`) and embeds a per-task Design Spec (tokens, states, copy, register, surface, reuse/new_primitive) drawing on impeccable's references. `/rivet run` enforces mechanically at Stage 2a (runs after Stage 2 on every `ui: true` task): design-lint (hardcoded hex / off-scale / unknown fonts — hard-fail), import-aware reuse verification (`scripts/check-reuse.mjs`), and trigram-similarity duplicate check (`scripts/similarity.mjs`) with LLM tiebreaker only in the 0.35–0.80 gray zone. At end of sub-plan, `/rivet run` dispatches parallel audit + critique + harden subagents per surface (polish runs only if P0/P1 clean); findings become `origin: audit` follow-up tasks. `/rivet review` Point 17 does the same audit + critique on the review scope, deriving a brief on the fly when no persisted brief exists. Setup: run `$impeccable teach` (writes PRODUCT.md with `register:` + optional `## Surfaces`) and `$impeccable document` OR Google Stitch (writes DESIGN.md). Missing impeccable / `PRODUCT.md` / `DESIGN.md` → all enrichment and verification skip with a one-line note; pipeline never blocks. Use `--skip-verify` on `/rivet run` to opt out of the end-of-sub-plan verification pass even when impeccable is present.
