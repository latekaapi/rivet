# /rivet redesign — Design Re-apply Pass

Brings already-built components into compliance with an updated DESIGN.md. Runs the visual layer only — no TDD cycle, no logic changes. Detects stale surfaces by comparing stored `design_hashes[surface].ref_sha` against the current DESIGN.md SHA, then dispatches targeted subagents to re-apply `ui_commands` to each affected component file.

## Step 0: Gate Check

Before scanning anything:

1. **DESIGN.md present?** Check for `DESIGN.md` (or any `DESIGN-{surface}.md`) at the project root. If absent: stop.
   ```
   DESIGN.md not found. /rivet redesign requires the design system to be present.
   Run impeccable's document/teach command or Google Stitch to generate DESIGN.md first.
   ```

2. **impeccable installed?** Check `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/SKILL.md`. If absent: stop.
   ```
   impeccable not found. Install from https://github.com/pbakaus/impeccable
   or set $IMPECCABLE_DIR to its install path.
   ```

3. **Working tree clean?** Run `git status --porcelain`. If output is non-empty: offer (1) commit the outstanding work, (2) stash it, (3) abort. Do not proceed with a dirty tree — redesign commits must be isolated from unrelated work.

## Step 1: Scan for Stale Surfaces

Parse the invocation arguments to determine scope:

- **No args**: scan all sub-plan files under `docs/plans/`.
- **`{spec} {phase}`**: scan `docs/plans/{spec}/{phase}/` only.
- **Single-spec shorthand**: same inference rule as plan.md / run.md — if exactly one spec exists in `docs/specs/` (or a bare `spec.md` at root), the spec name may be omitted.

For each `*.md` file in scope, read YAML frontmatter. Skip files where `design_hashes` is absent — they have no design enrichment and nothing to check.

```
For each surface in plan.design_hashes:
  design_ref  = plan.design_hashes[surface].design_ref
  stored_sha  = plan.design_hashes[surface].ref_sha

  current_sha = sha256(design_ref)

  if current_sha != stored_sha:
    collect stale_entry: {
      sub_plan_file,
      surface,
      design_ref,
      stored_sha,
      current_sha,
      ui_tasks: [tasks where ui: true AND surface matches this surface]
    }
```

Only `ref_sha` (DESIGN.md) staleness triggers redesign. If only `canonical_sha` is stale — the user hand-edited the canonical brief without touching DESIGN.md — that is not a redesign trigger; point the user to `/rivet plan {spec} {phase} --refresh` instead.

**Deduplicate by surface.** If the same `design_ref` appears stale across multiple sub-plans, report it once at surface level in Step 2. The per-sub-plan breakdown goes into the detail lines.

## Step 2: Report and Confirm

Display a summary. If `--dry-run` was passed, show the summary and exit without touching any files.

```
Design refresh scan — {scope description}

Stale surfaces:
  {surface} ({design_ref})
    DESIGN.md changed: {stored_sha[0:8]}… → {current_sha[0:8]}…
    Sub-plans affected: {count}
    UI tasks to re-apply: {task_count} ({file_count} component files)
      {sub_plan_file}: {n} tasks — {PricingCard.tsx, Hero.tsx, ...}
      ...

  {surface-2} ...

{total_file_count} component files need redesign. Proceed? (y/n)
```

If no stale surfaces are found:
```
All surfaces are current — no DESIGN.md drift detected.
(If you've edited the canonical brief directly, run /rivet plan {spec} {phase} --refresh instead.)
```

If `--dry-run` was passed, append `(dry-run — no changes made)` and exit cleanly.

## Step 3: Refresh Stale Briefs

For each stale surface (once per surface, not per sub-plan or per task):

```
1. Compute current_brief_sha = sha256(docs/design/brief-{surface}.md)
   stored_brief_sha = first affected sub-plan's design_hashes[surface].canonical_sha

2. If current_brief_sha != stored_brief_sha:
     warn: "Canonical brief for surface '{surface}' has also been modified since it was
            generated. Regenerating from DESIGN.md will overwrite those hand-edits.
            Proceed? (y/n)"
     On n → skip this surface entirely (user will handle brief manually).

3. Regenerate docs/design/brief-{surface}.md using the same content protocol as
   design.md §6.2:
     - Read design_ref (DESIGN.md or DESIGN-{surface}.md)
     - Read PRODUCT.md
     - Read impeccable shared laws: ${IMPECCABLE_DIR}/SKILL.md
     - Read register reference: ${IMPECCABLE_DIR}/reference/{brand|product}.md
       (based on surface's register field from PRODUCT.md ## Surfaces)

   Brief content:
     - Surface name + route globs from PRODUCT.md
     - Register with rationale
     - Voice overlay
     - Tokens from design_ref verbatim (color, spacing, typography, radii, shadows)
     - Motion system (durations, easing, reduced-motion policy)
     - Voice + anti-references from PRODUCT.md
     - Absolute bans (impeccable shared laws) + register bans + surface bans
     - Global state conventions (empty / loading / error)
     - Component-primitive directory convention

   Write updated file to docs/design/brief-{surface}.md.
   new_canonical_sha = sha256(docs/design/brief-{surface}.md)
   Store in memory for Step 6's frontmatter update.
```

## Step 4: Dispatch Subagents per Task

For each stale sub-plan, iterate its stale UI tasks. Apply the same parallel dispatch rules as `run.md` Step 4:

- Up to 3 tasks in parallel.
- No overlap in `files:` lists across parallel tasks (check before dispatching).
- Tasks with overlapping files run serially in task-id order.
- Subagents stage (`git add`) but do **not** commit — coordinator commits sequentially.

For each task, verify every path in `task.files` exists on disk. If any are missing:

```
Task {id} in {sub_plan_file}: file {path} not found.
Options:
  [A] Skip this task (mark redesign_failed — stale hashes remain)
  [B] Provide the new path (re-apply design to the new location)
  [C] Mark task obsolete (update status: obsolete in frontmatter, skip redesign)
```

Wait for the user's response before proceeding with this task.

**Subagent prompt template:**

```
## Your Task

These component files already exist with working, tested logic. Your job is to bring
their visual presentation into compliance with the updated design system.

## Constraints (STRICT)

Do NOT change:
  - Component props, interfaces, or TypeScript types
  - Business logic, data fetching, state management, or event handlers
  - Test files (.test.* / .spec.*)
  - File names or export names
  - Any backend integration points

ONLY change:
  - CSS class names and style values
  - Inline style props used for visual presentation
  - Tailwind utility classes (if used)
  - Animation and transition properties
  - Layout and spacing (visual only — not structural changes that affect props)
  - Color, typography, shadow, and radius values using tokens from the design brief

If a proposed visual change requires adding or removing props, changing component API,
or modifying a test file — skip it and note it in your report. This is a visual pass only.

## Files to Update

{for each file in task.files:}
  ### {file path}
  {full current file contents}

## Commands to Apply

Apply ONLY the following commands (skip unlisted ones):
{task.ui_commands}

  typeset  : bring typography into compliance (font families, sizes, weights, line-height,
             tracking) using only tokens from the design brief
  layout   : fix spacing, alignment, grid structure using only spacing tokens
  colorize : replace all hardcoded hex / custom colors with DESIGN.md color tokens
  adapt    : ensure responsive breakpoints match the brief's responsive spec
  animate  : bring motion (duration, easing, transition) in line with the motion system
  clarify  : refine visible text copy (labels, buttons, errors, empty states) per voice + tone
  onboard  : review empty/first-run states
  distill  : simplify visually dense UI

## Design Brief — Surface: {surface}

{full contents of docs/design/brief-{surface}.md}

## DESIGN.md Token Reference

{full contents of task.design_ref file}

## Project Conventions

{relevant frontend excerpts from CLAUDE.md}

## Verification

Before reporting done:
1. Run git diff and confirm you only changed visual properties in the listed files.
2. Confirm no props, types, test files, or logic were altered.
3. git add {task.files joined by space}  ← stage, do NOT commit.

Report in under 10 lines:
  - Visual changes made (one sentence per file)
  - Tokens used from the brief
  - Changes you could NOT make without touching props or logic (manual follow-ups)
  - Staged files list
```

**After each subagent returns:**

Run Design Token Lint:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/design-lint.mjs \
  --design {design_ref} \
  --files {comma-separated task.files}
```

- Exit 0 → pass.
- Exit 2 → dispatch a fix subagent with the full violation report as the prompt. Cap retries at 2. After 2 failed retries: mark the task `redesign_failed` in frontmatter, skip its hash update, surface a warning to the user.

On pass, coordinate commits in task-id order:

```bash
git commit {task.files} \
  -m "design: apply {surface} redesign to {task.title} ({sub-plan-slug} task {id})"
```

## Step 5: Post-Pass Lint Sweep

After all tasks for a surface are committed, run one final lint sweep across all affected files for that surface:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/design-lint.mjs \
  --design {design_ref} \
  --files {all_affected_files_for_surface_csv}
```

Exit 0: surface clean.
Exit 2: surface residual violations to the user — do not auto-fix. These are cross-task contaminations or files the subagents couldn't fully remediate. The user decides whether to run `/rivet redesign --tasks {n,m}` to retry specific tasks or fix manually.

## Step 6: Update Frontmatter Hashes

For each sub-plan where all tasks passed (none in `redesign_failed` state):

```yaml
design_hashes[surface].ref_sha       = current_sha        # new sha256 of DESIGN.md
design_hashes[surface].canonical_sha = new_canonical_sha  # sha256 of regenerated brief
```

Do not update sub-plans that have any `redesign_failed` task — stale hashes correctly communicate that drift is unresolved.

Commit all frontmatter updates per phase in one commit:

```bash
git add docs/plans/{spec}/{phase}/*.md
git commit -m "design: update design_hashes after {surface} redesign — {spec}/{phase}"
```

If multiple surfaces were redesigned, combine them in the message:

```
design: update design_hashes after marketing+dashboard redesign — main/phase-0
```

## Step 7: Summary Report

```
Redesign complete

  Applied:  {n} tasks across {m} sub-plans
  Skipped:  {k} tasks (redesign_failed — lint did not clear after 2 retries)
  Lint:     {clean | N residual violations listed above}

  Updated design_hashes in:
    {sub-plan-file1}
    {sub-plan-file2}
    ...

  {k > 0 ? "Tasks needing manual attention:" : ""}
  {failed task list with file paths}

Next: /rivet run {spec} {phase} to continue building with the refreshed design.
```

---

## Edge Cases

**No UI tasks in a stale sub-plan.** A surface's `ref_sha` is stale but none of the sub-plan's tasks have `ui: true`. Update `ref_sha` and `canonical_sha` directly in frontmatter (no subagent dispatch needed), and output:

```
Surface '{surface}' in {sub-plan}: DESIGN.md changed but no UI tasks present.
Updated design_hashes.ref_sha only.
```

**File overlap across tasks in the same surface.** Two UI tasks share a file. Enforce serial dispatch — same rule as `run.md`. The later task's subagent reads the already-modified file, compounding the changes correctly.

**File overlap across surfaces.** If the same component file appears in a task for surface A and a task for surface B, surface the conflict before dispatching:

```
Conflict: {file} is assigned to both surface '{A}' and surface '{B}'.
  {A} task {id}: {title}
  {B} task {id}: {title}

Apply which surface's design to this file?
  [A] {A}  [B] {B}  [C] skip this file
```

**Multiple specs share the same DESIGN.md.** Both will appear as stale. Scan and report them together, confirm once, redesign both.

**Partial failure (some `redesign_failed`).** Leave stale hashes for failed sub-plans. The user can rerun `/rivet redesign` after fixing the failed components manually — the command will only pick up still-stale tasks.

**`--tasks {n,m,p}` specifying a non-UI task.** Warn and skip: "Task {id} has `ui: false` — redesign only applies to UI tasks."

**`--tasks` specifying a current task.** Warn: "Task {id}'s surface is not stale — DESIGN.md matches the stored hash. Use --dry-run to review current state."

---

## What This Command Does NOT Do

These exclusions are intentional — they keep the pass focused:

- **No test modifications.** Enforced in the subagent prompt. If a lint fix requires changing a test, the task gets `redesign_failed`; the user resolves it.
- **No Component Catalog duplicate-similarity check.** This is a re-apply pass on existing components, not new primitive creation.
- **No Sub-Plan Design Verification** (audit/critique/harden). That pass is for newly-built components at sub-plan completion.
- **No checkpoint tags.** Redesign does not run the full test suite; a checkpoint tag would falsely imply test coverage.
- **No learnings-scratch entries.** Summary report covers any manual follow-up items.
- **No task Design Spec regeneration.** `### Design Spec` blocks in plan files are plan-time artifacts recording what was built; redesign does not rewrite them.
