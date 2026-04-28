# /rivet review — Senior Code Review

## Step 1: Determine Scope

Parse the arguments to determine what to review:

- **(no args):** Review files changed since the last review commit marker, or since the last `git tag` matching `review-*`, or fall back to `git diff main --name-only`. If none of these work, ask the user. Scope shape = `default`.
- **file paths:** Review only the specified files. Scope shape = `files`; capture the first file path for filename derivation.
- **`--full`:** Review the entire codebase (slow — warn the user). Scope shape = `full`.
- **branch name:** Review all changes on that branch vs main. Scope shape = `branch`; capture the branch name.
- **PR number (`pr 123`, `pr-123`, `#123`, or `--pr 123`):** Fetch metadata via `gh pr view <n> --json number,title,headRefName,baseRefName` and the diff via `gh pr diff <n>`. The diff is the review scope. Scope shape = `pr`; capture `{number, title, headRefName}` for use in Step 6 (filename) and Step 7 (offer-to-fix prompt). Stop with a clear error if `gh` isn't installed or the PR isn't accessible — don't silently degrade.

Capture the resolved scope shape (`pr | branch | files | full | default`) and any metadata the filename will need (PR number/title, branch name, first file path) — Step 6 reads these to derive the save path.

## Step 2: Load Project Context

Read these files to understand the project's conventions and architectural intent:
- `CLAUDE.md` — conventions, patterns, stack rules
- Every spec in the repo — domain vocabulary, architecture decisions, and what's coming in future phases. Discover them the same way `plan.md` Step 1 does: list `docs/specs/*.md`, and if that's empty fall back to `spec.md` at the project root. A repo can host multiple specs (e.g. `main.md`, `admin.md`, `agency.md`) or a single one; read them all so the review catches inconsistencies in domain language or cross-spec architectural drift.

These inform how to apply each review point. Without them, the review is generic. With them, it catches project-specific issues.

## Step 3: Gather the Code

- Run `git diff` (or appropriate variant) to get the actual changes
- For each changed file, read the full file (not just the diff) — context matters
- Identify files that import from or are imported by the changed files (immediate dependents)
- Read those dependent files too

## Step 4: Run the Review Points

Work through points 1–16 in order for every review. Run point 17 only when its trigger (frontend files in scope + design files present) fires. For each point, either report findings or explicitly state "No issues found." Do not skip points silently.

---

### 1. API Integration Resilience
*Does every external API call handle failure?*

Check: timeouts configured, retryable errors (429, 503) distinguished from permanent errors (401, 404), graceful degradation working (if one source fails, does the pipeline continue?), no expensive API calls inside loops, response shape validated before accessing nested keys.

### 2. Job & Queue Safety
*If applicable — skip if the project doesn't use queues.*

Check: every job is idempotent (running twice produces the same result), partial failure leaves data in a consistent state, transaction boundaries are correct, jobs dispatched to the right queue with appropriate retries, no infinite retry on permanent failures.

### 3. Data Integrity
*Is the data layer trustworthy?*

Check: JSONB/nested keys accessed safely (what if a key is missing?), database constraints match application assumptions, migrations safe to run on a database with existing data, enum/status values consistent everywhere they're read and written, no orphaned records possible.

### 4. Correctness & Edge Cases
*Does the logic hold at the boundaries?*

Check: null inputs, empty arrays, zero-length strings, malformed URLs, missing optional data, unexpected API response shapes, integer overflow, off-by-one errors, race conditions in concurrent operations. Focus on the domain-specific edges from the spec.

### 5. Architecture & Extractability
*Does the code fit the system's architecture?*

Check: service classes follow established patterns, dependency direction makes sense (higher-level depends on lower-level, not reverse), classes have single responsibilities, coupling to framework internals is minimal (using injectable interfaces vs framework facades where the spec requires portability), new code follows the same structural patterns as existing code.

### 6. Duplication, Dead Code & Structural Quality
*Is similar logic consolidated? Is anything now obsolete?*

Check: similar integrations share a common interface, repeated patterns extracted into shared concerns, methods under ~30 lines, nesting under 3 levels deep, no dead code (unused imports, unreachable branches, commented-out code). **Removal candidates:** are there classes, methods, or helpers made redundant by changes in this sub-plan or a prior one? Distinguish "safe to delete now" (no references, no side effects) from "defer with a plan" (still referenced but being replaced). Dead code is not just clutter — it misleads the next agent or developer into thinking it's load-bearing.

### 7. Test Quality
*Do tests verify behavior, not implementation?*

Check: tests survive refactoring of internals, API mocks match real response shapes, edge case tests exist for failure modes, job tests verify idempotency (run twice, assert same state), test names describe the behavior being verified.

### 8. Contracts Between Components
*Are handoff points explicit?*

Check: what does component A promise to return? What does component B assume it receives? Are these defined via DTOs, value objects, interfaces, or type hints — or is it implicit (passing raw arrays and hoping)? Every handoff point in a pipeline is a potential silent contract violation.

### 9. Future-Awareness Without Premature Abstraction
*Will today's code actively hurt tomorrow's requirements?*

Read every spec discovered in Step 2 (covers `docs/specs/*.md` and the root `spec.md` fallback) for what's planned in the next 1-2 phases of each. Check: are decisions being made now that will be painful to change? Is something hardcoded that needs to be configurable later? Is duplication being introduced that should be an interface? The goal is NOT to over-engineer — it's to avoid decisions that will cost 10x to fix later. Sometimes "extract later" is the right call. Flag the tradeoff explicitly, and name the specific spec + phase that informs the flag.

### 10. Domain Language Consistency
*Does the code speak the same language as the specs?*

Check: class names, method names, variable names, database columns, job names, config keys — do they match the relevant spec's vocabulary? With multiple specs, also check for cross-spec drift: if `main.md` says "enrichment" and `admin.md` says "signal processing" for the same concept, that's a spec-level inconsistency worth flagging back to the user, not just a code issue. Muddled names signal muddled thinking about responsibilities.

### 11. What's Not There
*What's missing that should exist?*

Check: logging in jobs that call external APIs, validation on user input before expensive operations, rate limiting on public endpoints, index on columns used in WHERE clauses, error messages that actually help debug the problem, configuration for values that are currently hardcoded but will need to change.

### 12. Implicit Coupling & Temporal Dependencies
*Do things that don't import each other still break together?*

Check: chained jobs that assume prior jobs wrote data in a specific shape, code that depends on execution order without enforcing it, shared database state that multiple processes read/write without coordination, config values that must stay in sync across files.

### 13. Error Semantics
*Can the caller distinguish between different failure modes?*

Check: when a method catches an error and returns... what? Can the caller tell the difference between "data source unavailable" and "data source returned nothing"? Between "partial result" and "complete result"? Is degradation visible (logged, flagged) or silent? Does the code distinguish between "expected absence" (optional data) and "unexpected failure"?

### 14. Observability
*When this breaks in production, can you figure out why?*

Check: structured logging with sufficient context (IDs, domain, step name), ability to trace a request through the full pipeline, no sensitive data in logs (API keys, tokens), enough detail to replay a failed operation, and monitoring for the failure modes that matter most.

### 15. Defensiveness at System Boundaries
*Is every external input validated before trust?*

Check: user input validated and normalized before entering the pipeline, API responses validated against expected shapes before extracting nested fields, webhook signatures verified, JSON parsed with error handling, URLs validated before HTTP requests, file paths sanitized.

### 16. Naming as Thinking
*Do the names reveal or obscure intent?*

Check: can you understand what a class does from its name alone? Are method names verbs that describe the action? Are variables named for what they contain, not what type they are? If a class is hard to name, is it doing too much? If a method is named generically (`handle`, `process`, `run`), does it need a more specific name?

### 17. Design System Compliance (conditional, requires impeccable)
*Skip this point entirely if no frontend files are in scope.*

**Trigger:** ALL of the following hold:
- the review scope contains at least one `.tsx`, `.jsx`, `.vue`, `.svelte`, `.astro`, or `.blade.php` view file (or any other HTML-templating view file)
- both `PRODUCT.md` and `DESIGN.md` exist at the project root
- the [impeccable](https://github.com/pbakaus/impeccable) skill is installed at `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/`

If any condition fails, emit a one-line note in the review report (`Point 17 skipped: <reason>.`) and complete the review with points 1–16 only. Note it in the "Passed Clean" section as `17. Design System Compliance — N/A ({reason})`. Do not hard-fail the review when design files are missing; treat it as non-applicable.

When the trigger fires, read `${CLAUDE_SKILL_DIR}/design.md` (if not already loaded this session) and apply its `## Review — Design System Compliance (Point 17)` section, which contains the mechanical token lint, the per-surface brief resolution chain (canonical / canonical+override / phase-override / derived), the parallel audit + critique subagent dispatch, and the merge rule that avoids duplicating findings already raised by points 1–16.

---

## Step 5: Generate Report

### Severity Levels

| Level | Name | Description | Gate |
|-------|------|-------------|------|
| **P0** | Critical | Security vulnerability, data loss risk, correctness bug | Blocks merge / blocks next sub-plan |
| **P1** | High | Logic error, contract violation, missing error handling on critical path | Fix before merge |
| **P2** | Medium | Code smell, coupling concern, missing test, removal candidate | Fix in this sub-plan or create a follow-up |
| **P3** | Low | Naming, minor refactoring opportunity, style | Optional improvement |

### Report Structure

```markdown
# Code Review — {date}

**Verdict: APPROVE / REQUEST CHANGES / COMMENT**

**Scope:** {what was reviewed — files, branch, etc.}
**Files reviewed:** {count}
**Dependent files checked:** {count}
**Findings:** P0: {n}  P1: {n}  P2: {n}  P3: {n}

---

## P0 — Critical (blocks proceeding)

{Each finding: review point number + name, file:line, what's wrong, concrete fix recommendation}

## P1 — High (fix before merge)

{Same format}

## P2 — Medium (fix or follow-up)

{Same format}

## P3 — Low (optional)

{Same format}

## Removal Candidates

{Dead code, obsolete helpers, redundant classes — with "safe to delete now" or "defer with plan" label}

## Passed Clean

{List the review points that found no issues — confirms they were checked, not skipped}
```

**Verdict rules:**
- Any P0 → REQUEST CHANGES
- P1 but no P0 → REQUEST CHANGES
- Only P2/P3 → COMMENT (proceed at your discretion)
- Nothing found → APPROVE

## Step 6: Save Report to `docs/reviews/`

Every `/rivet review` run persists its report to disk so reviews become durable artifacts (linkable, diffable, re-readable) instead of vanishing with the conversation. This step is unconditional — no opt-out flag in v1.

Reports are stratified by detected scope so multi-spec repos don't pile every review into a flat directory. Lineage detection mirrors the helper documented in [plan.md](plan.md) Review-Source Mode Step B (single source of truth — keep both implementations consistent).

1. **Resolve lineage from the reviewed branch.** Determine the relevant branch:
   - `pr` scope → `headRefName` from the `gh pr view` call in Step 1.
   - `branch` scope → the branch name argument.
   - `default` scope → current branch (`git rev-parse --abbrev-ref HEAD`).
   - `files` and `full` scope → no branch context; skip the helper.

   Then classify (same helper as plan.md):

   ```
   helper(branch_string) → {kind, ...}:
     if branch_string matches "rivet/{X}/{Y}" AND {X} in spec_names AND {Y} is a phase in spec {X}:
         return { kind: "spec", spec: X, phase_id: Y }
     elif branch_string matches "rivet/adhoc/{name}":
         return { kind: "adhoc", name: name }
     else:
         return { kind: "none" }
   ```

   Discover `spec_names` the same way [plan.md](plan.md) Step 1 does (`docs/specs/*.md`, falling back to root `spec.md`).

2. **Compute the directory** from the helper result + scope shape:

   | Helper / scope result | Directory |
   |---|---|
   | `kind: spec` | `docs/reviews/{spec}/{phase-id}/` |
   | `kind: adhoc` | `docs/reviews/adhoc/{name}/` |
   | `kind: none`, scope = `branch` | `docs/reviews/branch/` |
   | scope = `files` | `docs/reviews/files/` |
   | scope = `full` | `docs/reviews/full/` |
   | scope = `default`, helper = `none` | `docs/reviews/default/` |

   Create the directory with `mkdir -p <directory>` if missing.

3. **Derive the filename** from the scope shape captured in Step 1 (filename only — no `docs/reviews/` prefix; that comes from Step 6.2):

   | Scope | Filename pattern |
   |---|---|
   | `pr` | `pr-{number}-{kebab(title, ≤50 chars)}.md` |
   | `branch` | `branch-{kebab(branch)}-{YYYY-MM-DD}.md` |
   | `files` | `files-{YYYY-MM-DD}-{kebab(basename of first file, no extension)}.md` |
   | `full` | `full-{YYYY-MM-DD}.md` |
   | `default` (no args) | `changes-{YYYY-MM-DD}-{kebab(current branch)}.md` |

   Full path = `<directory from Step 6.2>/<filename from Step 6.3>`. Example: `docs/reviews/main/phase-2/pr-42-fix-webhook-signing.md` (lineage detected) or `docs/reviews/full/full-2026-04-27.md` (no lineage).

4. **Kebab rule.** Lowercase; replace runs of non-alphanumeric chars with `-`; trim leading/trailing `-`; collapse repeats. PR-title truncation cuts at the last word boundary that keeps total length ≤50 chars.

5. **Collision handling.** If the target path already exists, append `-2`, `-3`, … before `.md` until the path is free. **Never overwrite** — prior reviews are evidence and shouldn't disappear.

6. **Write the report.** Prepend a YAML frontmatter block to the markdown produced in Step 5:

   ```yaml
   ---
   scope: pr | branch | files | full | default
   pr_number: <n>            # only when scope = pr
   pr_title: "<title>"       # only when scope = pr
   branch: <name>            # when scope = pr | branch | default
   files: [path1, path2]     # only when scope = files
   date: YYYY-MM-DD
   verdict: APPROVE | REQUEST CHANGES | COMMENT
   findings: { p0: n, p1: n, p2: n, p3: n }
   lineage_kind: spec | adhoc | none   # result of Step 6.1 helper
   lineage_spec: <name>      # only when lineage_kind: spec
   lineage_phase: <phase-id> # only when lineage_kind: spec
   lineage_adhoc: <name>     # only when lineage_kind: adhoc
   ---
   ```

   Followed by the full report body verbatim (the same content shown in the conversation).

7. **Echo the path back to the user** before advancing to Step 7:

   > Saved review to `docs/reviews/main/phase-2/pr-42-fix-webhook-signing.md`.

## Step 7: Present Next-Step Commands (chains into plan/run)

After the report is shown and saved, output a **copy-paste-friendly command block** so the user can turn findings into a fix-plan with one paste. The block adapts to what was found.

### 7.1 Three branches based on findings

**Branch A — Nothing found (only "Passed Clean"):**

```
Nothing to fix — review clean.

Review saved to {full review path}.
```

Stop here. Do not show fix-plan commands.

**Branch B — Only P3 findings (low-priority style/naming):**

```
Review saved to {full review path}.

Only {n} low-priority (P3) suggestions — no blockers, no required fixes.

If you want to address them anyway:

    /rivet plan --from-review {full review path}
```

Stop after the optional command. Do not also offer P0/P1 or `--items` variants — they don't apply.

**Branch C — Anything P0 / P1 / P2 present:** the headline + variants block (Step 7.2 below).

### 7.2 Headline + variants block

Compute, before printing:

- `total` — total finding count across P0 + P1 + P2 + P3 + Removal Candidates
- `blockers` — P0 + P1 count
- `present_priorities` — chain like `P0 → P1 → P2 → P3` listing only the levels that have at least one finding
- `cherry_pick_sample` — the first 3–4 finding numbers in priority order (e.g., `1,2,3,4` if P0 has findings 1–2 and P1 has findings 3–4); if `blockers > 0`, prefer those numbers; otherwise pick the first 3–4 of whatever's present

Then output exactly this block (substitute `{ }` placeholders verbatim):

```
Review saved to {full review path}.

Run this command — it picks up the review file and generates a fix-plan automatically:

    /rivet plan --from-review {full review path}

Variants:

    # All {total} findings ({present_priorities}):
    /rivet plan --from-review {full review path}

    {if blockers > 0:}
    # P0+P1 only (the {blockers} blocker{s if plural} — fastest path to merge):
    /rivet plan --from-review {full review path} --max-priority p1

    # Cherry-pick specific findings (e.g. just findings {cherry_pick_sample}):
    /rivet plan --from-review {full review path} --items {cherry_pick_sample}
```

The `# P0+P1 only` variant is omitted if `blockers == 0` (no P0/P1 findings — going straight to "Fix all" or cherry-picking P2 makes more sense).

The `# Cherry-pick` example uses real finding numbers from the actual review (computed above) so users can paste it as-is to fix the most important items first.

### 7.3 Optional shortcut prompt

After the variants block, offer an inline shortcut for users who'd rather not copy-paste:

```
Or pick one to run now: [1] Fix all  [2] P0+P1 only  [3] Specific items  [Enter] Skip
```

(Show option `[2]` only when `blockers > 0`. Show `[3]` only when `total > 1` — cherry-picking from a single finding is silly.)

On choice:
- **1:** invoke `/rivet plan --from-review <full review path>`
- **2:** invoke `/rivet plan --from-review <full review path> --max-priority p1`
- **3:** prompt for finding numbers (same numbering Step 5 used — P0 first, then P1, then P2, then P3, then Removal Candidates, 1-indexed across the whole review), then invoke `/rivet plan --from-review <full review path> --items <list>`
- **Enter / no choice:** stop. The user has the commands above to run later.

**Do not generate the plan automatically.** The shortcut is opt-in. Pasting one of the variants from 7.2 is the primary path.

After plan generation completes (via shortcut or via the user pasting a variant), [plan.md](plan.md) Review-Source Mode Step J echoes the lineage-correct `/rivet run` target. Plan.md handles that prompt — review.md is done once it has presented Step 7 output.

**Why chain instead of fix inline?** The plan/run pipeline provides per-task subagent dispatch, verify.md Stage 0–2 verification, checkpoint tags, rollback, resumability after `/clear`, and learnings-scratch capture. An inline fix loop loses all of these. Per-task `fix: ... [review]` commits are still produced — `/rivet run` handles the commit per-task per [run.md](run.md).
