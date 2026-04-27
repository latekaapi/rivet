# Contributing to /rivet

Thanks for considering a contribution. This skill is a Claude Code skill — code lives in plain Markdown instruction files (`SKILL.md`, `plan.md`, `run.md`, `review.md`, `status.md`, `learnings.md`, `verify.md`) plus a few Node.js helper scripts under `scripts/`.

## Before you open a PR

**1. Run the script-level smoke test (~30 seconds):**

```bash
bash scripts/test-integration.sh
```

This exercises `design-lint.mjs`, `catalog-components.mjs`, `check-reuse.mjs`, and `similarity.mjs` against self-contained fixtures. A vendored stub at `scripts/test-fixtures/impeccable/` stands in for the real impeccable parser, so you don't need impeccable installed locally to run the smoke test or have it pass in CI.

**2. For non-trivial changes (new features, behavior changes, new subcommands):** walk through the relevant scenarios in [docs/verification-scenarios.md](docs/verification-scenarios.md) on a throwaway test project. Especially relevant if you touch `plan.md`, `run.md`, the design-system pipeline, or any of the helper scripts.

**3. Keep changes scoped.** A PR that touches one subcommand is easier to review than one that retunes three. If a fix exposes adjacent issues, prefer noting them in the PR description over expanding the diff.

## What kind of changes are welcome

- **Bug fixes** to scripts, instruction-file logic errors, or examples that don't actually work.
- **Stack support**: making the skill work better for stacks that are currently "reported working" (Next.js, Nuxt, SvelteKit, Django, Rails, Go). The `rivet.config.json` config file is a good place to add stack-specific defaults.
- **Token optimizations** in instruction files — anything that reduces context usage without losing fidelity.
- **Documentation** that helps newcomers understand a non-obvious part of the workflow.
- **Tests / fixtures** for `scripts/test-integration.sh` covering edge cases.

## What's out of scope

- **Replacing the impeccable integration with a different design-system tool.** Impeccable integration is intentionally kept as a soft-optional dependency; the right path is a generic interface, not swapping one tool for another.
- **Hardcoding a particular stack** in the instruction files or scripts. The skill's value comes from being stack-agnostic at runtime.
- **Adding hooks, MCP servers, or other Claude Code primitives** that aren't strictly necessary for the core spec-driven loop.

## Style

- Markdown instruction files: be terse. The model reads these in every relevant invocation, so wordiness is a token tax.
- Comments in scripts: only when the *why* is non-obvious. The *what* should be clear from the code.
- Examples: prefer stack-neutral pseudocode in the main body; relegate Laravel/TS/Python-specific examples to clearly-labelled appendices.

## Reporting issues

When opening an issue, please include:
- Your stack (language, framework, test runner).
- Whether impeccable is installed.
- Output of `bash scripts/test-integration.sh` if any helper script is misbehaving.
- The relevant `docs/plans/{spec}/{phase}/...` file if a plan or run subcommand misbehaved.

## License

By contributing, you agree your contributions will be licensed under the MIT license (see [LICENSE](LICENSE)).
