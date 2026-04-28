# /rivet — Design Enrichment (conditional)

This file is loaded conditionally by `/rivet` subcommands. The full design integration adds enrichment at three points (plan, run, review), plus an optional spec-time co-founder alignment check that uses a simpler gate.

**Default load gate (used by plan / run / review sections):** read this file only when ALL of the following hold —
- `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/SKILL.md` exists
- `PRODUCT.md` exists at the project root
- `DESIGN.md` exists at the project root

(The "Spec — Co-founder alignment" section below has a simpler gate — only `PRODUCT.md` is required. See that section.)

When the gate fails, the calling subcommand emits a one-line skip note and proceeds without design enrichment. The pipeline never blocks on a missing gate.

The subcommand files (`spec.md`, `plan.md`, `run.md`, `review.md`) reference sections of this file by anchor name. Each section preserves its full content verbatim as it existed before extraction — quality of generated output is identical to the pre-split version.

---

## Spec — Co-founder alignment

Used by `spec.md` Step 2.9. Gated only on `PRODUCT.md` existing at the project root (impeccable + DESIGN.md not required for this section).

Skip if `PRODUCT.md` is missing or has a single author.

If `PRODUCT.md` lists multiple authors OR the user has mentioned a co-founder in the conversation:

```
You mentioned Sara as co-founder. Before locking in this bet:
  1. Has Sara reviewed the bet statement?
  2. Any disagreements on target customer, pricing, or moat?
  3. Anything you've deferred discussing because it felt awkward?

If any of these have unresolved items, list them — they go into the
Decisions Deferred register so they don't get lost.
```

Use AskUserQuestion. Don't push if the user says "skip" — note as `O1: Co-founder alignment pending review` and move on.

---

## Plan — DESIGN.md validation + Surface inference

Used by `plan.md` Step 1.5 (DESIGN.md validation, runs only when DESIGN.md exists) and from Step 3.5 onward (Surface inference resolution).

### Step 1.5: Validate DESIGN.md (guard, runs only when DESIGN.md exists)

Before using DESIGN.md for any downstream work, validate its frontmatter + required markdown sections:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/design-lint.mjs --validate-spec DESIGN.md
```

Run this for every DESIGN file present: `DESIGN.md` plus every unique `design_ref` value in PRODUCT.md's `## Surfaces` section.

If any validation fails (exit code 1), stop and tell the user exactly which DESIGN file is broken and the reported issues. Do not generate a plan against a broken spec — garbage tokens produce garbage enrichment. Ask the user to fix DESIGN.md (or re-run `$impeccable document`) before retrying.

### Surface inference (applies from Step 3.5 onward)

`PRODUCT.md` may include an additive `## Surfaces` section defining N surfaces with route globs, register, voice overlay, and optional per-surface `design_ref`. Schema:

```markdown
## Surfaces

- name: marketing
  route: /, /pricing, /about, /marketing/**
  register: brand
  voice_overlay: bolder, committed color, typographic risk
  design_ref: DESIGN-marketing.md

- name: dashboard
  route: /app/**, /dashboard/**
  register: product
  voice_overlay: warm, confident, moments of delight
  design_ref: DESIGN.md

- name: admin
  route: /admin/**, app/admin/**
  register: product
  voice_overlay: utilitarian, dense, minimal motion, no decorative delight
  design_ref: DESIGN-admin.md
```

Define as many surfaces as the project needs. Tasks inherit `register` and `voice_overlay` from the matched surface; the matched surface's `design_ref` determines which DESIGN file gates token lint for that task. If `## Surfaces` is absent, treat the whole project as a single surface using `PRODUCT.md`'s global `register` and `DESIGN.md`.

---

## Plan — Design Enrichment (Step 6)

Used by `plan.md` Step 6 — UI tasks only, requires impeccable.

Skip this step entirely if any of:
- the [impeccable](https://github.com/pbakaus/impeccable) skill is not installed at `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/`
- `PRODUCT.md` is missing at the project root
- `DESIGN.md` is missing at the project root

When skipping, emit this one-line note in the Step 7 summary and proceed: `Design enrichment skipped: <reason>. Install impeccable (https://github.com/pbakaus/impeccable) and run '$impeccable teach' + '$impeccable document' (or Google Stitch) to enable, then rerun /rivet plan {spec} {phase}.`

### 6.1 Classify each task

For every task, set these frontmatter fields at generation time:

- **`ui`** — `true` if the task description names any frontend noun: component, page, form, table, chart, modal, dashboard, screen, view, layout, card, button, input, nav, list, hero, landing, widget, panel, sidebar, footer. Otherwise `false`.
- **`surface`** — match the task's target file paths AND any routes-or-URLs in the description against each `## Surfaces` entry's `route` globs. Longest-prefix wins. If no `## Surfaces` section exists, set `default`. If matches come back ambiguous (task touches files in two surfaces), prompt the user to split the task before finishing the plan.
- **`register`** — resolved by priority: (1) explicit per-task cue ("landing page" → brand); (2) matched surface's `register`; (3) `PRODUCT.md`'s global `register`. Record the chosen value explicitly so `/rivet run` and `/rivet review` don't re-infer.
- **`ui_commands`** — the gated subset of impeccable commands to apply at plan time. Rules:

| Command | Include when |
|---|---|
| `typeset` | always (UI task) |
| `layout` | always (UI task) |
| `colorize` | always (UI task) |
| `adapt` | always (UI task) |
| `animate` | always (UI task) |
| `clarify` | task emits user-visible copy (labels, errors, empty states, tooltips, button text) |
| `onboard` | task mentions onboarding / first-run / empty state / activation / welcome / tour |
| `distill` | task is feature-dense: dashboards, settings panels, forms with many fields, tables with many columns |

**Register-mismatch warning:** if ≥30% of UI tasks in this phase disagree with their inferred surface's `register`, stop and ask the user before writing the plan. Usually it means a `route` glob in `## Surfaces` is wrong.

### 6.2 Write per-surface design briefs (canonical + optional override)

Two brief locations per surface, resolved at read time:

1. **Canonical (required):** `docs/design/brief-{surface}.md` — one per surface, project-wide. Regenerated only when PRODUCT.md or the surface's `design_ref` file changes. Source of truth for every phase.
2. **Override (optional):** `docs/plans/{spec}/{phase-id}/design-brief-{surface}.md` — phase-specific addendum. Composed on top of canonical at read time (tokens overlay, sections append). Written only when the phase has legitimately phase-specific constraints; most phases won't have one.

For each UI-touched surface in the phase:

1. Compute `product_hash = sha256(PRODUCT.md)` and `ref_sha = sha256(design_ref file)`.
2. If `docs/design/brief-{surface}.md` exists AND its frontmatter stores matching hashes → reuse as-is.
3. Else → generate fresh from impeccable references + PRODUCT.md + the surface's `design_ref` DESIGN file, with frontmatter `{product_hash, design_hash, surface, register, generated_at}`. Write to `docs/design/brief-{surface}.md`.

**Migration from pre-canonical projects:** if `docs/plans/{spec}/{phase-id}/design-brief-{surface}.md` exists AND `docs/design/brief-{surface}.md` does not, copy the per-phase brief to `docs/design/` as the canonical; leave the per-phase file in place (it becomes an empty-delta override). Mention the migration in Step 7's summary: `"Migrated {N} briefs to docs/design/. Remove docs/plans/{spec}/{phase}/design-brief-*.md if you don't need phase-specific overrides anymore."`

**Single-surface projects** collapse `{surface}` to `default` in both paths: canonical at `docs/design/brief-default.md` (or just `docs/design/brief.md` if you prefer — the reader accepts either), override at `docs/plans/{spec}/{phase-id}/design-brief.md`.

Each brief contains, distilled from impeccable references + PRODUCT.md + the surface's `design_ref` DESIGN file:

- Surface name + route globs
- Register (with rationale: task cue, surface default, or PRODUCT.md fallback)
- Voice overlay from the surface definition
- Tokens from the surface's `design_ref`: color strategy, type scale, spacing scale, radii, shadows (pull verbatim token names + values)
- Motion system: durations, easing curves, reduced-motion policy
- Voice + anti-references from PRODUCT.md
- Absolute bans (impeccable shared laws from `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/SKILL.md`) + register-specific bans (from `reference/brand.md` or `reference/product.md`) + surface-specific bans inferred from voice_overlay
- Global state conventions for this surface: what empty/loading/error look like
- Component-primitive directory convention (where shared UI for this surface lives, from `component-catalog.md`)

Write hashes into the plan's frontmatter (Step 5):

```yaml
product_hash: <sha256 of PRODUCT.md>
design_hashes:
  marketing:
    design_ref: DESIGN-marketing.md
    ref_sha: <sha256 of the design_ref file>
    canonical_path: docs/design/brief-marketing.md
    canonical_sha: <sha256 of the canonical brief>
    # override_path + override_sha present only if a per-phase override exists
    override_path: docs/plans/{spec}/{phase-id}/design-brief-marketing.md
    override_sha: <sha256>
  admin:
    design_ref: DESIGN-admin.md
    ref_sha: <sha256>
    canonical_path: docs/design/brief-admin.md
    canonical_sha: <sha256>
```

**Brief-read protocol** (used by plan.md Step 6.3, run.md Sub-Plan Verification, review.md Point 17):

```
load_brief(surface):
  canonical = read(plan.design_hashes[surface].canonical_path)
  if plan.design_hashes[surface].override_path exists:
    override = read(plan.design_hashes[surface].override_path)
    return compose(canonical, override)   # override sections append; override tokens overlay
  return canonical
```

### 6.3 Append per-task Design Spec

For each `ui: true` task, append these sections to the task body (do NOT overwrite the task description, tests, or existing frontmatter):

```markdown
### Design Spec

**Surface:** {surface}
**Register:** {register}
**Commands applied:** {ui_commands}
**Reads:** docs/plans/{spec}/{phase}/design-brief-{surface}.md
**Catalog:** docs/plans/{spec}/{phase}/component-catalog.md

reuse:
  - "{catalog path 1}"              # existing primitive — reason for reuse
  - "{catalog path 2}"

new_primitive:
  name: {ComponentName}
  path: "{import path}"
  reason: "{why no catalog entry fits — reference closest catalog entry that almost fits}"

**Component:** {one-line description}
**Composition:** {grid / asymmetric / stack, primary vs secondary}
**States required:** {list — must include hover/focus/active/disabled for interactive; empty/loading/error for data-backed}
**Copy:** (exact strings)
  - {role}: "{text}"
  - ...
**Motion:** {durations, easing, specific transitions}
**Responsive:** {breakpoints + how it reshapes, not just shrinks}
**Key bans for this task:** {concrete bans from the brief that this task is at highest risk of violating}

### Design Verification

Mechanical (run by /rivet, hard-fail at Stage 2 — see run.md):
- Design Token Lint clean (no hex / off-scale values / unknown fonts in changed files)
- Reuse/new_primitive declarations match actual files created
- Component Catalog duplicate-similarity check clean

Checklist (reviewer judgement, evaluated in /rivet review):
- [ ] All states above are implemented and visually distinct
- [ ] Responsive behavior matches spec at declared breakpoints
- [ ] No absolute-ban violations (shared + register + surface)
- [ ] prefers-reduced-motion respected
- [ ] Copy matches exact strings above
- [ ] Passes AI slop test
```

**Either `reuse:` OR `new_primitive:` is REQUIRED** on every UI task — enforced in-loop during generation:

1. Construct the Design Spec for the task, including `reuse:` or `new_primitive:`.
2. Validate immediately: at least one of the two fields is populated?
3. If yes → continue to the next task.
4. If no → this is a "planner miss." Regenerate **only this task** with an explicit prompt: *"Task {id}: missed `reuse:` / `new_primitive:`. Component catalog is at `docs/plans/{spec}/{phase}/component-catalog.md`, surface `{surface}` entries: {list top 5 active catalog entries}. Choose: (a) add `reuse:` pointing at an existing catalog entry by path, or (b) add `new_primitive:` with name + path + reason explaining why no catalog entry fits."*
5. **Cap retries at 2 per task.** After 2 failed attempts, escalate via `AskUserQuestion`: "Task {id}: `{task.title}` couldn't be enriched. {specific diagnostic — e.g., 'touches `/pricing` which doesn't match any surface in PRODUCT.md's ## Surfaces'}. Options: [A] Pick a surface from {list}, [B] Add a new surface to PRODUCT.md (I'll update it), [C] Skip design enrichment for this task (ui: false)."
6. Only when every UI task has valid enrichment → write all sub-plan files to disk.

Validate during generation (fail-fast per-task) rather than post-hoc (which would force regenerating the whole plan when one task is bad).

### 6.4 Design extends escape hatch

If the planner can see from the brief that a task genuinely needs a token value DESIGN.md doesn't have (e.g., a new spacing step for a one-off hero), the task's frontmatter may include:

```yaml
design_extends:
  spacing.xxl: "96px"
  reason: "Hero needs vertical breathing room beyond the standard 64px lg step; 96px aligns with the 8px grid."
```

`/rivet run` Stage 2 handles the extension: before running Design Token Lint, it merges the extends into DESIGN.md, invalidates hashes, and re-runs lint. See run.md Stage 2 for the flow. Without this escape hatch, lint becomes a trap; with it, new token needs go through a reviewable path instead of being smuggled as hardcoded values.

### 6.5 Idempotency

- **Re-run with no args:** skips tasks that already have `### Design Spec`.
- **`--refresh`:** for each surface in `design_hashes`, recompute `product_hash`, `ref_sha`, `canonical_sha`, and `override_sha` (if override exists). Handle each drift case:
  - `product_hash` or `ref_sha` changed → regenerate canonical brief at `docs/design/brief-{surface}.md`. Re-enrich all non-done UI tasks in that surface. Done-task specs tagged `design_stale: true` (don't rewrite bodies).
  - `canonical_sha` changed but ref/product didn't → user manually edited the canonical brief. Warn, then re-enrich non-done tasks in that surface.
  - `override_sha` changed → user edited the override. Re-enrich non-done tasks in that surface only.
  - Nothing changed → skip.
- **`regenerate sub-plan N`:** preserves tasks with `origin: audit` or `origin: review` in their frontmatter by default. Warn the user if regenerating a sub-plan that contains either — `audit` tasks represent verification-driven follow-up work, `review` tasks trace back to a specific review file (preserve `review_source` so the lineage stays intact).

### 6.6 Skip-with-note cases

- `PRODUCT.md` or `DESIGN.md` missing → one-line note in Step 7 summary (text above).
- No `ui: true` tasks → skip silently.
- `## Surfaces` missing → single-surface fallback: all UI tasks get `surface: default`, canonical brief at `docs/design/brief-default.md`, optional override at `docs/plans/{spec}/{phase-id}/design-brief.md`, `design_hashes.default.design_ref: DESIGN.md`.

### 6.7 Final plan validation sweep

After all sub-plan files are written to disk, run one last sanity sweep before returning success:

- Every `ui: true` task has a `### Design Spec` section → else halt with `Plan validation failed: task {id} in {sub-plan-file} is marked ui:true but has no Design Spec`.
- Every task's `reuse:` entry points at a catalog path whose `status` in `component-catalog.md` is NOT `deprecated` or `do-not-reuse` → else halt.
- Every surface referenced in task frontmatter exists in PRODUCT.md's `## Surfaces` section (or `surface: default` if no `## Surfaces`) → else halt.
- `design_hashes` frontmatter covers every surface used by at least one UI task in the sub-plan → else halt.

This is a belt-and-suspenders check against the in-loop validation in 6.3. If 6.3 worked correctly, 6.7 is silent. If 6.7 ever fires, it means 6.3 has a bug worth reporting — surface the exact assertion that failed.

---

## Run — Sub-Plan Design Verification

Used by `run.md` after all sub-plan tasks complete and the full test suite passes — but BEFORE offering the Sub-Plan Transitions menu. Skip this entire block if any of:

- `/rivet run` was invoked with `--skip-verify`, OR
- the sub-plan contained zero `ui: true` tasks, OR
- `PRODUCT.md` or `DESIGN.md` is missing at the project root, OR
- the [impeccable](https://github.com/pbakaus/impeccable) skill is not installed at `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/` (in which case emit a one-line note: `Design verification skipped: impeccable not found. Install at ~/.agents/skills/impeccable/ or set $IMPECCABLE_DIR.`).

When running, print the banner once per session:

> `Running design verification… use '--skip-verify' on /rivet run to opt out next time.`

**1. Group UI tasks by `surface`.** Each surface gets its own verification pass so admin findings don't pollute marketing findings.

**2. For each surface group, in parallel:**

Read the impeccable references fresh:
- `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/SKILL.md` (shared laws)
- Register ref — `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/reference/brand.md` OR `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/reference/product.md` (based on the surface's resolved `register`)
- `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/reference/audit.md`
- `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/reference/critique.md`
- `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/reference/harden.md`

Dispatch three subagents in parallel (see "Parallel Dispatch" section above for the tool-call pattern). Each subagent's prompt includes:
- Scope: the changed files belonging to this surface in the sub-plan
- The surface's composed brief via `load_brief(surface)`: read `docs/design/brief-{surface}.md` (canonical, project-wide) + optional `docs/plans/{spec}/{phase}/design-brief-{surface}.md` (per-phase override) composed together — override sections append, override tokens overlay. See plan.md Step 6.2 for the protocol. For ad-hoc runs, the override path is `docs/plans/adhoc/{name}/design-brief-{surface}.md`.
- Each task's Design Spec verbatim
- The single impeccable reference it should follow:
   - Audit subagent → `audit.md`. Produces P0–P3 technical findings (a11y, perf, theming, responsive, anti-patterns).
   - Critique subagent → `critique.md`. Produces UX heuristic scoring + persona-based checks.
   - Harden subagent → `harden.md`. Produces edge-case findings (i18n, overflow, long text, big data, errors).

**3. Merge findings across all surfaces.** Group by severity P0 / P1 / P2 / P3. Count by category.

**4. Polish gate.** If the merged result has zero P0 and zero P1 across the whole sub-plan, dispatch one polish subagent per surface reading `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/reference/polish.md` against the same scope. If any P0/P1 exists, skip polish — running polish while real issues are outstanding buries the micro-findings.

**5. Optimize gate.** If any task in the sub-plan touched list rendering, tables, charts, animation loops, or heavy imports (check task file paths and `optimize`-trigger keywords in task descriptions), dispatch an optimize subagent reading `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/reference/optimize.md`.

**6. Report to the user:**

```
Sub-plan verification — {sub-plan-name}
  Audit:    {a0} P0, {a1} P1, {a2} P2, {a3} P3  ({per-surface breakdown if multi-surface})
  Critique: score {s}/20 — "{top-line summary}"
  Harden:   {h0} P0, {h1} P1, ...
  Polish:   {status — "ran" or "skipped (P0/P1 present)"}
  Optimize: {status — "ran" or "not triggered"}

Next actions:
  1. Accept all P0/P1 → appended as new tasks to this sub-plan (status: pending, origin: audit)
  2. Review findings individually
  3. Skip (continue to next sub-plan without addressing — P0/P1 items will resurface in /rivet review)
```

**7. On "Accept":** For each P0 and P1 finding, append a new task entry to the current sub-plan's YAML frontmatter:

```yaml
  - id: {max(id) + 1}
    title: "{finding summary}"
    status: pending
    origin: audit                     # flag so /rivet plan regenerate preserves it
    depends_on: [{id of task that produced the flagged file}]
    files: [{flagged file paths}]
    ui: true
    surface: {surface from parent}
    register: {register from parent}
    ui_commands: [{refiner for the finding category — e.g., 'harden' for harden findings, 'layout' for hierarchy findings}]
```

Also append a `### Task N` section to the body with the finding details and suggested fix. Tasks with `origin: audit` are executed the same way as regular tasks — the normal Stage 2 chain applies.

P2 / P3 findings are presented as suggestions only — not auto-appended. User can choose to add specific ones.

---

## Review — Design System Compliance (Point 17)

Used by `review.md` Step 4 Point 17. Adds the additional gate: at least one frontend file in scope.

*Skip this point entirely if no frontend files are in scope.*

**Trigger:** ALL of the following hold:
- the review scope contains at least one `.tsx`, `.jsx`, `.vue`, `.svelte`, `.astro`, or `.blade.php` view file (or any other HTML-templating view file)
- both `PRODUCT.md` and `DESIGN.md` exist at the project root
- the [impeccable](https://github.com/pbakaus/impeccable) skill is installed at `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/`

If any condition fails, emit a one-line note in the review report (`Point 17 skipped: <reason>.`) and complete the review with points 1–16 only.

When triggered:

1. **Mechanical token lint.** For each frontend file in scope, resolve its surface (match file path against `PRODUCT.md`'s `## Surfaces` routes; default if absent), then run:

   ```bash
   node ${CLAUDE_SKILL_DIR}/scripts/design-lint.mjs \
     --design <surface design_ref> \
     --files <in-scope files for that surface>
   ```

   Any violations become **P1** findings (hardcoded hex, off-scale px/rem, unknown font-family).

2. **Resolve the brief for each surface.** Group the in-scope files by surface. For each surface, resolve a brief using this chain and cache for the duration of this review:

   ```
   a. If docs/design/brief-{surface}.md exists → use it (canonical, gap-1 design).
      If a phase-specific override docs/plans/{phase}/design-brief-{surface}.md is locatable
      (review scope covers one phase), compose override on top.
   b. Else if docs/plans/{phase}/design-brief-{surface}.md exists → use it.
   c. Else → derive on-the-fly:
        - Read PRODUCT.md (voice, register, anti-references)
        - Read the surface's design_ref (DESIGN.md or DESIGN-{surface}.md)
        - Construct a minimal brief in memory: tokens + voice_overlay + register bans
          + impeccable absolute bans (from ${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/SKILL.md)
        - Note: source = "derived"
   ```

   Track each surface's brief source and hashes. Findings report MUST include:

   ```
   Surface: {surface}
   Brief source: canonical | canonical+override | phase-override | derived
   product_hash: <sha>
   design_hash: <sha of resolved design_ref>
   ```

   When source = `derived`, add this line to the findings section:

   > Context was derived on the fly — no persistent brief exists for surface `{surface}`. Consider running `/rivet plan {phase}` to capture a canonical brief for future consistency.

3. **Audit + critique via impeccable references.** For each surface group, dispatch two subagents in parallel with scope = those files + the resolved brief from step 2 + PRODUCT.md + the surface's DESIGN file:

   - Audit subagent — reads `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/reference/audit.md`. Technical checks (a11y, perf, theming, responsive, anti-patterns). Returns P0–P3 findings.
   - Critique subagent — reads `${IMPECCABLE_DIR:-~/.agents/skills/impeccable}/reference/critique.md`. UX heuristic + persona scoring. Returns P0–P3 findings.

4. **Merge.** Fold all findings into this review's findings list under a `Design System Compliance` subheading, preserving the same P0–P3 severity format used by points 1–16. Do not duplicate findings already raised by points 1–16 — if point 4 already flagged a validation gap the audit would also catch, keep only the point-4 entry.

If the trigger doesn't fire (no frontend files in scope, or PRODUCT.md / DESIGN.md missing), note it in the "Passed Clean" section as `17. Design System Compliance — N/A ({reason})`. Do not hard-fail the review when design files are missing; treat it as non-applicable.
