# Module 1 · Working with an AI

Six habits that make the rest easier. Each lesson has one idea, one example and one thing to try.

## 1.1 What you're talking to

An AI chat tool predicts useful text from patterns in a huge amount of writing. That's why it's fluent, fast
and often right. It's also why it can be confidently wrong: the same process that produces a correct answer
produces a plausible-sounding wrong one, in the same calm voice.

It doesn't know when it's guessing unless you ask it to separate the two. Ask "what here did you check, and
what are you remembering?" and you'll often get a different, more useful answer.

**Example.** You ask about a law in your country. The answer is clear and well organised, and one detail
comes from a different country's version of the law. Nothing in the tone warns you. The fluency is real; the
accuracy has to be checked.

None of this makes it useless. It makes it a tool with a particular shape: brilliant at drafts, explanations
and options, unreliable on specific facts it can't point to. Your companion is set up to tell you which is
which, with labels like `verified`, `from memory` and `guess`.

**Try:** ask it something from your own field, work or study, where you know the answer well. Note one thing
it gets subtly wrong, and how confident it sounded when it did.

## 1.2 It only knows what's in front of it

Most bad output comes from missing context, not a weak model. The AI can't see your screen, your course, your
deadline or what you tried yesterday. It fills the gaps with the most typical answer, which is rarely the one
you need.

Give it what a new colleague would need on their first day:

- **Goal:** what you're trying to achieve, and why.
- **Context:** what exists already, who it's for, what you've tried.
- **Constraints:** time, tools, level, rules you have to follow.
- **What "done" means:** how you'll know it worked.
- **Where to stop:** the point where it should check with you before going on.

**Example.** "Make my website better" gets a generic list. "My portfolio site is for recruiters in design.
They leave within ten seconds. Done means they can see three projects without scrolling. Suggest changes,
but don't rewrite my text" gets something you can use.

It feels slower to write. It's much faster than three rounds of "no, not that".

**Try:** take one vague request you made this week and rewrite it with a goal and a "done means". Compare the
two answers.

## 1.3 Ask for options, not answers

For anything that matters, don't ask "what should I do?" Ask: **"Give me three ways to do this, with the
trade-offs, and tell me which you'd pick and why."** Then you choose.

This is the single habit that turns an assistant into a companion. A single answer hides the choice that was
made for you. Options show it: what each costs, what each is good for, and what you'd be giving up. The AI's
pick is still useful. It's one input, not the decision.

**Example.** You ask how to store the data for your app. One answer says "use Firebase". Three options show
that Firebase is quick to start but ties you to one company, a plain database is more to set up but more
portable, and a spreadsheet would honestly do for fifty users. Now you're deciding, and you'll be able to
explain why.

Your companion does this by itself for important choices: anything hard to undo, or touching security,
money or personal data. For small things it decides and tells you in a line. You can always say "you
decide" and it will.

**Try:** use the three-options question on your next real decision, big or small. Notice whether you'd have
picked the first answer it gave you.

## 1.4 Make it explain, and explain back

Two habits, one before and one after.

**Before:** "Explain your approach first, then do it." You get to spot a wrong turn before it's built, and you
learn the shape of the solution instead of just receiving it.

**After:** explain it back. In your own words, tell the AI what it did and why, then ask: "What did I get
wrong or leave out?" This is the fastest way to find the gaps between reading something and understanding it.
If you can't explain it, you don't own it yet, and the exam, the interview or the next bug will find that out.

**Example.** The AI fixed a bug in your form: "it was a race condition". You nod. Explaining back, you write
"the form sent twice because…" and realise you don't know why it sent twice. That's the one idea worth asking
about, and now you know to ask.

Your companion asks for this now and then, with one short question after an important piece of work. It never
grades you. Getting it wrong is how you find what to ask next.

**Try:** pick something you "learned" from an AI last week. Explain it back in three to five sentences and
ask what you missed.

## 1.5 When it goes in circles, reset

If the same fix fails twice, stop. A third attempt in the same direction usually fails too, and each round
adds more confusion to the conversation.

Say instead: **"Step back. List three possible causes, and how we'd test each one."** That moves it from
guessing to diagnosing. Often the real cause is one it hadn't considered, because it kept patching the first
idea.

If the chat itself has become long and tangled, start a fresh one. Ask for a short summary first (the goal,
what's been tried, what's known), then paste that into a new chat. Long conversations get worse, not better:
the AI juggles more old, half-wrong context with every message. They also cost more, because the whole
conversation is re-sent every time.

**Example.** "Still broken, fix it" for the fourth time gets a fourth rewrite. "Here's the exact error
message. Before changing anything, what are three causes and how would we tell them apart?" gets you a test
that finds the cause in one step.

**Try:** save the reset phrase somewhere you'll see it: a note on your phone, or your companion card's rules.

## 1.6 Your usage is a budget

Every AI plan has limits, even paid ones. A big task done in one go can run out halfway, leaving you with a
half-finished change and a conversation you can't continue.

Three habits keep that from hurting:

- **Small steps.** One clear piece at a time, each finished and checked before the next.
- **Save progress after each step.** In a coding tool, that's a commit. In a chat, a short summary you keep.
  If you're cut off, you lose one step, not a day.
- **Check before starting something large.** Look at how much you have left, and start big work in a fresh
  session with plenty of room.

**Example.** You ask for "the whole app, with login, payments and a dashboard" in one message. Two thirds of
the way through you hit your limit, and nothing works yet. Done as five steps, you'd have hit the limit with
four working pieces and a clear note of what's next.

Where to look differs by tool. `guide/usage.md` lists the command or page for each one, and a table of what
fits in what's left. In the workbench, say `budget` and your companion reads it with you.

**Try:** find your tool's usage page or command in `guide/usage.md` and check it now, before you need to.
