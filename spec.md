# /rivet spec — Strategic Execution Document

**Model guidance:** Use Opus-class. `/rivet spec` is a thinking task, not execution. Cheaper models produce specs that look right but miss the assumptions that matter.

`/rivet spec` is the entry point to the rivet pipeline. It takes a braindump (or attached file, or conversation context, or an existing draft) and produces a strategic execution document at `docs/specs/{name}.md` that `/rivet plan` then consumes phase-by-phase.

The output progresses through three internal phases — **Validation → Architecture → Synthesis** — tracked by a `Status:` field at the top of the spec (`Validating | Validated | Architecting | Drafting | Complete | Killed | Pivoted`). Earlier phases stay visible in the final document; the spec is a record of what was thought through, not just a build plan.

Quality gates are soft: missed criteria become warnings, not hard fails, and the user can `--force` past them. Bypassed gates are recorded in a `## Low-Confidence Warnings` block near the top of the spec — the next reader sees the gaps without having to re-derive them.

## Step 0: Pre-flight

Before any clarification interview or research dispatch, verify the working environment.

1. **Working tree clean?** Run `git status --porcelain`. A spec write is low-risk (one new markdown file, optionally one research file), so a dirty tree is not a blocker — but warn the user that `/rivet spec` will create files in `docs/specs/` and offer to abort if they have unrelated work in flight.

2. **Existing spec at the target name?** Compute the target name from arguments (see Step 1.0 for resolution). Then:
   - If `docs/specs/{name}.md` exists AND `--refresh` is set → jump to Step 6 (Refresh).
   - If `docs/specs/{name}.md` exists AND no `--refresh` → read its `Status:` field and offer four options: (1) continue from current phase (e.g. `Validated` → jump straight to Phase 2 / Architecture), (2) refresh (re-validate stale assumptions), (3) overwrite (delete and start fresh), (4) abort. Wait for the choice. Do not silently re-run validation on a `Complete` spec.
   - If `docs/specs/{name}.md` does not exist → continue.

3. **Read project context.** Skip any file that doesn't exist:
   - `CLAUDE.md` — domain vocabulary, architecture, project conventions.
   - `PRODUCT.md` — `register:`, `## Surfaces`, anti-references. Particularly the **authors** field (used in Step 2.9 co-founder alignment).
   - Existing `docs/specs/*.md` — the *names* and one-line summaries (read each spec's first 30 lines). Used in Step 4.2 (cross-spec dependency surfacing). Do not read full bodies.

4. **Confirm spec discovery rule.** Names are the basenames of `docs/specs/*.md`. Single-spec fallback (a bare `spec.md` at project root) is recognized for compatibility with `/rivet plan` but `/rivet spec` writes to `docs/specs/{name}.md` by default — never to root `spec.md`.

If any pre-flight check requires user input, wait before advancing.

## Step 1: Intake & Classification

`/rivet spec` accepts five input sources. Resolve them in priority order, then classify the input, then assess scope.

### 1.0 Argument shapes

Strip the `spec` subcommand word from `$ARGUMENTS`. Parse what remains:

| Form | Behavior |
|---|---|
| `<braindump>` | Inline text. Default mode `--deep`, default name `main` (or as inferred from content). |
| `--from <file>` | Explicit file input. Auto-detection of attached files in Step 1.1 still runs. |
| (no args) | Synthesize from conversation context. No clarification interview. |
| `{name}` | Look for existing `docs/specs/{name}.md`. If exists → continue from current `Status:` (Step 0.2). If not → treat `{name}` as a name override; proceed with intake. |
| `{name} --refresh` | Re-validate stale assumptions, re-research, re-score. Additive, not destructive. See Step 6. |
| `--lite` / `--deep` | Bet size; both have full rigor. `--lite` is briefer (smaller bets), `--deep` is the default. |
| `--force` | Bypass quality gates. Bypassed gates recorded in spec. |
| `--name <n>` | Override default name. |

The argument parser is NL-tolerant: `/rivet spec from braindump.md` and `/rivet spec refresh main` both work. When in doubt, ask — never silently substitute.

### 1.1 Resolve input source

Five sources, priority-ordered:

| # | Source | Detection | Action |
|---|---|---|---|
| 1 | `--from <file>` | Explicit flag | `Read` file. Use as primary input. |
| 2 | `{name}` of existing spec | `docs/specs/{name}.md` exists | Read existing. Branch handled by Step 0.2 (continue / refresh / overwrite / abort). |
| 3 | Attached file in client | Path tokens (`./`, `/`, `~/`, `@file`), markdown links to `.md/.txt/.pdf/.docx`, attachment markers like `[Attached: ...]` | `Read` file. Use as primary input. Inline text becomes additional context. |
| 4 | Inline braindump | Message body has substantive content (>20 words) | Use message body. |
| 5 | Conversation context | Empty body, recent conversation has bet discussion | Synthesize. Skip clarification interview. |

**Path-detection patterns** (Source 3):
- Tokens matching `./`, `/`, `~/`, `file://` at the start of a path-shaped string.
- Markdown links to `.md/.txt/.pdf/.docx`.
- `@file` references.
- Client attachment markers (e.g., `[Attached: path/to/file.md]`).
- User phrases ("attached", "see the file", "uploaded", "the doc I just shared").

**Conflict resolution rules:**
- `--from` beats attached file (explicit beats implicit).
- Attached file beats inline text (file is primary, text becomes additional context appended to the spec's `## Notes` section).
- Multiple attached files → ask which one is primary, never guess.
- Failed `Read` → tell the user the path that failed and the error, then request the correct path.

**Announce resolution in one line** before advancing:

> *"Reading from `braindump.md` (attached). Treating its contents as the braindump."*
> *"Existing spec at `docs/specs/main.md`, status: `Validated`. Continuing from architecture phase."*
> *"No input on the message line and no attached file. Synthesizing from the last 20 turns of conversation."*

### 1.2 Classify input

Run only when the source is a file or inline text (Source 1, 3, 4). Skip for Source 2 (existing spec — already structured) and Source 5 (conversation context — straight to bet framing in Step 2.3).

| Type | Signals | Path |
|---|---|---|
| Raw braindump | <500 words, no headings, no citations, no evidence markers | Full clarification flow (Step 2.2). |
| Structured external doc | >1500 words, has H2 headings AND at least one of: evidence/persona/success criteria | Audit + gap-analyze. Ask only about gaps. |
| Mid-stream | Between the two, or signals are mixed | Treat as braindump but skip clarification questions whose answers are already in the doc. |

Heuristic in pseudocode:

```
classify(text):
  word_count   = words(text)
  heading_count = count_lines_matching(text, /^#{1,3} /)
  has_evidence  = search(text, /reddit|customer|interview|survey|signups|trend/i)
  has_persona   = search(text, /target user|customer profile|ICP|buyer|persona/i)
  has_success   = search(text, /success criteria|definition of done|north star|kpi|target metric/i)

  if word_count < 500 and heading_count < 2:
    return "raw_braindump"
  if word_count > 1500 and heading_count >= 3 and (has_evidence or has_persona or has_success):
    return "structured_doc"
  return "mid_stream"
```

If conversation-context (Source 5), skip Step 2.1 quality gate and Step 2.2 clarification — go straight to Step 2.3 bet framing using what's already been said.

### 1.3 Scope assessment (multi-spec gate)

Before any drafting, scan the input for independent subsystems. Signals:
- Different audiences (e.g., end-users vs developers).
- Different deployment surfaces (e.g., Chrome extension vs backend API).
- Different release cadences (one ships when ready, the other ships on schedule).
- Different revenue logic (one is paid, one is free; one is per-seat, one is per-event).

If two or more of these signals fire across distinct chunks of the input, propose decomposition:

> *"I see two independent products: a Chrome extension and a backend API. They have different release cycles. Proposed names: `extension`, `backend`. Treat as one spec or split? (one / split)"*

**Default to one spec.** Splitting is opt-in. Rationale: bets that should be unified often look separable on the surface, and fragmenting them prematurely loses the moat reasoning that ties them together. Make the user say *"yes, split."*

If the user splits, every downstream step (Validation, Architecture, Synthesis) runs once per spec. Cross-spec dependencies are surfaced in Step 4.2.

## Step 2: Phase 1 — Validation

Validation is the spine. Most specs that fail in the wild fail because validation was skipped or hand-waved, not because the build plan was wrong. Set `Status: Validating` at the start of this phase.

### 2.1 Quality gate (soft, with `--force` bypass)

Four criteria. The gate is soft — failure surfaces a warning, not a stop. The user can fill gaps now, proceed with warnings, or stop.

| # | Criterion | Pass | Fail |
|---|---|---|---|
| 1 | Target customer named | "Solo founders building B2B SaaS, $0–$2M ARR" | "Small businesses" |
| 2 | Problem concrete | "Founders waste 4–6 hrs/week manually writing weekly investor updates" | "Reporting is broken" |
| 3 | At least one demand signal cited | Reddit thread URL, customer convo notes, analogous tool's growth, search trend chart | "I think people want this" |
| 4 | Outcome named | "Cut update-writing from 5 hrs to 30 min, measured by self-report after 4 weeks" | "Improve reporting" |

**Failure path:**

```
Quality gate: 2 of 4 criteria failed.

  ✗ Target customer not specific enough
    Current: "Small businesses"
    Want:    A segment + size + situation (e.g., "Solo founders, B2B SaaS, $0–$2M ARR")

  ✗ No demand signal cited
    Want:    A Reddit thread URL, customer conversation notes, an analogous
             tool's growth, or a search trend.

Options:
  1. Fill gaps now (I'll ask one at a time, ~2 min each)
  2. Proceed with warnings (writes to ## Low-Confidence Warnings near the top of the spec)
  3. Stop
```

Bypassed gates → write a `## Low-Confidence Warnings` section near the top of the spec, listing each missed criterion with the wording above. The next reader (or `/rivet spec {name} --refresh`) can target the gaps directly.

`--force` skips the prompt entirely; warnings still get written.

### 2.2 Clarification interview

Borrowed from the obra/superpowers brainstorming pattern. Rules:
- **One question at a time.** Never batch.
- **Multiple choice when possible.** Helps the user think faster than open-ended prompts.
- **Always offer "Other / I'm not sure / Skip".** Skip is not failure — it goes into the assumption register as an Open Question.
- **Stop when the next question wouldn't change the spec.** If the user has answered enough that the bet, kill criteria, and capabilities are all derivable, stop.

Targets:
- `--deep`: 4–8 questions.
- `--lite`: 2–3 questions.

Question sources are documented in [references/question-frameworks.md](references/question-frameworks.md). Pull from these categories in priority order: bet shape → audience → demand evidence → constraints → opportunity cost → moat → reversibility.

Use the AskUserQuestion tool for each turn. Never read more than one prompt ahead.

### 2.3 Bet framing

Required. Output goes into the spec as `## The Bet`. Use this exact template:

```markdown
## The Bet

We believe that [target customer]
will [desired action / outcome]
because [reason / underlying belief].

We'll know we're right if [observable, measurable signal].
We'll know we're wrong if [falsifiable failure condition].

The unfair advantage we're betting on is [moat / asymmetry].
```

Any clause that can't be filled concretely becomes an entry in the assumption register (Step 2.4). Do not ship a spec where any of the six clauses is hand-waved — flag it as `A` (Assumption) or `O` (Open Question) explicitly.

### 2.4 Four-register extraction

The spine of validation. Every claim in the spec goes into exactly one of four registers:

- **Known Facts (F)** — verified, with citations and dates. Example: *"F1: 14k subscribers in r/founders discuss weekly investor update fatigue (2026-04-15, [link]). Confirmed."*
- **Stated Assumptions (A)** — believed but unverified, each with a validation method and deadline. Example: *"A1: Solo founders will pay $29/month for this. Validate by 2026-06-01 with 5 customer interviews."*
- **Open Questions (O)** — deferred decisions, each with a trigger condition and owner. Example: *"O1: Pricing tier for teams (>1 founder). Defer until 5 paying solo customers; owner: founder."*
- **Risks (R)** — acknowledged unknowns, each with a mitigation or explicit acceptance. Example: *"R1: OpenAI rate limits on bulk update generation. Mitigation: queue + retry; accept that batch size > 100 may be slow."*

Format details: [references/assumption-register-format.md](references/assumption-register-format.md).

**Critical rule:** Step 2.5 research must update these registers. Confirmed → move A to F. Invalidated → move A to R (with note: "previously assumed, disproven by ..."). New unknowns surfaced → add to A or R. A research phase that doesn't update the registers wasn't useful — it was skimming.

### 2.5 Bounded competitive scout

Parallel subagents with strict budgets. Each subagent gets one specific question, one search budget, one output spec. The coordinator merges findings into `docs/specs/{name}-research.md` and updates the registers.

| Area | Budget | Output |
|---|---|---|
| Direct competitors (5–10) | 5–8 searches | Per-competitor card: pricing, positioning, 3 strengths, 3 weaknesses, "what they don't do" |
| Pricing benchmarks | 3–5 searches | Comparison table: tier names, anchor prices, what's included |
| Tech / API options (per major component) | 3–5 searches per component | Decision matrix: option, cost model, lock-in, fit |
| Adjacent threats | 2–3 searches | Threat list: who could build this as a feature in 6 months |
| Distribution channels | 2–3 searches | Channel list with effort/return: where the audience already is |

**Subagent dispatch pattern:**

```
Dispatch via Agent tool, subagent_type=general-purpose, in parallel:

  Agent 1: "Find 5–10 direct competitors of [bet]. For each: pricing,
            positioning, 3 strengths, 3 weaknesses, what they don't do.
            Budget: 8 searches. Output as a markdown table."
  Agent 2: "Pricing benchmarks for [category]. 3–5 searches. Output:
            comparison table (tier, anchor price, what's included)."
  Agent 3: "Tech options for [major component, e.g., 'browser extension
            background sync']. Cost model, lock-in, fit. 5 searches."
  ...

Coordinator merges into docs/specs/{name}-research.md.
For each finding: classify as confirms/invalidates/new-unknown,
                  update registers F/A/O/R accordingly.
```

See [references/research-playbook.md](references/research-playbook.md) for budgets, output formats, and "done" criteria.

If a subagent hits its search budget without a clear answer, it logs the unknown as `O` (Open Question), not `R` (Risk) — Risk implies *acknowledged*, Open Question implies *deferred*.

### 2.6 Falsifiability — kill criteria

Required. Minimum count: **≥3 in `--deep` mode, ≥1 in `--lite` mode.** Fewer than that means the bet isn't actually falsifiable — refuse to proceed without explicit `--force`.

Format:

```markdown
## Kill Criteria

| # | Condition | Checkpoint | What we'll do |
|---|---|---|---|
| K1 | <30 weekly-active solo founders by week 6 | 2026-06-09 | Pivot to a different audience |
| K2 | <$500 MRR by week 12 | 2026-07-21 | Kill — pricing is the ceiling, not the floor |
| K3 | OpenAI API costs >$200/customer/month | week 4 | Switch to local Llama 3.3, accept latency hit |
```

Rules per row:
- **Condition observable** — somebody could check it without judgment calls. "<30 WAU" yes, "feels like it's not working" no.
- **Date present.** No "eventually" or "soon."
- **Response named.** Pivot, kill, or accept-with-mitigation. Not "we'll figure it out."

Conditions with past dates → in refresh, become a checkpoint review (Step 6).

### 2.7 Bet sizing & opportunity cost

Required table:

```markdown
## Bet Sizing

| Question | Answer |
|---|---|
| Time to validate (cheapest test) | 2 weeks |
| Time to MVP if validated | 6 weeks |
| Out-of-pocket cost to validate | ~$200 (LLM credits + landing page + ads) |
| Out-of-pocket cost to MVP | ~$2k |
| Founder time commitment | 30 hrs/week, 8 weeks |
| Opportunity cost | Could ship the customer-feedback aggregator instead — that's a 4-week build |
```

Plus reversibility analysis per major decision. One-way doors get extra scrutiny. Format:

```markdown
### Reversibility

| Decision | Door | Why |
|---|---|---|
| Build on OpenAI vs. self-hosted Llama | Two-way | Switch costs ~1 week of refactor |
| Solo-founder positioning vs. team-of-3 | One-way (positioning sticks) | Pricing/messaging/onboarding all key off audience choice |
| Chrome extension vs. web app | One-way (dev tooling diverges) | Re-platforming in month 3 = restart |
```

One-way doors that are weakly motivated → become Risks. The reader (and `/rivet spec --refresh` later) needs to see what was *consciously* committed vs. drifted into.

### 2.8 Adversarial pass

Dispatch a hostile-critic subagent. Prompt:

```
You are a skeptical senior engineer / former founder reviewing a bet
that was just framed. Your job is to surface the 5–10 sharpest, ranked
objections a board or skeptical co-founder would raise.

For each objection, output:
  - Why it matters (1 sentence)
  - Recommended response (concrete: more research / change the bet /
    kill / accept the risk explicitly)
  - What the author should do next (1 line)

Rank by severity (existential first, irritation last).

Do not be polite. Do not soften. Do not preface with "great work but."
If a question is dumb, drop it from the list — the goal is signal,
not exhaustiveness.

Input: [paste the bet, registers, kill criteria, bet sizing]
```

Output appended to the spec as `## Opposition Register` with the objections numbered (`Op1`, `Op2`, …). Each `Op` entry that the user accepts as valid migrates an item into the registers (typically `R` or `O`).

### 2.9 Co-founder alignment (optional, conditional)

Skip if `PRODUCT.md` is missing. Otherwise read `${CLAUDE_SKILL_DIR}/design.md` (if not already loaded this session) and apply its `## Spec — Co-founder alignment` section.

### 2.10 End of Phase 1: recommendation

Validation is done. The spec gets a recommendation at the top, *not buried at the end*:

| Recommendation | When | Action |
|---|---|---|
| **Proceed to architecture** | Quality gate clean OR forced; ≥3 kill criteria; opposition register reviewed; no existential `R` accepted without mitigation | Continue to Step 3 in same run. |
| **Validate first** | Multiple `A` entries that could falsify the bet AND validation is cheap (<2 weeks) | Write spec at this depth. Set `Status: Validated`. Exit. User runs validation IRL, returns with `--refresh`. |
| **Pivot** | Research invalidated the bet's core premise; opposition register has an unanswerable existential objection | Suggest a pivot direction in the spec. Set `Status: Pivoting`. Exit. |
| **Kill** | Bet is not viable; cost > realistic upside; better alternatives exist | Document why. Set `Status: Killed`. Exit. Spec still useful as a learning artifact. |

The recommendation lives in the spec's `## Recommendation` section near the top (right under the frontmatter block). User confirms before continuing.

If the recommendation is Proceed, set `Status: Architecting` and move to Step 3.

## Step 3: Phase 2 — Architecture

Architecture turns a validated bet into a buildable system. Set `Status: Architecting`.

### 3.1 Architecture approach proposals

Always propose **2–3 alternatives** with explicit tradeoffs. Never propose one. The user picks; the discarded alternatives get logged as Decisions Made (Step 3.3) so future readers see what was considered.

Format per proposal:

```markdown
### Approach A: <name>

- **Shape:** 1–2 sentences of the system shape
- **Strengths:** 2–3 bullets
- **Weaknesses:** 2–3 bullets
- **Cost shape:** capex / opex / per-customer marginal
- **Reversibility:** one-way / two-way; if one-way, what locks in
- **Best when:** 1 sentence — the conditions under which this approach wins
```

Decision categories likely to come up: stack, data sources, pricing model, GTM channel, architecture style, moat shape, operating model. See [references/decision-categories.md](references/decision-categories.md).

### 3.2 Bounded research per component

Same dispatch pattern as Step 2.5. For each major architectural component the chosen approach implies, dispatch a subagent with a budget:

| Component class | Budget | Output |
|---|---|---|
| Stack choice (lang/framework) | 3–5 searches | Decision matrix: ergonomics, hire-ability, hosting, ecosystem |
| Data source / API | 5 searches | Endpoint shapes, auth, rate limits, recent breakage |
| Hosting / infra | 3 searches | Cost at projected scale, lock-in, dev/prod parity |
| Auth / payments | 3 searches | Provider comparison: features, fees, lock-in |

Findings update the registers (same rule as Step 2.5: confirmed → F, invalidated → R, new unknowns → A or O).

### 3.3 Architecture decisions logged

Every meaningful architectural choice goes into the spec's `## Decision Log` using the two-register format (Decisions Made + Decisions Deferred). See [references/decision-log-format.md](references/decision-log-format.md).

Per Decision Made:

```markdown
### D1: Use OpenAI for v1; revisit at $5k/mo LLM spend

- **Date:** 2026-04-27
- **Decided by:** Bharani
- **Alternatives considered:** Self-hosted Llama 3.3; Claude API; OpenAI API
- **Why OpenAI won:** Best-in-class for structured generation; no infra burden at v1 scale; switch cost is ~1 week if we pivot
- **Reversibility:** two-way (R5 captures the LLM cost ceiling)
- **Trigger to revisit:** $5k/mo total LLM spend OR per-customer cost >$30/mo
```

Per Decision Deferred:

```markdown
### O3: Multi-tenancy — single DB or per-customer schema?

- **Why deferred:** First 50 customers fit in single DB; schema split adds operational cost we don't need yet
- **Trigger to revisit:** 50 paying customers OR first enterprise contract requesting data isolation
- **Owner:** Bharani
- **Default if forced:** Single DB with `tenant_id` column; per-customer schema is a 2-week migration
```

The Decision Log is *the* artifact future readers cite when asking "why did we build it this way?" Make it information-dense.

### 3.4 Capabilities decomposition

Capabilities are the primary structure. Phases (Step 4.1) are derived from capabilities, not the other way around. Decomposing this way keeps the spec stable when the build plan re-shuffles.

Per capability:

```markdown
### C1: Weekly Update Generation

- **Description:** Given a founder's data sources (calendar, GitHub, Linear), produce a draft investor update by Friday 5pm
- **Who it serves:** Solo founders sending weekly investor updates
- **Success criterion:** ≥80% of generated drafts shipped without rewrites (measured by edit distance from generated → sent)
- **Depends on:** A2 (founders accept LLM-drafted updates), C0 (data ingestion), F3 (calendar API access available)
```

`depends-on:` links use IDs from the registers (F/A/O/R/D) and other capabilities (`C0`, `C1`, …). Anchors enable Step 4.3 traceability.

### 3.5 Pricing strategy

Required. First-class section. Hand-waving on pricing is a top reason specs fail in the wild.

```markdown
## Pricing

**Anchor price:** $29/month
**Anchor competitor:** Beehiiv ($39/mo for similar substack-adjacent positioning)

**Tiers:**

| Tier | Price | Includes | Excludes |
|---|---|---|---|
| Solo | $29/mo | 1 founder, 4 updates/mo, GPT-4 | Team seats, custom branding |
| Team | $79/mo | Up to 5 founders, unlimited updates | Custom integrations |
| Enterprise | Custom | SSO, audit logs, dedicated support | — |

**What's included by default:** GPT-4-class quality, all data integrations, email + web delivery
**What's add-on:** Custom training on past updates ($50/mo), white-label ($200/mo)
**Free trial:** 2 weeks, full Solo tier, no credit card

**Citations:** F2 (Beehiiv pricing), F4 (3 customer interviews accepted $29 anchor), A4 (Team tier conversion rate assumed 15%)
```

Cite competitive benchmarks from Step 2.5 research. If pricing has no F-citations, kick back to validation.

### 3.6 Go-to-market

Required. First-class section.

```markdown
## Go-to-Market

**Primary channel:** Twitter (founder audience already there)
**Sequencing:**
  1. Week 1–4: Build in public on Twitter; release weekly progress threads
  2. Week 5–8: Open beta via waitlist; 50 founders
  3. Week 9–12: Public launch; ProductHunt + IndieHackers

**Viral hook:** Generated updates include "Made with [tool]" footer (opt-out)
**Content strategy:** Weekly "founder update teardown" — anonymized real updates with annotations
**Paid vs. organic:** Organic for v1; paid only after CAC < $30 in tests
```

Channels listed must connect to F-citations from Step 2.5 distribution-channel research. If a channel has no evidence the audience is there, downgrade it.

### 3.7 Operating model

Required. Captures who-does-what and what happens when somebody is offline.

```markdown
## Operating Model

**Team:** Bharani (eng + product), Sara (design + GTM)
**Bharani owns:** Backend, LLM integrations, infra, auth, billing
**Sara owns:** Frontend, brand, content, customer interviews
**Shared:** Pricing decisions, hire/no-hire calls, kill-criteria checkpoints

**Expertise gaps:** Neither founder has done outbound sales — if Tier 3 (Enterprise) becomes a real channel, hire or partner
**Single-points-of-failure:**
  - LLM cost monitoring: only Bharani knows the dashboards. Mitigation: weekly screenshot in shared Slack
  - Customer interview pipeline: only Sara has the relationships. Mitigation: shared CRM notes
**On-call:** Both founders, alternating weeks
```

If `PRODUCT.md` has multiple authors, this section MUST address all of them.

### 3.8 Non-goals

Required. **Minimum 3.** Refuse to write the spec without explicit non-goals listed — they're the cheapest scope-control device available.

```markdown
## Non-Goals

- **Mobile app for v1.** Reasoning: founder audience writes updates from laptops. Reassess at 500 paying customers.
- **Team collaboration features.** Reasoning: Solo tier is the bet. Team tier unlocks at 100 paying solo founders.
- **AI investor matching.** Reasoning: tempting but a different bet entirely; would split focus. Spin out as separate spec if pursued.
```

Each non-goal needs a reason. Non-goals without reasons get re-litigated every standup; non-goals with reasons stay non-goals.

## Step 4: Phase 3 — Synthesis

Synthesis composes the deliverable. Set `Status: Drafting`.

### 4.1 Phase projection

Derive build phases from capabilities. This is what `/rivet plan` consumes. **Output MUST produce `## Phase N` headings** so the downstream tool can find them.

Per phase:

```markdown
### Phase 0: Foundation

- **Scope:** C0 (data ingestion), C1.1 (calendar parser), C1.2 (GitHub parser)
- **Success criteria:** All three integrations return structured data for one test founder
- **Estimated:** 30 hours (~6 days at 5 hrs/day)
- **Dependencies:** None — clean start
- **Spec sections this implements:** §3.4 (C0, C1.1, C1.2)
- **Verification checklist:**
  - [ ] `php artisan import:github --founder=1 --dry-run` → prints "3 commits found"
  - [ ] `php artisan tinker` → `App\Services\CalendarParser::parse($testFounder)` returns array with ≥1 event
  - [ ] Open `/admin/founders/1` → enrichment tab shows populated data rows
  - [ ] `php artisan test --filter=DataIngestionTest` → all pass
```

Phase scope is capability IDs, not free text. Traceability (Step 4.3) reads these. Dependencies link to other phases (within the same spec) or other specs (cross-spec; see Step 4.2).

Every phase must include a `**Verification checklist:**` field. Write 2–5 steps the human user can follow immediately after the phase completes to confirm the build worked — browser URLs to visit, CLI commands with expected output, UI flows to click through. If a phase produces nothing a human can see or touch (e.g. pure infrastructure wiring), say so explicitly: `- [ ] No user-visible output this phase — run \`php artisan test\` to confirm all N tests pass.` The field is required even when there is nothing to show; the honest "nothing to see yet" entry is better than a silent omission.

Estimate per phase: 4–8 sub-plans worth of work (so `/rivet plan {spec} phase-N` produces a reasonably-sized split). If a phase is >40 hrs, split it.

### 4.2 Cross-spec dependency surfacing

Run only when multi-spec (Step 1.3 produced ≥2 specs).

For every phase, scan dependencies for references to capabilities in other specs. Surface explicitly:

```markdown
### Cross-Spec Dependencies

- `extension` Phase 2 depends on `backend` Phase 1 shipping `/scan` endpoint (C2 in backend.md).
- `backend` Phase 3 depends on `extension` Phase 1 shipping client telemetry (C1.3 in extension.md).
```

If circular: stop. Tell the user the cycle and ask which spec absorbs the work to break it.

### 4.3 Traceability links

Every phase's `Spec sections this implements:` line links back to source capability IDs. Every capability's `Depends on:` links to register IDs (F/A/O/R/D). Use markdown anchors:

```markdown
- **Depends on:** [A2](#a2-founders-accept-llm-drafted-updates), [C0](#c0-data-ingestion)
```

A reader following links can trace: phase → capability → assumption → research finding (in `{name}-research.md`). No phantom claims.

### 4.4 Diagrams (Mermaid)

At minimum:
- **System architecture** — components, data flow, external dependencies.
- **User journey** — primary flow from first touch to value moment.

Additional diagrams when they pay for themselves: state diagram for stateful flows, ERD for data-heavy specs. Don't draw every system — diagrams cost reading attention.

Embed inline in the spec, not as separate files. Mermaid is GitHub-native.

### 4.5 Hygiene self-review

Dispatch a separate subagent (not the adversarial one — that one's already played its role). Prompt:

```
You are a meticulous editor reviewing a strategic spec before it ships.
Check for:
  - Placeholders: "TODO", "TBD", "FIXME", "[fill in]"
  - Contradictions: bet says X, kill criterion implies not-X
  - Missing required sections: Recommendation, The Bet, F/A/O/R registers,
    Kill Criteria (≥3 in deep / ≥1 in lite), Bet Sizing, Opposition
    Register, Capabilities, Pricing, Go-to-Market, Operating Model,
    Non-Goals (≥3), Decision Log, Phase 0+
  - Vague evidence: claims with no F-citation
  - Scope creep: capabilities not connected to any kill criterion or success metric
  - Numbered references that don't resolve (e.g., "C7" mentioned but no C7 defined)

Output two lists:
  Mechanical fixes (apply directly): typos, broken anchors, formatting drift
  Judgement calls (surface to user): contradictions, missing rigor

Apply mechanical fixes inline. Surface judgement calls separately.
```

Apply mechanical fixes to the spec file. Show judgement calls to the user as a numbered list; for each, ask: "fix it / accept and document as Open Question / explain why it's actually fine."

### 4.6 Quality scoring

Run the rubric in [references/quality-rubric.md](references/quality-rubric.md). Each dimension scored 0–3. Pass thresholds:

- **`--deep`:** ≥2 on every dimension.
- **`--lite`:** ≥1 on every dimension; ≥2 on bet statement and target customer.

If below threshold:
- Show the failed dimensions and what they'd need to clear.
- Offer: "fix now / accept and document as Low-Confidence Warnings / `--force` past."

Score is written into the frontmatter (`Quality score: N/M`).

### 4.7 Status set

If all gates passed and user accepts → `Status: Complete`.
If user wants to iterate → `Status: Drafting` (spec is usable; scoring not yet final).

`Complete` is the green light for `/rivet plan {spec} phase-0`.

## Step 5: Output Structure

`docs/specs/{name}.md`:

```markdown
# Spec: {Name}

**Status:** Validating | Validated | Architecting | Drafting | Complete | Killed | Pivoted
**Created:** YYYY-MM-DD
**Updated:** YYYY-MM-DD
**Authors:** Bharani, Sara
**Mode:** lite | deep
**Quality score:** N/M

## Recommendation

[Verdict (Proceed / Validate first / Pivot / Kill) + 2–3 sentence rationale + next-step instruction]

## Low-Confidence Warnings

[Bypassed gate criteria + what fixing them would look like. Omit section entirely if none.]

---

## Phase 1: Validation

### The Bet

### Registers
#### Known Facts
#### Stated Assumptions
#### Open Questions
#### Risks

### Competitive Landscape
### Kill Criteria
### Bet Sizing
### Reversibility
### Opposition Register
### Co-founder Alignment

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

### Phase 0: <name>
<!-- Scope, Success criteria, Estimated, Dependencies, Spec sections, Verification checklist -->
### Phase 1: <name>
### Phase 2: <name>
...

### Cross-Spec Dependencies
### Diagrams

---

## Decision Log

### Decisions Made
### Decisions Deferred

---

## Notes

[Free-form. Stuff the user pasted in but that didn't fit elsewhere lives here. The author's diary, basically.]
```

Plus a separate research file: `docs/specs/{name}-research.md`. Contents:
- Raw findings from each Step 2.5 / 3.2 subagent, organized by area.
- Citations with URLs and dates.
- A `## Provenance` section at the top: which agent, what budget, what date.

The main spec links into the research file by section anchor (`See [pricing benchmarks](./{name}-research.md#pricing-benchmarks)`). The research file is the receipts; the spec is the argument.

## Step 6: Refresh Semantics

`/rivet spec {name} --refresh`. Runs only when `docs/specs/{name}.md` exists.

Refresh is **additive by default**. The Decision Log stays — no re-litigation unless the user flags a specific decision. If the user wants a rewrite, they delete the spec file and start fresh.

Flow:

1. **Read existing files.** `docs/specs/{name}.md` and `docs/specs/{name}-research.md`. Parse Status, Mode, Authors, all registers, all capabilities, the Decision Log.

2. **Skip Decision Log.** Existing decisions stay locked. Tell the user explicitly: *"Skipping 4 entries in Decisions Made. Pass `--decision-revisit D2` to re-open one."*

3. **Re-fetch stale research.** For every research finding older than 4 weeks, dispatch a scoped subagent (parallel) to re-check. Update findings; flag any reversals to the user.

4. **Walk Stated Assumptions.** For each `A` entry, ask the user one at a time: "still true / validated / invalidated / skip."
   - **Validated** → move to Facts (`F`). Record validation method and date.
   - **Invalidated** → move to Risks (`R`) with note: *"previously assumed, disproven by [reason/source]."*
   - **Still believed** → keep as `A`. Bump validation deadline if past-due.
   - **Skip** → keep as `A`. Don't push.

5. **Walk Kill Criteria with past dates.** Each becomes a checkpoint review:
   - **Triggered** (condition met for kill or pivot) → recommendation flips to `Kill` or `Pivot`. Update `Status:`. Stop downstream work.
   - **Not triggered** → bump checkpoint date, note: *"Reviewed 2026-06-09; condition not met (24/30 WAU); next checkpoint 2026-07-21."*

6. **Recompute quality score** against rubric. If a previously-passing dimension drops below threshold (research invalidated a citation, an assumption was disproven), flag it.

7. **Status field may advance.** Examples:
   - `Validated` → `Architecting` if the user provided validation evidence inline or via `--from validation-results.md`.
   - `Drafting` → `Complete` if the rubric now passes cleanly.
   - `Architecting` → `Pivoting` or `Killed` if step 5 triggered a kill criterion.

8. **Append `## Refresh Log` section.** Date, what changed, what didn't. Future refreshes append to the same section. This is the spec's audit trail.

Do not overwrite phase definitions during refresh. If capabilities or phases need restructuring, tell the user: *"Capability changes need a fresh `/rivet spec` run (delete `docs/specs/{name}.md` first). Refresh is additive only."*

## Step 7: Edge Cases & Operational Notes

### 7.1 Edge cases

- **"I attached a file in Claude Code / VS Code — does it just work?"** → Yes. Step 1.1 auto-detects.
- **"My braindump is 5 words long."** → Quality gate fails all four criteria. Can `--force` but the spec will be 90% warnings; better to spend 5 minutes filling gaps now.
- **"I'm already mid-build, why a spec?"** → Run with the existing PRD as `--from`. Catches missed assumptions, surfaces kill criteria, gives `/rivet plan` a structured target. Cheap insurance.
- **"Internal tool, not a product."** → Skip customer-evidence sections; keep the rigor; adapt language ("users" → "team", "customers" → "stakeholders"). The bet template still works: *"We believe that [team] will [adopt this workflow] because [reason]. We'll know we're right if [metric]."*
- **"I want to spec two products together."** → Step 1.3 handles. Default unified, opt-in split. After splitting, every step re-runs per spec; cross-spec dependencies surfaced in Step 4.2.
- **"I ran validation, recommendation was 'Validate first.' Now what?"** → Spec sits at `Status: Validated`. Run validation IRL. Return with `/rivet spec {name} --refresh` and append evidence inline or via `--from validation-results.md`. The refresh Step 6.4 walk converts validated `A` → `F`.
- **"Capability X depends on a different spec's Phase 2."** → Step 4.2 handles. Document the cross-spec dependency explicitly. `/rivet plan {dependent-spec}` will surface the dependency at plan time.
- **"I want to revisit a Decision Made."** → Pass `--decision-revisit D2`. Refresh re-opens just that decision; siblings stay locked. Record the re-opening with date and reason in the Decision Log itself.
- **"Two specs with the same name."** → `/rivet spec {name}` always targets `docs/specs/{name}.md`. Path-collision is on the user; we don't auto-disambiguate.
- **"The braindump is in a different language."** → Output the spec in the same language as the braindump. Internal templates (status values, register codes F/A/O/R) stay in English for tooling consistency.

### 7.2 Recommended model

Opus-class. `/rivet spec` is a thinking task — adversarial pass, four-register classification, decision-tradeoff analysis, capability decomposition. Cheaper models produce specs that look right syntactically (all sections present, registers populated) but miss the reasoning that separates a useful spec from a checked-the-box spec. Cost is small relative to the multi-week build the spec authorizes.

### 7.3 What `/rivet spec` does not do

- **Does not write code.** Output is markdown only; build files come from `/rivet plan` + `/rivet run`.
- **Does not validate the bet.** It frames the bet, surfaces what would falsify it, and recommends *how* to validate. Actual validation (talking to customers, running landing-page tests) is the user's job.
- **Does not decide between competing specs.** Step 1.3 surfaces splits; the user picks. No automatic merging or splitting.
- **Does not modify `/rivet plan`'s outputs.** Refresh is scoped to the spec; downstream plans regenerate via `/rivet plan {spec} {phase} --refresh`.

### 7.4 Next: `/rivet plan`

After `/rivet spec` reaches `Status: Complete`:

```
/rivet plan {name} phase-0
```

`/rivet plan` reads the spec's `## Phase N` headings, picks the requested one, and generates sub-plans against it. The capability IDs and decision log carry through — the plan cites them, and `/rivet run` enforces them at execution time.

If the spec is `Validated` (not `Complete`), `/rivet plan` will refuse and tell the user to either complete the spec (`/rivet spec {name}` to resume from Architecture) or run validation IRL first.
