# /rivet plan — Generate Implementation Plan

**Model guidance:** This subcommand benefits from a stronger model (e.g., Opus). The output must be so mechanically detailed that a less capable model can execute each step without making architectural decisions.

## Step 1: Read Project Context

Read these files (skip any that don't exist):
- `CLAUDE.md` — project conventions, stack, patterns
- The target spec (may not exist for ad-hoc tasks; see spec discovery below and Step 2 for routing). Path is `docs/specs/{spec}.md` for normal multi-spec repos, or `spec.md` at the project root in single-spec-fallback mode.
- `PRODUCT.md` — design strategy (from `$impeccable teach`). Strategic: users, brand, tone, anti-references, `register:` field, and optionally a `## Surfaces` section (see "Surface inference" below).
- `DESIGN.md` — design system tokens (from `$impeccable document` or Google Stitch). Visual: colors, typography, spacing, components. Google Stitch format.
- Any sibling `DESIGN-{surface}.md` files referenced by PRODUCT.md's `## Surfaces` entries.

**Spec discovery** (Step 2 needs this list to validate the `{spec}` argument; Step 3's Cross-spec agent reads them later):

1. List `docs/specs/*.md`. For each entry, the spec name is the basename without `.md` and the path is `docs/specs/{name}.md`.
2. If step 1 returns nothing, check for `spec.md` at the project root. If present, treat it as a single spec with name `spec` and path `spec.md`. (Plans, branches, and checkpoints will use `spec` as the implicit `{spec}` so all downstream paths stay consistent.)
3. If both are empty, no specs exist in this repo — only ad-hoc mode is available.

Track the result as `spec_files` = list of `{name, path}` pairs. Step 2 uses both `name` (for argument matching) and `path` (for reading the spec file).

If `spec_files` is empty AND the user's arguments look like a spec command (not free-text), stop:
> "No specs found. Create one at `docs/specs/{name}.md` (multi-spec repos) or `spec.md` at the project root (single-spec shorthand), then retry. (Ad-hoc mode works without any specs: `/rivet plan \"<task description>\"`.)"

If `PRODUCT.md` or `DESIGN.md` is missing, `/rivet plan` proceeds without design enrichment — the pipeline doesn't halt, it just skips Step 6 with a one-line note (see Step 6).

### Step 1.5: Validate DESIGN.md + Surface inference (conditional)

If `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/SKILL.md` exists AND `PRODUCT.md` + `DESIGN.md` exist at the project root, read `${CLAUDE_SKILL_DIR}/design.md` (if not already loaded this session) and apply its `## Plan — DESIGN.md validation + Surface inference` section. Otherwise skip Step 1.5 entirely and treat the project as a single surface using `PRODUCT.md`'s global `register` and `DESIGN.md` (the single-surface fallback) — Step 6 will already be skipping with a note.

## Step 2: Route — Spec Phase, Ad-Hoc Task, Refresh, or Regenerate

### Argument parsing (first, before any guard)

Let `spec_files` = the list of `{name, path}` pairs collected in Step 1's spec discovery. Let `spec_names` = the names from that list. Let `args` = `$ARGUMENTS` with the `plan` subcommand word already stripped.

**Pre-filter the `--no-review` flag.** Before any positional parsing below, scan `args` for the literal token `--no-review`. If present, set `skip_review = true` and remove the token from `args`. Otherwise `skip_review = false`. The flag is positional-agnostic (anywhere on the command line works) and applies to every mode below — Step 5.5 reads `skip_review` and short-circuits if true.

```
first = args[0]
if first in spec_names:
    spec  = first
    rest = args[1:]
elif first == "--from-review":
    # Review-source mode (explicit flag). Path is args[1]; remaining args are filter
    # flags (--max-priority, --items, --include-removal). Stop with a clear error if
    # args[1] is missing or doesn't point at an existing file.
    review_path = args[1]
    review_args = args[2:]
    → "review-source"
elif first matches glob "docs/reviews/**/*.md" AND file exists:
    # Review-source mode (implicit path). The glob matches both flat
    # docs/reviews/pr-42-...md and stratified docs/reviews/{spec}/{phase}/pr-42-...md.
    review_path = first
    review_args = args[1:]
    → "review-source"
elif len(spec_names) == 1 and first not in spec_names:
    # Single-spec shorthand: first arg is treated as the phase (or as a flag/regenerate keyword).
    # Applies whether the lone spec is in docs/specs/ or is a bare spec.md at the project root.
    spec  = spec_names[0]
    rest = args                              # don't consume the first arg — it belongs to phase/tail
else:
    → "adhoc"  (the entire args string is the task description)

# Common tail handling once spec is resolved:
if rest is empty:
    → "spec-no-phase"  (ask user to pick a phase from the spec's path)
else:
    phase = rest[0]
    tail  = rest[1:]                         # e.g. ["--refresh"] or ["regenerate","sub-plan","2"]
    if tail == ["--refresh"]:                         → refresh
    elif tail[0:2] == ["regenerate","sub-plan"]:      → regenerate (N = tail[2])
    else:                                             → spec
```

Resolve the spec path from `spec_files` once `spec` is known (`docs/specs/{spec}.md` for normal specs; `spec.md` for the root single-spec fallback). Use that path everywhere downstream that previously hardcoded `docs/specs/{spec}.md`.

**Edge cases to surface to the user explicitly (do not guess):**
- Multiple specs exist and `first` looks like a phase (`phase-0`, `phase-1`, ...) but isn't a spec name → list `spec_names` and ask which one they meant. (With a single spec, this case never triggers — the shorthand absorbs it.)
- `first` is a spec name but `rest[0]` isn't a phase in that spec → list available phases from the spec file and ask.
- `first` is a spec name and `rest` is empty ("spec-no-phase") → list available phases and ask.
- `spec_files` empty → already handled in Step 1.
- `first == "--from-review"` but `args[1]` is missing or doesn't exist on disk → tell the user the path was missing or unreadable and stop. Don't guess.
- `first` is a path under `docs/reviews/` but the file doesn't exist → same — stop with a clear error.
- A spec is literally named `reviews` AND the user types `/rivet plan docs/reviews/...` → the `first in spec_names` branch wins (spec mode). To run review-source on such a project, use the explicit `--from-review` flag.

### Guard: plans already exist for this target

After parsing, in spec mode: check whether `docs/plans/{spec}/{phase}/` already exists with non-empty content. In ad-hoc mode: check `docs/plans/adhoc/{slug}.md` and `docs/plans/adhoc/{slug}/`. In review-source mode: check the resolved fix-plan path (see Review-Source Mode below — `docs/plans/{spec}/{phase}/reviews/{slug}/` for spec-lineage, `docs/plans/adhoc/review-{slug}/` otherwise). If a match exists and the user did NOT pass `--refresh` or `regenerate sub-plan N`:

```
Plans already exist for {spec} {phase}. Options:
  1. /rivet plan {spec} {phase} --refresh                 — re-validate vs current codebase
  2. /rivet plan {spec} {phase} regenerate sub-plan N     — rewrite one sub-plan
  3. Delete docs/plans/{spec}/{phase}/ first, then re-run — full replan (last resort)
```
Stop. Do not overwrite existing plans silently.

### Spec Mode

Read the spec at the path resolved in Step 2 (`docs/specs/{spec}.md`, or `spec.md` for the root single-spec fallback) and extract only the content for `{phase}`. Identify:
- All tasks assigned to the technical role (ignore marketing/growth tasks — those are for a different person)
- Hour budget for the phase
- Exit criteria
- Dependencies on prior phases
- Architectural decisions from the spec's decision log that affect this phase

If `{phase}` doesn't match anything in `docs/specs/{spec}.md`, list the available phases in that spec and ask the user to pick one.

### Ad-Hoc Mode

The user is describing work that isn't in any spec. Before planning:

1. **Clarify scope** — ask 2-3 targeted questions using AskUserQuestion. What exactly needs to happen? What's the boundary — what's NOT included? Any constraints (time, compatibility, specific approach)? Are there related spec phases this should be consistent with?

2. **Estimate size** — based on the answers, estimate hours. If under 4 hours, this will be a single plan file. If larger, it will be split into sub-plans like a spec phase.

3. **Check spec alignment across every spec** — if `spec_files` is non-empty (covers both `docs/specs/*.md` and the root `spec.md` fallback), skim each one to check whether this ad-hoc work touches planned features. If it overlaps with one or more specs, flag every overlap by name: *"This overlaps with `admin.md` Phase 0 (user-management dashboard) AND `main.md` Phase 2 (billing integration). Plan this consistent with those phases' architectures, or independently?"* Don't collapse to a single spec when multiple are affected.

Plan output for ad-hoc tasks goes to: `docs/plans/adhoc/{kebab-case-name}.md`
(or `docs/plans/adhoc/{name}/01-*.md` if split into multiple sub-plans)

### Review-Source Mode

The user has a saved review file (from `/rivet review`) and wants to convert its findings into an executable plan. Each finding becomes a task; sub-plans split by priority bucket.

#### Step A: Read the review file

Open `review_path` and parse:
- YAML frontmatter: `scope`, `pr_number`, `pr_title`, `branch`, `verdict`, `findings`, `date`.
- Markdown body sections: `## P0 — Critical`, `## P1 — High`, `## P2 — Medium`, `## P3 — Low`, `## Removal Candidates`. Within each, parse individual findings (review point # + name, file:line, what's wrong, fix recommendation).

If frontmatter is missing or malformed, stop with: `Review file at {path} is missing required YAML frontmatter (expected scope, branch, verdict, findings). Re-run /rivet review or fix the frontmatter manually.` Don't synthesize a plan from an unparsed file.

#### Step B: Resolve lineage (shared scope-detection helper)

Given the review's `branch:` value, classify into one of three kinds:

```
helper(branch_string) → {kind, ...}:
  if branch_string matches "rivet/{X}/{Y}" AND {X} in spec_names AND {Y} is a phase in spec {X}:
      return { kind: "spec", spec: X, phase_id: Y }
  elif branch_string matches "rivet/adhoc/{name}":
      return { kind: "adhoc", name: name }
  else:
      return { kind: "none" }
```

The same helper is invoked by [review.md](review.md) Step 6 to stratify the review file path on save — keep the implementation consistent across both subcommands.

#### Step C: Resolve plan path, branch, and run target from lineage

| Helper result | Plan output dir | Branch | Run target |
|---|---|---|---|
| `kind: spec` | `docs/plans/{spec}/{phase}/reviews/{slug}/{nn}-{bucket}.md` | `rivet/{spec}/{phase}/reviews/{slug}` | `/rivet run {spec} {phase} review {slug}` |
| `kind: adhoc` | `docs/plans/adhoc/review-{slug}/{nn}-{bucket}.md` | `rivet/adhoc/review-{slug}` | `/rivet run adhoc/review-{slug}` |
| `kind: none` | `docs/plans/adhoc/review-{slug}/{nn}-{bucket}.md` | `rivet/adhoc/review-{slug}` | `/rivet run adhoc/review-{slug}` |

`{slug}` derives from the review filename: take the basename, strip the `.md` extension, lowercase and kebab-case (existing rule from [review.md](review.md) Step 6.3). Example: `docs/reviews/main/phase-2/pr-42-fix-webhook-signing.md` → `slug = pr-42-fix-webhook-signing`.

#### Step D: Apply filter flags

Parse `review_args` for:
- `--max-priority p0|p1|p2|p3` — drop findings below that level. Default: include all.
- `--items 3,7,9` — include only listed finding numbers. Numbers are 1-indexed across the entire review (count P0 findings first, then P1, then P2, then P3, then Removal Candidates).
- `--include-removal=false` — drop the Removal Candidates section. Default: include.

Build a working `findings[]` list from the parsed sections after applying filters.

#### Step E: Skip ad-hoc clarification questions

The Ad-Hoc Mode "Clarify scope" AskUserQuestion block (Step 1 above) is **skipped** in review-source mode. The review file is already structured input — extra questions are friction.

#### Step F: Run targeted research

Findings already cite `file:line`, so skip the broad ad-hoc research. Dispatch only:

- **Codebase agent (focused):** read every cited file in full; map immediate dependents (mirrors [review.md](review.md) Step 3).
- **Cross-spec agent (always, when `spec_files` is non-empty):** re-use the spec-mode Cross-spec agent definition below in Step 3 — crucial in multi-spec repos: a finding might cross spec boundaries.

Skip web research and dependency agent — fixes work within the existing stack.

#### Step G: Group findings into priority buckets

```
01-p0   ← all P0 findings (skip if empty)
02-p1   ← all P1 findings + Removal Candidates marked "safe to delete now"
03-p2   ← all P2 findings + Removal Candidates marked "defer with plan"
04-p3   ← all P3 findings (skip if empty)
```

Skip empty buckets entirely (no zero-task file). Renumber after skipping so output is always contiguous (`01`, `02`, `03`).

#### Step H: Skip Step 4's split-approval prompt

The split is mechanical and predictable — no user confirmation needed. Announce the resulting structure inline (see Step J).

#### Step I: Generate one sub-plan per bucket

Each sub-plan file follows the standard schema (Step 5 below) with these frontmatter additions per task:

```yaml
  - id: {n}
    title: "{finding short description, ≤60 chars}"
    estimated_min: {15 for P3, 20 for P2, 25 for P1, 35 for P0}
    depends_on: [...]                       # populate when two findings cite the same file
    files: [{cited paths}]
    status: pending
    origin: review                          # alongside existing 'audit' from Step 6
    priority: p0 | p1 | p2 | p3 | removal
    review_point: {1–17}
    review_source: {review_path}
    lineage_kind: spec | adhoc | none
    lineage_spec: {spec}                    # only when lineage_kind: spec
    lineage_phase: {phase}                  # only when lineage_kind: spec
    # ui / surface / register / ui_commands set normally if the file is a frontend surface
    # (re-uses Step 3.5/Step 6 logic so design-lint still gates the fix).
```

Task body shape per finding:

```markdown
### Task N: {finding title}

**Files:** {cited paths}
**Source:** {review file}, finding #{N}, review point {1–17 name}
**Priority:** P0 / P1 / P2 / P3 / Removal Candidate

**What's wrong:** {verbatim from review}

**Fix:**
{verbatim "concrete fix recommendation" from review}

**Verification:**
- Re-run the test(s) in {affected test file(s)}
- Re-run review point {N} on the affected file (mirrors [review.md](review.md) Step 7's
  "re-run only the affected review points" guidance)
```

#### Step J: Echo the result

Print the resolved location and the lineage-correct run command:

```
Generated review-driven plan at docs/plans/main/phase-2/reviews/pr-42-fix-webhook-signing/
  01-p0.md  (2 tasks, ~70 min)
  02-p1.md  (4 tasks, ~100 min)
  03-p2.md  (3 tasks, ~60 min)
  04-p3.md  (1 task,  ~15 min)

Lineage: main / phase-2 (detected from review frontmatter)
Run: /rivet run main phase-2 review pr-42-fix-webhook-signing
```

When `kind: adhoc` or `kind: none`, the run command is `/rivet run adhoc/review-{slug}` and the lineage line shows `Lineage: ad-hoc (no spec/phase detected from {branch_value or "review scope"})`.

### Refresh Mode

A plan generated a week ago may now contain stale code — dependencies updated, the codebase moved on, API responses changed shape. Refresh re-validates an existing plan against the world *as it is now*.

Flow:

1. **Read the existing plan files** at `docs/plans/{spec}/{phase}/` — both frontmatter and markdown bodies. If no plan exists, stop and tell the user to run `/rivet plan {spec} {phase}` first.

2. **Dispatch research agents in parallel** (same set as spec mode's Step 3):
   - Codebase agent — compare embedded code snippets to current file contents and signatures
   - Dependency agent — compare `composer.json` / `package.json` versions referenced in the plan to what's currently installed
   - API docs agent — re-check response shapes / endpoints referenced in the plan

3. **Build a staleness report.** For each embedded code block, command, or API assumption, classify:
   - `fresh` — still valid
   - `stale` — no longer valid; propose replacement
   - `unknown` — couldn't verify (e.g., no test coverage, external API not probed)

4. **Present the diff to the user.** Show each stale item with:
   - Which task it's in
   - The current (stale) content
   - The proposed (fresh) content
   - Why it's stale (the research finding)

5. **Apply on confirmation.** Rewrite only the stale sections in the plan file(s). Leave tasks already marked `status: done` untouched (refreshing done tasks doesn't help — the code already exists).

Refresh never adds or removes tasks — it only updates content within existing tasks. To restructure tasks, use `regenerate sub-plan N`.

### Regenerate Mode

Arguments: `{spec} {phase} regenerate sub-plan N` (e.g., `/rivet plan main phase-0 regenerate sub-plan 2`).

Rewrites one sub-plan file end-to-end, keeping siblings untouched. Use when the split was right but the generated content is wrong.

Flow:

1. **Locate the sub-plan.** `docs/plans/{spec}/{phase}/0N-*.md`. Stop if no match.

2. **Warn if any tasks in this sub-plan have `status: done`.** Regeneration will overwrite the task definitions — the commits still exist, but the plan's record of what they did gets rewritten. Confirm with the user before proceeding.

3. **Read siblings** (`01-*.md`, `03-*.md`, etc.) to understand what this sub-plan sits between. Use their frontmatter + goals to keep the regenerated plan consistent with adjacent sub-plans.

4. **Run full research** as in spec mode Step 3 — codebase + dependencies + API docs for this sub-plan's scope.

5. **Generate** a fresh plan file using Step 5's structure (YAML frontmatter + markdown tasks). Overwrite the existing file.

6. **Report the rewrite** with a summary of what changed vs before.

## Step 3: Gather Context (when code exists)

### Spec Mode: Lightweight Context Scan

**Skip this step if the repository has no application code yet** (e.g., Phase 0 on an empty repo).

When existing code is present, dispatch parallel sub-agents to gather context before planning:

- **Codebase agent:** Grep/Glob/Read to find existing service classes, models, migrations, tests, config, and route definitions relevant to this phase's scope. Map what already exists that this phase builds on.
- **Dependency agent:** Check `composer.json` / `package.json` for installed packages. Identify any new packages this phase requires and verify current versions.
- **API docs agent (when the phase involves external APIs):** WebSearch for current API documentation of services this phase integrates. Focus on: response shapes, rate limits, error codes, authentication patterns, and any recent breaking changes.
- **Cross-spec agent (always in spec mode, when other specs exist):** Read every spec in `spec_files` *other than* the target spec (this includes the root `spec.md` fallback when in single-spec mode — though in that case there are no other specs and this agent has nothing to do). For each, look for conflicts with `{spec} {phase}`:
  1. **Shared models/tables** — does another spec create or modify a database table this phase touches (same name, same migration scope)? Flag with spec file + phase + table name + field if known.
  2. **Shared services** — does another spec define or consume a service class or interface this phase changes? Flag if this phase's changes could break another spec's assumptions about that service.
  3. **Ownership collisions** — does another spec plan something this phase depends on (and we'd duplicate), or does this phase plan something another spec's future phase already owns? Flag with an explicit ownership question.

  Report findings in a compact table: *Spec • Phase • What collides • Severity (blocker / coordinate / FYI)*. Omit the table entirely if no collisions.

After agents return, synthesize findings. If anything contradicts this spec's assumptions OR cross-spec collisions were flagged at blocker severity, use `AskUserQuestion` to let the user resolve ownership *before* Step 4. Don't auto-resolve — these are architectural decisions. Lower-severity overlaps (coordinate / FYI) can be noted and carried into the plan's Session Log.

### Ad-Hoc Mode: Full Research

Ad-hoc tasks start from a vague description — research is mandatory, not optional. Always dispatch these agents in parallel, even on an empty repo:

- **Codebase agent (when code exists):** Grep/Glob/Read to find existing code related to the task. Map what already exists — the task might be extending, modifying, or integrating with existing work. If nothing relevant exists, report that.
- **Web research agent (always):** WebSearch for best practices, common implementations, library documentation, and known pitfalls for the task's domain. Focus on: how others have solved this, which approach is current best practice, and what to watch out for. Prioritize official docs and recent sources.
- **Dependency agent (when the task involves packages):** Check what's already installed, research the right package for the job if one is needed, verify compatibility with the existing stack.
- **API docs agent (when the task involves external services):** WebSearch for current API documentation. Focus on: exact endpoint signatures, authentication scheme, response shapes, error codes, rate limits, webhook formats. Get the specifics the plan will need.

**After agents return:**

1. **Synthesize** — combine findings, resolve contradictions, note what's confirmed vs uncertain.
2. **Check in with user** — summarize the key findings in 3-5 lines, surface anything surprising or anything that changes the scope from what they described. Use AskUserQuestion with specific choices if there's a decision to make (e.g., "Two approaches: HMAC-SHA256 validation in middleware vs in the controller. Middleware is cleaner but adds complexity. Which do you prefer?").
3. **Check spec alignment across every spec** — if `docs/specs/` contains any `.md` files, skim each one and check whether this ad-hoc work overlaps with any planned phase in any spec. Flag each overlap by name: *"This touches billing integration, which `main.md` Phase 2 also plans. It also overlaps with `admin.md` Phase 1's webhook handlers. I'll plan consistent with both — or, if you prefer independent, say so."*

## Step 3.5: Component Catalog (runs when frontend directories exist)

Before splitting into sub-plans, scan the repo for existing frontend primitives so the planner can require reuse in task specs rather than spec new components that duplicate existing ones.

**Run:**

```bash
node ${CLAUDE_SKILL_DIR}/scripts/catalog-components.mjs \
  --out docs/plans/{spec}/{phase-id}/component-catalog.md \
  --product PRODUCT.md \
  --root .
```

(For ad-hoc plans, `--out docs/plans/adhoc/{name}/component-catalog.md`.)

The script auto-detects component roots: always scans `src/components/**`, `src/lib/components/**`, `components/**`, `app/components/**`, and additionally scans `resources/js/**` + `resources/views/components/**` when `composer.json` or `resources/js/` exists (Laravel projects). Override with a `--roots` CSV flag or `rivet.config.json` (`{ "componentRoots": [...] }` at repo root). The script extracts name + path + leading-docstring purpose, groups by surface via `## Surfaces` route matching, and emits a markdown catalog.

**If the scan finds zero components** (empty/new repo): skip catalog emission, note it in the plan summary, and plan tasks as all-new primitives. No catalog file is needed.

**If the scan finds components:** surface the result to the user BEFORE continuing to Step 4:

> `Component catalog written to docs/plans/{spec}/{phase-id}/component-catalog.md ({N} components across {M} surfaces). Review and edit as needed (mark deprecated items, tighten purpose, change status to 'do-not-reuse'), then press ENTER to continue. Type 'skip' to proceed without review.`

This is the user's opportunity to override the scanner's reuse decisions before any task spec locks them in.

**Catalog is consumed in Step 6** — every UI task spec must declare either `reuse: [<catalog paths>]` OR `new_primitive: { name, path, reason }`.

Skip this step silently if the repo has no frontend directories at all (pure backend work).

## Step 4: Propose Sub-Plan Split

**Spec mode:** A single phase is typically 20–40 hours. That's too large for one plan. Split each phase into sub-plans of approximately **4–8 hours** each.

**Spec mode, small phase (<4 hours):** Generate a single sub-plan file at `docs/plans/{spec}/{phase-id}/01-{name}.md`. Skip the split proposal — just announce the plan. The directory + single file structure keeps `/rivet run {spec} {phase}` behavior identical whether there's one sub-plan or many.

**Ad-hoc mode:** If the estimated work is under 4 hours, generate a single plan file — no split needed. If larger, split the same way as spec phases.

Identify natural boundaries using:
- Service class groupings (e.g., "Site Intelligence" vs "Prompt Generation")
- Feature boundaries (e.g., "Competitors section" vs "Fix Engine")
- The spec's own sub-sections and groupings (spec mode)
- Logical steps from the research findings (ad-hoc mode)
- Dependency order (what must be built before what)

Present the proposed split to the user:

```
I'd break Phase 0 into 3 sub-plans:

1. Project setup + SiteFetcher + DataForSEO integration (~8 hrs)
2. Reddit + Serper + Enricher + PromptGenerator (~8 hrs)
3. AI engine integrations + ScoreCalculator + Artisan command (~6 hrs)

Each sub-plan will be independently testable. Does this split work?
```

Wait for user approval or adjustments. Do not generate plans until the split is confirmed.

## Step 5: Generate Each Sub-Plan

For each approved sub-plan, create a file at:
```
docs/plans/{spec}/{phase-id}/{nn}-{sub-plan-name}.md
```

Example: `docs/plans/main/phase-0/01-site-intelligence.md`

### Plan Document Structure

Every plan file MUST follow this structure exactly. The YAML frontmatter is machine-readable — `/rivet status` reads it instead of counting checkboxes, and `/rivet run` uses `depends_on` for parallel dispatch.

```markdown
---
phase: phase-0
sub_plan: 01-site-intelligence
estimated_hours: 8
# Design-system hashes (present only when enrichment ran). Invalidate specs on refresh when hashes differ.
product_hash: <sha256 of PRODUCT.md at enrichment time>
design_hashes:
  default:
    design_ref: DESIGN.md
    sha: <sha256>
  # ...one entry per surface used in this sub-plan
tasks:
  - id: 1
    title: Fetch homepage HTML
    estimated_min: 20
    depends_on: []
    files: [app/Services/SiteFetcher.php, tests/Unit/SiteFetcherTest.php]
    status: pending   # pending | in_progress | done
    # Design fields (UI tasks only — set by Step 6)
    ui: false          # true when task touches a frontend surface
    surface: default   # name from PRODUCT.md's ## Surfaces, or 'default'
    register: product  # brand | product — inherited from surface
    ui_commands: []    # subset of [typeset, layout, colorize, adapt, animate, clarify, onboard, distill]
    # Origin tag (set to 'audit' for tasks injected by post-sub-plan verification,
    # or 'review' for tasks generated from a review file via Review-Source Mode)
    # origin: audit
    # depends_on may point back at the UI task that produced a flagged file
    # Review-source-only fields (present when origin: review):
    # priority: p0 | p1 | p2 | p3 | removal
    # review_point: 1–17                 # which review.md point raised the finding
    # review_source: reviews/.../foo.md  # path to the review file this task came from
    # lineage_kind: spec | adhoc | none  # what the review's branch resolved to
    # lineage_spec: <spec name>          # only when lineage_kind: spec
    # lineage_phase: <phase id>          # only when lineage_kind: spec
  - id: 2
    title: Build pricing card component
    estimated_min: 25
    depends_on: [1]
    files: [src/components/marketing/PricingCard.tsx]
    status: pending
    ui: true
    surface: marketing
    register: brand
    ui_commands: [typeset, layout, colorize, adapt, animate, clarify]
    # reuse / new_primitive live in the task body (see Step 6)
  # ... one entry per ### Task below, in order
---

# {Phase}: {Sub-Plan Name}

> **Execution:** Use `/rivet run {spec} {phase-id}` to execute this plan via subagents (or `/rivet run adhoc/{name}` for ad-hoc plans).

**Goal:** [One sentence — what this sub-plan delivers]
**Estimated hours:** [N]
**Prerequisites:** [What must exist before starting — prior sub-plan, config, API keys]
**Spec reference:** [Section numbers from the spec that define these requirements]

---

## Plan Overview

**Delivers:** [One sentence — what the user/system can do when this sub-plan is done, beyond "tests pass". Frame as a user capability, not a list of classes.]
**Key decisions:**
- [Non-obvious architectural choice #1 — state the WHY, not the what. E.g., "model slugs use dots not dashes (anthropic/claude-sonnet-4.6) — verified against live /api/v1/models 2026-04-27"]
- [Non-obvious architectural choice #2]
**Dependency chain:** [E.g., "1 → 2 → 3 → 4 → 8 → 9 → 10; tasks 6 and 7 are independent and can run in parallel"]
**Exit condition:** `[exact command]` — [expected output, e.g., "56 passed, 0 failed"]

---

## File Map

List every file that will be created or modified, with its responsibility:

| File | Action | Responsibility |
|---|---|---|
| `app/Services/SiteFetcher.php` | Create | Fetch homepage, /pricing, /about, meta tags, social links |
| `tests/Unit/SiteFetcherTest.php` | Create | Unit tests for SiteFetcher |
| ... | ... | ... |

---

## Tasks

### Task 1: {Descriptive Name}

**Files:** `path/to/file.php`, `path/to/test.php`

**Step 1: Write the failing test**

**Tests that:** [One sentence — what property or behavior the test asserts, not how. E.g., "SiteFetcher.fetch() returns a map with `title` and `meta_description` keys, both non-empty."]

​```php
// tests/Unit/SiteFetcherTest.php

namespace Tests\Unit;

use Tests\TestCase;
use App\Services\SiteFetcher;

class SiteFetcherTest extends TestCase
{
    public function test_fetches_homepage_title_and_meta(): void
    {
        $fetcher = new SiteFetcher();
        $result = $fetcher->fetch('https://example.com');

        $this->assertArrayHasKey('title', $result);
        $this->assertArrayHasKey('meta_description', $result);
        $this->assertNotEmpty($result['title']);
    }
}
​```

**Step 2 (verify fail):** `php artisan test --filter=SiteFetcherTest` → FAIL — class `App\Services\SiteFetcher` not found.

**Step 3: Write minimal implementation**

​```php
// app/Services/SiteFetcher.php

namespace App\Services;

class SiteFetcher
{
    public function fetch(string $url): array
    {
        // implementation here
    }
}
​```

**Step 4 (verify pass):** `php artisan test --filter=SiteFetcherTest` → PASS.

**Commit:** `feat: add SiteFetcher with homepage extraction (task N)` — files: `app/Services/SiteFetcher.php`, `tests/Unit/SiteFetcherTest.php`

Include the task id in the commit subject so rollback can match commits to tasks when resetting. One task = one commit. Do not stage test and implementation into separate commits — the red-green-refactor happens within a single commit. Sub-plan-level squashing is offered at sub-plan completion ([run.md](run.md)).

#### Alternative stack shape — same TDD structure, TypeScript/Vitest

The Laravel example above is not prescriptive — plans adopt whatever stack and test runner the target project uses. Same task, TypeScript shape:

**Step 1: Write the failing test**

**Tests that:** SiteFetcher.fetch() returns an object with `title` and `metaDescription` properties, both truthy.

​```ts
// src/services/__tests__/site-fetcher.test.ts
import { describe, it, expect } from 'vitest';
import { SiteFetcher } from '../site-fetcher';

describe('SiteFetcher', () => {
  it('fetches homepage title and meta', async () => {
    const result = await new SiteFetcher().fetch('https://example.com');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('metaDescription');
    expect(result.title).toBeTruthy();
  });
});
​```

**Step 2 (verify fail):** `npx vitest run site-fetcher` → FAIL — module not found.
**Step 3: Write minimal implementation** at `src/services/site-fetcher.ts`.
**Step 4 (verify pass):** `npx vitest run site-fetcher` → PASS.
**Commit:** `feat: add SiteFetcher with homepage extraction (task N)` — files: `src/services/site-fetcher.ts`, `src/services/__tests__/site-fetcher.test.ts`

Pick the test runner the project already uses (`pytest`, `go test`, `cargo test`, `bundle exec rspec`, `php artisan test`, etc.). The TDD shape — failing test, verify fail, minimal impl, verify pass, single commit — is invariant; only the commands change.

---

### Task 2: {Next Task}
[Same structure]

---

> Session notes are kept in [session-log.md](../session-log.md) — appended by `/rivet run`, not here. Leave this line as-is at generation time.
```

### Task Granularity Rules

Each task MUST be a single testable unit of work, completable in 2–5 minutes:

- "Write the failing test" is one step
- "Run it to verify it fails" is one step
- "Write the implementation" is one step
- "Run the test to verify it passes" is one step
- "Commit" is one step

### What Every Task MUST Include

1. **Exact file paths** — no "create a service class," instead the specific file path the task targets (e.g., `src/services/site-fetcher.ts` or `app/Services/SiteFetcher.php`).
2. **Complete code** — not "add validation logic," instead the actual code to write. The executor should never have to make a design decision.
3. **A `**Tests that:**` one-liner** immediately before each Step 1 code block — one sentence stating what property or behavior the test asserts. Written for human reviewers; the code block is authoritative for the executor.
4. **Compact Steps 2, 4, and 5** — use the one-liner form: `**Step 2 (verify fail):** <command> → FAIL — <reason>.` / `**Step 4 (verify pass):** <command> → PASS.` / `**Commit:** <conventional-message> — files: <file list>`. Not multi-line blocks.
5. **Context from the spec** — if the spec specifies a particular approach, data structure, API response format, or design decision, include it directly in the task so the executor doesn't need to read the spec

### What Tasks MUST NOT Include

- Ambiguous instructions ("implement appropriate error handling")
- Decisions left to the executor ("choose a suitable data structure")
- References to other files without specifying what to look for ("follow the pattern in the other services")
- Multiple unrelated changes in one task

### Final Task Rule: Integration Test

The last task of every sub-plan MUST be an integration test that wires together the components built in that sub-plan and verifies they work as a connected pipeline.

- Mock external APIs (HTTP responses, not the service classes themselves)
- Pass real data through the chain: input → service A → service B → output
- Assert the final output shape and values, not just that each step was called
- This catches contract violations between components that unit tests miss

Example: if the sub-plan built SiteFetcher + DataForSeoClient + Enricher, the integration test feeds a mocked HTTP response through all three and asserts the enriched output has the expected fields.

If the sub-plan is purely UI or configuration with no service chain, this rule can be skipped — note why in the plan.

## Step 5.5: Senior Plan Review (auto-revise loop, opt-out via `--no-review`)

A second Opus pass, framed as a senior reviewer rather than the planner, catches issues a single-pass plan still leaks: ambiguous tasks, `depends_on` graphs that miss real ordering, scope drift from the spec, "implement appropriate retry logic"-style instructions that defeat mechanical executability. Up to two passes (review → patch → re-review). The reviewer is read-only; the parent applies patches.

**Skip this step entirely if `skip_review = true`** (set in Step 2 when `--no-review` was on the command line). Note the skip in Step 7's summary and proceed to Step 6.

**Skip this step if no sub-plan files were generated this run** (e.g., the planner stopped earlier on a guard or user prompt).

### 5.5.1 — Pass 1: Review

Launch a single Agent with `subagent_type: "Plan"`, `description: "Senior plan review (pass 1)"`. The Plan subagent type is **read-only** (no Edit/Write/NotebookEdit) — it only judges, never patches. The prompt:

> You are reviewing a plan generated by another Opus instance for `/rivet plan {mode descriptor — e.g., main phase-0 / adhoc/webhook-signing / refresh of main phase-0}`. Provide an independent second opinion. Read these files in full:
> - All generated sub-plan files: `{list of paths}`
> - Spec at `{spec_path}` (omit this line in ad-hoc mode; instead include the user-confirmed task description verbatim)
> - `CLAUDE.md` (skip if missing)
> - For every task whose Step 1 (failing test) or Step 3 (implementation) code block references an existing class, mock helper, factory, base test class, fixture, or config key: read the file that defines it. Build the list yourself by scanning each task's code blocks for `use` statements, class names, factory invocations (`UserFactory::new`), facade calls (`Cache::driver`), config reads (`config('foo.bar')`), fixture paths, and `Mockery::mock(X::class)` targets. If a referenced symbol cannot be located in the repo at all, that itself is a Lens 4 finding (the plan assumed something exists that doesn't).
>
> Apply four lenses. For every issue you find, name the lens, the sub-plan file, and the location (Task N / frontmatter / file_map / overview).
>
> **Lens 1 — Executor-friendliness.** Every task must be mechanically executable by a less-capable model. Flag: ambiguous instructions ("implement appropriate X"), decisions left to the executor ("choose a suitable Y"), references like "follow the pattern in the other services" without specifying which pattern, missing exact file paths, missing complete code (only a stub or "// implementation here"), missing or vague `**Tests that:**` lines, missing or non-conventional commit-message specifications, multiple unrelated changes bundled into one task.
>
> **Lens 2 — Architecture & dependency correctness.** Verify: `depends_on` is acyclic across all sub-plans; tasks marked independent (no `depends_on` entry from each other) are actually independent (no shared file, no implicit ordering); tasks linked by `depends_on` actually need to be serial; the integration test (last task per sub-plan) wires the right components from that sub-plan's earlier tasks; the File Map matches the union of files referenced in Tasks; frontmatter `tasks[]` order, IDs, and titles match the markdown body.
>
> **Lens 3 — Spec alignment & scope discipline.** Verify: the sub-plans collectively deliver the phase's exit criteria from the spec; no scope creep beyond the spec's stated requirements; no premature abstraction (no helpers for hypothetical futures, no surrounding cleanup, no extra layers introduced "just in case"); domain language matches the spec (e.g., if the spec says "enrichment," tasks say "enrichment," not "data augmentation"); cross-spec collisions flagged in Step 3 (if any) are actually acted on in the plan, not just noted.
>
> **Lens 4 — Code grounding.** Every code block, mock setup, factory call, base-class reference, and existing-symbol invocation in a task must match the actual implementation in the repo. Flag: test setups that mock methods the target class doesn't expose (or with wrong signatures), factory calls referencing columns/relationships not in the migration, `extends` / `use` references to classes that don't exist or live at a different path, helper/util calls with the wrong argument shape, fixture loaders pointing at files not present in the repo, configuration keys read from `config()` that aren't defined. The plan can introduce *new* code — Lens 4 only fires when the plan references something it expects to *already exist*.
>
> Output a YAML+markdown report. **Do not attempt to edit files.** Your tool result must be a single document in this format and nothing else:
>
> ````
> ---
> review_pass: 1
> date: {YYYY-MM-DD}
> verdict: approved | revisions-required
> finding_counts: { blocker: N, major: N, minor: N }
> findings:
>   - id: 1
>     severity: blocker | major | minor
>     lens: executor | architecture | spec_alignment | code_grounding
>     sub_plan: 01-site-intelligence
>     location: "Task 5"            # or "frontmatter", "file_map", "overview"
>     issue: "Task 5 instruction 'implement appropriate retry logic' leaves design decisions to the executor."
>     proposed_fix: "Replace Task 5's Step 3 code block with: 'Wrap the DataForSeoClient::fetch() call in Illuminate\\Support\\Facades\\Retry::times(3, ..., 100) with backoff 100ms, 400ms, 1600ms.'"
>   - id: 2
>     severity: blocker
>     lens: code_grounding
>     sub_plan: 03-enrichment
>     location: "Task 4"
>     issue: "Task 4's failing-test block calls Mockery::mock(SiteFetcher::class)->shouldReceive('fetch')->andReturn(...), but SiteFetcher (app/Services/SiteFetcher.php) exposes fetchSite($url): SiteResponse — there is no fetch() method. Test will fail at mock binding before reaching the assertion."
>     proposed_fix: "In Task 4 Step 1, change shouldReceive('fetch') to shouldReceive('fetchSite') and update the argument matcher to ->with('https://example.com'). Update the andReturn() payload to a SiteResponse instance, not a raw array."
>   - id: 3
>     ...
> ---
>
> # Plan review — pass 1
>
> ## Summary
> {2-3 sentences on overall plan health}
>
> ## Findings
> ### Finding 1 — blocker — executor — 01-site-intelligence / Task 5
> {full prose explanation, including why the proposed_fix resolves it}
>
> ### Finding 2 — ...
> ````
>
> Severity rules:
> - `blocker` — plan cannot execute correctly as written (dependency cycle, missing file in File Map but referenced in tasks, executor-undecidable instruction, frontmatter/body mismatch on task IDs).
> - `major` — plan will execute but produce wrong/incomplete output (weak test assertion, scope drift, premature abstraction, integration test wires wrong components).
> - `minor` — stylistic / clarity (verbose prose, inconsistent vocabulary, redundant context).
>
> Verdict is `approved` only when blocker == 0 AND major == 0. Otherwise `revisions-required`.

Save the returned content verbatim to:
- Spec mode: `docs/plans/{spec}/{phase-id}/plan-review.md`
- Ad-hoc mode: `docs/plans/adhoc/{name}/plan-review.md`

Overwrite if the file already exists from a prior run.

### 5.5.2 — Patch

Read the saved `plan-review.md`. For each finding where severity is `blocker` or `major`:

1. Open the sub-plan file named in `sub_plan`.
2. Locate the section identified by `location`:
   - `Task N` → find the `### Task N: {name}` header and operate on the block until the next `### Task` or `---` boundary.
   - `frontmatter` → operate on the YAML between the leading `---` markers.
   - `file_map` → operate on the `## File Map` section.
   - `overview` → operate on the `## Plan Overview` section.
3. Apply `proposed_fix` via Edit. The `proposed_fix` is a high-level instruction (not a literal find/replace string) — interpret it surgically. Touch only the section identified in `location`; do not rewrite adjacent content.
4. If the Edit fails (anchor not unique, proposed_fix unclear, file content already matches the proposed end-state), record `{finding_id, "patch failed: <reason>"}` in a running `patch_skips[]` list to surface in Step 7. Continue with remaining findings — one bad finding does not abort the patch loop.

`minor` findings are **not** auto-applied. They surface in the final Step 7 summary so the user can address them manually.

**Safety rule.** If a single `proposed_fix` would delete more than ~20 lines of plan content without a clear replacement of comparable size, skip it and add a `patch_skips[]` entry — likely a malformed report. Lean conservative: a missed patch is recoverable; a destructive one is not.

### 5.5.3 — Pass 2: Re-review

If pass 1's verdict was `approved` (no blocker/major findings), skip pass 2 — there is nothing to re-review. Record `passes: 1` in the frontmatter tagging step (5.5.4) and continue.

Otherwise, re-launch the same Plan subagent with `description: "Senior plan review (pass 2)"`. Use the same prompt shape, but:
- Inject `review_pass: 2` into the required output frontmatter.
- Include the pass-1 report as additional context so the reviewer can spot regressions or insufficient fixes:
  > Pass 1 of this review identified the findings below. The plan has since been patched. Re-review the current state of the sub-plan files and report any remaining blocker/major issues — including pass-1 findings that were not adequately resolved.

Append the returned content to `plan-review.md` under a `# Plan review — pass 2` header so the file ends up with two `---`-delimited YAML blocks and two markdown sections (pass 1 first, pass 2 below). Pass 2's verdict is one of:

- `approved` — no blocker/major remain.
- `residual` — pass-1 issues persist OR new issues uncovered.

**Hard cap: 2 passes total.** Never run pass 3, even if pass 2 is `residual`. Surface residuals to the user instead (Step 7 + 5.5.7).

### 5.5.4 — Frontmatter tagging

After Step 5.5 completes (or after pass-1-only when verdict was `approved`), append a `plan_review:` block to each sub-plan's frontmatter via Edit on the YAML:

```yaml
plan_review:
  reviewed_at: YYYY-MM-DD
  passes: 1 | 2
  verdict: approved | residual
  findings_addressed: N    # blocker + major findings whose patch succeeded
  findings_residual: N     # blocker + major findings still present in pass 2
```

If the sub-plan already has a `plan_review:` block from a prior run (e.g., on `--refresh`), overwrite it.

### 5.5.5 — Mode-specific scoping

- **Spec mode.** Default flow above; review covers all generated sub-plans for the phase.
- **Ad-hoc mode.** Same flow; report at `docs/plans/adhoc/{name}/plan-review.md`. Lens 3's "spec alignment" sub-checks (exit criteria, domain vocabulary) are skipped — there is no spec. Lens 3's "scope discipline" sub-checks (no premature abstraction, no scope creep beyond the user-confirmed task description) still apply. Note this in the pass-1 prompt.
- **Refresh mode.** Review scope is **only the tasks marked `stale` by the staleness report** in Refresh Step 3. Pass-1 prompt scopes the lenses to those task IDs by name. Other tasks remain frozen and are not re-reviewed. Skip Step 5.5 entirely if the staleness report had zero stale items (refresh was a no-op).
- **Regenerate sub-plan N.** Review scope is the regenerated sub-plan only; siblings are read-only context for lens 2 (cross-sub-plan dependency correctness) but are not themselves reviewed.
- **Review-source mode.** Review runs in full. Review-source plans are mechanical but still benefit from sanity checks on dependency ordering and file-path correctness — and lens 3 catches cases where multiple findings cite the same file but the generated tasks don't `depends_on` each other.

### 5.5.6 — Hard gate on residual blockers

If pass 2 ends with verdict `residual` AND at least one residual finding has `severity: blocker`, **stop**. Print the residual block to the user, do **not** proceed to Step 6, and exit Step 5.5 with:

```
Plan review halted: {N} residual blocker(s) after 2 passes.
See docs/plans/{spec}/{phase-id}/plan-review.md for details.

Options:
  1. Fix the blocker(s) manually in the sub-plan file(s), then run:
     /rivet plan {spec} {phase-id} --refresh
  2. Override and proceed without review (NOT recommended for blockers):
     /rivet plan {spec} {phase-id} --no-review
```

Major-only residuals do **not** gate — they print as warnings in Step 7 and the pipeline continues to Step 6. This is the only place where review can hard-block. Major / minor findings always proceed.

### 5.5.7 — Failure modes

- **Subagent crashes / times out.** Log `Plan review skipped: subagent error ({reason})` in Step 7, proceed to Step 6 without review. Do not block plan finalization on infrastructure failure.
- **Subagent returns unparseable output** (no YAML frontmatter, no findings list). Treat as a crash per above. Do not retry — one infrastructure failure should not double the cost.
- **Pass-1 verdict immediately `approved`.** Skip pass 2 (nothing to re-review). Record `passes: 1` in frontmatter.
- **Patch failures accumulate** (e.g., `patch_skips[]` ≥ 3 in a single pass). Continue but flag prominently in Step 7; the report file remains the source of truth for manual application.
- **`plan-review.md` already exists** from a prior run on the same target. Overwrite. No merge.

## Step 6: Design Enrichment (conditional, UI tasks only, requires impeccable)

If `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/SKILL.md` exists AND `PRODUCT.md` + `DESIGN.md` exist at the project root, read `${CLAUDE_SKILL_DIR}/design.md` (if not already loaded this session) and apply its `## Plan — Design Enrichment (Step 6)` section, which contains the full sub-steps 6.1 (classify each task) through 6.7 (final plan validation sweep) — including the per-task Design Spec template, the `reuse:` / `new_primitive:` enforcement loop, the `design_extends:` escape hatch, idempotency rules, and the post-write validation sweep.

Otherwise emit this one-line note in the Step 7 summary and proceed: `Design enrichment skipped: <reason>. Install impeccable (https://github.com/pbakaus/impeccable) and run '$impeccable teach' + '$impeccable document' (or Google Stitch) to enable, then rerun /rivet plan {spec} {phase}.`

## Step 7: Summary

After generating all plans, present a single output that begins with the plan-review status line (Step 5.5 result) followed by the file listing for the active mode.

### Plan-review status line (always first)

Pick the variant that matches Step 5.5's outcome:

- `--no-review` set: `Plan review: skipped (--no-review).`
- Step 5.5 was skipped because the mode produced no sub-plans this run (e.g., refresh no-op): `Plan review: skipped (no sub-plans changed).`
- Subagent failure: `Plan review: skipped — subagent error ({reason}).`
- Pass-1 approved: `Plan review: 1 pass, no findings.`
- Pass-2 approved: `Plan review: 2 passes, {addressed} findings addressed ({blocker_addressed} blocker, {major_addressed} major), 0 residual.`
- Pass-2 residual (major-only — pipeline continued): `Plan review: 2 passes, {addressed} addressed, {residual} residual major. Manual revision recommended before /rivet run.`
- Pass-2 residual (blocker — Step 5.5 hard-gated, this Step 7 only runs if the user opted to override): handled by Step 5.5.6's halt block; Step 7 does not run.

When pass 1 or pass 2 ran, append a second line:

```
Report: docs/plans/{spec}/{phase-id}/plan-review.md
```

(or `docs/plans/adhoc/{name}/plan-review.md` for ad-hoc).

When `patch_skips[]` is non-empty, append:

```
{n} patch(es) skipped — see plan-review.md for manual application.
```

When pass 1 or pass 2 surfaced any `minor` findings, append:

```
{n} minor finding(s) — not auto-applied; see plan-review.md.
```

### File listing (one of the variants below)

**Spec mode:**
```
Plans generated for {spec} {phase-id}:

  docs/plans/{spec}/{phase-id}/01-{name}.md  ({n} tasks, ~{h} hrs)
  docs/plans/{spec}/{phase-id}/02-{name}.md  ({n} tasks, ~{h} hrs)
  docs/plans/{spec}/{phase-id}/03-{name}.md  ({n} tasks, ~{h} hrs)

Total: {N} tasks across {M} sub-plans (~{H} hrs)

Next: Run `/rivet run {spec} {phase-id}` to start executing.
```

**Ad-hoc mode (single plan):**
```
Plan generated:

  docs/plans/adhoc/{name}.md  ({n} tasks, ~{h} hrs)

Next: Run `/rivet run adhoc/{name}` to start executing.
```

**Ad-hoc mode (multiple sub-plans):**
```
Plans generated for {name}:

  docs/plans/adhoc/{name}/01-{sub}.md  ({n} tasks, ~{h} hrs)
  docs/plans/adhoc/{name}/02-{sub}.md  ({n} tasks, ~{h} hrs)

Total: {N} tasks across {M} sub-plans (~{H} hrs)

Next: Run `/rivet run adhoc/{name}` to start executing.
```
