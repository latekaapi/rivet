# /rivet run — Subagent-Driven Execution

## Step 0: Pre-flight

Before loading context or executing anything, verify the environment is ready. Skip this step for `rollback` invocations — the rollback flow has its own checks.

1. **Working tree clean?** Run `git status --porcelain`. If output is non-empty:
   - Offer three options: (1) commit the outstanding work, (2) stash it, (3) abort the run.
   - Do not proceed with dirty state — mid-run commits would entangle outside work with task commits.

2. **Branch up to date with remote?** Run `git fetch` then `git status -uno`. If behind:
   - Warn the user. Offer to `git pull --ff-only` or proceed anyway.

3. **Dependencies fresh?** Check whether `composer.lock` / `package-lock.json` / `yarn.lock` / `bun.lockb` differs between `HEAD` and `HEAD~1`:
   ```bash
   git diff --name-only HEAD~1 HEAD | grep -E '(composer|package|yarn|bun)\.(lock|lockb)?$'
   ```
   If any lockfile changed, prompt to run the corresponding install command (from CLAUDE.md) before continuing.

4. **Branch check.** Compare the current branch against the run target:

   - **On `main` / `master`:** Offer to create and switch to the run's target branch (`rivet/{spec}/{phase-id}` for spec phases, `rivet/adhoc/{name}` for ad-hoc, `rivet/{spec}/{phase}/reviews/{slug}` for review fix-plans). User can decline and stay on main.

   - **Already on the run's target branch:** Proceed — this is normal session resumption.

   - **On a different `rivet/...` branch** (e.g., on `rivet/main/phase-0` and running `phase-1`): The previous phase's branch is still checked out — this run's commits would land on the wrong branch. Check whether the current branch is already merged into main (`git branch --merged main`) and offer:
     - (a) **Switch to main, then create the new branch.** Default if the current branch is already merged.
     - (b) **Merge current branch to main first, then create the new branch.** Default if it's unmerged. Walks through the same regular-vs-squash prompts as Phase Completion.
     - (c) **Continue on the current branch.** Anti-pattern — mixes work from two phases on one branch. Only pick this if you explicitly want to stack.

   - **On any other branch** (not `main`/`master`, not a `rivet/...` branch): Warn that the skill didn't create this branch. Offer to switch to main and create the `rivet/...` target branch, or proceed on the current branch (user's call).

   Convention documented in [docs/overview.md](docs/overview.md) (also covered in [README.md](README.md) section 5).

5. **Design context drift.** If the plan's frontmatter has `design_hashes` (impeccable integration present), recompute each surface's hashes and compare against stored values:

   ```
   For each surface in plan.design_hashes:
     Recompute: ref_sha, canonical_sha, override_sha (if override_path set)
     Store locally for this run.
     If any recomputed SHA differs from the stored value:
       collect a diff entry: { surface, which, stored_first_8, current_first_8 }
   ```

   If any drift was detected, warn the user:

   ```
   Design context has changed since this plan was generated:
     {surface}:
       {which}: stored {old8}…, current {new8}…  ✗
       ...
   Recommend: /rivet plan {spec} {phase} --refresh before continuing.
   Proceed anyway with stale context? (y/n)
   ```

   - On `y`: proceed; append a learnings-scratch entry `Ran with stale design_hashes for surface={X}, which={which}.` so `/rivet learnings` captures it.
   - On `n`: abort; user runs `--refresh` first.

   This is a warning, not a hard fail — the user might have intentionally hotfixed a token and wants in-flight tasks to use the new value.

If any check requires user input, wait for a decision before advancing to Step 1.

## Step 1: Load Context

Read `CLAUDE.md` — project conventions, domain vocabulary, architecture patterns.

In spec mode, only read the target spec if CLAUDE.md lacks a `## Domain Vocabulary` or `## Architecture` section. The spec path is `docs/specs/{spec}.md` for normal multi-spec repos, or `spec.md` at the project root in single-spec-fallback mode (resolved during Step 2 alongside the spec discovery in plan.md). Those two CLAUDE.md sections are where spec-derived context lives; if they're both present, the plan files plus CLAUDE.md have everything the subagents need. Skimming a 1,600-line spec every run wastes tokens.

In ad-hoc mode, skip the spec read entirely — ad-hoc work is not scoped to any single spec.

Line-count is a poor proxy for sufficiency — a 10-line CLAUDE.md that says "this is a Laravel project" won't carry an execution session. Presence of the two named sections is the real gate.

## Step 2: Parse Intent from Arguments

First, identify the plan target. Discover specs the same way `plan.md` Step 1 does: list `docs/specs/*.md`; if empty, fall back to `spec.md` at the project root with implicit name `spec`. Call this set `spec_names`.

Arguments take one of two shapes:

- **Spec mode:** `{spec} {phase}` followed by optional natural-language intent. `{spec}` must match a name in `spec_names`. **Single-spec shorthand:** when `len(spec_names) == 1`, the user may omit `{spec}` and pass just `{phase}` (e.g. `/rivet run phase-0 task 3`) — the lone spec is inferred. With multiple specs, if the first token isn't a known spec name but looks like a phase (`phase-0`, etc.), list `spec_names` and ask which one the user meant.
- **Ad-hoc mode:** `adhoc/{name}` followed by optional natural-language intent. No spec context.

If `{spec}` isn't in `spec_names`, list the specs that exist and ask; never silently substitute. If `{phase}` doesn't match a directory under `docs/plans/{spec}/`, tell the user and stop — this is usually a typo.

Once the target is known, the remaining arguments are free-form natural language. Parse them for intent:

**Jump to a specific task:**
Triggered by mentions of a task number with or without context — "task 3", "start from task 3", "just task 3", "only task 7", "skip to task 5".
→ Execute only that specific task (or start from that task and continue sequentially).

**Expand a task:**
Triggered by "expand task 4", "break down task 4", "task 6 is too big", "split task 2".
→ Read the specified task from the plan, break it into finer sub-tasks (each still 2–5 minutes), write the expanded tasks back into the plan file replacing the original, then ask the user to confirm before executing.

**Revise a task (mid-run plan adjustment):**
Triggered by `revise task 4 "reason"`, "rewrite task 4 to use X library", "task 5 won't work because the API returns ...".
→ The plan's approach for that task is wrong given what we've learned. Flow:
  0. **Check task N's current status.** If `status: done`, the task's code is already committed — rewriting the plan won't touch the code. Warn and offer:
     - "Task N is already done. Options: (1) /rivet rollback to the checkpoint before task N, then revise; (2) treat this as a new follow-up task (revise the plan's future-work section instead); (3) abort."
     Wait for the user's choice. Do NOT silently proceed with plan rewrite on a done task — the resulting divergence between plan and committed code is worse than either alternative.
  1. Read task N from the plan plus any downstream tasks that reference task N's files (check the `files:` list in frontmatter).
  2. Dispatch a fresh planning subagent (Opus-grade if available) with: the user's reason, the current codebase state (recent commits + touched files), CLAUDE.md, and the tasks that follow. Instruct it to produce a new task N (and revised downstream tasks if dependencies change).
  3. Rewrite the affected tasks in the plan file — both the YAML frontmatter entries and the `### Task N` markdown blocks.
  4. Show the user a diff of the changed tasks.
  5. Wait for confirmation, then resume `/rivet run` from the revised task.

Do not execute revised tasks without user confirmation — this is a planning action, not an execution action.

**Rollback to a checkpoint:**
Triggered by "rollback", "rollback to ckpt-2", "revert to last checkpoint", "undo".
→ Jump to the Rollback section below. Destructive; requires explicit user confirmation before `git reset --hard`.

**Skip sub-plan design verification:**
Triggered by `--skip-verify` anywhere in the args (e.g., `/rivet run main phase-0 --skip-verify`, or `/rivet run main phase-0 task 3 --skip-verify`).
→ On reaching Sub-Plan Design Verification, skip the entire block (audit + critique + harden + polish + optimize subagent dispatch) and go straight to Sub-Plan Transitions. Task-level Stage 2a design enforcement chain (token lint + declaration match + duplicate check) still runs — `--skip-verify` only opts out of the end-of-sub-plan verification pass.

**Run a review-driven fix-plan (spec mode):**
Triggered by `review` (with or without a slug) immediately after `{spec} {phase}`.
- With slug: e.g. `/rivet run main phase-2 review pr-42-fix-webhook-signing` → use that slug directly.
- Without slug: e.g. `/rivet run main phase-2 review` → **infer the slug** per the Slug Inference rule in Step 3.

→ Read sub-plans from `docs/plans/{spec}/{phase}/reviews/{slug}/*.md` instead of `docs/plans/{spec}/{phase}/*.md`. All other behavior (subagent dispatch, verification stages, checkpointing, learnings-scratch) is identical — only the plan source directory changes. Checkpoint tags use the form `rivet/{spec}/{phase}/reviews/{slug}/ckpt-{n}` (the existing tag generator builds tags from the run's branch name, which for review-driven plans is `rivet/{spec}/{phase}/reviews/{slug}`). Any further natural-language tail (`task 3`, `start from task 5`, `rollback`) applies to the review fix-plan, not the parent phase. For ad-hoc-located review plans (no spec lineage), use the standard `adhoc/review-{slug}` target — no `review {slug}` tail is needed.

**Default (no extra context beyond target):**
→ Resume from the next incomplete task and continue sequentially.

## Step 3: Find Plan Files

Resolve the plan path from the target:
- `main phase-0` → look in `docs/plans/main/phase-0/`
- `admin phase-0` → look in `docs/plans/admin/phase-0/`
- `adhoc/webhook-signing-verification` → look for `docs/plans/adhoc/webhook-signing-verification.md` (single file) or `docs/plans/adhoc/webhook-signing-verification/` (directory with sub-plans)
- `main phase-2 review pr-42-fix-webhook-signing` → look in `docs/plans/main/phase-2/reviews/pr-42-fix-webhook-signing/` (review-driven fix-plan nested under the parent phase). If the directory is missing: `No review fix-plan found at docs/plans/{spec}/{phase}/reviews/{slug}/. Run /rivet plan --from-review reviews/{spec}/{phase}/{slug}.md first.`

**Slug Inference (when `review` is passed without a slug):**

Scan `docs/plans/{spec}/{phase}/reviews/*/` (non-recursive directory listing). Apply this resolution order:

1. Collect all fix-plan directories whose sub-plans contain at least one task with `status: pending` or `status: in_progress` — call these **active** plans. If exactly one active plan exists → use it. Tell the user: `Inferred review fix-plan: {slug} (has pending tasks).`
2. If zero active plans exist but exactly one fix-plan directory exists total → use it. Tell the user: `Inferred review fix-plan: {slug}.`
3. If multiple active plans exist → list their slugs and ask: `Multiple in-progress review fix-plans found for {spec} {phase}. Which one? {slug-a}, {slug-b}, ...` Wait for the user's answer, then re-enter Step 3 with the chosen slug.
4. If zero fix-plan directories exist → stop with: `No review fix-plans found for {spec} {phase}. Run /rivet plan --from-review reviews/{spec}/{phase}/{review-file}.md first.`

For ad-hoc-scoped review plans: the argument `adhoc/review` (without a slug suffix) triggers the same logic over `docs/plans/adhoc/review-*/` directories. The global shorthand `/rivet run review` (inferring both phase and spec) is intentionally not supported — too ambiguous when multiple specs or phases have in-progress reviews.

If neither a matching file nor directory exists:
- spec mode: "No plans found for `{spec} {phase}`. Run `/rivet plan {spec} {phase}` first."
- Ad-hoc mode: "No plans found for `adhoc/{name}`. Run `/rivet plan \"...\"` first."

If a single plan file: execute its tasks directly.
If a directory with multiple sub-plans: determine which to execute:
1. Parse each sub-plan's YAML frontmatter and look for entries with `status: pending` or `status: in_progress`. List `*.md` non-recursively — `docs/plans/{spec}/{phase}/reviews/` is a sibling directory of the phase's sub-plans and must NOT be scanned when running the parent phase. Review fix-plans run only when the user passes the `review {slug}` tail.
2. Start with the first sub-plan that has non-done tasks
3. Tell the user: "Resuming from `{sub-plan-file}` — {n} tasks remaining. Starting at Task {next-incomplete}."

## Step 4: Execute Tasks via Subagents

For each incomplete task in the current sub-plan, dispatch a **fresh sub-agent** using the Agent tool.

### Parallel Dispatch for Independent Tasks

Before dispatching the next task, look at the next few pending tasks and their `depends_on:` entries in the frontmatter. If two or more upcoming tasks satisfy all of:

- `status: pending`
- All `depends_on:` task ids have `status: done`
- No overlap in `files:` (two tasks editing the same file must run sequentially to avoid merge headaches)

…dispatch them **concurrently** — one Agent tool call per task in a single assistant message. Hard cap: **3 in parallel**. More than that and coordinator attention fragments; review quality drops.

Review and commit sequentially by task id after all parallel subagents return. Do not flip `status: done` for any parallel task until it has passed Stage 0 + Stage 1 + Stage 2 + Stage 2a (if `ui: true`) review. Commit each parallel task as it clears review, in task-id order. If one fails, fix-and-retry that task only — the others that already passed stay committed, and the failed one blocks any downstream task that depended on it. **Do not apply `design_extends` in parallel** — if two parallel tasks both declare `design_extends`, fall back to sequential dispatch to avoid concurrent writes to the same DESIGN file.

**Parallel subagents must NOT commit.** Git's index lock (`.git/index.lock`) is per-repo; concurrent `git commit` calls from parallel Agent processes can collide and fail. Instead, instruct parallel subagents to stage their changes (`git add`) but stop short of committing. Their final return should include a `files_staged:` list. The coordinator then iterates through the returned subagents in task-id order, runs Stage 0/1/2 review per task, and issues the commit itself (coordinator → Bash tool, sequential).

If in doubt (e.g., uncertain whether two tasks touch the same file), fall back to sequential dispatch. The safety-vs-speed tradeoff favors safety.

### Subagent Prompt Construction

Each subagent receives ONLY:
- The specific task from the plan (steps, code, file paths, commands, expected output)
- The verification checklist (see below)
- Relevant CLAUDE.md conventions (extract only the parts that apply — don't dump the whole file)

Each subagent does NOT receive:
- The full plan
- The spec
- Previous task results (unless the current task explicitly depends on them)
- Conversation history

This context isolation is intentional — fresh context per task prevents drift and keeps the subagent focused.

### Subagent Task Template

```
## Your Task

{paste the exact task from the plan, including all steps, code, file paths, commands}

## Project Conventions

{relevant excerpts from CLAUDE.md — only what applies to this task}

## Verification

Follow the verification protocol in `${CLAUDE_SKILL_DIR}/verify.md` before reporting done. Report back in under 10 lines per the format described there.
```

### After Each Subagent Returns

The coordinator (you) performs a **three-stage review**. Stage 0 is non-negotiable.

**Stage 0 — Test Verification (MANDATORY):**

Re-run the exact test command from the task in a Bash tool call. Compare the actual output to the task's `Expected: PASS` line.
- Actual PASS → proceed to Stage 1.
- Mismatch (test failed, error, or doesn't match expected output) → do NOT trust the subagent's report. Dispatch a fix subagent with the actual test output before any `status:` flip. Count this as a review failure for the bail-out heuristic.

This closes the "subagent hallucinated passing tests" failure mode. The subagent's claim is a hypothesis; the coordinator's re-run is the evidence.

**Stage 1 — Spec Compliance:**
- Did the subagent complete exactly what the task specified?
- Did it modify only the files listed in the task?
- Does the code match the spec's domain language and architecture patterns?
- Did tests pass?

**Stage 2 — Per-task Quality Check:**

Apply review points 4 (Correctness & Edge Cases), 6 (Duplication, Dead Code & Structural Quality), 10 (Domain Language Consistency), and 16 (Naming as Thinking) from `${CLAUDE_SKILL_DIR}/review.md`. That file is the single source of truth for what "quality" means in this pipeline; duplicating the criteria here would drift. The full 16-point review runs at `/rivet review`; Stage 2 is the per-task subset most likely to catch issues that would make the next task harder.

**Stage 2a — Design enforcement chain (UI tasks only, `ui: true` in frontmatter):**

Three mechanical checks in order. Any failure blocks task close — dispatch a revise subagent with the exact failure report as the prompt. Repeat until clean.

1. **`design_extends` application (if present).** If the task's frontmatter declares `design_extends:`, merge those token additions into the task's surface `design_ref` file (DESIGN.md or DESIGN-{surface}.md), then invalidate the plan's `design_hashes[{surface}].sha` to the new SHA. Record the append in `session-log.md`. Do this before Design Token Lint so the new tokens register as allowed.

2. **Design Token Lint.** Compute the task's changed files via `git diff --name-only <task-start-ref> HEAD`, then run:

   ```bash
   node ${CLAUDE_SKILL_DIR}/scripts/design-lint.mjs \
     --design <surface design_ref resolved from task frontmatter> \
     --files <comma-separated changed files>
   ```

   - Exit 0 → pass this sub-check.
   - Exit 2 → reject. Pass the script's full violation report as the revise prompt. Executor fixes hardcoded hex / off-scale values / unknown fonts and re-reports.

3. **Reuse / new_primitive declaration match.** Two sub-checks:

   **3a. Created files match declarations.** Parse the task body's `reuse:` list and `new_primitive:` block. For each file the subagent *created* (not modified):
   - Created path matches a `new_primitive.path` → OK.
   - Created path isn't declared anywhere → reject: list the undeclared files, require the executor to either update `reuse:` or declare a new `new_primitive:` with reason.

   **3b. Declared reuse actually used.** For every entry in the task's `reuse:` list, invoke the import-aware resolver:

   ```bash
   node ${CLAUDE_SKILL_DIR}/scripts/check-reuse.mjs \
     --reuse "<comma-separated reuse paths>" \
     --files "<comma-separated changed files>" \
     --root .
   ```

   - Exit 0 → every declared reuse was imported or used as a JSX tag / function call.
   - Exit 2 → one or more reuses were declared but never used. Reject: pass the script's report as the revise prompt ("You declared `reuse: [X]` but never imported or rendered X. Either import it, drop the entry, or replace with `new_primitive:`.")
   - Exit 3 → internal error. Escalate to user.

4. **Component Catalog duplicate-similarity check.** For each declared `new_primitive` in the task:

   **4a. Compute mechanical similarity.** Load `docs/plans/{spec}/{phase}/component-catalog.md` (spec mode) or `docs/plans/adhoc/{name}/component-catalog.md` (ad-hoc), filter to `active` entries in the SAME surface, drop entries with `status: do-not-merge`. For each remaining catalog entry, compute similarity:

   ```bash
   node -e "import('${CLAUDE_SKILL_DIR}/scripts/similarity.mjs').then(m => \
     console.log(JSON.stringify({ \
       score: m.similarity({name: '<new.name>', purpose: '<new.reason>'}, \
                           {name: '<entry.name>', purpose: '<entry.purpose>'}), \
       band: m.classify(...) \
     })))"
   ```

   (In practice, iterate in-process rather than spawning Node per pair — similarity is pure, no side effects.)

   **4b. Apply decision bands** based on the top-scoring match:

   - **Top score ≥ 0.80** (auto-flag band): reject task close immediately. Present top 3 matches to user:

     ```
     Catalog flagged possible duplicate for new primitive `{new.name}` (surface: {surface}).
     Top matches:
       1. {entry1.name} at {entry1.path}  (similarity: {s1})
       2. {entry2.name} at {entry2.path}  (similarity: {s2})
       3. {entry3.name} at {entry3.path}  (similarity: {s3})
     Options:
       [A] Replace new_primitive with reuse: [{entry1.path}]
       [B] Rename + differentiate with a sharper reason (executor retries)
       [C] Mark {entry1.path} `do-not-merge` in catalog and keep new primitive
     ```

   - **Top score ≤ 0.35** (auto-pass band): no LLM call, task proceeds.

   - **0.35 < top score < 0.80** (gray zone): single LLM tiebreaker call with the top match:

     ```
     Prompt: "Is component `{new.name}` (purpose: {new.reason}) fundamentally the same primitive as `{top.name}` (purpose: {top.purpose})?
              Reply with exactly one of: yes | no | borderline.
              Answer yes only if reusing {top.name} would cover ≥70% of {new.name}'s use case."
     ```

     - `yes` → reject as in auto-flag (use A/B/C prompt above, single top match)
     - `no` → pass
     - `borderline` → surface the same A/B/C prompt to the user

   Catalog entries with `status: do-not-merge` are excluded from scoring at step 4a — used for legitimately-distinct components with unavoidably similar names (e.g., `PricingCard` vs `PricingPlanCard`).

Skip this entire Stage 2a block for tasks where `ui: false`.

**If Stage 2a fails on a UI task 3 times in a row**, escalate to the Bail-Out Heuristic (treat as three consecutive review failures).

**If review passes:**
1. Update the task's `status:` to `done` in the plan file's YAML frontmatter
2. Add a one-line entry to `docs/plans/{spec}/{phase}/session-log.md` (create with `# Session Log\n` header if absent)
3. Proceed to next task

Before dispatching each subagent, also update that task's `status:` from `pending` to `in_progress` so concurrent or resumed sessions see the current state.

**If review fails:**
1. Fix the issue directly (for small fixes) or dispatch another subagent with the specific fix
2. Re-verify
3. Only then mark complete

### Bail-Out Heuristic

Track consecutive review failures across tasks — a failure is any task where Stage 0, 1, or 2 required remediation before the `status:` flipped to `done`. Retry-within-task counts as one failure for the current task.

After **3 consecutive task failures** (three tasks in a row that each required at least one round of fix-and-retry), halt. The plan is likely wrong for the current codebase, and per-task retry is papering over a structural issue.

Report to the user:

```
3 consecutive review failures. The plan may be wrong for the current codebase.

Failed tasks:
  ✗ Task {a}: {title} — {brief reason}
  ✗ Task {b}: {title} — {brief reason}
  ✗ Task {c}: {title} — {brief reason}

Options:
  1. /rivet run {spec} {phase} revise task {c} "reason"   — rewrite the failing task
  2. /rivet plan {spec} {phase} --refresh                  — regenerate with current context
  3. Continue anyway                                 — I'll keep retrying per-task
```

Wait for the user's choice before advancing.

Reset the counter to zero on any successful task (no fix needed). A single isolated failure doesn't trip the bail-out; only a pattern does.

### Checkpointing

Read `checkpointEvery` from `rivet.config.json` at the project root (if the file exists). Default to **3** if the key is absent or the file doesn't exist.

After every **`checkpointEvery` completed tasks**, run the **full test suite** before pausing. This catches regressions — task 8 might break something from task 2 that the per-task test didn't cover.

```bash
# Run the project's full test suite — exact command comes from CLAUDE.md.
# Examples across stacks: npm test, pytest, go test ./..., bundle exec rspec, php artisan test, cargo test.
<project test command>
```

If the full suite fails, identify which earlier task's test broke, fix it, and commit the fix before reporting the checkpoint.

Once the full suite passes, **tag the tree** so rollback has a known-good anchor:

```bash
# Spec mode:
git tag rivet/{spec}/{phase}/ckpt-{n}
# Ad-hoc mode:
git tag rivet/adhoc/{name}/ckpt-{n}
```

For spec runs the tag prefix is `rivet/{spec}/{phase}/` (e.g. `rivet/main/phase-0/ckpt-1`); for ad-hoc it is `rivet/adhoc/{name}/`. `{n}` is the checkpoint ordinal within this sub-plan. Tags are the rollback targets — without them, recovery from a bad late task means hunting through `git log`.

Then pause and report to the user:

```
Checkpoint — {n} of {total} tasks complete in {sub-plan-name}
Full test suite: PASS ({x} tests) / FAIL ({details})

Completed since last checkpoint:
  ✓ Task {a}: {title}
  ✓ Task {b}: {title}
  ✓ Task {c}: {title}

Issues encountered: {any review failures, fixes applied, regressions caught}

Next {checkpointEvery} tasks:
  → Task {d}: {title}
  → Task {e}: {title}
  → ...

Continue? (y / pause / review)
```

- **y** or **continue**: proceed with next batch
- **pause**: stop here, save progress, session can resume later
- **review**: run `/rivet review` on changes so far before continuing

**Token optimization:** After the user continues past a checkpoint, prior subagent reports are no longer needed in detail — only the session log entries matter. If context is getting long, summarize prior task reports to their one-line session log entries before dispatching the next subagent.

If ending your session after this checkpoint, run `/rivet learnings` first.

### Sub-Plan Design Verification (conditional, requires impeccable)

After all tasks complete and the full test suite passes — but BEFORE offering the Sub-Plan Transitions menu — apply the design verification pass.

Skip this entire block if any of:
- `/rivet run` was invoked with `--skip-verify`, OR
- the sub-plan contained zero `ui: true` tasks, OR
- `PRODUCT.md` or `DESIGN.md` is missing at the project root, OR
- the [impeccable](https://github.com/pbakaus/impeccable) skill is not installed at `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/`.

On skip, emit a one-line note (e.g. `Design verification skipped: <reason>.`) and proceed to Sub-Plan Transitions.

Otherwise read `${CLAUDE_SKILL_DIR}/design.md` (if not already loaded this session) and apply its `## Run — Sub-Plan Design Verification` section, which contains the per-surface grouping, parallel audit/critique/harden subagent dispatch, the polish + optimize gates, the user-facing report format, and the "Accept P0/P1 → append as origin: audit tasks" frontmatter handling.

### Sub-Plan Transitions

After verification completes (or was skipped), run the **full test suite** one final time to confirm everything passes together.

If the full suite fails at this point, do NOT move to the next sub-plan. Fix the regression first.

**Determine whether there is a next sub-plan.** List `*.md` non-recursively in the current plan directory, sort by filename, and check if any file after the current one has `status: pending` or `status: in_progress` tasks. For spec phase runs, exclude the `reviews/` subdirectory (as Step 3 already does).

#### If a next sub-plan exists

```
Sub-plan complete: {sub-plan-name} ✓

{n} tasks completed, {m} commits made.
Full test suite: PASS ({x} tests)
{design verification summary line if verification ran}

Options:
  1. Continue to next sub-plan: {next-sub-plan-name} ({p} tasks, ~{h} hrs)
  2. Squash commits before continuing (one commit per sub-plan, cleaner history for review)
  3. Pause
  4. Review (run /rivet review on this sub-plan's changes)
```

If the user picks squash, walk them through a non-interactive `git reset --soft` to the sub-plan's starting commit + single `git commit`, keeping the sub-plan's work as one logical unit. Do not force — users who prefer granular commits may skip. Offer, don't impose.

If ending your session here, run `/rivet learnings` first.

#### If this is the last sub-plan of a spec phase

Go to **Phase Completion** below.

#### If this is the last sub-plan of a review fix-plan

Go to **Review Fix-Plan Completion** below.

(Ad-hoc plans skip Sub-Plan Transitions on completion — go directly to Ad-Hoc Plan Completion.)

---

### Phase Completion

Triggered when the last sub-plan of a normal spec phase finishes.

```
Phase complete: {spec} / {phase} ✓

{total-n} tasks completed across {total-sub-plans} sub-plans.
Branch: {current-branch}

Tip: /rivet review before merging catches issues a human reviewer would flag.
     If you haven't reviewed yet, consider doing that first.

Options:
  1. Run /rivet review first (then the review fix-plan run will offer the merge)
  2. Merge to main now
  3. Push branch only (no merge yet)
  4. Do nothing
```

**If already on main** (user declined branch at pre-flight): skip options 2–3 — there is nothing to merge. Report completion only.

**If main has diverged** since this branch was created, warn before merging: "Note: main has received commits since this branch was created. The merge may require conflict resolution." (Check with `git log HEAD..main --oneline`.)

**Option 2 — Merge to main now:**

```
Merge style?
  A. Regular merge  — preserves all task commits on main
  B. Squash merge   — one commit on main, branch history stays intact
```

On A:
```bash
git checkout main
git merge {current-branch}
```

On B:
```bash
git checkout main
git merge --squash {current-branch}
git commit  # default message: "feat({phase}): {spec}/{phase}"
```

After merge: `Merged {current-branch} → main ✓. Now on main. Next: git push origin main to push, or start the next phase with /rivet run.`

**Option 3 — Push branch only:**
```bash
git push origin {current-branch}
```
Report: `Pushed {current-branch} to origin. No merge performed.`

**Option 4:** No git ops. Report: `Branch {current-branch} is intact whenever you're ready.`

If ending your session here, run `/rivet learnings` first.

---

### Review Fix-Plan Completion

Triggered when the last sub-plan of a review fix-plan finishes (`/rivet run {spec} {phase} review {slug}`).

Review already happened before this fix-plan was created. This is the right merge point — no nudge to review again.

```
Review fixes applied: {spec} / {phase} / reviews / {slug} ✓

{total-n} tasks completed across {total-sub-plans} sub-plans.
Branch: {current-branch}

Options:
  1. Merge to main now
  2. Squash-merge to main (one clean commit)
  3. Push branch only (no merge yet)
  4. Do nothing
```

**If already on main:** skip options 1–3. Report completion only.

**If main has diverged:** same divergence warning as Phase Completion above.

**Option 1 — Regular merge:**
```bash
git checkout main
git merge {current-branch}
```

**Option 2 — Squash merge:**
```bash
git checkout main
git merge --squash {current-branch}
git commit  # default message: "fix({phase}): review/{slug}"
```

**Option 3 — Push only:**
```bash
git push origin {current-branch}
```

**Option 4:** No git ops.

After any merge: `Merged {current-branch} → main ✓. Now on main. Next: git push origin main to push, or start the next phase with /rivet run.`

If ending your session here, run `/rivet learnings` first.

### Session Resumption

When `/rivet run` is invoked and there's an in-progress plan:
- Detect incomplete tasks automatically
- Show what was already completed
- Resume from the next incomplete task
- No need to re-execute completed tasks

## Rollback

Invoked as `/rivet run {spec} {phase} rollback` (or `/rivet run {spec} {phase} rollback {tag}` to target a specific checkpoint). For ad-hoc: `/rivet run adhoc/{name} rollback`. For a review-driven fix-plan: `/rivet run {spec} {phase} review {slug} rollback` — scoped to that fix-plan's checkpoints only.

This is a destructive operation. Always confirm with the user before running `git reset --hard`.

1. List available checkpoints. Pick the pattern that matches the run target:
   - Spec phase: `git tag --list 'rivet/{spec}/{phase}/ckpt-*' --sort=-creatordate`
   - Spec phase review fix-plan: `git tag --list 'rivet/{spec}/{phase}/reviews/{slug}/ckpt-*' --sort=-creatordate`
   - Ad-hoc: `git tag --list 'rivet/adhoc/{name}/ckpt-*' --sort=-creatordate`

   Use the literal `ckpt-*` suffix (not `*`) so a phase rollback doesn't accidentally surface review-fix checkpoints nested under it. Show the most recent 5 with commit date + commit subject for context.

2. Determine target:
   - If user passed a specific tag → use it.
   - Otherwise → default to the most recent checkpoint tag for this phase.

3. Show the user what will be lost:
   ```bash
   git log --oneline {target}..HEAD
   ```
   Ask for explicit confirmation: "This will reset X commits. Proceed? (y/n)"

4. On confirmation:
   ```bash
   git reset --hard {target}
   ```

5. Update the plan file's YAML frontmatter: for any task whose most recent commit (matching the task id in the commit subject) is newer than `{target}`, set `status:` back to `pending`. Leave tasks that were completed before the checkpoint alone.

6. Report:
   ```
   Rolled back to {target}.
   {n} tasks reverted to pending. {m} tasks still done.
   Next: /rivet run {spec} {phase} to resume from Task {next-incomplete}.
   ```

If no checkpoint tags exist yet (no checkpoints have been reached), tell the user: "No checkpoints for {spec} {phase}. Rollback target would be the pre-build commit — run `git log --oneline` to find it manually if that's what you want."

## Learnings Scratch File

During execution, maintain the session's learnings-scratch file — an append-only, one-line-per-entry log that `/rivet learnings` reads at end-of-session:

- spec mode: `docs/plans/{spec}/{phase}/learnings-scratch.md`
- Ad-hoc: `docs/plans/adhoc/{name}/learnings-scratch.md` (create the containing dir if the ad-hoc plan is a single file).

Create the file on first append (no blank scaffold). Append a line **immediately** when any of these happen:

- **User correction.** The user pushes back on the coordinator's approach, tells you to stop doing something, or redirects you. Write `[correction] {one-line what they said and why}`.
- **Subagent discovery.** A subagent reports a surprise: API returned differently, env var was missing, a library behaved unexpectedly, a test mode quirk. Write `[discovery] {what was found}`.
- **Coordinator judgment call.** You decided between two non-obvious approaches during review (e.g., kept a seemingly-duplicate helper because its context differs, chose a specific commit granularity, deviated from the plan for a good reason). Write `[decision] {what you chose and why}`.

Keep entries brief — this is a source, not a summary. The end-of-session `/rivet learnings` skill applies the high bar and decides which entries are worth codifying into CLAUDE.md / README.md.

Do **not** write entries for routine things (task completed, tests passed). The scratch file is for signals that would otherwise decay from context by end-of-session.

## Error Recovery

If a subagent fails catastrophically (test suite broken, build won't compile):

1. Do NOT proceed to the next task
2. Assess: is this a task-level issue or did it break something from a prior task?
3. If task-level: fix and retry
4. If prior task regression: run `git log --oneline -10` to find the last good commit, report to user with the specific failure, and recommend a course of action
5. Never silently skip a failing task

## Ad-Hoc Plan Completion

When all tasks in an ad-hoc plan are complete (plan path contains `adhoc/`), perform one additional step before the final report:

**Check spec overlap across every spec.** If `docs/specs/` contains any `.md` files, skim each one for phases that touch the same area of the codebase or feature domain. Flag every overlapping spec by name — don't collapse to just one. If any overlaps are found:

```
Ad-hoc plan complete: {name} ✓

Note: This work touches {area}, which is also planned in:
  - {spec-a}.md, Phase {n} ({phase title})
  - {spec-b}.md, Phase {m} ({phase title})

Consider adding a decision log entry to each affected spec so those phases account for what was built here.

Suggested entries:
  For {spec-a}.md, Phase {n}:
    "Ad-hoc: {brief description}. Phase {n} should {how to adapt}."
  For {spec-b}.md, Phase {m}:
    "Ad-hoc: {brief description}. Phase {m} should {how to adapt}."

Want me to append these to the decision logs? (y / all / n / choose)
```

`y` / `all` appends to every overlapping spec. `choose` asks per-spec. For each confirmed spec, append the entry to its `## Decision Log` section (create the heading at the end of the file if missing).

If no overlaps: skip this step, just report completion normally.

After the overlap check and any decision-log appends complete (or were skipped), offer to merge:

```
Ready to merge rivet/adhoc/{name} to main?

Branch: rivet/adhoc/{name}

Options:
  1. Merge to main now
  2. Squash-merge to main (one clean commit)
  3. Push branch only (no merge yet)
  4. Do nothing
```

**If already on main:** skip options 1–3. Report completion only.

**If main has diverged:** warn before merging: "Note: main has received commits since this branch was created. The merge may require conflict resolution." (Check with `git log HEAD..main --oneline`.)

**Option 1:**
```bash
git checkout main
git merge rivet/adhoc/{name}
```

**Option 2:**
```bash
git checkout main
git merge --squash rivet/adhoc/{name}
git commit  # default message: "feat(adhoc): {name}"
```

**Option 3:** `git push origin rivet/adhoc/{name}`

**Option 4:** No git ops.

After any merge: `Merged rivet/adhoc/{name} → main ✓. Now on main. Next: git push origin main to push.`

If ending your session here, run `/rivet learnings` first.
