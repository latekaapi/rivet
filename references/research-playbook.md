# Research Playbook

How `/rivet spec` scopes research without spiraling. Used by Step 2.5 (competitive scout) and Step 3.2 (architecture research) of [spec.md](../spec.md).

The job of research in a spec is *not* to be exhaustive. It's to update the assumption registers (F/A/O/R) with enough confidence to make the bet executable. A research phase that doesn't reclassify any register entries was wasted budget.

## The dispatch pattern

Every research subagent gets exactly three things:

1. **One specific question** — not a topic. "Find 5–10 direct competitors and per-competitor: pricing, positioning, 3 strengths, 3 weaknesses, what they don't do." Not "research the market."
2. **One search budget** — a hard cap on web searches before the agent must return.
3. **One output spec** — the exact markdown shape it should produce.

Dispatch agents in parallel via the Agent tool, `subagent_type=general-purpose`. The coordinator (the main `/rivet spec` flow) merges results into `docs/specs/{name}-research.md` and updates registers.

```
For each research area in scope:
  Spawn Agent(
    subagent_type=general-purpose,
    description="<area>: <question>",
    prompt="<one-question> + <budget> + <output-spec>"
  )
All agents fire in a single message (parallel).
After all return:
  Merge into {name}-research.md
  For each finding:
    classify: confirms / invalidates / new-unknown
    update F/A/O/R registers in spec
```

## Per-area budgets and output specs

### Direct competitors

**Question:** Find 5–10 direct competitors of `[bet]`. Direct = same buyer, same job-to-be-done.

**Budget:** 5–8 web searches.

**Output:**

```markdown
## Competitor: [Name]

- **URL:** [primary site]
- **Pricing:** [tiers + anchor price]
- **Positioning:** [one-sentence pitch from their site]
- **Strengths:** [3 bullets]
- **Weaknesses:** [3 bullets]
- **What they don't do:** [the gap]
- **Verified:** [date]
```

**Done criteria:** 5+ competitors documented, OR 3 attempts to find more returned only adjacents (different buyer or different job). Adjacents are flagged separately, not counted.

**Anti-patterns:**
- Listing every tool in the category (irrelevant to the bet).
- Including the user's own product as a "competitor" (it's the bet, not a competitor).
- Stopping at 1–2 because "those are the obvious ones" — find at least 5 to surface the long tail.

### Pricing benchmarks

**Question:** What do the top 3–5 pricing-anchor competitors charge? What's included, what's add-on, what's the lowest-paid tier?

**Budget:** 3–5 searches.

**Output:**

```markdown
## Pricing Benchmark

| Tool | Lowest tier | Includes | Excludes / add-ons | Source |
|---|---|---|---|---|
| Beehiiv | $39/mo | 1k subs, basic analytics | Custom domains ($25), advanced analytics ($30) | https://beehiiv.com/pricing |
| ConvertKit | $25/mo | 300 subs, email broadcasts | Automations ($75/mo plan) | https://convertkit.com/pricing |
```

**Done criteria:** 3+ price points captured with sources.

**Anti-patterns:**
- "Pricing varies" — never useful; capture the published anchor.
- Capturing only the highest tier (custom enterprise) — the lowest paid tier is the real anchor.

### Tech / API options

**Question (per major component):** What are the 2–3 viable options for `[component]`? For each: cost model, lock-in, fit for `[stack]`.

**Budget:** 3–5 searches per component.

**Output:**

```markdown
## Component: [name, e.g., "LLM provider"]

| Option | Cost model | Lock-in | Fit | Notes |
|---|---|---|---|---|
| OpenAI GPT-4 | $/token | medium (proprietary API) | high (best structured output) | F8: structured-output benchmark |
| Anthropic Claude | $/token | medium | high | Similar latency profile |
| Self-hosted Llama 3.3 | infra cost | low | medium (engineering overhead) | Cheaper at $5k+/mo spend |
```

**Done criteria:** 2+ options with cost / lock-in / fit assessed.

**Anti-patterns:**
- Recommending one without listing alternatives — Step 3.1 needs alternatives to log them as Decision-Made context.
- Skipping the cost model — "it depends" is not an answer; pick a typical scenario and cost it.

### Adjacent threats

**Question:** Who could build this as a feature in 6 months and squash the bet?

**Budget:** 2–3 searches.

**Output:**

```markdown
## Adjacent Threats

- **Notion** — already does long-form writing; could add "investor update" template + AI as a v2 feature
- **Substack** — has the audience; could pivot from broadcast to private updates
- **Beehiiv** — direct competitor, but adjacent threat is the bigger players adjacent to *them*
```

**Done criteria:** 2+ adjacencies with the "could build this as a feature" lens.

### Distribution channels

**Question:** Where does `[audience]` congregate online? Which channels have the highest signal-to-noise for reaching them?

**Budget:** 2–3 searches.

**Output:**

```markdown
## Distribution Channels

| Channel | Audience density | Effort to enter | Notes |
|---|---|---|---|
| r/founders | high | low (post + engage) | 250k members, daily active |
| Twitter/X build-in-public | high | medium (need handle + cadence) | Founder audience already there |
| IndieHackers | medium | low (post + engage) | Smaller but high signal |
| Cold outbound | high | high (research + sequence) | Saved for after PMF signal |
```

**Done criteria:** 3+ channels with effort/return assessed.

## Coordinator behavior after agents return

For each finding, the coordinator must decide:

| Finding type | Action |
|---|---|
| Confirms an existing `A` (Stated Assumption) | Move `A` → `F` (Known Fact). Record finding as Source. |
| Invalidates an existing `A` | Move `A` → `R` (Risk) with note: "previously assumed, disproven by [finding]." |
| Surfaces a new fact | Add as new `F` entry with source + date. |
| Surfaces a new unknown | Add as `O` (Open Question) if no team position; `A` (Assumption) if team takes a position; `R` (Risk) if accepted as background. |
| Confirms an existing `F` | No action — already tracked. Don't duplicate. |
| Contradicts an existing `F` | Demote to `R` with note: "previously fact, contradicted by [finding]." |

If the coordinator can't classify a finding into one of these buckets, the finding probably isn't load-bearing — drop it.

## Done criteria for the research phase as a whole

Research is done when:

1. **Every register entry from Step 2.4 has been touched at least once** — confirmed, invalidated, or explicitly noted as still-unknown.
2. **The bet template's clauses are all backed by `F` or accepted-`R`** — no clause depends solely on an unverified `A`.
3. **The kill criteria reference observable signals** that the research surfaced, not vibes.

If any of these isn't true, dispatch one more targeted agent. Don't dispatch broad re-runs — surgical only.

## Budget exhaustion

If a subagent hits its search budget without a clear answer:

- Log the unknown as `O` (Open Question), not `R` (Risk). Risk implies *acknowledged*; Open Question implies *deferred*.
- Note the budget exhaustion in the research file: *"Budget exhausted on [question]. Deferred as O[N]; trigger to revisit: [N customers / N weeks]."*
- Do not silently skip — the spec needs the record that this question was attempted.

## What NOT to research

- **Things the team already knows.** If the founders have a five-year background in the domain, don't dispatch agents to teach them their own field. Trust their `F` entries.
- **Adjacent rabbit-holes.** If the bet is "weekly investor updates for solo founders," don't research the entire SaaS productivity market. Stay scoped to the bet.
- **Things the team can answer in 2 minutes.** If a question can be answered by asking the user, don't spend 5 search budget on it. Step 2.2 (clarification) handles that.
- **Nice-to-knows.** If a finding wouldn't change the spec (bet, registers, kill criteria, capabilities, decisions), don't research it.

## Time and cost guidance

Total research budget per `/rivet spec` deep run:
- Phase 1 (competitive scout): ~25 searches across 5 areas.
- Phase 2 (architecture research): ~15 searches across 3–5 components.

If the run is hitting >50 searches, scope is too broad — pull back to fewer areas with tighter questions.

`--lite` mode runs about 50% of these budgets — narrower scope, fewer areas. The rigor (per-area output spec, register updates) doesn't change.
