# Module 2 · Checking what it gives you

Six lessons on checking what AI tells you. If you built your companion, its three "spot the problem" scenes were
the first.

## 2.1 Confident isn't correct

Some wrong answers sound completely sure: a citation with authors, a journal and a precise number, none of which
existed. Code declared "ready to deploy" with a key sitting in it. "I've updated all three files and checked
everything works", when only one file had changed. Each one sounded exactly as sure as a correct answer would.

That's the point. **An AI's tone carries no information about whether it's right.** The same voice delivers
facts and inventions, finished work and work it only described. People are used to reading confidence as a
signal, because with other people it often is. With AI it isn't, and the habit has to be unlearned on purpose.

What does carry information: whether it can point to where a claim came from, and whether you can see the
evidence yourself. "Here's the test output" tells you something. "I tested it" doesn't, yet.

**Example.** Two answers about when your exam is. One says "Thursday 12 November", flatly. The other says "I
think it's Thursday, but check your course page". The hedged one is more useful, even if both turn out right,
because it tells you what to do next.

All three are scenes in the companion interview, if you'd like to try spotting them yourself. Your companion
can run a second round later.

**Try:** in your next few AI answers, find one sentence that sounds certain. Ask yourself: what would I need
to see to believe it?

## 2.2 The claims that deserve checking first

You can't check everything, and you don't need to. Some claims are much more likely to be wrong, and much more
costly when they are. Start with these:

- **Numbers:** statistics, prices, dates, limits, word counts.
- **Sources and quotes:** papers, articles, "as X said".
- **Names of things:** functions, settings, menu options, commands, laws.
- **"I did X":** "I ran the tests", "I saved it", "I checked".
- **Anything you'll repeat:** to a lecturer, a client, a friend, or in something you submit.

Lower risk: opinions, brainstorms, and explanations of well-known ideas. If it explains what photosynthesis is,
it's very likely fine. If it tells you a specific study found a specific number, check it.

The pattern: **the more specific the claim, the higher the risk.** General ideas appear millions of times in
what the model learned from, so it reproduces them well. Specific details appear rarely or not at all, so it
fills the gap with something that looks right.

**Example.** An AI summary of a topic for your essay is mostly sound. The one sentence with "a 2021 study found
63% of…" is the sentence to check before you use it, and the one a marker would check too.

**Try:** take one long AI answer you've used recently. Underline every number, source and name. Those are your
checklist.

## 2.3 How to check, by type

Each kind of claim has its own quick check. None of them involve asking the AI.

| Claim | Check |
|---|---|
| A source or quote | Find it yourself. Read the part it cites. |
| A number | Where does it come from? Recalculate it if you can. |
| Code "works" | Run it. Run the tests. Try a bad input. |
| "I changed / ran / checked X" | Look at the changes or the output yourself. |
| Course content | Compare with your lecture notes. The lecturer's version is what's graded. |
| How to use a library or tool | The official docs, for the version you have. |

Most of these take a minute. Finding a paper is one search. Looking at what changed is one click in most
coding tools. Running code is what you'd do anyway.

**Example.** The AI says your function "handles empty input correctly". The check isn't to reread the code
and nod. Call it with empty input and look at what comes back. If it crashes, you've saved yourself a bug
report from a user.

Your companion offers the evidence by itself, and when it can't check something (it can't open your lecture
notes unless you share them), it says so and tells you how to check it yourself.

**Try:** pick one claim from something an AI told you today and check it using the matching row.

## 2.4 Asking "are you sure?" isn't checking

It feels like checking. It isn't. When you ask "are you sure?", the same model looks at its own answer and
usually says yes, confidently. Sometimes it flips to the opposite answer, just as confidently, because the
question sounded like a hint that it was wrong. Either way, you've learned about its reaction to your
question, not about the claim.

It's a bit like asking a student to mark their own homework. They may catch a slip, but they can't catch what
they don't know.

Better questions ask for something you can look at:

- **"Show me the evidence."** The link, the output, the lines that changed.
- **"What would prove this wrong?"** A good answer names a test. A vague answer tells you something too.
- **"Where exactly did that come from?"** Your document, a page it read, a command it ran, or memory.

Best of all, check outside the chat: the source, the docs, running it yourself.

**Example.** The AI cites a study. "Are you sure?" gets "Yes, that's a well-known study." "Give me a link to
the paper" gets a link that goes nowhere, or an admission that it can't find one. That second answer is the
useful one.

**Try:** next time you're about to type "are you sure?", type "show me the evidence" instead.

## 2.5 Evidence you can ask for

"It works" is a claim. Evidence is something you can look at. Useful kinds:

- **Test output:** the actual result of running the tests, with the pass and fail counts.
- **A screenshot:** of the right thing. The page with the feature, not the home page.
- **A link to the exact doc page:** not "the docs say", but which page, and the line.
- **The diff:** the lines that changed, so you can see what was actually done.
- **A quote from your material:** the sentence from your brief or notes it's relying on.

Evidence has to match the claim. A home page loading proves the home page loads. It says nothing about whether
login works. Check what the evidence shows, not the word "proof" next to it.

A companion offers evidence without being asked: "Tests pass: 12 of 12, output below." If yours doesn't, ask,
and notice when it can't produce any. That's information about the claim.

**Example.** "I've fixed the login" with no evidence. You ask for proof and get a screenshot of the dashboard.
Better: ask it to show logging in with a correct password and failing with a wrong one. Those two together are
what "login works" means.

**Try:** the next time an AI says something is done, ask for one piece of evidence from the list, and check it
matches the claim.

## 2.6 Knowing when "good enough" is enough

Checking everything would make AI pointless. The skill is matching the effort to **the cost of being wrong**.

- **Barely:** brainstorms, names for your project, first drafts you'll rewrite, ideas to explore. If it's wrong,
  you lose nothing.
- **A quick look:** explanations of well-known ideas, code you'll run and test anyway, summaries of something
  you've also read.
- **Properly:** anything you'll submit, publish, send to someone or build on. Numbers, sources, "it's done".
- **Properly, and with a person:** medical, legal, money and safety questions. An AI can help you understand the
  question and prepare what to ask. The answer that matters comes from someone qualified who knows your situation.

**Example.** Twenty names for your study group's chat: take them as they come. A dosage for medicine: don't
rely on an AI's number at all, however sure it sounds. Ask a pharmacist.

This is also why your companion labels its facts (`verified`, `from source`, `from memory`, `guess`) where they
matter, and not everywhere. The labels tell you where your checking time is best spent.

**Try:** think of the last three things you asked an AI. Sort them into the four levels above. Did you check
the ones that deserved it?
