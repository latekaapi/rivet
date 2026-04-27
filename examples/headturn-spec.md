# Spec: HeadTurn

**Status:** Draft (placeholder — to be ported from HeadTurn_PRD_v2.0)
**Created:** 2026-04-27
**Updated:** 2026-04-27
**Authors:** Bharani, Akshaya
**Mode:** deep
**Quality score:** _pending port_

> **Note to readers:** This file is a *structural* example of what `/rivet spec` produces in `--deep` mode. The real HeadTurn PRD lives in a separate (private) repository. This placeholder mirrors the canonical output structure from [spec.md](../spec.md) Step 5 so that:
>
> 1. References from [references/quality-rubric.md](../references/quality-rubric.md) (calibration anchor) resolve to a real file.
> 2. Readers can see the full section taxonomy without needing the source PRD.
> 3. A future commit can replace each `_to be ported_` block with the real content without restructuring.
>
> A second worked example with end-to-end fictional content lives in the `## Worked snippets` section at the bottom of this file.

## Recommendation

_to be ported_ — Verdict (Proceed / Validate first / Pivot / Kill) + 2–3 sentence rationale + next-step instruction. HeadTurn's current state per PRD v2.0 is "Pre-build validation" → maps to **Validate first** with a sequenced plan to convert assumptions to facts before architecture is finalized.

## Low-Confidence Warnings

_omit unless a quality gate was bypassed._

---

## Phase 1: Validation

### The Bet

_to be ported_ — Use the six-clause template from [spec.md](../spec.md) Step 2.3:

> We believe that `[target customer]`
> will `[desired action / outcome]`
> because `[reason / underlying belief]`.
>
> We'll know we're right if `[observable, measurable signal]`.
> We'll know we're wrong if `[falsifiable failure condition]`.
>
> The unfair advantage we're betting on is `[moat / asymmetry]`.

For HeadTurn: target = "technical SaaS founders losing AI-platform visibility"; desired action = "subscribe to a $39/mo monitoring + fix tool"; signal = "≥30 paying customers within 8 weeks of launch"; falsifying = "<10 paid signups after 5 free audits sold"; moat = "speed of fix delivery + AI-platform-native output format."

### Registers

#### Known Facts

_to be ported_ — F-entries, each with source URL + verification date. From PRD v2.0:
- `F1`: AI Overview presence in Google SERPs grew Nov 2024 → Nov 2025 by ~3x ([source TBD]).
- `F2`: $39/mo anchor competitor (Profound) charges enterprise-only ($1k+/mo).
- `F3`: Technical founders edit JSON-LD/llms.txt/robots.txt as part of normal workflow ([source TBD]).
- (continue per [references/assumption-register-format.md](../references/assumption-register-format.md))

#### Stated Assumptions

_to be ported_ — A-entries, each with validation method + deadline + owner + "if invalidated" line. Likely candidates:
- `A1`: Founders will pay for monitoring + fixes (not just monitoring).
- `A2`: AI-platform citation matters enough to founders to price it monthly, not annual.
- `A3`: Reddit + Serper data is sufficient input — proprietary AI-platform telemetry not required.

#### Open Questions

_to be ported_ — O-entries, each with trigger + owner + default-if-forced.
- `O1`: Agency tier (multi-site) — Phase 2 inclusion or separate spec?
- `O2`: White-label / unbranded export — table stakes or premium?

#### Risks

_to be ported_ — R-entries, each with severity + likelihood + mitigation + accepted (yes/no).
- `R1`: AI platform ToS changes (rate limits, scraping prohibition, deprecated APIs).
- `R2`: Reddit API access changes (already realized once: PRD v2.10 changelog notes Nov 2025 policy shift forcing the tool from authenticated API to public JSON + Serper piggyback).

### Competitive Landscape

_to be ported_ — Per-competitor cards from research-playbook (Profound, Otterly, Goodie, etc.). Format per [references/research-playbook.md](../references/research-playbook.md) "Direct competitors" output.

### Kill Criteria

_to be ported_ — Minimum 3 in `--deep`. Each: condition (observable) + checkpoint (date) + response (pivot / kill / accept).

| # | Condition | Checkpoint | What we'll do |
|---|---|---|---|
| K1 | _<X paid signups by week 8_ | _date_ | _pivot to agency-tier-only / kill_ |
| K2 | _AI platform unit cost > $X/customer/month_ | _date_ | _switch to cheaper models / drop platform_ |
| K3 | _<5 audits sold during Phase 0 manual validation_ | _date_ | _kill — bet doesn't have demand_ |

### Bet Sizing

_to be ported_ — Full table per [spec.md](../spec.md) Step 2.7: time-to-validate, time-to-MVP, $-to-validate, $-to-MVP, founder hours, opportunity cost.

### Reversibility

_to be ported_ — One-way vs two-way doors per major decision. Likely:
- Brand name "HeadTurn": one-way (positioning, domain, social)
- Stack (Laravel 13 + Inertia v3 + React): two-way (rebuild ~3 weeks)
- Anchor pricing $39/mo: one-way-ish (raising later is harder than dropping)

### Opposition Register

_to be ported_ — Adversarial-pass output, ≥5 ranked objections per [spec.md](../spec.md) Step 2.8. Each with: why it matters + recommended response + author action.

### Co-founder Alignment

_to be ported_ — Multi-author spec (Bharani + Akshaya). Document any deferred discussions or disagreements per [spec.md](../spec.md) Step 2.9.

---

## Phase 2: Architecture

### Approach Decisions

_to be ported_ — 2–3 alternatives per major decision, with explicit tradeoffs. Likely:
- Self-hosted vs. SaaS for AI platform queries (PRD chose API-based; never scrape UIs).
- Async job chain via Bus::batch vs. synchronous pipeline (PRD chose async per v2.11).
- Reddit API vs. public JSON + Serper (PRD switched to latter per v2.10).

### Capabilities

_to be ported_ — Capability decomposition per [spec.md](../spec.md) Step 3.4. Each: description + who-it-serves + success criterion + depends-on. Likely capabilities:
- `C1`: Site Intelligence Engine (one-shot scan).
- `C2`: AI Citation Query (multi-platform query + response analysis).
- `C3`: Score Computation (6-dimension visibility score).
- `C4`: Fix Engine (copy-paste JSON-LD / llms.txt / robots.txt).
- `C5`: Shareable `/scan/{slug}` Report Page.
- `C6`: Telemetry / Admin View.

### Pricing

_to be ported_ — Anchor price ($39/mo flat), tier structure, free-tier decision (Free Scanner as acquisition + paid Monitor + Fix). Citations to F-entries (anchor competitor pricing).

### Go-to-Market

_to be ported_ — Channels (Twitter build-in-public, IndieHackers, ProductHunt). Sequencing. Viral hook: shareable `/scan/{slug}` URLs.

### Operating Model

_to be ported_ — Bharani owns engineering + LLM integrations + infra; Akshaya owns ___; shared decisions ___. On-call. Single-points-of-failure. (Fill from PRD §13 / authors section.)

### Non-Goals

_to be ported_ — Minimum 3 with reasoning. Per PRD §1 "What HeadTurn is NOT":
- **Not an SEO tool.** Reasoning: market saturated; HeadTurn occupies "AI citation optimization" category.
- **Not a brand agency or PR tool.** Reasoning: technical output (JSON-LD, llms.txt) for technical founders.
- **Not a dashboard-only tool.** Reasoning: copy-paste fixes are the value; dashboards are supporting UI.

---

## Phase 3: Build Plan

### Phase 0: Manual Validation + Production-Code Pipeline

_to be ported_ — Per PRD v2.11 restructure: Phase 0 builds full scan pipeline as production code (5 PostgreSQL migrations, Redis job chain, Inertia v3 SSR `/scan/{slug}` page). Manual validation obligation: sell ≥5 audits at ≥$99, confirm ≥3 buyers would pay $39/month.

**Scope:** _C1, C2, C3, C4, C5 (skeleton) — capability links_
**Success criteria:** _≥5 audits sold; ≥3 confirmed paying intent_
**Estimated:** _hours_
**Dependencies:** _None_
**Spec sections this implements:** _§3.4 (C1–C5)_

### Phase 1: Public URL-Input Form + Auth + Anonymous Rate Limits

_to be ported_

### Phase 2: Agency Tier (Multi-Site)

_to be ported — also see Cross-Spec Dependencies for relationship to admin.md / `[Admin Panel PRD]`._

### Phase 3: Fix Engine + Pattern Detection

_to be ported_

### Cross-Spec Dependencies

_to be ported_ — HeadTurn has a sibling spec (Admin Panel PRD v1.0 at `docs/prd/admin-PRD.md` in the source repo). Cross-spec dependencies per [spec.md](../spec.md) Step 4.2:
- `admin` Phase 0 depends on `headturn` Phase 0 shipping `scans.step_timings` + `scans.step_statuses` JSONB columns (PRD §9, v2.12 changelog).

### Diagrams

_to be ported_ — Mermaid diagrams: system architecture (per PRD §3.1 ASCII art), user journey (per PRD §3.2). Embed inline.

---

## Decision Log

### Decisions Made

_to be ported per [references/decision-log-format.md](../references/decision-log-format.md). Likely entries:_

- `D1`: API-based AI platform queries, never scrape UIs. Reversibility: one-way (architectural). Trigger to revisit: never (ToS-driven).
- `D2`: Reddit access via public JSON + Serper piggyback (Nov 2025 policy shift). Per PRD v2.10.
- `D3`: $39/mo flat-rate pricing. Trigger to revisit: 100 paying customers OR enterprise inbound.
- `D4`: Phase 0 builds production-code pipeline (not throwaway CLI). Per PRD v2.11.
- `D5`: Telemetry columns on `scans` table (`step_timings`, `step_statuses`). Per PRD v2.12.

### Decisions Deferred

_to be ported_ — Likely entries:
- `O1`: Agency tier — Phase 2 vs. separate spec? Trigger: 30 paying solo customers OR first inbound agency request.
- `O2`: PDF export — defer to "buyer requests it." Default if forced: `/scan/{slug}` URL replaces PDF.
- `O3`: OG image generation — same posture as O2.

---

## Notes

The PRD's changelog (v2.0 → v2.12 in HeadTurn_PRD_v2.0.md) is a model audit trail of how decisions evolved. When porting, preserve the changelog entries that explain *why* a decision was reversed or restructured (v2.10 Reddit pivot, v2.11 Phase 0 restructure, v2.12 telemetry expansion) — they belong in the Refresh Log section the spec accumulates over time.

---

## Worked snippets

The following section is **not** part of the canonical output — it's included here so a reader who landed on this stub gets at least one concrete example of each register/section format. These are real PRD-derived fragments adapted to the spec format.

### Sample F-entry (drawn from PRD v2.0 §3)

```markdown
- **F1: Reddit's Responsible Builder Policy (Nov 2025) ended self-service API access for commercial SaaS tools.**
  - Source: PRD v2.10 changelog; Reddit policy announcement [URL TBD]
  - Verified: 2025-11 (PRD log entry)
  - Notes: Forced architectural change — switched from authenticated API to public JSON + Serper piggyback. Cost: $0 → ~$0.002/site (absorbed into existing Serper integration).
```

### Sample D-entry (architectural decision)

```markdown
### D4: Phase 0 builds production-code pipeline, not throwaway CLI
- **Date:** 2026-04-? (PRD v2.11 timestamp)
- **Decided by:** Bharani
- **Alternatives considered:**
  - CLI-only Artisan command (original v1.2–v2.10 scope) — produces throwaway markdown/PDF
  - Production pipeline as Phase 0 (chosen) — every paid manual audit produces shareable `/scan/{slug}` URL
  - Defer pipeline to Phase 1 — keeps Phase 0 cheap but every audit is private
- **Why production pipeline won:** Every paid manual audit produces viral distribution (URL shareable on Twitter/Reddit) instead of a private file. Polish bar matches a $99–199 deliverable. Phase 1 shrinks accordingly.
- **Reversibility:** one-way (5 migrations + job chain + SSR page = months of work to undo)
- **Trigger to revisit:** never (architectural; would require restart)
- **Linked:** F1 (Phase 0 sells ≥5 manual audits — need polished output), C5 (shareable report page), R3 (engineering scope risk for Phase 0)
```

### Sample capability decomposition

```markdown
### C2: AI Citation Query

- **Description:** Given a brand + intent prompt set, query 3+ AI platforms (ChatGPT, Perplexity, Gemini) and analyze responses for brand mentions, sentiment, and competitive context
- **Who it serves:** Technical SaaS founders running a HeadTurn scan
- **Success criterion:** ≥95% of scans complete with valid responses from all 3 platforms within 90 seconds; partial-failure tolerance handles 1-of-3 platform outages
- **Depends on:** C1 (Site Intelligence — provides intent prompts), F4 (LLM-API rate limits documented), R1 (platform ToS risk accepted), D6 (model selection: gpt-4o-mini, Claude Sonnet, Gemini Flash, Perplexity sonar)
```

### Sample kill-criterion table

```markdown
| # | Condition | Checkpoint | What we'll do |
|---|---|---|---|
| K1 | <5 manual audits sold during Phase 0 | week 4 | Kill — bet doesn't have demand |
| K2 | <10 paid Monitor+Fix subscribers within 8 weeks of launch | week 12 | Pivot to agency-tier-only positioning |
| K3 | Per-customer LLM cost >$10/month | week 6 | Switch to cheaper model tier (gpt-4o-mini → gpt-3.5; accept quality degradation) |
| K4 | Reddit data access blocked again | any | Drop Reddit input; rely on Serper SERP-derived signal only |
```
