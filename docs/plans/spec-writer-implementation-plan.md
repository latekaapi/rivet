# Implementation Plan: `/rivet spec`

**Repo:** github.com/latekaapi/rivet
**Goal:** Add a `/rivet spec` subcommand that takes a braindump (or attached file, or conversation context, or existing draft) and produces `docs/specs/{name}.md` — a strategic execution document that `/rivet plan` then consumes.

This plan is for execution inside Claude Code. Each phase is a clean unit of work that can be reviewed and committed before moving on.

---

## Design summary

- **Single command, three internal phases.** `/rivet spec` runs Validation → Architecture → Synthesis. A `Status:` field in the output tracks progression: `Validating | Validated | Architecting | Drafting | Complete | Killed | Pivoted`.
- **One output file per spec.** `docs/specs/{name}.md`. Plus a separate research file `docs/specs/{name}-research.md` for raw findings.
- **Two modes.** `--lite` (small bet, briefer) and `--deep` (default).
- **Soft quality gates.** Flag issues; let user proceed with `--force`. Bypassed gates recorded in the spec itself.
- **Auto-detect attached files.** Step 0a resolves input from 5 sources before classification. `--from <file>` is the explicit form.
- **Multi-spec is first-class.** Step 0c can decompose a braindump into multiple specs (`extension.md`, `backend.md`).
- **Rigor moves baked in.** Four-register assumption tracking (Facts / Assumptions / Open Questions / Risks), kill criteria with dates, bet sizing, opposition register from adversarial pass, decisions-deferred register.
- **Capabilities primary, phases derived.** The spec describes capabilities; phases are a projection that `/rivet plan` consumes.
- **Refresh is additive.** `--refresh` tightens, doesn't rewrite.

---

## Repo structure changes

```
rivet/
├── SKILL.md                          ← UPDATE: register /rivet spec in router
├── plan.md                           ← existing, unchanged
├── run.md                            ← existing, unchanged
├── review.md                         ← existing, unchanged
├── status.md                         ← existing, unchanged
├── learnings.md                      ← existing, unchanged
├── verify.md                         ← existing, unchanged
├── spec.md                           ← NEW: the /rivet spec algorithm
├── README.md                         ← UPDATE: add §4.0 for /rivet spec
├── references/                       ← NEW folder
│   ├── question-frameworks.md        (question banks per phase + decision type)
│   ├── research-playbook.md          (how to scope competitive + tech research)
│   ├── decision-categories.md        (pricing, stack, GTM, data, moat)
│   ├── quality-rubric.md             ("unit tests for English" scoring)
│   ├── decision-log-format.md        (decisions-made + decisions-deferred)
│   └── assumption-register-format.md (the four-register pattern in detail)
├── examples/                         ← NEW folder
│   ├── headturn-spec.md              (anchor: deep mode output)
│   └── socialpilot-spec.md           (anchor: second pattern — deferred until SocialPilot PRD shared)
└── scripts/                          ← existing, unchanged
```

---

## Phase 0: Pre-flight

Before writing anything, calibrate against rivet's existing patterns.

1. Read `rivet/plan.md` and `rivet/run.md` end-to-end. Match their:
   - Heading hierarchy
   - Tone (terse, operational, command-style)
   - Pre-flight checks pattern
   - Argument-shape table format
   - Edge case section pattern
2. Read `rivet/SKILL.md` to understand how the router lists subcommands.
3. Read `rivet/README.md` §1-3 for document tone.
4. Confirm rivet's spec discovery rule: "List `docs/specs/*.md`. Every match is a spec; basename is the name."

Output: a 1-pager mental note (no file) capturing the style elements to mirror. Estimated: 15 minutes.

---

## Phase 1: Draft `spec.md`

The core file. Estimated final size: 900-1100 lines.

### 1.1 — Frontmatter and intro

```yaml
---
name: rivet-spec
description: Produce a strategic execution document from a braindump, attached file, conversation context, or existing draft. Output: docs/specs/{name}.md with progressive depth — validation rigor (assumption registers, kill criteria, bet sizing) followed by architecture decisions, capabilities, and phase plan that /rivet plan consumes. Soft quality gates; multi-spec capable; refresh-friendly.
---
```

Intro section (3-4 paragraphs):
- What `/rivet spec` produces and why it's the entry point to the rivet pipeline
- Three internal phases (Validation → Architecture → Synthesis) with status field tracking
- Soft gates philosophy
- Relationship to `/rivet plan` downstream

### 1.2 — Argument shapes table

| Form | Behavior |
| --- | --- |
| `<braindump>` | Inline text. Default `--deep`, default name `main`. |
| `--from <file>` | Explicit file input. Auto-detection of attached files happens regardless. |
| (no args) | Synthesize from conversation context. No clarification interview. |
| `{name}` | Look for existing `docs/specs/{name}.md`. If exists → continue from current `Status:`. If not → treat `{name}` as a name override. |
| `{name} --refresh` | Re-validate stale assumptions, re-research, re-score. Additive, not destructive. |
| `--lite` / `--deep` | Bet size; both have full rigor. |
| `--force` | Bypass quality gates. Bypasses recorded in spec. |
| `--name <n>` | Override default name. |

Argument parser is NL-tolerant: `/rivet spec from braindump.md` and `/rivet spec refresh main` both work.

### 1.3 — Step 0: Intake & classification

**Step 0a — Resolve input source** (5 sources, priority-ordered):

| # | Source | Detection | Action |
| --- | --- | --- | --- |
| 1 | `--from <file>` | Explicit flag | `Read` file. Use as primary input. |
| 2 | `{name}` of existing spec | `docs/specs/{name}.md` exists | Read existing. Continue from current `Status:`. |
| 3 | Attached file in client | Path tokens (`./`, `/`, `~/`, `@file`), markdown links to `.md/.txt/.pdf/.docx`, attachment markers like `[Attached: ...]` | `Read` file. Use as primary input. Inline text becomes additional context. |
| 4 | Inline braindump | Message body has substantive content | Use message body. |
| 5 | Conversation context | Empty body, recent conversation has bet discussion | Synthesize. Skip clarification interview. |

Path-detection patterns: tokens matching `./`, `/`, `~/`, `file://` at start of a path-shaped string; markdown links to `.md/.txt/.pdf/.docx`; `@file` references; client attachment markers; user phrases ("attached", "see the file", "uploaded").

Conflict resolution rules:
- `--from` beats attached file (explicit beats implicit)
- Attached file beats inline text (file is primary, text becomes context)
- Multiple attached files → ask, don't guess
- Failed `Read` → tell user, request correct path

Announce resolution in one line:
> *"Reading from `braindump.md` (attached). Treating its contents as the braindump."*
> *"Existing spec at `docs/specs/main.md`, status: `Validated`. Continuing from architecture phase."*

**Step 0b — Classify input** (when source is file or inline):

| Type | Signals | Path |
| --- | --- | --- |
| Raw braindump | <500 words, no headings, no citations | Full clarification flow |
| Structured external doc | >1500 words, has H2 headings + evidence/persona/success criteria | Audit, gap-analyze, ask only about gaps |

Include classification heuristic pseudo-code (word count, heading detection, evidence markers, success criteria markers, target user markers → classification).

If conversation context (Source 5), skip Step 1 quality gate and Step 2 clarification — go straight to bet framing in Step 3.

**Step 0c — Scope assessment** (multi-spec gate):

Scan for independent subsystems:
- Different audiences (e.g., end-users vs developers)
- Different deployment surfaces (e.g., Chrome extension vs backend API)
- Different release cadences
- Different revenue logic

If detected, propose decomposition:
> *"I see two independent products: a Chrome extension and a backend API. They have different release cycles. Proposed names: `extension`, `backend`. Treat as one spec or split? (one / split)"*

Default to one spec. Splitting is opt-in (avoids fragmenting bets that should be unified).

### 1.4 — Phase 1: Validation

Sub-steps (each gets its own H3 in `spec.md`):

1. **Quality gate** — soft, with `--force` bypass. Four criteria:
   - Target customer named (concrete, not "small businesses")
   - Problem concrete (falsifiable, not "X is broken")
   - At least one demand signal cited (Reddit thread, customer convo, analogous tool's growth, search trend)
   - Outcome named (measurable, not "improve X")

   Failure path: list missing items, give 3 options (fill gaps now / proceed with warnings / stop). Bypassed gates → `## Low-Confidence Warnings` section near top of spec.

2. **Clarification** — borrowed from obra/superpowers brainstorming:
   - One question at a time, never batches
   - Multiple choice when possible
   - Always offer "Other / I'm not sure / Skip"
   - Stop when next question wouldn't change the spec
   - Aim 4-8 questions in `--deep`, 2-3 in `--lite`

3. **Bet framing** — standard hypothesis format, required:
   ```
   ## The Bet

   We believe that [target customer]
   will [desired action / outcome]
   because [reason / underlying belief].

   We'll know we're right if [observable, measurable signal].
   We'll know we're wrong if [falsifiable failure condition].

   The unfair advantage we're betting on is [moat / asymmetry].
   ```

   Any clause that can't be filled concretely becomes an entry in the assumption register.

4. **Four-register extraction** — the spine of validation:
   - **Known Facts (F)** — verified, with citations and dates
   - **Stated Assumptions (A)** — believed but unverified, with validation method + deadline
   - **Open Questions (O)** — deferred decisions, with trigger conditions + owner
   - **Risks (R)** — acknowledged unknowns, with mitigations or explicit acceptance

   Format details in `references/assumption-register-format.md`.

5. **Bounded competitive scout** — parallel subagents with budgets:

   | Area | Budget | Output |
   | --- | --- | --- |
   | Direct competitors (5-10) | 5-8 searches | Per-competitor card: pricing, positioning, 3 strengths, 3 weaknesses, "what they don't do" |
   | Pricing benchmarks | 3-5 searches | Comparison table |
   | Tech / API options | 3-5 per major component | Decision matrix |
   | Adjacent threats | 2-3 searches | Threat list |
   | Distribution channels | 2-3 searches | Channel list with effort/return |

   Subagent dispatch pattern: each gets one specific question, one search budget, one output spec. Coordinator writes to `docs/specs/{name}-research.md`.

   Critical rule: research findings must update assumption registers. Confirmed → Facts. Invalidated → Risks (with note). New unknowns → Assumptions or Risks.

6. **Falsifiability — kill criteria**: required ≥3 in deep, ≥1 in lite:
   ```
   | # | Condition | Checkpoint | What we'll do |
   ```
   Every condition observable, every condition has a date, every condition has a response.

7. **Bet sizing & opportunity cost** — required table:
   - Time to validate (cheapest test)
   - Time to MVP if validated
   - Out-of-pocket cost to validate
   - Out-of-pocket cost to MVP
   - Founder time commitment
   - Opportunity cost (what else could that time build?)

   Plus reversibility analysis per major decision (one-way vs two-way doors).

8. **Adversarial pass** — hostile-critic subagent:
   ```
   You are a skeptical senior engineer / former founder. Surface 5-10 sharp,
   ranked objections a board or skeptical co-founder would raise. For each:
   why it matters, recommended response, what the author should do (more
   research / change the bet / kill / accept the risk explicitly).
   Do not be polite. Do not soften.
   ```
   Output appended as `## Opposition Register`.

9. **Co-founder alignment** — optional. If `PRODUCT.md` lists multiple authors or user mentions co-founder, prompt for disagreements/deferred-discussions.

**End of Phase 1: stop point.** Spec gets a recommendation:
- **Proceed to architecture** → continue to Phase 2 in same run
- **Validate first** → write spec at this depth, set `Status: Validated`, exit. User runs validation IRL, returns with `--refresh`.
- **Pivot** → suggest pivot direction, set `Status: Pivoting`, exit.
- **Kill** → document why, set `Status: Killed`, exit. Spec still useful for learning.

Recommendation lives at the top of the spec, not buried.

### 1.5 — Phase 2: Architecture

Once validation clears (status: `Architecting`):

1. **Architecture approach proposals** — always 2-3 alternatives with explicit tradeoffs. User picks. Don't propose one.
2. **Bounded research per component** — parallel subagents. Budgets per major component.
3. **Architecture decisions** — logged using format in `references/decision-log-format.md`. Each: alternatives considered, why X won, who decided, date, reversibility, trigger to revisit.
4. **Capabilities decomposition** — primary structure. Each capability:
   - Name + description
   - Who it serves
   - Success criterion
   - `depends-on:` links to other capabilities and to assumption-register entries
5. **Pricing strategy** — required first-class section. Tier structure, anchor pricing, what's included, what's add-on. Cite competitive benchmarks from Phase 1 research.
6. **Go-to-market** — required first-class section. Channels, sequencing, viral hooks, content strategy.
7. **Operating model** — team & expertise, what each founder owns, what's missing, what happens if one is offline.
8. **Non-goals** — required ≥3. Refuse to write spec without explicit non-goals listed. Each with reasoning.

### 1.6 — Phase 3: Synthesis

Compose the deliverable:

1. **Phase projection** — derive build phases from capabilities. Each phase: name, scope (capability links), success criteria, estimated time, dependencies. This is what `/rivet plan` consumes — must produce `## Phase N` headings.
2. **Cross-spec dependency surfacing** — if multi-spec, explicitly name dependencies between specs ("Phase 2 of `extension` depends on `backend` Phase 1 shipping `/scan` endpoint").
3. **Traceability links** — every phase line links back to source capability, supporting research, supporting assumption(s). Use markdown anchors.
4. **Diagrams (Mermaid)** — at minimum: system architecture, user journey. Embedded inline.
5. **Hygiene self-review** — separate subagent (not the adversarial one). Checks: placeholders, contradictions, missing required sections, vague evidence, scope creep. Mechanical fixes inline; judgment calls surfaced.
6. **Quality scoring** — rubric per dimension (0-3 scale), pass thresholds, score reported. Rubric in `references/quality-rubric.md`.
7. **Status set** — `Complete` if all gates passed; `Drafting` if user wants to iterate.

### 1.7 — Output structure

`docs/specs/{name}.md`:

```markdown
# Spec: {Name}

**Status:** Validating | Validated | Architecting | Drafting | Complete | Killed | Pivoted
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD
**Authors:** ...
**Mode:** lite | deep
**Quality score:** N/M

## Recommendation (if not yet Complete)

[Verdict + rationale + next step instruction]

## Low-Confidence Warnings (if any)

[Bypassed gate criteria + what fixing them would look like]

---

## Phase 1: Validation

### The Bet
### Registers
  ### Known Facts
  ### Stated Assumptions
  ### Open Questions
  ### Risks
### Competitive Landscape
### Kill Criteria
### Bet Sizing
### Opposition Register
### Co-founder Alignment (if applicable)

---

## Phase 2: Architecture

### Approach Decisions
### Capabilities
### Pricing
### Go-to-Market
### Operating Model
### Non-Goals

---

## Phase 3: Build Plan

### Phase 0
### Phase 1
### Phase 2
...
### Cross-Spec Dependencies (if multi-spec)
### Diagrams

---

## Decision Log
### Decisions Made
### Decisions Deferred

---

## Notes
```

Plus separate research file: `docs/specs/{name}-research.md` with raw findings citable from main spec.

### 1.8 — Pre-flight checks

Same shape as `/rivet plan` Step 0:
1. Working tree clean? Warn if dirty.
2. Existing spec? If exists and not `--refresh`, read its `Status:` field, ask user if they want to continue from there.
3. Project context loaded? Read `CLAUDE.md`, `PRODUCT.md` if present — particularly authors and existing product surfaces.

### 1.9 — Refresh semantics

`/rivet spec {name} --refresh`:

1. Read existing `docs/specs/{name}.md` and `{name}-research.md`.
2. Decisions register stays. No re-litigation unless user flags.
3. Research older than 4 weeks → re-fetch (parallel subagents, scoped to stale areas).
4. Each Assumption (A) entry → user "still true / validated / invalidated" pass:
   - Validated → move to Facts
   - Invalidated → move to Risks (with note: "previously assumed, disproven by ...")
   - Still believed → keep
5. Kill criteria with past dates → checkpoint review. Triggered → recommendation pivots to Kill or Pivot.
6. Quality score recomputed.
7. Status field may advance (e.g., Validated → Architecting if user provides validation evidence inline).

The refresh is additive by default. If user wants a rewrite, they delete the spec file and start fresh.

### 1.10 — Edge cases

- **"I attached a file in Claude Code / VS Code — does it just work?"** → Yes. Step 0a auto-detects.
- **"My braindump is 5 words long."** → Quality gate fails. Can `--force` but spec will be 90% warnings.
- **"I'm already mid-build, why a spec?"** → Run with existing PRD as `--from`. Catches missed assumptions, surfaces kill criteria.
- **"Internal tool, not a product."** → Skip customer-evidence sections; keep rigor; adapt language ("users" → "team", "customers" → "stakeholders").
- **"I want to spec two products together."** → Step 0c handles. Default unified, opt-in split.
- **"I ran validation, recommendation was 'validate first.' Now what?"** → Spec at `Status: Validated`. Run validation IRL. Return with `/rivet spec {name} --refresh` and append evidence inline or via `--from validation-results.md`.
- **"Capability X depends on a different spec's Phase 2."** → Step 1.6.2 handles. Document the cross-spec dependency explicitly.

### 1.11 — Recommended model

Use Opus-class. `/rivet spec` is a thinking task, not execution. Cheaper models produce specs that look right but miss the assumptions that matter.

### 1.12 — Next: /rivet plan

Closing section:
```
After /rivet spec completes (status: Complete):
  /rivet plan {name} phase-0
```

---

## Phase 2: Draft `references/` files

Each shorter than `spec.md` (200-400 lines).

### 2.1 — `question-frameworks.md`

Question banks per phase + decision type. Categories:

- **Bet shape** — "What's the smallest version that proves this works?"
- **Audience** — "Name 2-3 people you've talked to about this."
- **Demand evidence** — "What's the strongest piece of evidence this is wanted?"
- **Constraints** — time, money, dependencies
- **Opportunity cost** — "If not this, what would you build?"
- **Moat** — "If a well-resourced competitor copies this in 6 months, what's left?"
- **Reversibility** — one-way vs two-way doors
- **Architecture tradeoffs** — build vs buy, sync vs async, monolith vs services
- **Pricing** — anchor competitor's price, who pays (user vs company)
- **GTM** — where the audience congregates, viral hooks

For each question: when to ask, what answers to listen for, follow-up if vague.

### 2.2 — `research-playbook.md`

How to scope competitive and tech research without spiraling. Per-area budgets, output formats, "done" criteria.

Subagent dispatch pattern documented: each subagent gets one specific question, one budget, one output spec. The rule that findings must feed back into registers.

### 2.3 — `decision-categories.md`

Decision types `/rivet spec` should expect to encounter, grouped:

- **Stack** — language, framework, hosting, database, queue, cache
- **Data sources** — APIs, scrapers, integrations, fallbacks
- **Pricing** — tier structure, anchor price, add-ons, free tier
- **GTM** — primary channel, viral hook, content strategy, paid vs organic
- **Architecture** — monolith vs services, sync vs async, multi-tenant vs single
- **Moat** — OSS, network effects, brand, distribution, integrations
- **Operating** — team structure, expertise gaps, on-call

Per category: typical tradeoffs, when each option wins, what to research before deciding.

### 2.4 — `quality-rubric.md`

Per-dimension 0-3 scoring:

| Dimension | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| Bet statement falsifiable | Vague | Has outcome | Has measurable signal | Fully falsifiable with date |
| Target customer named | Abstract | Segment | Persona with detail | Persona + named real people |
| Demand signals cited | None | Anecdotal | One verifiable signal | Multiple verifiable |
| Assumption register | None | Some assumptions | All four registers populated | All four + validation methods + deadlines |
| Kill criteria | None | Conditions named | + dates | + dates + responses |
| Bet sizing | None | Some costs | Full table | + reversibility analysis |
| Opposition register | None | <3 objections | ≥5 ranked | ≥5 ranked + responses |
| Architecture decisions logged | None | Listed | + alternatives | + alternatives + rationale + date |
| Capabilities decomposed | None | Listed | + linked to assumptions | + success criteria each |
| Non-goals | None | <3 | ≥3 | ≥3 + reasoning |

Pass thresholds:
- Deep: ≥2 on every dimension
- Lite: ≥1 on every dimension, ≥2 on bet statement and target customer

(Calibrate via Phase 5 smoke test against HeadTurn — tighten or loosen based on whether HeadTurn scores feel right.)

### 2.5 — `decision-log-format.md`

The two-register pattern.

**Decisions Made**:
```
### D1: <decision>
- **Date:** YYYY-MM-DD
- **Decided by:** ...
- **Alternatives considered:** ...
- **Why X won:** ...
- **Reversibility:** one-way / two-way
- **Trigger to revisit:** (optional)
```

**Decisions Deferred**:
```
### O1: <open question>
- **Why deferred:** ...
- **Trigger to revisit:** ...
- **Owner:** ...
- **Default if forced:** ...
```

### 2.6 — `assumption-register-format.md`

The four-register pattern in detail. Per register: definition, format per entry, rules for moving entries between registers.

Critical rule: research findings must update registers. A research phase that doesn't update them wasn't useful.

---

## Phase 3: Examples

### 3.1 — `examples/headturn-spec.md`

Derive from `HeadTurn_PRD_v1_9.md`. Restructure into the new format:
- Front matter with status, mode, quality score
- Phase 1 sections (extract bet, registers, kill criteria from existing PRD content)
- Phase 2 sections (architecture decisions, capabilities, pricing, GTM, operating, non-goals)
- Phase 3 sections (phase projection, dependencies, diagrams)
- Decision log

Dual purpose: calibration anchor *and* smoke test. If HeadTurn doesn't fit cleanly into the new format, the format needs adjusting.

### 3.2 — `examples/socialpilot-spec.md`

Deferred until SocialPilot final PRD is shared. Add TODO note in README.

---

## Phase 4: Update `SKILL.md` and `README.md`

### 4.1 — `SKILL.md` router

Add `/rivet spec` entry. Match existing format (see how `/rivet plan` is registered).

### 4.2 — `README.md` §4.0

New section: "Spec creation with `/rivet spec`."

Subsections:
- What it does (3-4 sentences)
- Argument forms (condensed table)
- The three internal phases
- When to use deep vs lite
- File attachment behavior in Claude Code (auto-detected)
- How it interacts with `/rivet plan`
- Example commands (5-6 lines)

Target ~80-120 lines. `spec.md` is deep documentation; README is discoverability.

Renumber existing sections if needed.

---

## Phase 5: Smoke test

Before final PR:

1. **Self-test** — run `/rivet spec` mentally with HeadTurn as input. Does the algorithm produce the same shape as v1.9 PRD? (Phase 3.1 deliverable IS this test.)
2. **Verify `/rivet plan` integration** — `/rivet plan` looks for `## Phase N` headings. Confirm new spec format produces these.
3. **Run quality rubric on the example** — score should be ≥2 on every dimension. If not, fix the example or recalibrate the rubric.
4. **Test attached-file path** — drop a file into Claude Code and confirm Step 0a auto-detection works as documented.

---

## Commit strategy

| PR | Files | Why |
| --- | --- | --- |
| 1 | `spec.md` only | Core algorithm, reviewable in isolation |
| 2 | `references/*.md` | Supporting docs |
| 3 | `examples/headturn-spec.md` | Calibration anchor |
| 4 | `SKILL.md` + `README.md` | User-facing surfaces last |

Total estimated: 2-3 focused Claude Code sessions.

---

## What's deliberately not included

- **`scripts/` additions** — none for v1. The skill is markdown algorithms + reference docs. Quality scoring automation can come later.
- **Tests** — rivet doesn't have tests for existing markdown algorithms (they're prompts, not code).
- **Migration for existing rivet users** — no breaking changes. New command is purely additive.

---

## Open items (non-blocking)

1. **SocialPilot final PRD** — for `examples/socialpilot-spec.md`. Ship without; add later as PR 5.
2. **Quality rubric thresholds** — currently ≥2 (deep) / ≥1 (lite). Calibrate via Phase 5.

---

## Reference material to consult during implementation

- **rivet/plan.md and rivet/run.md** — for tone, depth, format mirror
- **HeadTurn_PRD_v1_9.md** — for "what good looks like"
- **mattpocock/skills `to-prd`** — for conversation-context synthesis pattern
- **obra/superpowers `brainstorming`** — for one-question-at-a-time, 2-3 approaches, scope assessment, self-review subagent
- **github/spec-kit `/speckit.checklist`** — for quality scoring rubric

---

## Final note

This plan is opinionated about depth. The whole point is matching HeadTurn-level rigor. If during implementation a section feels like overengineering for what `/rivet spec` actually does in practice, *cut it* — but log the cut in the PR description. Better to ship a leaner v1 and add rigor in v1.1 than ship a 1500-line `spec.md` that nobody reads.
