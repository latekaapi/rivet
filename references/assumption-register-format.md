# Assumption Register Format

The four-register pattern is the spine of `/rivet spec`'s validation phase. Every claim in the spec lives in exactly one register. The registers are how the spec earns the right to be a build authorization rather than wishful thinking.

## The four registers

| Code | Register | Definition |
|---|---|---|
| `F` | Known Facts | Verified externally. Has a citation (URL, customer-conversation note, observed metric) and a date. |
| `A` | Stated Assumptions | Believed but unverified. Has a validation method and a deadline. |
| `O` | Open Questions | Deferred decisions. Has a trigger condition and an owner. |
| `R` | Risks | Acknowledged unknowns. Has a mitigation or an explicit acceptance. |

The split between `A` and `R` is the most common confusion. Use this rule:

- **`A`** if the team intends to validate it and a future answer changes the bet.
- **`R`** if the team has decided to live with the unknown (mitigated or accepted as background risk).

If you can't decide, it's an `A` until the team explicitly accepts the risk.

The split between `O` and `A` is similar:

- **`A`** if the team has a position ("we believe X") that needs testing.
- **`O`** if the team has *no* position yet — the question is still open.

`O` upgrades to `A` once the team takes a position. `A` upgrades to `F` once verified.

## Per-entry format

### Known Facts

```markdown
- **F1: 14k subscribers in r/founders discuss weekly investor update fatigue.**
  - Source: https://reddit.com/r/founders/search?q=update+fatigue
  - Verified: 2026-04-15
  - Notes: Top thread had 340 upvotes, 89 comments naming specific tools used
```

Every `F` entry has:
- One-line claim.
- **Source** — URL, customer name + date, file path to interview notes, or "internal observation: [metric]".
- **Verified** — date the source was checked.
- **Notes** — one or two lines of supporting detail.

If a fact's source goes 404 or its date is >12 weeks old, refresh re-verifies (Step 6.3 of [spec.md](../spec.md)).

### Stated Assumptions

```markdown
- **A2: Solo founders will pay $29/month for this.**
  - Validation method: 5 customer interviews testing willingness-to-pay
  - Deadline: 2026-06-01
  - Owner: Bharani
  - If invalidated: pricing drops to $19 anchor; revisit Tier structure (D5)
```

Every `A` entry has:
- One-line claim.
- **Validation method** — how this gets confirmed or disproven. Concrete: "5 customer interviews", "landing page CTR test", "1-week beta with 10 users". Not "ask around" or "we'll see."
- **Deadline** — when the validation runs by.
- **Owner** — single person.
- **If invalidated** — what changes if this doesn't hold. This is the leverage check: if nothing changes, the assumption isn't load-bearing and should be downgraded to a Note.

### Open Questions

```markdown
- **O3: Multi-tenancy — single DB or per-customer schema?**
  - Why deferred: First 50 customers fit in single DB; schema split adds operational cost we don't need yet
  - Trigger to revisit: 50 paying customers OR first enterprise contract requesting data isolation
  - Owner: Bharani
  - Default if forced: Single DB with `tenant_id` column; per-customer schema is a 2-week migration
```

Every `O` entry has:
- One-line question.
- **Why deferred** — what makes it safe to not decide yet.
- **Trigger to revisit** — observable condition that forces the decision.
- **Owner** — who calls it when triggered.
- **Default if forced** — what gets shipped if a decision is needed today.

The "default if forced" line is the most-skipped and most-load-bearing field. If the team can't articulate what they'd ship today, the question isn't actually deferrable — it's an `A` masquerading as an `O`.

### Risks

```markdown
- **R5: OpenAI rate limits on bulk update generation.**
  - Severity: medium
  - Likelihood: high (already hit during prototype)
  - Mitigation: queue + retry; batch size cap at 50 updates/run
  - Accepted: yes — batch >100 will be slow; documented in product UX
```

Every `R` entry has:
- One-line claim.
- **Severity** — low / medium / high / existential.
- **Likelihood** — low / medium / high (or specific %, when known).
- **Mitigation** — what's done about it. "None" is allowed if accepted.
- **Accepted** — yes / no. If `no`, this should probably be an `A` instead.

Existential risks that can't be mitigated → kill criterion (force the decision via Step 2.6 of [spec.md](../spec.md)).

## Rules for moving entries between registers

Research findings must update registers. A research phase that doesn't reclassify any entries wasn't useful — it was skimming.

Allowed transitions:

```
A → F        Validation succeeded. Move to Facts; record the validation
             evidence as the Source.
A → R        Validation failed. Move to Risks with note: "previously
             assumed, disproven by [reason/source]." Severity inherits
             from the "If invalidated" line.
A → O        Validation deferred (lost the deadline; not yet abandoned).
             Set a trigger; owner stays.
O → A        Team took a position. Add validation method and deadline.
O → F        Question answered without deliberation (e.g., research
             surfaced a definitive answer). Rare.
R → A        Team decided to validate (e.g., severity rose, mitigation
             insufficient). Promote with deadline.
R → F        Risk crystallized into a known fact (e.g., "API rate limit
             is exactly 60 RPM" — used to be uncertain, now measured).
F → R        Source went 404 or got contradicted. Demote with note.
```

Disallowed:
- `F → A` (a verified fact doesn't become an assumption again unless the source breaks; that's `F → R`).
- Skipping registers (e.g., `O → F` without going through `A`) is allowed but rare; require a one-line justification.

Every transition gets logged in the spec's `## Refresh Log` (Step 6.8 of [spec.md](../spec.md)) with the date and reason.

## ID conventions

- IDs are stable. `A2` stays `A2` even if `A1` gets promoted to `F`.
- When `A2` becomes `F2`, the new entry uses the new register's number sequence (next free `F`), but the spec keeps a one-line breadcrumb in the Refresh Log: *"A2 → F: solo founders willing to pay $29 (validated 2026-06-01, 4/5 interviews positive)."*
- Cross-references in capabilities and decision logs use the *current* ID. If a capability depended on `A2` and `A2` migrated to `F4`, update the dependency to `F4` during refresh.

## What does NOT go in the registers

- **Decisions made.** Those go in the Decision Log (`D` entries; see [decision-log-format.md](decision-log-format.md)).
- **Phase plan / capabilities.** Those are in their own sections.
- **Background context the team already knows.** If a fact is "the sky is blue" obvious to the founders, it doesn't need to be `F1`. Registers track *load-bearing* claims.
- **Tasks / TODOs.** Those go in capability success criteria or the Notes section.

The test: if removing the entry from the spec changes the bet, kill criteria, or build plan, it belongs in a register. If not, it's a Note.

## Worked example — going from braindump to registers

Input braindump:

> *"I want to build a tool that auto-writes weekly investor updates for founders. I think solo founders especially struggle with this — there's a Reddit thread I saw with hundreds of comments. Should be easy with GPT-4. Charge $29/mo, like Beehiiv. Question is whether to do it as Chrome extension or web app. Worried about OpenAI costs blowing up at scale."*

Extracted registers:

```markdown
### Known Facts
- **F1: Reddit r/founders has discussion threads about weekly investor update friction.**
  - Source: https://reddit.com/r/founders/...
  - Verified: 2026-04-27
  - Notes: User-cited thread with "hundreds of comments"; need to capture URL + count

### Stated Assumptions
- **A1: Solo founders are the highest-pain segment.**
  - Validation method: 5 customer interviews comparing solo vs. team-of-3 pain
  - Deadline: 2026-05-15
  - Owner: Bharani
  - If invalidated: positioning shifts to "founders sending weekly stakeholder updates" (broader)

- **A2: Founders will pay $29/month, anchored to Beehiiv.**
  - Validation method: landing-page A/B test ($19 vs $29) + 3 willingness-to-pay convos
  - Deadline: 2026-06-01
  - Owner: Bharani
  - If invalidated: drop to $19 anchor; revisit Tier structure

- **A3: GPT-4 quality is good enough for unedited drafts.**
  - Validation method: generate 10 sample updates from real founder data; have 3 founders rate edit-distance
  - Deadline: 2026-05-08
  - Owner: Bharani
  - If invalidated: switch to Claude or local Llama; revisit cost projections

### Open Questions
- **O1: Chrome extension vs. web app for v1?**
  - Why deferred: bet hasn't been validated; either could ship a v1 prototype
  - Trigger to revisit: after A1 + A2 validation
  - Owner: Bharani
  - Default if forced: Web app — lower friction for first 10 customer interviews

### Risks
- **R1: OpenAI cost per customer scales unfavorably.**
  - Severity: medium
  - Likelihood: medium (depends on update length distribution)
  - Mitigation: monitor at $5k/mo total spend; switch to local Llama if per-customer cost >$30/mo
  - Accepted: yes — captured as kill criterion K3
```

Six register entries from a five-sentence braindump. Each is load-bearing. Each has a future action attached. The bet is now executable.
