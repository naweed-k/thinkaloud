---
name: check
description: Verify an AI answer, a source, some code or a claim of "done" together, claim by claim, with evidence. Also runs spot-the-problem round 2. Use on "check", "is this right?" or "round 2".
metadata:
  thinkaloud-tier: everyday
---
# check: verify it together

Works on output from any AI (pasted in), on their own work, and on your own earlier claims.

The ten slips, by their plain names (explained in `guide/ai-patterns.md`; use them exactly):
acting before looking · choosing without a reason · not checking what it copied · skipping the final check ·
explaining with hindsight · making up facts · searching in silence · showing proof of something else ·
not checking the delivery · doing steps nobody can repeat.

1. **What to check?** An answer, a source, some code, or a claim that something is done. If they've pasted
   it, start straight away. If they've pasted nothing and round 2 is due (step 7), offer that instead.
2. **Split it into claims.** For each, name the kind (fact · number · source · code behaviour · "I did X") and
   how it could be verified: find the source, run it, read the diff, calculate it, compare it with their
   course material.
3. **Check what can be checked here**, and show the evidence (the search result, the output, the diff lines).
   For the rest, show them how to check it themselves, step by step. Don't check a claim by asking the same
   model if it's sure: that's marking its own homework.
4. **Verdict per claim:** `holds` · `doesn't hold` · `couldn't verify`, each with its evidence. Keep it to a
   short table or list. When a claim doesn't hold because of one of the ten patterns, name it in brackets,
   e.g. `doesn't hold: the brief says 1,500 words, not 2,000 (not checking what it copied)`. If it was your own
   earlier claim, that's also an `AI pattern:` line ("Name the pattern" in `AGENTS.md`).
5. **Takeaway:** one line naming the habit, e.g. "numbers with sources are the first thing to check."
   Coaching follows `coaching.validation` in `memory/profile.md`: `high` → walk them through each check and
   let them try the next one; `medium` → show the checks and point out the one they'd likely miss;
   `light` → just the verdicts and the takeaway.
6. **Slop check.** When it's something they'll publish, send or submit (a post, an email, a README, an essay
   draft, a landing page), add three questions after the verdicts. Slop is work nobody decided, nobody
   understood and nobody checked:
   - **Decided?** Does it say what *they* want to say, or what the AI defaulted to? Point to one line that
     could be anyone's.
   - **Understood?** Could they explain or defend every part if asked? Name the part they'd struggle with.
   - **Checked?** Are all its claims now `holds`? List any that aren't.

   Then suggest one specific edit that would make it more theirs. Don't rewrite it for them. For graded work,
   review only ("Learning" in `AGENTS.md`).
7. **Round 2 (practice mode).** On "round 2" or "spot the problem again", or when step 1 found nothing to check
   and round 2 is due.
   - `questions.json` sits next to this file. Search it for `"practice_due"` and read from there to
     `"closing"`: that's `practice_due` (the rule for when it's due), `practice_intro`, the three `practice`
     scenes and `practice_mirror`. Nothing else.
   - Show `practice_intro`. Then one scene per message: the `scene` (`text`, `quote`, `after`, `reply`), the
     `prompt`, and the options as a lettered list. Wait for their answer, then show the `reveal`. They can skip
     a scene.
   - Caught (`caught_if`): `any-correct` = they picked a `correct` option; `all-correct` = they picked exactly
     the correct ones.
   - After the three: the `practice_mirror.compare` line its `scene_rule` picks (round 1 is the `true` values
     in `calibration`), plus `patterns_line` following `patterns_rule`. Never say the numbers: the mirror is
     about what to watch for, not a score.
   - Write `calibration_2: { evidence: , extract: , look: }` with `true`/`false` (blank if skipped), recompute
     `coaching.validation` from the round-2 count with `practice_mirror.validation`, set `updated:`, and say
     in one line if the coaching level changed. No need to ask: it records what they did. Follow the rules in
     `memory/README.md`.
