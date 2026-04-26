# Rivet — Spec-Driven Development Pipeline for Claude Code

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg) ![Node: 18+](https://img.shields.io/badge/node-18%2B-green.svg)

*Where specs get shaped into shipped code.*

A Claude Code skill for turning a spec (or ad-hoc task) into working code through micro-step plans, subagent-driven execution, checkpoints + rollback, and a senior code review pass.

Stack-agnostic: works with any language, framework, and test runner. Optional design-system integration for frontend work via the companion [impeccable](https://github.com/pbakaus/impeccable) skill.

**Tested on:** Laravel + Inertia/React (battle-tested, daily use by the author). Next.js, Python, Go, Rails reported working but not CI-tested.

## Supported stacks

| Stack | Status | Notes |
|---|---|---|
| Laravel + Inertia / Blade | ✅ Battle-tested | Component-root scan auto-detects `composer.json` / `resources/js/` |
| Next.js / React | ⚠️ Reported working | Community-reported, not CI-tested |
| Nuxt / Vue | ⚠️ Reported working | Community-reported, not CI-tested |
| SvelteKit | ⚠️ Reported working | May need `rivet.config.json` for component roots |
| Django / Rails / Go | ⚠️ Reported working | Plan + run + review work; design integration is frontend-only |

All `/rivet plan`, `/rivet run`, `/rivet review`, `/rivet status`, `/rivet learnings` subcommands are stack-agnostic. Only the frontend design-system integration (Point 17 of `/rivet review`, Stage 2a of `/rivet run`) is React/Vue/Svelte/Blade-shaped.

## Installation

Clone this repo, then run:

```bash
bash scripts/install.sh
```

This copies the skill into `~/.claude/skills/rivet/`. Restart Claude Code or start a new session to pick it up.

**Windows (PowerShell):** `Copy-Item -Recurse -Force . "$env:USERPROFILE\.claude\skills\rivet"`

Verify: `ls ~/.claude/skills/rivet/` should show `SKILL.md plan.md run.md review.md status.md learnings.md verify.md README.md scripts/`

To uninstall: `bash scripts/uninstall.sh` (add `--force` to skip the confirmation prompt; honors `$CLAUDE_HOME` the same as `install.sh`).

## Permissions You're Granting

`/rivet` declares `allowed-tools: Read Write Edit Bash Grep Glob Agent TodoWrite` in [SKILL.md](../SKILL.md). On first invocation Claude Code will prompt you to allow each. What each is used for in this skill:

- **Read / Grep / Glob** — read project files (specs, code, plans, lockfiles, design briefs) to gather context.
- **Write / Edit** — create and update plan files under `docs/plans/`, append session-log entries, and (with explicit confirmation) propose `CLAUDE.md` / `README.md` edits during `/rivet learnings`.
- **Bash** — run your project's tests (Stage 0 verification), `git` commands (status, diff, log, tag, commit, **including `git reset --hard` during `/rivet rollback`**), and the helper scripts under `scripts/`.
- **Agent** — dispatch fresh subagents per task during `/rivet run` and per surface during design verification. Subagents inherit only the permissions you've granted to the main session.
- **TodoWrite** — internal multi-step task tracking.

**Heads-up on destructive operations:**

- `/rivet rollback` runs `git reset --hard` against a checkpoint tag. It always asks for explicit confirmation first, but the operation is irreversible — uncommitted work is lost. Stash or commit before rolling back.
- `/rivet run --skip-verify` opts out of the end-of-sub-plan design audit + critique. The per-task design-lint chain (Stage 2a) still runs; only the post-sub-plan pass is skipped.

If you'd rather not grant Bash globally, narrow it in your project's `.claude/settings.json` to the specific commands `/rivet` invokes (`git`, your test runner, `node`, `bash scripts/...`). Without Bash, the skill degrades to plan-only — it can't run tests, commit, or verify.

## Project Setup

For each project, ensure:
1. At least one spec exists at `docs/specs/{name}.md` (for spec-driven workflow — common names: `main.md`, `admin.md`, `agency.md`). A repo can host any number of specs side by side and the skill plans, executes, and tracks each independently, plus flags cross-spec collisions at plan time. **Single-spec shorthand:** a single bare `spec.md` at the project root also works — the skill discovers it with implicit name `spec` and lets you omit the spec name on every command (`/rivet plan phase-0` instead of `/rivet plan spec phase-0`).
2. `CLAUDE.md` exists at project root with, at minimum, a `## Domain Vocabulary` section and a `## Architecture` section. These are the presence gate that tells `/rivet run` it can skip loading the target spec. Without them, every run re-reads the spec (slower and burns tokens).
3. `docs/plans/` will be auto-created on first `/rivet plan`.
4. Your repo is a git repo (required — checkpoint tags and rollback depend on it).

## Branch Strategy

`/rivet run`'s pre-flight check will offer to create an appropriately named branch if you're on `main`/`master`. Convention:

- `rivet/{spec}/{phase-id}` for spec phases — e.g., `rivet/main/phase-0`, `rivet/admin/phase-0`
- `rivet/adhoc/{name}` for ad-hoc work — e.g., `rivet/adhoc/webhook-signing-verification`

Checkpoint tags accumulate on whichever branch you're on: `rivet/{spec}/{phase-id}/ckpt-{n}` (spec mode) or `rivet/adhoc/{name}/ckpt-{n}` (ad-hoc). These are your rollback targets.

## Usage

**Spec workflow (every spec command takes `{spec} {phase}`):**
```
/rivet plan main phase-0                              → generate micro-step plans from main spec
/rivet plan admin phase-0                             → plans from admin spec
/rivet plan main phase-0 --refresh                    → re-validate existing plan vs current codebase
/rivet plan main phase-0 regenerate sub-plan 2        → rewrite one sub-plan only
/rivet run main phase-0                               → execute via subagents
/rivet run main phase-0 task 3                        → jump to a specific task
/rivet run admin phase-0 expand task 4                → break down a complex task
/rivet run main phase-0 revise task 5 "reason"        → rewrite a task mid-run (plan was wrong)
/rivet run main phase-0 rollback                      → reset to last checkpoint tag (destructive)
/rivet rollback main phase-0 rivet/main/phase-0/ckpt-2  → reset to a specific checkpoint
```

**Single-spec shorthand (when only one spec exists, in `docs/specs/` OR a bare `spec.md` at root):**
```
/rivet plan phase-0                                  → single-spec shorthand (only one spec exists)
/rivet run phase-0 task 3                            → same inference for run
/rivet status                                        → same scan layout
```

**Ad-hoc workflow (work not in any spec — no spec name):**
```
/rivet plan "add webhook signing verification"     → research + plan from description
/rivet run adhoc/webhook-signing-verification      → execute ad-hoc plan
```

**Anytime:**
```
/rivet status                            → progress across all specs + ad-hoc
/rivet status main                       → drill into just one spec
/rivet review                            → senior code review (16 points + optional design audit on frontend files)
/rivet learnings                         → end-of-session CLAUDE.md sweep
```

## What Each Subcommand Does

### /rivet plan
Reads the spec (or takes an ad-hoc task description), gathers context via parallel research agents, proposes a split into 4-8 hour sub-plans, and generates micro-step task files with YAML frontmatter (machine-readable task list, dependencies, status). Each task follows TDD: write failing test → verify fail → implement → verify pass → commit. Every sub-plan ends with an integration test. Ad-hoc mode runs full web + docs + codebase research before planning. `--refresh` re-validates an existing plan; `regenerate sub-plan N` rewrites one sub-plan.

### /rivet run
Pre-flight checks (clean tree, branch up-to-date, deps fresh, branch name). Dispatches a fresh subagent per task with context isolation. Coordinator re-runs each task's test command as Stage 0 verification. Two more stages: Stage 1 spec compliance, Stage 2 per-task quality (subset of the 16-point review). Parallel dispatch up to 3 subagents for tasks with satisfied dependencies and no file overlap. Full test suite at every checkpoint, followed by a `rivet/{spec}/{phase}/ckpt-{n}` git tag (or `rivet/adhoc/{name}/ckpt-{n}` for ad-hoc). Bail-out prompt after 3 consecutive review failures. Natural language intents: "task 3", "expand task 4", "revise task 5", "rollback".

### /rivet rollback
Lists available checkpoint tags, confirms target, `git reset --hard` (destructive — requires user confirmation), then reverts `status:` to `pending` for tasks whose commits are newer than the tag.

### /rivet review
16-point senior review: API resilience, job safety, data integrity, correctness, architecture, duplication/dead code, test quality, component contracts, future-awareness, domain language, what's missing, implicit coupling, error semantics, observability, system boundary defense, naming. A 17th point (Design System Compliance) runs automatically when the review scope contains frontend files AND the project has `PRODUCT.md` + `DESIGN.md` AND impeccable is installed — mechanical design-lint plus parallel audit + critique subagents per surface, findings merge into the same P0–P3 report. P0-P3 severity with APPROVE / REQUEST CHANGES / COMMENT verdict. Offers granular fix options.

### /rivet status
Parses YAML frontmatter across all plan files, shows progress bars with estimated-vs-actual hours (actual computed from commit timestamps), flags stale plans, suggests next action. Also flags inconsistencies: tasks marked done without matching commits, tasks stuck in_progress.

### /rivet learnings
Reads `learnings-scratch.md` files (in-flight captures during execution) first, then git diff + CLAUDE.md/README.md/spec. Applies a high bar to identify non-obvious gotchas, conventions, corrections, architectural decisions worth codifying. Proposes edits without applying. Flags spec contradictions. Deletes scratch files after synthesis so rejected entries don't re-propose next session.

## Recommended Model Usage

The skill **cannot** switch models on your behalf. Invoke the right model before each subcommand:

```
Strongest Anthropic model (e.g. Opus family)   → /rivet plan       (planning needs the strongest reasoning)
Fast capable model (e.g. Sonnet family)        → /rivet run        (execution needs speed; plan already has the decisions)
Fast capable model                             → /rivet review     (either works; Sonnet-class is faster)
Fast capable model                             → /rivet status     (trivial)
Fast capable model                             → /rivet learnings  (either works)
```

Tested extensively on Opus 4.7 for `plan` and Sonnet 4.6 for `run`/`review`. If you start `/rivet run` on Opus, it'll still work — just slower and pricier. If you start `/rivet plan` on Haiku-class, the plan will likely be too underspecified for a cheaper executor to follow.

## Optional: Design-System Integration (impeccable)

**Skip this entire section if you don't need design-system governance** — the plan/run/review/status/learnings pipeline works stand-alone.

If you install the companion [impeccable](https://github.com/pbakaus/impeccable) skill at `~/.agents/skills/impeccable/` (or set `IMPECCABLE_DIR` to its path) and place `PRODUCT.md` + `DESIGN.md` at your project root, `/rivet` wires in design-system enforcement for frontend work.

**Non-default install path?** If you put impeccable somewhere other than `~/.agents/skills/impeccable/` — for example, `~/.claude/skills/impeccable/` to keep it next to other Claude skills — export `IMPECCABLE_DIR=~/.claude/skills/impeccable` (or whatever path you used) in your shell profile so `/rivet` can find it. The fallback is `~/.agents/skills/impeccable/`; without `IMPECCABLE_DIR` set, anywhere else won't be discovered.

What it gets you:

- **Setup (once per project):** run `$impeccable teach` (writes `PRODUCT.md` with `register:` + optional `## Surfaces`), then `$impeccable document` OR Google Stitch (writes `DESIGN.md`).
- **`/rivet plan`**: generates a component catalog (reviewable before proceeding), writes a canonical per-surface design brief at `docs/design/brief-{surface}.md` (surfaces are project-wide, so canonical briefs are shared across every spec; optional phase-scoped override at `docs/plans/{spec}/{phase}/design-brief-{surface}.md`), and appends a Design Spec + Design Verification to every UI task — tokens, copy, states, motion, `reuse:` / `new_primitive:`, bans. Per-task validation during generation: any UI task missing both fields triggers a retry (capped at 2) then escalates to the user.
- **`/rivet run`**: Stage 0 warns if `DESIGN.md` has drifted since the plan was generated. Stage 2a mechanical chain per UI task — design-lint (hardcoded hex / off-scale / unknown fonts → hard-fail), import-aware reuse verification via `scripts/check-reuse.mjs`, trigram similarity via `scripts/similarity.mjs` (deterministic bands, LLM tiebreaker only in the 0.35–0.80 gray zone). End of each sub-plan: parallel audit + critique + harden subagents per surface; polish gated on zero P0/P1. Findings become `origin: audit` follow-up tasks. Use `--skip-verify` to opt out of the end-of-sub-plan pass.
- **`/rivet review`**: Point 17 runs impeccable's audit + critique on frontend files in scope, resolving a brief from canonical → phase-override → derived-on-the-fly, and merges findings into the P0–P3 report.

Missing impeccable → `/rivet` continues to work; design enrichment and verification skip with a one-line note and never block the pipeline. Missing `PRODUCT.md` / `DESIGN.md` → same graceful skip.

## FAQ

**Do I need impeccable installed?**
No. The core pipeline (plan, run, review, status, learnings) has zero impeccable dependency. It's only needed for automated frontend design-system enforcement.

**Does this work with monorepos?**
Yes, but `/rivet` treats the current working directory as the project root. Run it from inside the package you're working on, not the monorepo root. Checkpoint tags, branches, and test commands are all scoped to that cwd.

**What if my specs aren't in `docs/specs/`?**
By default the skill looks in `docs/specs/{name}.md` (multi-spec layout). For small single-spec projects you can also place a bare `spec.md` at the project root — the skill discovers it with implicit name `spec`, plans go to `docs/plans/spec/{phase}/...`, and you can omit the spec name on every command. If you need a different layout entirely, the discovery rule lives in `plan.md` Step 1 — edit there.

**What if I use a different test runner?**
The skill reads your project's actual test command from `CLAUDE.md` or the task's YAML frontmatter — not from a hardcoded stack. Any test runner works (`npm test`, `pytest`, `go test`, `cargo test`, `bundle exec rspec`, `php artisan test`, etc.). The Laravel examples in the skill's instruction files are illustrative few-shot demonstrations for the planner, not assumptions about your stack.

**Component-root detection picked the wrong directories. How do I override?**
Two options:
1. `rivet.config.json` at your project root: `{ "componentRoots": ["packages/ui/src", "apps/web/components"] }`
2. Pass `--roots` when invoking the script directly (comma-separated).

**Is this Claude-only or does it work with other LLMs?**
Claude-only — it's a Claude Code skill. The `/rivet` command, subagent dispatch, and context routing all rely on Claude Code primitives.

## File Structure

```
~/.claude/skills/rivet/
  SKILL.md        — Router (lazy-loads subcommand files)
  plan.md         — Plan generator (includes --refresh and regenerate modes)
  run.md          — Executor (Stage 0 test re-run, checkpoints, rollback, parallel dispatch)
  review.md       — Senior code review: 16 core points + optional point 17 (impeccable design audit) when frontend files are in scope
  VERIFICATION.md — Manual test scenarios for feature-level verification (run on a throwaway fixture project)
  scripts/
    install.sh              — Copies the skill into ~/.claude/skills/rivet/
    design-lint.mjs         — DESIGN.md validator + changed-file token linter (Stage 2a gate); requires impeccable
    catalog-components.mjs  — Frontend component scanner, writes per-spec-per-phase component-catalog.md grouped by surface
    check-reuse.mjs         — Import-aware verifier: rejects tasks that declare `reuse:` but don't actually import the primitive
    similarity.mjs          — Trigram Jaccard similarity, used for deterministic catalog duplicate-check bands (LLM tiebreaker only in gray zone)
    test-integration.sh     — ~30s script-level smoke test of the four helpers above against self-contained fixtures
  status.md       — Progress dashboard (reads YAML frontmatter, shows actual vs estimated hours)
  learnings.md    — End-of-session knowledge capture (reads learnings-scratch.md)
  verify.md       — Subagent verification protocol (referenced by run.md)

Your project:
  docs/
    specs/
      main.md                          (one file per spec — e.g. main.md, admin.md, agency.md)
      admin.md
    plans/
      main/
        phase-0/
          01-site-intelligence.md      (has YAML frontmatter for machine-readable status)
          02-prompt-pipeline.md
          component-catalog.md         (written by /rivet plan when frontend roots exist)
          learnings-scratch.md         (written during /rivet run, consumed by /rivet learnings)
      admin/
        phase-0/
          01-admin-scaffold.md
      adhoc/
        webhook-signing-verification.md
    design/
      brief-marketing.md               (canonical, project-wide — shared across every spec)
      brief-dashboard.md
  CLAUDE.md                            (must have ## Domain Vocabulary + ## Architecture sections)
```

## Token Optimizations Built In

- SKILL.md router lazy-loads subcommands — only routing is in permanent context
- `/rivet run` skips spec loading when CLAUDE.md has `## Domain Vocabulary` + `## Architecture` sections
- Subagent verification protocol lives in `verify.md` and is referenced, not inlined per dispatch
- Subagent reports capped at 10 lines
- Stage-2 quality check references `review.md` rather than duplicating criteria
- Each subcommand file loads only when invoked, not at session start

## License

MIT — see [LICENSE](../LICENSE).

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for version history.
