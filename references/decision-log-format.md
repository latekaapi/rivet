# Decision Log Format

Every spec ends with a `## Decision Log` containing two registers: **Decisions Made** (locked-in choices, rarely reopened) and **Decisions Deferred** (open questions tracked alongside the choices, not buried in registers). The split is what keeps the log useful: future readers can scan what's settled vs. what's still on the table without re-reading the whole spec.

## Decisions Made

```markdown
### D1: Use OpenAI for v1; revisit at $5k/mo total LLM spend

- **Date:** 2026-04-27
- **Decided by:** Bharani
- **Alternatives considered:**
  - Self-hosted Llama 3.3 (cheaper at scale, infra burden upfront)
  - Claude API (similar cost, less optimized for structured output)
  - OpenAI GPT-4 (chosen)
- **Why OpenAI won:** Best-in-class for structured generation; no infra burden at v1 scale; switch cost is ~1 week if we pivot
- **Reversibility:** two-way (R5 captures the LLM cost ceiling)
- **Trigger to revisit:** $5k/mo total LLM spend OR per-customer cost >$30/mo
- **Linked:** F8 (OpenAI structured-output benchmarks), R5 (cost risk), K3 (kill criterion)
```

Required fields:

| Field | Purpose |
|---|---|
| **Date** | When the decision was made. Refresh uses this to flag stale decisions (>12 weeks) for optional review. |
| **Decided by** | Single named person. "We" is not allowed — every decision has an accountable decider. |
| **Alternatives considered** | What was on the table. Minimum 2; usually 3. The losing options are part of the institutional memory. |
| **Why X won** | The actual reasoning, in one sentence. Not "best fit" — the *specific* reason. If you can't articulate why X won, the decision was a hunch and should probably go to Decisions Deferred until it's earned. |
| **Reversibility** | one-way / two-way. If one-way, what locks in (e.g., "positioning shapes pricing/messaging/onboarding — re-platforming is a restart"). |
| **Trigger to revisit** | Optional. Observable condition that would re-open the decision. Common shapes: cost threshold, customer count threshold, contract requirement, performance ceiling. |
| **Linked** | IDs from the registers (F/A/O/R) and kill criteria (K) that the decision references. Enables traceability: a future reader can follow the link from "we use OpenAI" to "because F8 said so" to "F8 is verified at [URL]". |

## Decisions Deferred

```markdown
### O3: Multi-tenancy — single DB or per-customer schema?

- **Why deferred:** First 50 customers fit in single DB; schema split adds operational cost we don't need yet
- **Trigger to revisit:** 50 paying customers OR first enterprise contract requesting data isolation
- **Owner:** Bharani
- **Default if forced:** Single DB with `tenant_id` column; per-customer schema is a 2-week migration
- **Linked:** A4 (enterprise interest assumption), R7 (data-isolation request risk)
```

Required fields:

| Field | Purpose |
|---|---|
| **Why deferred** | What makes it safe to not decide yet. "We don't know" is not enough — the spec should articulate why it's *deferable*. |
| **Trigger to revisit** | Observable. Same rigor as Decisions Made. |
| **Owner** | Single person. Same person who'll have to make the call when the trigger fires. |
| **Default if forced** | What ships if a decision is needed today. The most-skipped, most-load-bearing field. If no default exists, the question isn't actually deferrable. |
| **Linked** | Same convention as Decisions Made. |

## ID convention

- `D1`, `D2`, … for Decisions Made.
- `O1`, `O2`, … for Decisions Deferred. (Same namespace as the Open Questions register — Decisions Deferred *is* the user-facing surface for `O` entries.)
- IDs are stable. If `O3` becomes a Decision Made (`D7`), the spec keeps a one-line breadcrumb in the Refresh Log: *"O3 → D7: chose single DB with tenant_id; trigger remained the same."*
- Cross-references in capabilities, kill criteria, and risks use the *current* ID. Update during refresh.

## Re-opening a Decision Made

Decisions Made are *locked by default* during refresh. The Decision Log doesn't get re-litigated every time the spec runs.

To re-open:

```bash
/rivet spec {name} --refresh --decision-revisit D2
```

Behavior:
1. The decision is unlocked for this run.
2. The user is asked: "what changed?" — the answer is appended to the existing entry as `**Re-opened YYYY-MM-DD because:** <reason>`.
3. The decision goes through the same flow as a fresh decision (alternatives, why-X-wins, reversibility, trigger).
4. The previous decision is preserved in-place; a new entry is added below it with the same ID and a `(superseded by)` note. Audit trail intact.

Other decisions stay locked. Sibling decisions are not auto-revisited even if they look related — the user re-opens each one explicitly.

## What goes here vs. in the registers

| Belongs in Decision Log | Belongs in Registers |
|---|---|
| Choices made between alternatives ("we chose X over Y, Z") | Single-claim facts ("X is true; here's the source") |
| Choices deferred with a default ("we'll decide later, default is X") | Open questions with no default ("we don't know what to do here") |
| Architectural / strategic commitments | Tactical risks and unknowns |
| Decisions a future founder would re-open if the world changed | Information that's just *true* or *not yet known* |

When in doubt: a `D` is something the team *did*; a register entry is something the team *believes*, *doesn't know*, or *worries about*.

## Worked example — same spec as in [assumption-register-format.md](assumption-register-format.md), Decision Log

```markdown
## Decision Log

### Decisions Made

#### D1: Web app for v1, not Chrome extension
- **Date:** 2026-04-27
- **Decided by:** Bharani
- **Alternatives considered:** Chrome extension (deeper integration), Web app (chosen), Desktop app (overkill)
- **Why web app won:** Lower friction for first 10 customer interviews; faster iteration; no Chrome Web Store review cycle blocking releases
- **Reversibility:** two-way (rebuilding as extension is ~2 weeks if we hit a wall)
- **Trigger to revisit:** First 20 paying customers AND ≥30% request "always-available" placement
- **Linked:** O1 (originally deferred; resolved early because ad-hoc validation needed a working prototype)

#### D2: Bharani solo on tech; Sara owns design + GTM
- **Date:** 2026-04-27
- **Decided by:** Bharani + Sara
- **Alternatives considered:** Both founders cross-functional, hire third person early
- **Why solo-tech-led won:** Bharani has 10 yrs backend; Sara has zero engineering background; hiring at v1 burns runway before validation
- **Reversibility:** two-way (can re-org any time)
- **Trigger to revisit:** Either founder >60% utilized for 4 weeks straight
- **Linked:** R3 (single-points-of-failure risk)

### Decisions Deferred

#### O2: Tier structure beyond Solo ($29/mo)
- **Why deferred:** Solo tier is the bet; Team and Enterprise tiers are speculative until 100 paying solo founders
- **Trigger to revisit:** 100 paying Solo customers OR first inbound from a 5-founder team
- **Owner:** Sara
- **Default if forced:** Mirror Beehiiv: Team at $79/mo for up to 5 seats, Enterprise custom
- **Linked:** A2 (anchor pricing assumption), F2 (Beehiiv pricing benchmark)

#### O3: Multi-tenancy — single DB or per-customer schema?
- **Why deferred:** First 50 customers fit in single DB; schema split adds operational cost we don't need yet
- **Trigger to revisit:** 50 paying customers OR first enterprise contract requesting data isolation
- **Owner:** Bharani
- **Default if forced:** Single DB with tenant_id column; per-customer schema is a 2-week migration
- **Linked:** A4 (enterprise interest), R7 (data-isolation request risk)
```

Three locked-in decisions, two parked-for-now decisions. The next reader (or `--refresh` next month) sees the shape of what's been settled vs. what's still on the table without reading anything else.

## Anti-patterns

- **"D7: We'll figure out pricing later."** Pricing is either decided (`D`), parked with a default (`O`), or the spec isn't ready to ship.
- **"D12: Use the best framework for the job."** Specifically *which* framework? If unspecified, this is a Note, not a Decision.
- **"O5: Maybe we should add SSO?"** No trigger, no owner, no default. Either commit to deferring (with all four fields) or drop the entry — half-tracked questions are worse than untracked ones because they create a false sense of having thought about something.
- **Long-tail decisions in the registers.** A spec where load-bearing choices live in `R` (Risks) entries instead of `D` (Decisions Made) is a spec where the team is hedging. Promote them.
