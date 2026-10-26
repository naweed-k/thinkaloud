---
name: close
description: End the session cleanly. Save state to memory and logs, deal with uncommitted work, note lessons, and leave one clear next step. Use on "close", "done for today", or when usage is nearly out.
metadata:
  thinkaloud-tier: light
---
# close: save for next time

Before writing anything, follow the rules in `memory/README.md`.

The ten slips, by their plain names (explained in `guide/ai-patterns.md`; use them exactly):
acting before looking · choosing without a reason · not checking what it copied · skipping the final check ·
explaining with hindsight · making up facts · searching in silence · showing proof of something else ·
not checking the delivery · doing steps nobody can repeat.

1. **What happened?** From this conversation, plus `git status` and `git log` in the active project.
2. **Uncommitted work:** list it, then ask *commit / leave / discard*. Never discard without an explicit yes:
   it can't be undone. Never push: what goes public is their call.
3. **Update the active project or topic:**
   - Build: prepend an entry to `LOG.md` (**Did / Hard part / Next**; the hard part is what they worked out,
     and what's worth remembering or explaining later). Tick `PLAN.md` slices only if they were verified. Add unrecorded decisions to `DECISIONS.md`.
   - Learn: update mastery in `TOPIC.md` and prepend a line to the topic's `progress.md`.
4. **Memory:** overwrite `memory/now.md` (≤15 lines, because every session starts by reading it: date, focus,
   active project or topic, and the single next step, specific enough to start without thinking). Prepend a line to `memory/progress.md`, ending
   ` · slips: <names>` if there were any.
5. **Reflect, silently.** Was I corrected? Did something fail, then work? Did they state a preference? Did a
   slice take much more or less of the session than its size said? Write 0–3 lessons to `memory/lessons.md`,
   tagged, or increase the `×N` of an existing one. Every session reads that file, so only what will change
   how you work. At `×3`, offer to add it to `MY-RULES.md`.
   - **Slips.** Count this session's `AI pattern:` lines by plain name. A pattern that shows up twice this
     session, or also in an earlier `slips:` in `memory/progress.md`, becomes an `[observed]` lesson named
     with its plain name, or increases one, e.g. `- skipping the final check on UI work: check the whole page
     against the request [observed] 2026-10-02 ×2`.
   - **Profile proposals.** When a lesson reaches `×3` and contradicts a profile setting (they keep asking
     for the answer straight away while `stuck: hints`, or keep skipping check-ins), offer the profile change
     in one line instead of a `MY-RULES.md` line. Change it only on a yes, and set `updated:`.
   - **`knows:`** Make sure concepts they *showed* they understand this session are in it ("Explaining"
     in `AGENTS.md`). No need to ask.
6. **Summary**, ≤7 lines:
   ```
   Saved: <files>
   Done today: <…>
   Next time: <the next step>
   Learned: <lesson, or "nothing new">
   Slips: <none, or plain names with counts, e.g. "skipping the final check ×1">
   Uncommitted: <none, or what was left>
   ```
   Plus at most one `Tip:` line, if `tips` is `on` and it genuinely helps.
7. **Round 2, offered once.** If round 2 is due (the `practice_due` rule in `skills/check/questions.json`;
   search for it and read only that entry) and no line in `memory/progress.md` says `round 2 offered`, add
   one line, e.g. "Next time, want to try spot-the-problem round 2? Three new scenes. Say `round 2`."
   Append ` · round 2 offered` to today's `progress.md` line, so it's offered once, not every session. Don't
   run it here: `check` does, in a session with room for it.
