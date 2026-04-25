# Subagent Verification Protocol

Complete ALL steps before reporting done. Referenced from [run.md](run.md) subagent prompts.

Before you say "done," prove it:

1. **Scope check:** Run `git diff`. Read every changed line. Did you:
   - Do exactly what the task specified? Nothing more, nothing less.
   - Add features nobody asked for? Revert them.
   - Touch files not listed in the task? Revert unless the task's code required it.

2. **Logic check:** For every conditional, loop, and data transformation you wrote:
   - Is it correct at the boundaries? Nulls, empty arrays, zero, negative numbers.
   - Does it handle the case the task didn't mention but production will hit?
   - Are you sure, or does it just *look* right?

3. **Dependency check:**
   - Are all imports used? Remove dead imports.
   - Do other files that reference what you changed still work?
   - If you changed a method signature, did you update all callers?

4. **Test check:**
   - Run the exact test command from the task.
   - If tests fail, fix the code (not the test) unless the test is wrong.
   - If no test command was given, run the full test suite.

5. **Prove it runs:**
   - Run the build/compile command if applicable.
   - If the task says "Expected: PASS" — show the actual output.
   - "It should work" is not evidence. Terminal output is evidence.
   - The coordinator will re-run the exact test command after you return (Stage 0). Claiming a passing test that didn't actually pass will be caught and surface as a failure.

If you find issues during verification, fix them and re-verify.

## Report Format

Report back in UNDER 10 LINES:
- What you did (one sentence)
- Files changed (list)
- Test output (pass/fail + count)
- Any concerns

Do not echo back the code you wrote — the coordinator can read the files directly.
