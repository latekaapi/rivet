# /rivet status — Progress Dashboard

## Step 1: Scan Plan Files

Check if `docs/plans/` exists. If not: "No plans found. Run `/rivet plan {spec} {phase}` (or `/rivet plan {phase}` if you have a single `spec.md` at the project root) to get started."

The directory layout is `docs/plans/{spec}/{phase}/...` for spec plans and `docs/plans/adhoc/...` for ad-hoc plans. (For a project using the root `spec.md` single-spec fallback, `{spec}` is the literal string `spec`, so plans live at `docs/plans/spec/{phase}/...` — no special-case scan logic needed.) Scan like this:

1. List top-level dirs with `ls -d docs/plans/*/`. Every entry except `adhoc/` is a spec name.
2. For each spec dir, list phase subdirs: `ls -d docs/plans/{spec}/*/`.
3. Separately, scan `docs/plans/adhoc/` for ad-hoc plans (single files and named subdirs).

If an argument was passed, narrow the scan:
- `/rivet status {spec}` → only scan `docs/plans/{spec}/` (plus ad-hoc, for context).
- `/rivet status {spec} {phase}` → only scan `docs/plans/{spec}/{phase}/` with task-level detail.

**Single-spec shorthand:** if the project has only one spec (discovered the same way as `plan.md` Step 1 — `docs/specs/*.md`, falling back to root `spec.md`), the user may pass just `{phase}` (e.g. `/rivet status phase-0`) and it resolves against the lone spec.

## Step 2: Parse Each Plan

For each sub-plan file in each phase directory, read the YAML frontmatter:

- Total tasks = `len(tasks)` from frontmatter
- Completed tasks = count of entries where `status: done`
- In-progress tasks = count of `status: in_progress`
- Remaining tasks = count of `status: pending`
- Hours remaining = sum of `estimated_min` for non-done tasks / 60

If a plan file has no frontmatter, fall back to counting `### Task` headers and noting "plan needs frontmatter — regenerate with `/rivet plan {spec} {phase} --refresh`."

## Step 3: Compute Actual Hours Spent

For each sub-plan, compute actual hours from git commit timestamps. For each task with `status: done`:

1. Find the commit whose subject matches the task id (task commits follow the pattern `... (task N)` per plan.md's Step 5 template).
2. Record its author date.

Actual hours for a sub-plan = (max commit date - min commit date) in hours, for the commits within this sub-plan. If all commits happened within an hour, report `<1 hr`. This is wall-clock, not true effort — but over many sub-plans it's a useful self-calibration signal vs `estimated_hours` in the frontmatter.

Skip if fewer than 2 task commits exist in the sub-plan (not enough data).

## Step 4: Display Progress

Group output by spec, then by phase within each spec. Always show the `Ad-hoc` section last, even when empty-ish.

```
Rivet Progress
══════════════

main
  Phase 0 — Manual Validation
    01-site-intelligence.md     ████████████████████░  18/22 tasks  est 8h, actual 5h
    02-prompt-pipeline.md       ████████░░░░░░░░░░░░   8/20 tasks   est 8h, actual 3h
    03-audit-packaging.md       ░░░░░░░░░░░░░░░░░░░░   0/15 tasks   est 6h
    Phase total: 26/57 tasks

  Phase 1 — Foundation
    (not planned yet — run /rivet plan main phase-1)

admin
  Phase 0 — Dashboard Setup
    01-admin-scaffold.md        ████████████░░░░░░░░   9/16 tasks   est 6h, actual 4h
    Phase total: 9/16 tasks

Ad-hoc
  webhook-signing-verification.md  ████████████████████   ✓ 6/6 tasks  est 2h, actual 3h

──────────
Overall: 41/73 tasks complete across 2 specs + 1 ad-hoc

Next action: /rivet run main phase-0
  → Resuming 02-prompt-pipeline.md at Task 9
```

If a specific spec was requested (`/rivet status {spec}`), show only that spec's phases plus the ad-hoc section; drop the `Overall` spec-count line and show task-level detail (remaining task names, recent session-log entries). If `{spec} {phase}` was passed, drill into that single phase with the most detail.

## Step 5: Detect Stale Progress

If a plan file has incomplete tasks and the session log's last entry is older than 7 days:
- Flag it: "⚠ {sub-plan} has been idle for {n} days — last activity on {date}"

If a plan file has tasks marked `status: done` but no corresponding commit matching the task id exists in git:
- Flag it: "⚠ {sub-plan} shows task {N} as done but no matching commit found — progress may be inaccurate"

If a task is stuck in `status: in_progress` with no commit and no recent activity (>24 hours):
- Flag it: "⚠ {sub-plan} task {N} has been in_progress for {n} hours — a prior run likely crashed; resume or revert"
