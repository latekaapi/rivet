# /rivet skill verification scenarios

> Manual test scenarios for the skill's full feature set. See git log + commit messages for design rationale. For automated script-level smoke tests, run `bash scripts/test-integration.sh` (~30s, exercises design-lint, catalog-components, check-reuse, similarity against self-contained fixtures).

---

## End-to-end test on a fresh throwaway project

1. `mkdir ~/tmp/impeccable-rivet-test && cd ~/tmp/impeccable-rivet-test && git init`
2. Manually place `PRODUCT.md` with `register: product` + a 3-surface `## Surfaces` section (`marketing` [brand], `dashboard` [product], `admin` [product, utilitarian voice]). Place `DESIGN.md` (all-surface tokens) and `DESIGN-admin.md` (admin-specific token overrides). Pre-seed `src/components/ui/Button.tsx` and `src/components/marketing/SectionHeading.tsx` to test the catalog. Place `docs/specs/main.md` with one phase containing four tasks: (a) marketing UI task ("build a pricing card at /pricing"), (b) dashboard UI task ("build an overview widget at /app/overview"), (c) admin UI task ("build admin users table at /admin/users"), (d) non-UI task ("add a /health endpoint").

3. **Plan generation.** Run `/rivet plan main phase-0`.
   - Confirm `design-lint.mjs --validate-spec` ran against DESIGN.md + DESIGN-admin.md before anything else.
   - Confirm canonical briefs at `docs/design/brief-marketing.md`, `brief-dashboard.md`, `brief-admin.md` — each with `{product_hash, design_hash}` frontmatter. (Shared across specs.)
   - Confirm `component-catalog.md` under `docs/plans/main/phase-0/`, grouped by surface, with `Button` under dashboard/admin and `SectionHeading` under marketing.
   - Confirm the planner prompted to review the catalog — accept as-is.
   - Confirm task (a) frontmatter: `ui: true`, `surface: marketing`, `register: brand`, `ui_commands` gated subset. Spec declares `reuse: [@/components/marketing/SectionHeading]` AND `new_primitive: { PricingCard, reason: ... }`.
   - Confirm task (b) frontmatter: `surface: dashboard`, `register: product`.
   - Confirm task (c) frontmatter: `surface: admin`, `register: product`; its Design Spec composes canonical admin brief with utilitarian voice overlay.
   - Confirm task (d) has `ui: false` and no design sections.
   - Confirm plan frontmatter: `design_hashes` keyed by surface with `{design_ref, ref_sha, canonical_path, canonical_sha, optionally override_path + override_sha}` + `product_hash`.

4. **Reuse-modified gap (P1-A).** Add a task to the plan that declares `reuse: [@/components/ui/Button]` but write the task body to create a component that doesn't import Button. Run `/rivet run main phase-0 task N`. Confirm Stage 2a step 3b rejects via `scripts/check-reuse.mjs` with "declared reuse of this primitive but no changed file imports it." Fix by adding the import; confirm clean.

5. **Per-task validation (P1-B).** Manually corrupt the planner's behavior: edit PRODUCT.md to add a surface whose route doesn't match any file path, then craft a spec task that touches that route. Run `/rivet plan main phase-N`. Confirm 2 retries then escalation via `AskUserQuestion` with three concrete options (pick a surface / add new surface / skip enrichment).

6. **Derived brief fallback (P1-C).** Remove `docs/design/brief-marketing.md` AND `docs/plans/main/phase-0/design-brief-marketing.md`. Run `/rivet review src/components/marketing/PricingCard.tsx`. Confirm Point 17 fires, uses derived brief, findings header includes `Brief source: derived` + both hashes + advisory "Consider running /rivet plan to capture a canonical brief."

7. **Canonical + override layering (gap 1).** Hand-edit `docs/plans/main/phase-0/design-brief-marketing.md` to add a single override section. Run `/rivet run main phase-0` (ensure it enters Sub-Plan Verification). Confirm the audit subagent's scope includes the composed brief (canonical + override sections appended).

8. **Hash-based refresh (gap 1 / D.4).** Edit DESIGN.md. Run `/rivet plan main phase-0 --refresh`. Confirm `docs/design/brief-*.md` regenerates only for surfaces whose `design_ref` is DESIGN.md; non-done UI task specs re-enrich; done-task specs tagged `design_stale: true`.

9. **Deterministic duplicate check (gap 2 / E).** In a plan with catalog containing `PricingCard`, craft a task that declares `new_primitive: { name: PricingPlanCard, ... }`. Run `/rivet run main phase-0`. Confirm Stage 2a step 4 computes similarity ≈ 0.4 (gray zone), invokes a single LLM tiebreaker. Mark the catalog entry `status: do-not-merge` and retry — similarity skips the entry entirely; no LLM call.

10. **Automated smoke (gap 3).** Run `bash scripts/test-integration.sh`. All 10 steps print `PASS:`. Runtime < 30s.

11. **Token lint hard-fail.** In a task, hand-corrupt the embedded code to use `backgroundColor: '#beef00'` (not in DESIGN.md). Run `/rivet run main phase-0 task 1`. Confirm Stage 2a step 2 (`design-lint.mjs`) exits non-zero; task does NOT close; executor re-dispatched with violation report. Fix; confirm clean close.

12. **design_extends + hash drift (cross-cutting G).** A task declares `design_extends: spacing.xxl: 96px`. Confirm Stage 2a step 1 merges the token into DESIGN.md and updates the plan's `design_hashes[surface].ref_sha`. After it commits, start a new sub-plan run without refreshing the plan — confirm Step 0 hash-drift guard warns and prompts y/n.

13. **Post-sub-plan verification + surface grouping.** Complete all 4 tasks cleanly. Confirm audit + critique + harden dispatch per-surface (admin findings separate from marketing findings). Confirm polish is gated — only runs when zero P0/P1 across all surfaces. Confirm optimize fires if any task touched lists/tables/charts. Confirm checkpoint tags are `rivet/main/phase-0/ckpt-N` (slashes).

14. **Register override via task cue.** Add a task with description "build marketing hero" targeted at file path `app/dashboard/HeroStats.tsx`. Confirm the planner flags ambiguity (marketing cue vs dashboard path) and prompts to split or pick.

15. **Missing-files fallback.** Delete PRODUCT.md; rerun plan. Confirm enrichment skips with the one-line `$impeccable teach` note; pipeline doesn't fail.

16. **Single-surface fallback.** Remove the `## Surfaces` section from PRODUCT.md; rerun plan. Confirm planner collapses to `surface: default` on all UI tasks and canonical brief at `docs/design/brief-default.md`.

17. **Skip-verify.** `/rivet run main phase-0 --skip-verify` on a follow-up sub-plan. Confirm post-sub-plan verification is skipped; Stage 2a per-task chain still runs.

18. **Migration from per-phase briefs.** In a project that predates the canonical layout (`docs/plans/main/phase-0/design-brief-*.md` exists, `docs/design/` doesn't), run `/rivet plan main phase-0 --refresh`. Confirm per-phase briefs are copied to `docs/design/`; summary notes migration count.

### Multi-spec scenarios

19. **Cross-spec collision detected at plan time.** Add a second spec at `docs/specs/admin.md` whose Phase 0 creates a `scan_metrics` table. Edit `docs/specs/main.md` Phase 2 to also plan a `scan_metrics` table. Run `/rivet plan admin phase-0`. Confirm the Cross-spec agent fires in Step 3, reports the collision tagged with spec + phase + table name, and surfaces an `AskUserQuestion` for ownership before Step 4 generates any plans.

20. **Spec routing edges.**
    - `/rivet plan phase-0` (no spec, two specs exist) → skill lists `main` and `admin` and asks which one.
    - `/rivet plan main` → skill lists available phases in `main.md` and asks.
    - `/rivet plan main phase-99` → skill lists actual phases in `main.md`, no silent overwrite.
    - `/rivet plan "fix a bug"` (ad-hoc) → plans land at `docs/plans/adhoc/fix-a-bug.md`, unchanged.

21. **Nested status output.** With plans generated for both `main phase-0` and `admin phase-0` plus one ad-hoc plan complete, run `/rivet status`. Confirm the output nests phases under each spec heading, ad-hoc section renders, and `Overall: ... across 2 specs + 1 ad-hoc` appears. Then `/rivet status main` — confirm only `main`'s phases show with task-level detail.

22. **Ad-hoc overlap flags every spec.** Complete an ad-hoc plan whose changes touch code referenced by both `main.md` Phase 2 and `admin.md` Phase 1. Confirm the Ad-Hoc Plan Completion prompt lists *both* overlapping specs and offers to append decision-log entries to each (y / all / n / choose).

23. **Branch and tag naming.** Start a spec run on `main`. Confirm pre-flight offers `rivet/main/phase-0` branch; checkpoints create tags like `rivet/main/phase-0/ckpt-1`. `git tag --list 'rivet/main/phase-0/*'` should list them. Rollback via `/rivet rollback main phase-0` lists these tags.

24. **Learnings across specs.** Run sessions that touch both `main` and `admin` plans (each writes its own `learnings-scratch.md`). Then `/rivet learnings`. Confirm it walks all scratch files, checks each candidate learning against every `docs/specs/*.md`, and the spec-contradictions block in the proposal names specific spec filenames.

Each step is manually observable. The smoke test (`scripts/test-integration.sh`) is the only automated layer — everything else requires running `/rivet` via Claude Code against the fixture project.
