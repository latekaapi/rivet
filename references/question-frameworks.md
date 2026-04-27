# Question Frameworks

Question banks that drive `/rivet spec`'s clarification interview (Step 2.2 of [spec.md](../spec.md)). Use one question at a time, multiple choice when possible, always offer "Other / I'm not sure / Skip."

Stop when the next question wouldn't change the spec. Targets: 4–8 questions in `--deep`, 2–3 in `--lite`.

## Priority order (which bank to draw from first)

1. **Bet shape** — without a bet, nothing else matters
2. **Audience** — who specifically
3. **Demand evidence** — why now
4. **Constraints** — time, money, runway
5. **Opportunity cost** — what gets sacrificed
6. **Moat** — what compounds
7. **Reversibility** — what locks in
8. **Architecture tradeoffs** — only when bet is settled
9. **Pricing** — only when audience + value are clear
10. **GTM** — only when audience + value are clear

The first 7 are bet-validation questions. The last 3 are architecture/synthesis-phase questions and only fire after Step 2.10's "Proceed to architecture" recommendation.

## 1. Bet shape

**Goal:** Pin down what's actually being bet on, in falsifiable form.

| Question | When to ask | What to listen for | Follow-up if vague |
|---|---|---|---|
| What's the smallest version that proves this works? | Always — first or second question | A specific deliverable + a specific signal | "What would a one-week test look like?" |
| If this works, what changes for the customer? | When outcome is described abstractly | A behavior change ("they stop doing X", "they switch from Y to us") | "What does their week look like differently?" |
| What would the customer have done instead? | Always — names the alternative | A named tool, a manual workflow, or "nothing" | "Who's currently solving this for them, even badly?" |
| What's your one-sentence pitch? | Early, to surface positioning | Subject + verb + benefit, no buzzwords | "If a friend asked at dinner, what would you say?" |

Anti-patterns to flag:
- "We'll know when we see it" → push for an observable signal.
- "Everyone needs this" → push for a specific person who needs this.
- "The market is huge" → push for a beachhead segment.

## 2. Audience

**Goal:** Move from "small businesses" to "solo founders building B2B SaaS, $0–$2M ARR, who already write weekly investor updates."

| Question | When to ask | What to listen for | Follow-up if vague |
|---|---|---|---|
| Name 2–3 specific people you've talked to about this. | First audience question | Real names + how the user knows them | "Who's the most enthusiastic? Why?" |
| What do they have in common that distinguishes them from people who *don't* need this? | When the segment feels broad | A constraint, a workflow, or a context | "What's the hardest version of their job that this helps with?" |
| Where do they hang out online or in person? | Always | A specific subreddit, Slack, conference, Discord | "If you wanted to message 50 of them tomorrow, where would you go?" |
| Who would you NOT sell to, even if they asked? | When segment is fuzzy | Named anti-segment + reason | "What would make them a bad fit?" |

Anti-patterns to flag:
- "Anyone who needs X" → no segmentation; will fail GTM.
- "B2B" or "SMBs" alone → not a segment, a category. Push for sub-segment.
- "Both consumer and business" → almost always a sign of unfocused thinking. Force a pick for v1.

## 3. Demand evidence

**Goal:** Find the strongest piece of evidence this is actually wanted.

| Question | When to ask | What to listen for | Follow-up if vague |
|---|---|---|---|
| What's the strongest piece of evidence this is wanted? | Always — second or third question | A URL, a customer quote, a paid pilot, a search-trend chart | "What would convince a skeptical co-founder?" |
| What's the strongest piece of evidence this is *not* wanted? | After the positive evidence | Failed attempts, lukewarm reception, declining trend | "Has anyone tried something similar and stopped? Why?" |
| Has anyone paid you (or said yes to paying) for an early version? | When evidence feels thin | Yes / No / "they said maybe" | "What would it take to get one paid pilot in 2 weeks?" |
| If you stopped working on this tomorrow, who would be sad? | Pull-test for actual demand | Names + how they'd find out | "How much would they pay to keep it alive?" |

Anti-patterns to flag:
- "I just have a feeling" → not evidence.
- "Everyone I talk to says they'd use it" → social politeness; push for *paid* signal.
- "There's a Reddit thread" → good start; push for thread URL + comment count + recency.

## 4. Constraints

**Goal:** Surface what limits the bet — time, money, dependencies, expertise.

| Question | When to ask | What to listen for | Follow-up if vague |
|---|---|---|---|
| How much runway do you have for this bet? | Always — bet sizing input | Months of runway + monthly burn | "What happens at month N if it hasn't worked?" |
| What's the cheapest way to test this in 2 weeks? | When bet feels expensive | A landing page, a manual prototype, a paid pilot | "Could you fake the backend for the first 5 customers?" |
| What expertise are you missing? | Operating model question | Concrete gap (sales, design, ML, ops) | "Who's done this kind of thing before, that you could ask?" |
| What dependencies could break this? | Pre-research, surface what to scout | API availability, partner approval, regulatory | "If [dependency] disappeared tomorrow, what would you do?" |

Anti-patterns to flag:
- "Money's not a problem" → still ask the cheapest-test question; cheap tests learn faster regardless.
- "I'll figure it out" — accept once, but not for load-bearing constraints. Push for a plan.

## 5. Opportunity cost

**Goal:** Force a comparison against what else the founder could be building.

| Question | When to ask | What to listen for | Follow-up if vague |
|---|---|---|---|
| If not this, what would you build? | Always — bet sizing input | A second concrete bet | "What's the strongest argument for that one?" |
| What did you say no to, to work on this? | Surfaces past tradeoffs | A named alternative, a contract, a job offer | "Why did this one win?" |
| What's your opportunity cost per week? | When bet sizing feels casual | Dollar value or named alternative | "What would you charge a client for that week?" |

Anti-patterns to flag:
- "This is the only thing I'd want to work on" — possible, but rare. Probe gently; the comparison is still useful for the spec.

## 6. Moat

**Goal:** Surface what makes this defensible — or accept that nothing does.

| Question | When to ask | What to listen for | Follow-up if vague |
|---|---|---|---|
| If a well-resourced competitor copies this in 6 months, what's left? | Always | Network effect, brand, distribution, integration depth, switching cost | "What would they have to *also* build?" |
| What compounds as you grow? | When moat is unclear | Data, community, content, integrations | "What's worth more to customer #1000 than to customer #1?" |
| What's your unfair advantage? | The bet template asks this — verify it | Specific asymmetry (relationships, expertise, speed, ownership of a channel) | "Who could *not* build this, and why?" |

Anti-patterns to flag:
- "First-mover advantage" → almost never a moat alone. Push for the underlying mechanism.
- "We'll just execute better" → not a moat; a hope.
- "Our team is great" → not a moat; everyone says this.

## 7. Reversibility

**Goal:** Surface one-way doors. Two-way doors don't need this much rigor.

| Question | When to ask | What to listen for | Follow-up if vague |
|---|---|---|---|
| If this fails, can you pivot the product or do you have to start over? | Always | "Pivot" / "restart" / "sell for parts" | "What pieces are reusable in the next bet?" |
| What's the most expensive decision in this bet to reverse? | When architecture starts forming | Positioning, brand name, stack, data model, contract terms | "Why is that one hard to reverse?" |
| Are there decisions you're making now to optimize for v1 that will be expensive at v10? | Architecture phase | Stack choice, data model, customer segment | "What's the migration path if v10 needs something different?" |

Anti-patterns to flag:
- "It's all reversible" → rarely true. Push for one specific one-way door.
- "We'll deal with that when we get there" — accept once for non-existential items; push back for positioning, brand, or core data model.

## 8. Architecture tradeoffs

**Goal:** Surface the build/buy/sync/async/monolith/services calls. Only after the bet is settled.

| Question | When to ask | What to listen for | Follow-up if vague |
|---|---|---|---|
| Build, buy, or partner for [component]? | Per major component | A reasoned pick + alternatives | "What's the cost of buying it wrong?" |
| Sync or async for [user-facing flow]? | When latency vs. consistency tradeoff exists | Latency budget + UX implication | "What does the user see while they wait?" |
| How important is real-time? | Streaming vs. batch decisions | A tolerable freshness window | "Is 5 minutes OK? 1 hour? 1 day?" |
| Multi-tenant or single-tenant for v1? | Data isolation question | Customer segment expectations | "What would the first enterprise contract require?" |

## 9. Pricing

**Goal:** Anchor pricing to a competitor and a customer signal, not to a guess.

| Question | When to ask | What to listen for | Follow-up if vague |
|---|---|---|---|
| What does the closest competitor charge? | Always — anchor reference | A specific price + source | (research it if unknown — Step 2.5) |
| Who pays — the user or their company? | Always | "User out of pocket" vs. "company expense" — different price tolerances | "Is this a credit-card SaaS or a procurement-cycle SaaS?" |
| What's the customer's alternative cost (manual time, current tool)? | When anchor pricing is unclear | Hours/week × hourly rate, or current tool's price | "If they spent 5 hrs/week on this manually, what's an hour worth to them?" |
| Free tier — yes or no? | When acquisition strategy is being shaped | A reasoned decision | "What does free *teach* you that paid doesn't?" |

Anti-patterns to flag:
- "We'll start free and figure out monetization later" → spec it as `O2` (Decision Deferred) with default if forced.

## 10. GTM

**Goal:** Pick a primary channel based on where the audience already is.

| Question | When to ask | What to listen for | Follow-up if vague |
|---|---|---|---|
| Where does the audience congregate? | Always | A specific platform / community | (research it if unknown) |
| What's the viral hook? | When the product has any user-visible artifact | "Made with X" footer, shareable output, public profile | "What does the customer want to show off?" |
| What's the content strategy? | When organic-first is the plan | Topic + cadence + channel | "Could you commit to N posts/week for 6 months?" |
| Paid vs. organic for v1? | Always | A reasoned choice based on CAC tolerance | "What CAC kills the bet?" |

## How to compose questions in a session

A `--deep` session typically pulls 1–2 questions from each of these banks, in priority order:

```
Q1 (Bet shape):       What's the smallest version that proves this works?
Q2 (Audience):        Name 2–3 specific people you've talked to about this.
Q3 (Demand evidence): What's the strongest piece of evidence this is wanted?
Q4 (Constraints):     How much runway do you have for this bet?
Q5 (Opportunity cost):If not this, what would you build?
Q6 (Moat):            If a well-resourced competitor copies this in 6 months,
                      what's left?
Q7 (Reversibility):   What's the most expensive decision in this bet to reverse?
```

A `--lite` session compresses to 2–3:

```
Q1 (Bet shape + Audience): What's the smallest version that proves this works,
                            and who's the first person who'd pay for it?
Q2 (Demand evidence):       What's the strongest piece of evidence this is wanted?
Q3 (Reversibility):         What's the most expensive decision in this bet
                            to reverse?
```

Skip a bank if the input already answered its question. The bet template at the end of Step 2.3 is the test: if every clause is filled with a specific, concrete answer, no more questions are needed.
