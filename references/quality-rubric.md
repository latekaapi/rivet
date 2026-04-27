# Quality Rubric

The rubric `/rivet spec` Step 4.6 runs against the finished spec to score quality. Borrowed in spirit from github/spec-kit's checklist pattern — "unit tests for English."

Score each dimension 0–3 independently. Total score reported in the spec's frontmatter as `Quality score: N/M`.

## Pass thresholds

| Mode | Threshold |
|---|---|
| `--deep` | ≥2 on every dimension |
| `--lite` | ≥1 on every dimension; ≥2 on bet statement and target customer |

If any dimension scores below threshold, present the failed dimensions and what they'd need to clear. Offer:
- Fix now (one dimension at a time).
- Accept and document as `## Low-Confidence Warnings` near the top of the spec.
- `--force` past (still records warnings).

## The rubric

| # | Dimension | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|
| 1 | **Bet statement falsifiable** | Vague aspiration ("help founders be productive") | Has a desired outcome but no observable signal | Has a measurable signal but no falsifying condition | Fully falsifiable: target customer + outcome + observable success signal + observable failure signal + date |
| 2 | **Target customer named** | Abstract ("everyone", "businesses") | Segment ("B2B SaaS founders") | Persona with detail (size, situation, current behavior) | Persona + 2–3 named real people the founders have talked to |
| 3 | **Demand signals cited** | None | Anecdotal ("people I know want this") | One verifiable signal (Reddit thread URL, paid pilot, search trend) | Multiple verifiable signals across distinct sources |
| 4 | **Assumption register populated** | None | Some `A` entries | All four registers (F/A/O/R) populated | All four + every `A` has validation method + deadline + owner |
| 5 | **Kill criteria specific** | None | Conditions named ("if it's not working") | + observable conditions | + observable + dates + named responses (pivot / kill / accept) |
| 6 | **Bet sizing complete** | None | Some costs estimated | Full table (time, money, founder hours, opportunity cost) | + reversibility analysis (one-way vs. two-way doors per major decision) |
| 7 | **Opposition register** | None | <3 objections | ≥5 ranked objections | ≥5 ranked + recommended response per objection + author action per objection |
| 8 | **Architecture decisions logged** | None | Decisions listed | + alternatives considered for each | + alternatives + rationale + reversibility + trigger to revisit + date |
| 9 | **Capabilities decomposed** | None | Capabilities listed | + dependency links to registers | + success criterion per capability + who-it-serves |
| 10 | **Non-goals declared** | None | <3 | ≥3 | ≥3 + reasoning per non-goal |
| 11 | **Pricing strategy** | None | Anchor price named | + tier structure + anchor competitor cited | + tier structure + free-tier decision + add-on logic + linked to F-citations |
| 12 | **Go-to-market** | None | Channel named | + sequencing + viral hook | + channels linked to F-citations from distribution research |

## Per-dimension calibration notes

### 1. Bet statement falsifiable

The single most important dimension. A spec that scores 0 here can't be saved by scoring 3 on everything else — there's nothing to validate.

- **0 → 1:** Add a specific outcome ("cut update-writing time from 5 hrs to 30 min").
- **1 → 2:** Add a measurable signal ("self-reported by 70% of users at week 4").
- **2 → 3:** Add a falsifying signal AND a date ("if <30% report time savings by 2026-06-09, kill or pivot").

### 2. Target customer named

- **0 → 1:** Replace "everyone" with a segment.
- **1 → 2:** Add a constraint ("solo, B2B, $0–$2M ARR, currently writes weekly updates manually").
- **2 → 3:** Name 2–3 real people the founders have talked to. Names + how they're known.

### 3. Demand signals cited

Multiple sources beats one strong source. Diverse signal = robust signal.

- **0 → 1:** Add anecdotal signal (push for specifics: who said what when).
- **1 → 2:** Add one verifiable signal (URL, dated conversation, trend chart).
- **2 → 3:** Add a second signal from a different source class (e.g., one Reddit + one customer convo + one analogous-tool growth chart).

### 4. Assumption register populated

The four-register pattern is in [assumption-register-format.md](assumption-register-format.md).

- **0 → 1:** Extract any assumption the bet depends on.
- **1 → 2:** Categorize into all four registers (some F, some A, some O, some R).
- **2 → 3:** Every `A` has validation method + deadline + owner. The "if invalidated" line names a specific change.

### 5. Kill criteria specific

≥3 in `--deep`, ≥1 in `--lite`. Format in spec.md Step 2.6.

- **0 → 1:** Name conditions in plain language.
- **1 → 2:** Make them observable (anyone could check; no judgement calls).
- **2 → 3:** Add dates + named responses ("pivot to X" or "kill" — not "we'll figure it out").

### 6. Bet sizing complete

- **0 → 1:** Estimate any costs.
- **1 → 2:** Full table — time-to-validate, time-to-MVP, $-to-validate, $-to-MVP, founder hours, opportunity cost.
- **2 → 3:** Add reversibility column for each major decision (one-way / two-way + why).

### 7. Opposition register

Adversarial-pass output. Format in spec.md Step 2.8.

- **0 → 1:** Some objections.
- **1 → 2:** ≥5 ranked objections.
- **2 → 3:** Each objection has a recommended response (more research / change bet / kill / accept) AND a named author action.

### 8. Architecture decisions logged

Format in [decision-log-format.md](decision-log-format.md).

- **0 → 1:** Decisions listed.
- **1 → 2:** Alternatives considered for each.
- **2 → 3:** Each decision has alternatives + rationale + reversibility + trigger to revisit + date.

### 9. Capabilities decomposed

Format in spec.md Step 3.4.

- **0 → 1:** Capabilities listed.
- **1 → 2:** Each has dependency links to register entries.
- **2 → 3:** + success criterion per capability + who-it-serves named.

### 10. Non-goals declared

≥3, with reasoning. The cheapest scope-control device available.

- **0 → 1:** <3 non-goals.
- **1 → 2:** ≥3 non-goals.
- **2 → 3:** Each non-goal has a reason ("not now because <X>; reassess at <Y>").

### 11. Pricing strategy

- **0 → 1:** Anchor price named.
- **1 → 2:** + tier structure + anchor competitor cited from research.
- **2 → 3:** + free-tier decision + add-on logic + linked to F-citations.

### 12. Go-to-market

- **0 → 1:** Channel named.
- **1 → 2:** + sequencing (week 1–4, 5–8, …) + viral hook.
- **2 → 3:** Channels link to F-citations from distribution research; CAC tolerance named if paid.

## Calibration

The thresholds (≥2 deep, ≥1 lite) are starting points. Calibrate against [examples/headturn-spec.md](../examples/headturn-spec.md) — if HeadTurn (a known-good real-world spec) scores 2 on every dimension cleanly, the rubric is calibrated. If it scores 3 everywhere, the rubric is too easy. If it scores 1 on multiple dimensions, the rubric is too hard.

Adjust dimension wordings (not the thresholds) to keep HeadTurn at a clean 2. The thresholds are stable; the wording is the variable.

## How to score in practice

The Step 4.6 hygiene-review subagent is also the rubric scorer. Prompt:

```
You are scoring a strategic execution document against a 12-dimension rubric.
For each dimension, output a number 0–3 and a one-sentence justification.

Be strict — score 2 only when the dimension's level-2 criteria are *fully* met.
Score 3 only when the level-3 criteria are met, including the "+" additions.

Do not soften scores to be encouraging. The spec is better off with a 1
the user can fix than a 2 the user can't trust.

Output format:
  | # | Dimension | Score | Why this score |
  |---|-----------|-------|----------------|
```

Run the rubric exactly once at Step 4.6. Don't re-run after fixes — that creates incentive for the team to teach the rubric instead of fix the spec. If the user fixes a dimension, increment the score by hand and document it in the Refresh Log.

## Anti-patterns

- **Ceiling-chasing.** Trying to hit 3 on every dimension makes specs longer, not better. ≥2 is the deep target; "perfect" specs are usually padded.
- **Score-as-permission.** A high rubric score doesn't validate the bet — it validates that the spec captured the bet rigorously. The bet still has to be right.
- **Re-scoring during refresh.** Refresh updates the registers and recommends; it doesn't re-score automatically. New score happens only when the user explicitly requests it (`--rescore`) — or when refresh promotes/demotes register entries enough that the dimension clearly changed.
- **Treating the rubric as a checklist.** The rubric measures rigor; it doesn't measure whether the rigor went into the right things. A spec with a perfect 12/12 score on the wrong question is still wrong.

## Worked example

A spec for "weekly investor update tool for solo founders" might score:

```
| #  | Dimension                       | Score | Why                                                   |
|----|---------------------------------|-------|-------------------------------------------------------|
| 1  | Bet statement falsifiable       | 3     | Full template, observable signal, kill date           |
| 2  | Target customer named           | 3     | Solo founders + 3 named people + segment constraints  |
| 3  | Demand signals cited            | 2     | Reddit thread + 3 interviews; could add tool-growth  |
| 4  | Assumption register populated   | 2     | All four registers; 1 of 5 A's missing deadline       |
| 5  | Kill criteria specific          | 3     | 4 criteria with dates and named responses             |
| 6  | Bet sizing complete             | 2     | Full table; reversibility analysis on 2 of 4 decisions|
| 7  | Opposition register             | 3     | 6 objections, ranked, with responses + actions        |
| 8  | Architecture decisions logged   | 2     | Decisions logged; some missing trigger-to-revisit     |
| 9  | Capabilities decomposed         | 3     | 5 capabilities with deps + success criteria + audience|
| 10 | Non-goals declared              | 3     | 4 non-goals with reasoning                            |
| 11 | Pricing strategy                | 2     | Anchor + tiers; free-tier decision missing            |
| 12 | Go-to-market                    | 2     | Channels + sequencing; CAC tolerance not yet named    |

Total: 30/36
```

`--deep` threshold passed (every dimension ≥2). Spec is `Status: Complete` candidate. Three dimensions at 2 are surfaced as "could lift to 3 with X" but don't block.
