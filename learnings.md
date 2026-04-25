# /rivet learnings — End-of-Session Knowledge Capture

Final pre-commit sweep: did we learn anything in this session that the next person (or agent) working in this repo will regret not having written down?

The bar is **high**. Most sessions produce nothing worth adding. That's fine. Saying "nothing worth adding" is a valid — and often correct — outcome. Do not invent findings to justify this skill.

## Step 1: Gather Context

**Walk every learnings-scratch file first if any exist.** Search recursively under `docs/plans/` — spec-scoped scratches live at `docs/plans/{spec}/{phase}/learnings-scratch.md`, ad-hoc scratches at `docs/plans/adhoc/{name}/learnings-scratch.md` (or `docs/plans/adhoc/learnings-scratch.md` for flat single-file ad-hoc plans). Collect them all — across specs and ad-hoc — so a session that touched multiple phases doesn't drop signals from other scratches.

These files are the primary signal — entries were appended during execution, when the context was fresh. Each line is tagged `[correction]`, `[discovery]`, or `[decision]`. These entries are the candidates most likely to clear the bar; conversation-memory is the secondary source.

Then run these in parallel:
- `git diff` (unstaged) and `git diff --cached` (staged) — what actually changed
- `git status` — new files, deleted files
- `git log --oneline -20` — recent commit style and scope
- Read `CLAUDE.md` if it exists (project root, then `.claude/CLAUDE.md`)
- Read `README.md` if it exists
- Read every spec in the repo (list `docs/specs/*.md`; if empty, fall back to root `spec.md`) — needed for contradiction checking across all specs

Also re-read this session's conversation for anything the scratch file missed: user corrections not captured, stumbles, non-obvious discoveries. The scratch file should have caught most of these in flight; use the conversation as a safety net.

## Step 2: Apply the Bar

A candidate learning is worth codifying **only** if it meets at least one of these:

1. **Non-obvious gotcha** — something that cost real time this session and will cost real time next time. ("DataForSEO's SERP API returns `items` as null instead of empty array when no results — must null-coalesce before iterating.")
2. **Convention the code doesn't self-document** — a pattern, naming rule, or structural choice that isn't visible from reading one file. ("All service classes return DTOs, never raw arrays — see SiteFetchResult as the reference pattern.")
3. **User correction that is reusable** — the user pushed back on an approach in a way that applies beyond this task. ("Don't use Laravel facades in service classes — use dependency injection for extractability into the Composer package.")
4. **External dependency or env requirement** — something a fresh clone wouldn't work without. ("Requires `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` in `.env` or the enrichment pipeline silently skips SERP data.")
5. **Architectural decision with a reason** — a choice that looks arbitrary without the why. ("Reddit API integration uses the free tier — no OAuth, just public endpoint with user-agent header. Sufficient for Phase 0 volume.")

**Reject** candidates that are:
- A summary of what this session accomplished (that's what commit messages are for)
- Restating what the code already makes obvious
- Generic best practices ("use TypeScript strict mode") that aren't specific to this project
- One-off debugging fixes that won't recur
- Anything already covered by existing CLAUDE.md / README.md content — **check before proposing**

## Step 3: Check for Spec Contradictions

Review each candidate learning against every spec discovered in Step 1 (covers `docs/specs/*.md` and the root `spec.md` fallback). A learning might contradict one spec's assumption but be consistent with another — check each separately and always flag which specific spec is affected.

For each candidate:
- Does this learning reveal that a spec assumption was wrong? Flag which spec (and section, if you can pinpoint one).
- Does this learning describe a deviation from a spec's architecture? If intentional, note why. If accidental, flag it as a concern, tagged with the spec it deviates from.
- Does this learning describe a discovery that should update a spec's decision log? Suggest the specific entry and name the target spec.
- Does this learning reveal an inter-spec ownership collision (e.g. the learning was "ScanMetric model was built this session" but both `main.md` Phase 2 and `admin.md` Phase 1 plan to build it)? Flag it as a cross-spec ownership question, not just a single-spec issue.

**Do NOT modify any spec.** Only flag contradictions and suggest updates for the user to decide.

## Step 4: Decide the Target File

- **CLAUDE.md** — instructions *to Claude*. How to work in this repo. Commands, conventions, gotchas, "don't do X." Audience: the next AI agent in this repo.
- **README.md** — instructions *to humans*. Setup, architecture overview, deployment. Audience: a developer cloning the repo.

When in doubt: is this something that should be auto-loaded into every future AI session? → CLAUDE.md. Is this something a human needs during onboarding? → README.md.

If the project has no CLAUDE.md and the learning belongs there, propose creating one — but only if there's at least one solid entry to put in it. Don't create an empty scaffold.

## Step 5: Propose, Don't Commit

Present findings like this:

```
## Session Learnings

**Worth adding to CLAUDE.md:**
- [concrete proposed line or bullet, written in the voice/style of the existing file]
  Why: [one line — what it prevents or explains]

**Worth adding to README.md:**
- [same format]

**Spec contradictions detected:**
- [`{spec}.md`, Section X.Y] assumes A, but this session discovered B.
  Suggested decision log entry for `{spec}.md`: [draft entry]
- [`{spec-a}.md` Phase N] and [`{spec-b}.md` Phase M] both plan to build {thing}. This session built it in one of them. Decide ownership.

**Considered but rejected:**
- [thing that almost made the cut] — [one-line reason it didn't]
```

Then ask: "Want me to apply the CLAUDE.md/README.md edits?"

Do **not** edit CLAUDE.md or README.md without explicit approval. These files are load-bearing — a bad edit poisons every future session in the repo.

## Step 6: Clean Up the Scratch File

After the user has reviewed findings — whether they apply edits or reject them — delete every scratch file walked in Step 1 (across all specs and ad-hoc plans). Scratch content that cleared the bar is now codified in CLAUDE.md/README.md (or a spec decision log); content that didn't clear the bar was discarded intentionally. Keeping stale scratch files across sessions leads to re-proposing the same rejected entries.

If the user chose "apply later" or left any decision open, leave the relevant scratch files in place and note in the final report which entries remain pending and in which file.

If nothing clears the bar:

```
## Session Learnings

Nothing worth codifying. [One sentence on why — e.g., "Straightforward feature work; the diff and commit messages capture everything."]
```

Still delete the scratch files — if nothing in them cleared the bar, keeping them will only re-propose the same rejected entries next session.

That's a complete, honest answer. Ship it and move on.
