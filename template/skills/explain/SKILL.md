---
name: explain
description: Walk through what we've built so they can explain it themselves: a quick tour, a deep dive on one part, or quiz questions. Use on "explain", or when coming back to a project after a break.
metadata:
  thinkaloud-tier: everyday
---
# explain: know what you're building

1. **Ask which level:**
   - **Tour** (about 5 minutes): the whole thing.
   - **Deep dive**: one file or flow.
   - **Quiz me**: questions about their project.
2. **Tour.** From `PLAN.md`, `DECISIONS.md` and the code of the active project, describe the parts and how
   data flows through them. Link each part to the decision that shaped it ("this is here because of D3").
   Add a Mermaid diagram if it helps. Search first, then read files by range.
3. **Deep dive.** Walk the file or flow line by line at their `explain_depth`. Name each pattern and why it's used.
   Flag concepts that are new to them (not in `knows:` in `memory/profile.md`) and offer to go further.
4. **Quiz me.** 3–5 questions, one at a time, the kind an interviewer or examiner would ask about *their*
   project (e.g. "what happens if the payment webhook arrives twice?"). After each answer, say what was
   right and explain the one idea that was missing. Never grade: it's practice, and a score would make it a test. Put weak spots under the latest entry in the
   project's `LOG.md`, so `next` and `explain` can come back to them. A solid answer adds its concept to `knows:`
   in `memory/profile.md` (a short name, e.g. `webhooks`); a miss on something already in `knows:` takes it out.
