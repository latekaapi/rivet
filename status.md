# /rivet status — Progress Dashboard

## Step 1: Scan Plan Files

Check if `docs/plans/` exists. If not: "No plans found. Run `/rivet plan {spec} {phase}` (or `/rivet plan {phase}` if you have a single `spec.md` at the project root) to get started."

The directory layout is `docs/plans/{spec}/{phase}/...` for spec plans and `docs/plans/adhoc/...` for ad-hoc plans. (For a project using the root `spec.md` single-spec fallback, `{spec}` is the literal string `spec`, so plans live at `docs/plans/spec/{phase}/...` — no special-case scan logic needed.) Review-driven fix-plans (from [plan.md](plan.md) Review-Source Mode) live nested under their parent phase at `docs/plans/{spec}/{phase}/reviews/{slug}/`, or at `docs/plans/adhoc/review-{slug}/` when no spec lineage was detected. Scan like this:

1. List top-level dirs with `ls -d docs/plans/*/`. Every entry except `adhoc/` is a spec name.
2. For each spec dir, list phase subdirs: `ls -d docs/plans/{spec}/*/`.
3. For each phase dir, additionally check for `docs/plans/{spec}/{phase}/reviews/*/` — each entry is a review-driven fix-plan (slug = directory name). Treat each as a separate progress group nested under its parent phase. Sub-plan files for the fix-plan are at `docs/plans/{spec}/{phase}/reviews/{slug}/*.md`; do NOT recurse below that.
4. Separately, scan `docs/plans/adhoc/` for ad-hoc plans (single files and named subdirs). Subdirs starting with `review-` (e.g. `docs/plans/adhoc/review-pr-42-...`) are ad-hoc-located review fix-plans; surface them under the Ad-hoc section with a `(review)` label so they're distinguishable from regular ad-hoc work.

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

## Step 3: Build the Commit Index

Before computing per-sub-plan stats, run a **single** `git log` call to build a lookup map of all task commits. This replaces what would otherwise be one `git log --grep` per done task — on a project with 100 done tasks that's a 100× reduction in git process spawns.

```bash
git log --all --pretty=format:'%H|%at|%s' --since='180 days ago'
```

Parse each line. For commits whose subject matches the task-commit pattern (`... (task N)` per plan.md Step 5), extract the task id and store `{task_id → {sha, timestamp, subject}}`. Pair the task id with its sub-plan when needed (the commit subject conventionally includes the sub-plan slug — disambiguate task-id collisions across sub-plans by matching subject substring).

The `--since='180 days ago'` window keeps the call cheap on long-lived repos. If any in-scope plan file has an mtime older than 180 days AND contains tasks with `status: done`, re-run without `--since` to get full history. (Plan-file mtime is an upper bound for when its tasks could have been completed.)

All subsequent steps (actual-hours computation, stale-progress commit verification) read from this in-memory map — no further git calls per task.

## Step 4: Compute Actual Hours Spent

For each sub-plan, look up each `status: done` task in the commit index from Step 3. Take the matching commit's timestamp.

Actual hours for a sub-plan = (max timestamp - min timestamp) in hours, across the sub-plan's done tasks. If all commits happened within an hour, report `<1 hr`. This is wall-clock, not true effort — but over many sub-plans it's a useful self-calibration signal vs `estimated_hours` in the frontmatter.

Skip if fewer than 2 done tasks have matching entries in the commit index (not enough data).

## Step 5: Display Progress

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

  Phase 2 — Webhook Hardening
    01-signing.md               ████████████████████   ✓ 12/12 tasks  est 6h, actual 7h
    reviews/pr-42-fix-webhook-signing
      01-p0.md                  ████████████████████   ✓ 2/2 tasks   est 1h, actual 1h
      02-p1.md                  ████████░░░░░░░░░░░░   2/4 tasks    est 1.5h, actual 1h
      03-p2.md                  ░░░░░░░░░░░░░░░░░░░░   0/3 tasks    est 1h
      04-p3.md                  ░░░░░░░░░░░░░░░░░░░░   0/1 tasks    est 0.25h
      Fix-plan total: 4/10 tasks
    Phase total: 16/22 tasks (incl. review fix-plan)

  Phase 1 — Foundation
    (not planned yet — run /rivet plan main phase-1)

admin
  Phase 0 — Dashboard Setup
    01-admin-scaffold.md        ████████████░░░░░░░░   9/16 tasks   est 6h, actual 4h
    Phase total: 9/16 tasks

Ad-hoc
  webhook-signing-verification.md      ████████████████████   ✓ 6/6 tasks  est 2h, actual 3h
  review-full-2026-04-27/      (review)  ████░░░░░░░░░░░░░░░░   2/8 tasks   est 2h, actual 1h

──────────
Overall: 51/91 tasks complete across 2 specs + 2 ad-hoc

Next action: /rivet run main phase-0
  → Resuming 02-prompt-pipeline.md at Task 9
```

If a specific spec was requested (`/rivet status {spec}`), show only that spec's phases plus the ad-hoc section; drop the `Overall` spec-count line and show task-level detail (remaining task names, recent session-log entries). If `{spec} {phase}` was passed, drill into that single phase with the most detail.

## Step 6: Detect Stale Progress

If a plan file has incomplete tasks and the session log's last entry is older than 7 days:
- Flag it: "⚠ {sub-plan} has been idle for {n} days — last activity on {date}"

If a plan file has tasks marked `status: done` but the task id has no entry in the commit index built in Step 3:
- Flag it: "⚠ {sub-plan} shows task {N} as done but no matching commit found — progress may be inaccurate"

If a task is stuck in `status: in_progress` with no commit and no recent activity (>24 hours):
- Flag it: "⚠ {sub-plan} task {N} has been in_progress for {n} hours — a prior run likely crashed; resume or revert"
