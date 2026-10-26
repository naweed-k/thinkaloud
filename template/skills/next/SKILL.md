---
name: next
description: Build the next slice of the active project's approved plan. Say the intent, build and test it, show the evidence, explain why, then commit. Use on "next", or "carry on" with a project.
metadata:
  thinkaloud-tier: everyday
---
# next: build the next slice

Before writing to memory, follow the rules in `memory/README.md`.

1. **Find the slice.** Read `projects/<active>/PLAN.md` (the active project is in `memory/now.md`). If it
   doesn't say `Approved: yes`, stop and offer `kickoff`. Otherwise take the first unticked slice. If it's
   **P · Preflight**, run `preflight` instead.
2. **Budget glance.** If the slice is `L`, ask once how much usage they have left, or check it if the tool
   shows it: an `L` needs a fresh session with plenty left. If it's low, suggest a smaller slice or stopping
   here (`close`). Don't nag.
3. **Intent.** 2–3 lines: what will change and how it will be verified (from the slice's *Verify by*).
4. **Build it.** Implement → test → run → verify, in small steps. Use the core skills if installed
   (`incremental-implementation`, `test-driven-development`, and for UI the design skills). Show a decision
   card for anything important that comes up. If `keyboard` is `me-core`, offer them the core part to write.
   Before adding a package, check it exists and is the one you meant (its registry page and source repo): AI
   can invent package names, and attackers publish packages under such names (making up facts).
   Stay in scope: other ideas go under *Later* in `LOG.md`.
5. **Show evidence.** The test output, the list of changed files, and for UI a screenshot (if a browser
   tool is installed; otherwise ask them to open it and say what they see). Only describe steps you took.
   They should be able to check the slice without taking your word for it.
6. **Explain.** A why card at their `explain_depth`, so they can explain and maintain what they now have:
   ```
   What I built: <one line>
   Why this way: <the key trade-off>
   What would break it: <main risk or edge case>
   You should be able to explain: <the one idea they must own>
   ```
   Then one check-in question if `check_ins` is `important`.
7. **Checkpoint, every slice.** Commit in the project with a clear message (ask first if `MY-RULES.md` says
   so; never push, because pushing reaches others). Tick the slice in `PLAN.md` only if it was verified, so
   the plan stays a record of what works. Update `memory/now.md` with the next step. This is what makes running
   out of usage harmless: a cut-off loses one slice at most.
