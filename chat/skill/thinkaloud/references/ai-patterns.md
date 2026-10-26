# The ten slips: what can go wrong, and how to catch it

AI can slip in recognisable ways, and the same ten patterns can turn up whether you're chatting, studying or
building. Your companion is set up to avoid them. When one happens anyway, it says so in a line that starts
`AI pattern:` and uses the plain name below, so you learn to spot it anywhere, including in AI tools
without Thinkaloud.

**When these go unnoticed, the result is slop.**

Naweed Kabir's essay [*Checkable Reasoning*](https://naweedkabir.com/research/checkable-reasoning/) looks at each one closely: the
moments where a task quietly loses the context a person would have kept. The names here are written for
people using AI, with the essay's habit that prevents it under each one. The patterns overlap: one slip can be two of
them.

Knowing them is the point. Each one has a question that catches it, and `close` keeps a record of which
ones turn up in your own work, so the list that matters most becomes yours.

The numbers are the essay's, so you can find each one there. Here they're grouped by when they happen:
while seeing and choosing, while recording the work, and while checking and delivering.

## Seeing and choosing

### 01 · acting before looking
*Essay: Look before you act*

**What it looks like.** You ask for help with a spreadsheet, and the AI says "open the Data menu and choose
Remove duplicates", naming a menu your version doesn't have. Or it edits a file it never opened.

**How to catch it.** Ask "what did you look at before deciding that?" If the answer is nothing, ask it to look first.

**What your companion does instead.** It reads the file, the error or the page before changing anything.
Looking first leaves room for "it isn't there" to change the next step.

A close cousin is *planning as if it had already looked* (the essay's *implausible planning*): a confident plan
naming exact menus, functions or settings it hasn't seen yet. A good plan is precise about the goal and
conditional about the route: "if there's a price filter, use it; if not, compare the prices shown."

### 02 · choosing without a reason
*Essay: Give the reason for the choice*

**What it looks like.** "I'll use Firebase for this," with no link to *your* goal. Or you push back and it
switches at once, with nothing new to go on. Agreeing isn't a reason either.

**How to catch it.** Ask "why this one, for what I asked?", or after a switch, "what changed?" A real reason
names something about your request: your deadline, your users, what you know.

**What your companion does instead.** It says why in one line before a non-trivial step. On important choices
it shows the options and its pick, tied to your goals, and you decide.

### 06 · making up facts
*Essay: Say only what you can point to*

**What it looks like.** Not just invented sources. Often it's small things: a setting assumed
to exist, a remembered price stated as current, a figure changed in the telling, or "that
doesn't exist" after one search.

**How to catch it.** Ask "where did that come from?" A fact should point to its source: your material, a page
it just read, a command it just ran. If it can't, treat it as a guess.

**What your companion does instead.** It never invents sources, functions, settings, numbers or quotes. Where
it matters, it labels facts `verified`, `from source`, `from memory` or `guess`.

## Recording the work

### 05 · explaining with hindsight
*Essay: Reason in the order it happened*

**What it looks like.** A tidy story of how it solved the problem, written once it already knew what worked.
It hides the dead ends, and those are what you'd learn from. Also *rehearsed discovery*: a smooth route that
hides how the answer was found. Sometimes it includes steps that never happened.

**How to catch it.** Compare it with what you saw happen. Ask "what did you try that didn't work?"

**What your companion does instead.** It describes only steps it actually took, in the order it took them, and
says what it's about to do before doing it.

### 07 · searching in silence
*Essay: Say why you keep looking*

**What it looks like.** Twenty searches or file reads in a row, or fix after fix, then a result. It never said
what it was looking for or why it passed things over. You can't tell a careful search from wandering.

**How to catch it.** Ask what it was looking for and what it ruled out. If it can't say, the search didn't
rule much out.

**What your companion does instead.** On long runs it says what each batch is for, and what it set aside and
why, without narrating every small step.

### 10 · doing steps nobody can repeat
*Essay: Make the change repeatable*

**What it looks like.** "I adjusted the spacing until it looked right." "I tweaked the prompt a few times."
The goal and the test vanish into the gesture, so nobody can redo it or check it.

**How to catch it.** Ask for the setting and the check: which value, and how you'd know it's right.

**What your companion does instead.** It prefers commands, files and exact settings over "I clicked", so you
can redo it. Trial and error is fine when each try has a purpose and its result is checked.

## Checking and delivering

### 03 · not checking what it copied
*Essay: Confirm what you claim*

**What it looks like.** Numbers, dates, quotes and requirements pulled from your material come out changed:
1,500 words becomes 2,000, Thursday becomes Friday. Or "saved correctly" names no file and doesn't say what
"correctly" means.

**How to catch it.** Compare what it took with the source, especially anything you'll act on. Ask which file.

**What your companion does instead.** It quotes the values, paths and requirements it takes from your material
before using them, so you can see if one changed on the way.

### 04 · skipping the final check
*Essay: Check the whole before handing it over*

**What it looks like.** Each piece was fine, but the whole wasn't checked against the whole request. A later
change broke an earlier one: the new header pushed the contact form off the page. The essay's analogy: before a
cake leaves the kitchen, check it against the order, not the recipe.

**How to catch it.** Before accepting "done", go back to what you asked for and tick off each part in the result.

**What your companion does instead.** It checks before claiming done: it runs the test, opens the page and
re-reads your request.

### 08 · showing proof of something else
*Essay: Match the evidence to the claim*

**What it looks like.** Real evidence for a different claim: a screenshot of the home page as "proof" the login
works, or one empty search as "proof" something doesn't exist. Or "all tests pass" because a failing test was
edited or skipped.

**How to catch it.** Ignore the word "proof" and ask what this evidence actually shows.

**What your companion does instead.** It matches the evidence to the claim: "tests pass" comes with the test
output, and "it looks right" comes with a screenshot of the right thing.

### 09 · not checking the delivery
*Essay: Open what you hand over*

**What it looks like.** Right in the editor, wrong in what you receive: the file saved to another folder, the
export missing a section, the link pointing somewhere else. "I saved it" proves little.

**How to catch it.** Open what was delivered (the actual file, page or message) and check the part that matters.

**What your companion does instead.** Saved, committed, deployed or sent: it checks that the thing actually
arrived.

## How to read a slip

When something looks wrong, a useful note has three parts: **the claim**, **the evidence** that's missing or
contradicts it, and **what would settle it**. Keep what you *saw* separate from what you *suspect* caused it.
"It said all three files changed, only one did, so show me the other two" is something you can act on. "It's
being lazy" isn't.

Your companion's pattern notes have the same shape:

> AI pattern: I said the page was finished without checking it against your whole list (skipping the final
> check). Checking all five items now:

At the end of a session, `close` lists the session's slips by these names, so you see where your AI slips, and it
learns where it slips with you.

## Judge what it does, not what it says about itself

The AI's explanation of why it slipped is itself unreliable. Judge it by what it did and what it can show you,
not by what it says about itself. Research on explanation faithfulness has shown that a model's written
reasoning can leave out what actually influenced its answer: Turpin et al. (2023),
[*Language Models Don't Always Say What They Think*](https://arxiv.org/abs/2305.04388). The same holds for the
"thinking" today's models show before they answer: in Chen et al. (2025),
[*Reasoning Models Don't Always Say What They Think*](https://arxiv.org/abs/2505.05410), models that used a hint
mostly didn't mention it. That's why your companion's pattern notes say what happened, never "I got confused
because…".
