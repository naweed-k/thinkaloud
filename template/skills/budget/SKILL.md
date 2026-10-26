---
name: budget
description: Check how much usage is left and what fits in it, so work stops at a clean point instead of halfway. Use on "budget", or when they ask about usage or limits.
metadata:
  thinkaloud-tier: light
---
# budget: what fits in what's left

Run only when they ask, or once when `next` picks up an `L` slice. Never nag: the point is a calm stop, not
worry about limits.

1. **How much is left?** You can't see their plan's limits yourself. Tell them the command for the tool you're
   running in, from the "Where to look" table in `guide/usage.md` (read just that table; commands move between
   releases, so never answer from memory). Ask for a rough answer: *plenty / about half / low / nearly out*. If
   they paste the output, read it yourself. If they don't know, treat it as *about half*.
2. **What's next?** Read the next unticked slices and their sizes (`S` / `M` / `L`) in the active project's
   `PLAN.md` (from `memory/now.md`). In learn mode, the next session's plan in `TOPIC.md`.
3. **Recommend** in 2–3 lines, using the "What fits in what's left" table in `guide/usage.md` (read just that
   table). It stops new work early enough that `close` still fits. Adjust for `usage.plan` in `memory/profile.md`: `free` → keep to `S` slices, and point to the terminal for
   anything that doesn't need you (tests, `git status`); `api` → once, suggest a spend limit in their provider's
   console. If an `L` slice keeps not fitting, offer to split it (a decision card if it changes the plan).
4. **Record** the change in `memory/now.md` only if the plan changed (e.g. "next session: fresh session for L
   slice 4"). Say nothing more about usage until they ask again.

Never guess how many tokens or messages are left: you can't see them, and a wrong number is worse than none.
Slice sizes are relative, not token estimates.
