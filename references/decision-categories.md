# Decision Categories

Decision types `/rivet spec` should expect to encounter, grouped. Used by Step 3.1 (architecture approach proposals) and Step 3.3 (architecture decisions logged) of [spec.md](../spec.md).

For each category: typical tradeoffs, when each option wins, and what to research before deciding. The decisions themselves get logged in the format documented in [decision-log-format.md](decision-log-format.md).

## Stack

Language, framework, hosting, database, queue, cache.

### Language / framework

| Option type | Wins when | Loses when |
|---|---|---|
| Familiar (team's primary language) | Speed-to-MVP matters; v1 doesn't need exotic capability | The fit is genuinely worse (e.g., Python for low-latency trading) |
| Best-fit-for-domain | The domain has strong defaults (TypeScript for browser-heavy, Go for low-latency, Python for ML) | Team has zero experience and runway is short |
| Hire-friendly | Plan to hire 2+ engineers in 12 months | Solo team for the foreseeable future |

**Research before deciding:**
- Hire-ability data: Stack Overflow developer survey, regional salary surveys.
- Ecosystem maturity: critical libraries available? Active maintenance?
- Hosting cost at projected scale.

### Database

| Option | Wins when | Loses when |
|---|---|---|
| Postgres | Default. Works for 95% of cases up to ~$10M ARR. | Workload is genuinely real-time analytical (use ClickHouse) or document-shaped (use Mongo, maybe) |
| SQLite | Single-tenant or per-customer DB; tiny ops surface | Multi-tenant with concurrent writes |
| Managed (Supabase / Neon / RDS) | Solo team; ops cost > infra cost | Massive scale; cost optimization needed |

**Research before deciding:**
- Read/write ratio at projected scale.
- Backup/restore RTO.
- Whether the cheapest tier handles dev + prod or just dev.

### Hosting

| Option | Wins when | Loses when |
|---|---|---|
| PaaS (Vercel, Fly, Railway, Render) | Solo team; v1; ops should be invisible | High-throughput; cost optimization at scale |
| Cloud VMs (DO, Hetzner, Linode) | Want predictable cost; comfortable with ops | Solo team optimizing for time, not cost |
| Hyperscaler (AWS, GCP, Azure) | Enterprise contracts requiring it; specific managed services | Solo team — too much complexity per dollar |

**Research before deciding:**
- Project monthly cost at v1 scale (5–50 customers) and v2 scale (500–5000).
- Migration cost if you outgrow the choice.
- SOC2 / compliance requirements (rule out PaaS for some enterprise sales).

## Data sources

APIs, scrapers, integrations, fallbacks.

| Option | Wins when | Loses when |
|---|---|---|
| Official API | Stable terms, predictable cost, auth handled | Rate limits too tight, pricing per-call exceeds value |
| Unofficial / scraped | No API exists, or API is too expensive | ToS violation risk, breakage on UI changes |
| Build the data yourself | Becomes a moat; API doesn't exist; cost is critical | Domain doesn't reward proprietary data |
| Buy the data | Time-to-value matters more than cost | Vendor lock-in, contract complexity |

**Research before deciding:**
- API rate limits and pricing curve at projected scale.
- Terms of Service for scraping (legal posture).
- Vendor stability — has the data source company laid off staff or pivoted recently?
- Backup plan: what happens if the source disappears?

**Common spec mistake:** Picking one source without a fallback. If the bet depends on API X, and X has no fallback, that's a Risk that should probably be a Kill Criterion.

## Pricing

Tier structure, anchor price, add-ons, free tier.

### Tier structure

| Option | Wins when | Loses when |
|---|---|---|
| Single tier | Simplicity is a feature; v1 with one segment | Multiple segments with different willingness-to-pay |
| Good / Better / Best (3 tiers) | Standard SaaS; segment differentiation by features | Audience is homogeneous (all paying the same makes more sense) |
| Per-seat | B2B with team buyers | Solo / consumer (per-seat math doesn't work for one user) |
| Usage-based | Customer value scales with usage; predictable per-unit | Customers hate variable bills (procurement-blocked) |

**Research before deciding:**
- Top 3 competitors' tier structures.
- Whether the buyer is the user (credit-card SaaS) or their company (procurement-cycle SaaS).
- Anchor price: what's the closest competitor's lowest paid tier?

### Free tier

| Option | Wins when | Loses when |
|---|---|---|
| Free tier (forever) | Acquisition cost is dominant; viral hook in product | Marginal cost per free user is non-trivial; converts <2% |
| Free trial (time-limited) | Want to learn from usage but force conversion | Onboarding friction is high; users don't get to value in trial window |
| No free tier | Selling to companies; high marginal cost | Audience expects free entry (consumer) |

**Research before deciding:**
- Marginal cost of a free user (LLM tokens, storage, support time).
- Conversion rates at the closest competitor's free tier.
- Free-to-paid conversion industry benchmarks (typically 2–5% for B2B SaaS).

## Go-to-market

Primary channel, viral hook, content strategy, paid vs. organic.

### Primary channel

| Option | Wins when | Loses when |
|---|---|---|
| Inbound content | Audience reads / searches; founder has writing capacity | Audience is offline / non-readers; runway too short for content compound |
| Cold outbound | Audience is reachable + identifiable; ACV ≥ $5k | ACV < $1k (math doesn't work); audience hates cold email |
| Build-in-public (Twitter / IndieHackers) | Founder audience; consumer / prosumer SaaS | Enterprise; serious buyer ignores founder-content noise |
| Paid acquisition | CAC < LTV * 0.3 in tests | Untested; runway dependent on volume |
| Partnership / channel | Channel partner has the audience | Partner economics don't work; partner deprioritizes you |

**Research before deciding:**
- Where does the audience already congregate? (See research-playbook distribution-channels area.)
- Founder's content capacity and existing audience.
- CAC math for paid: typical $/click, conversion to trial, conversion to paid.

### Viral hook

Always cheaper than paid acquisition when it works. Almost never works as designed.

| Option | Wins when | Loses when |
|---|---|---|
| "Made with X" footer / watermark | Output is shared publicly | Output is private (most B2B) |
| Public profile / portfolio | Customer wants to show off their work | Customer wants privacy |
| Referral program (paid) | Customers love the product enough to refer | Customers tolerate the product (most v1s) |
| Network effects in product | Value goes up with N users | Single-player utility |

**Research before deciding:**
- Will the customer's *output* of using this be public or private?
- Has any competitor in the space made viral mechanics work? Why or why not?

## Architecture

Monolith vs. services, sync vs. async, multi-tenant vs. single.

### Monolith vs. services

| Option | Wins when | Loses when |
|---|---|---|
| Monolith | Solo team; <50 engineers; v1 | Engineering team is large enough that team boundaries match service boundaries |
| Services (modular monolith) | Same as monolith but want clean module boundaries early | Modules are fictional — split too early |
| Microservices | Team size + scale demand independent deploy | Solo / small team — coordination overhead exceeds benefit |

**Research before deciding:**
- Team size now and in 12 months.
- Deploy frequency tolerance (services need infra to make deploys cheap).
- Whether modules genuinely have different scaling needs.

**Default: monolith for v1.** Splitting later is a known migration; splitting too early is unbounded coordination cost.

### Sync vs. async

| Option | Wins when | Loses when |
|---|---|---|
| Synchronous | User waits for the result; latency budget < 2s | Operation is genuinely long (LLM batch, image gen, ETL) |
| Asynchronous | Operation is long; user can do other things | Operation is fast and async UX adds confusion |

**Research before deciding:**
- Latency budget per user-facing operation.
- UX cost of "we'll email you when it's done."

### Multi-tenancy

| Option | Wins when | Loses when |
|---|---|---|
| Single DB, `tenant_id` column | v1 with <100 customers; simpler ops | First enterprise contract requesting data isolation |
| Schema-per-tenant | Mid-scale (100–1000); some isolation desired | Operational cost of N schemas exceeds team capacity |
| DB-per-tenant | Enterprise / regulated; per-customer infra | Cost is unsustainable below ~$1k/mo per customer |

**Research before deciding:**
- Compliance requirements at the tier you're targeting.
- Cost of migrating later (single DB → schema-per-tenant is ~2 weeks; schema → DB-per-tenant is ~6 weeks).

## Moat

OSS, network effects, brand, distribution, integrations.

| Moat | Wins when | Doesn't work when |
|---|---|---|
| OSS / community | Enterprise pull from devs; community drives adoption | No genuine OSS culture in the team; "open source as marketing" |
| Network effects | Value scales with N users (e.g., social, marketplace) | Pure utility software (no inter-user value) |
| Brand | Audience is brand-loyal; brand ≠ logo (it's reputation) | Commodity category; price-driven buyers |
| Distribution | You own a channel competitors don't (large audience, partnership) | Channel is rented (SEO, paid ads) |
| Integrations | Switching cost rises with each integration | Integrations are one-click for everyone |
| Data | Proprietary data improves the product over time | Data is widely available; no compounding |
| Switching cost | Customer's data / workflow / team is locked in | Workflow is portable |

**Research before deciding:**
- Has any competitor built a moat in this category? Which one, and how?
- What compounds for the customer the longer they use it?

**Anti-pattern:** "First-mover advantage." Almost never a moat alone — push for the underlying mechanism (was first because we own a channel, etc.).

## Operating

Team structure, expertise gaps, on-call.

### Team structure

| Option | Wins when | Loses when |
|---|---|---|
| Solo founder | Highest agility; no comms overhead | Domain breadth exceeds one person's capacity |
| Co-founders (cross-functional) | Complementary skills; high trust | Both founders want the same role |
| Hire third early | Critical skill missing both founders need | Runway is short; not yet proven |

**Research before deciding:**
- Skills genuinely missing vs. skills the team can learn.
- Runway impact of a hire.
- Geographic/timezone constraints.

### On-call

| Option | Wins when | Loses when |
|---|---|---|
| Both founders, alternating | Solo / 2-person team | Customers expect 24/7 SLA; small team can't sustain |
| Founder + paid on-call rotation (third party) | After product-market fit; $5k+ MRR | Pre-PMF; cost not justified |
| Outsourced support tier-1 | Volume justifies it | <$10k MRR — founders should be the ones handling tickets |

**Research before deciding:**
- Customer expectations for response time at the price point.
- Volume of tickets at projected scale.
- Cost of managed support vs. founder-time tradeoff.

## How to use this in `/rivet spec`

In Step 3.1 (architecture approach proposals), pull from this document to identify which categories the spec needs to make decisions in. Not every spec touches every category — a pure utility tool might skip "moat" entirely; a developer tool might skip "viral hook."

For each category in scope:
1. List the realistic options (using this doc as a starting point — adapt to the specific bet).
2. Research the unknowns per [research-playbook.md](research-playbook.md).
3. Propose 2–3 alternatives with explicit tradeoffs.
4. User picks; logged in [decision-log-format.md](decision-log-format.md) shape.

Skip a category if it's not load-bearing for the bet. A category that doesn't change the spec, the kill criteria, or the GTM doesn't need a decision logged.
