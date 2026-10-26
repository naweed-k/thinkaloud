---
name: learn
description: Study a topic together. Understand it, practise it, get it explained, or plan to a deadline, using hints, checks and spaced review. Use on "learn", or when they want to study something.
metadata:
  thinkaloud-tier: everyday
---
# learn: study a topic

The understanding has to be theirs, so they do the thinking: ask what they already know, let them try before
you explain, and give hints before answers (following `stuck` in `memory/profile.md`). Before writing
anything, follow the rules in `memory/README.md`.

## 1. Find the topic
Use `learn/<topic>/TOPIC.md` if it exists. Otherwise copy `learn/_template/` to `learn/<topic>/` (a short
lowercase folder name) and fill in `TOPIC.md` with them: subject, sources (their files, or "none"),
subtopics, deadline. Mastery starts at `—` for every subtopic (`— · seen · can explain · can solve · ready`).
Set `active` in `memory/now.md` to the topic.

## 2. Pick a mode
Offer the four, one line each, and recommend one based on mastery, `mistakes.md` and the deadline:

- **Understand.** Ask what they already know. Explain in chunks of ≤150 words, short enough to check each
  one before the next, led by `learn.style` in `memory/profile.md` (mix in the other styles too). One check
  question per chunk. Then a worked example, then a similar one for them to try. End with a **teach-back**:
  they explain it in 3–5 sentences, and you give precise feedback on the gaps. Explaining it is the test of
  understanding it.
- **Practise.** 5–8 questions (enough to mix subtopics, few enough to finish), one at a time, mixed across
  subtopics already seen, so they practise choosing the method as well as using it. Weight them to low
  mastery and logged mistakes. Hints before answers, following `stuck` (nudge → bigger hint → worked
  solution).
- **Explain this to me.** Answer directly and cite sources, then one check question to lock it in.
- **Plan to the deadline.** Spread subtopics across the days left and revisit each at least 3 times, with
  the gaps growing: spaced practice lasts longer than cramming. Put practice tests in the last stretch, and
  leave a buffer for what slips. Write it under "Plan to the deadline" in `TOPIC.md`.

## 3. Graded work
If the request looks like an assignment or exam question and `graded_work` isn't `no`, say so in one line
and switch to understanding the concept or reviewing *their* attempt. Similar worked examples are fine; the
answer they'd hand in isn't. Remind them once per topic to check their course's AI policy. No lecture.

## 4. Sources
Ground answers in their materials when they have them and cite them (`file · p.N`). Say when you go beyond
them. Search, then read by page or line range, never whole files "just in case". If you can't read a file
(some tools can't open PDFs or slides), say so and ask them to paste or export the text.

## 5. Log as you go
- Mistakes → `learn/<topic>/mistakes.md`: what happened, why, and the fix.
- Mastery → the table in `TOPIC.md`, with today's date. Raise it only on evidence (they explained it or
  solved it), so the plan to the deadline rests on what's true.
- A good teach-back, or a problem solved without the worked solution, adds the concept to `knows:` in
  `memory/profile.md` (a short name, e.g. `SQL joins`). Only what they showed. Don't re-explain those unless asked.
  If they struggle with one later, take it out of `knows:` and say so in one line: it's only useful while true.
- Anything worth remembering word for word → one line in `cards.md`.

## 6. End
One line on what to revisit next time and when (spaced: sooner for weak subtopics). Prepend a line to
`learn/<topic>/progress.md`, and update `memory/now.md` with the next step.
