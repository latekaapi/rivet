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

## Step 2: Route — Spec Phase, Ad-Hoc Task, Refresh, or Regenerate

### Argument parsing (first, before any guard)

Let `spec_files` = the list of `{name, path}` pairs collected in Step 1's spec discovery. Let `spec_names` = the names from that list. Let `args` = `$ARGUMENTS` with the `plan` subcommand word already stripped.

```
first = args[0]
if first in spec_names:
    spec  = first
    rest = args[1:]
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

### Guard: plans already exist for this target

After parsing, in spec mode: check whether `docs/plans/{spec}/{phase}/` already exists with non-empty content. In ad-hoc mode: check `docs/plans/adhoc/{slug}.md` and `docs/plans/adhoc/{slug}/`. If a match exists and the user did NOT pass `--refresh` or `regenerate sub-plan N`:

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
    # Origin tag (set to 'audit' for tasks injected by post-sub-plan verification)
    # origin: audit
    # depends_on may point back at the UI task that produced a flagged file
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

**Step 2: Run test — verify it fails**

Run: `php artisan test --filter=SiteFetcherTest`
Expected: FAIL — class `App\Services\SiteFetcher` not found

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

**Step 4: Run test — verify it passes**

Run: `php artisan test --filter=SiteFetcherTest`
Expected: PASS

**Step 5: Commit (one commit per task — test + impl together)**

​```bash
git add app/Services/SiteFetcher.php tests/Unit/SiteFetcherTest.php
git commit -m "feat: add SiteFetcher with homepage extraction (task N)"
​```

Include the task id in the commit subject so rollback can match commits to tasks when resetting. One task = one commit. Do not stage test and implementation into separate commits — the red-green-refactor happens within a single commit. Sub-plan-level squashing is offered at sub-plan completion ([run.md](run.md)).

#### Alternative stack shape — same TDD structure, TypeScript/Vitest

The Laravel example above is not prescriptive — plans adopt whatever stack and test runner the target project uses. Same task, TypeScript shape:

**Step 1: Write the failing test**

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

**Step 2: Run test — verify it fails:** `npx vitest run site-fetcher` → FAIL (module not found).
**Step 3: Write minimal implementation** at `src/services/site-fetcher.ts`.
**Step 4: Run test — verify it passes:** `npx vitest run site-fetcher` → PASS.
**Step 5: Commit** — `git add src/services/site-fetcher.ts src/services/__tests__/site-fetcher.test.ts && git commit -m "feat: add SiteFetcher with homepage extraction (task N)"`.

Pick the test runner the project already uses (`pytest`, `go test`, `cargo test`, `bundle exec rspec`, `php artisan test`, etc.). The TDD shape — failing test, verify fail, minimal impl, verify pass, single commit — is invariant; only the commands change.

---

### Task 2: {Next Task}
[Same structure]

---

## Session Log

(Updated during execution — leave empty at generation time)
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
3. **Exact test commands** with expected output — not "run the tests," instead the project's actual test invocation with a filter (`npx vitest run site-fetcher`, `pytest -k site_fetcher`, `php artisan test --filter=SiteFetcherTest`, etc.) and the expected PASS/FAIL state.
4. **Exact git commands** — not "commit your changes," instead the full `git add` + `git commit -m "..."` with a conventional commit message
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

## Step 6: Design Enrichment (UI tasks only, requires impeccable)

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
- **`regenerate sub-plan N`:** preserves tasks with `origin: audit` in their frontmatter by default. Warn the user if regenerating a sub-plan that contains `origin: audit` tasks — they represent verification-driven follow-up work.

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

## Step 7: Summary

After generating all plans, present:

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
