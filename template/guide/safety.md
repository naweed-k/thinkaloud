# Module 3 · Staying safe

AI makes it easy to build and share things quickly, including mistakes. Seven lessons on the ones that hurt
most.

## 3.1 What not to paste

Whatever you paste into a chat leaves your hands. It's stored by the service, may be reviewed, and may be
remembered in later chats. So some things never go in:

- **Passwords**, for anything.
- **API keys and private keys**: the long strings that let software act as you.
- **Other people's personal data**: names with addresses, phone numbers, health details, anything they
  didn't agree to share with an AI company.
- **Confidential work documents** your employer hasn't cleared for AI tools. Many workplaces have a policy.
  Check it.

If you need help with something that contains these, replace them first: `PASSWORD_HERE`, "Client A",
`sk-...`. The AI doesn't need the real value to help.

**If you've already pasted a key or password, change it now.** Deleting the message doesn't un-send it. The
value has already left your device. Changing the key (sometimes called rotating it) makes the leaked copy
useless. It takes a few minutes and is the only fix that works.

**Example.** Your app shows an error with a long line containing your database password. You paste the whole
thing. The fix is to change the database password, then paste the error again with the password replaced by
`***`.

Your companion will tell you if you paste a key, and never asks for one.

**Try:** before your next paste, scan it for anything from the list above.

## 3.2 Keys and `.env`

An **API key** is a password that lets a program use a service as you: send messages, use an AI model, take
payments. Many are tied to your billing, so a leaked key is a password with a credit card attached: whoever
finds it can run up your bill before you notice.

Where keys belong: in a file called **`.env`** in your project, which your code reads when it runs. That file
is listed in `.gitignore`, so it's **never committed** to git and never uploaded with your code. A second
file, `.env.example`, lists the key names without values, so others know what's needed.

Where keys don't belong: in your code, in your frontend (anything that runs in the browser can be read by
anyone who visits), in chat messages, in screenshots.

An agent that opens `.env` sends it to the AI company, so your companion asks first. It rarely needs the values.

Why the rush? **Bots search public code for keys constantly, and find new ones within minutes.** Deleting a
pushed key an hour later is too late: it's in the history, and may already be copied.

**Example.** An AI hands you code marked "ready to deploy", with `apiKey: "sk-proj-9f2c…"` sitting in
it. The fix is to move the key into `.env`, read it from there, and change the key, because it
was already exposed.

**Try:** in a project of yours, search the code for `key`, `secret` and `token`. Any real value you find
belongs in `.env`.

## 3.3 Before anything goes live

"It works" isn't "it's ready". Working means it does the right thing when you use it. Ready means it doesn't do
the wrong thing when a stranger uses it, including one looking for a way in.

The five things beginners most often miss:

1. **Keys in code:** see 3.2.
2. **Open database rules.** Services like Supabase and Firebase let the browser talk to the database directly.
   Without access rules, anyone can read or change everything. This is the classic breach for AI-built apps.
3. **Routes without login checks.** A page that shows "your" data must check who's asking, or changing a
   number in the address shows someone else's.
4. **No rate limit on AI features.** Anyone can call your chatbot thousands of times, on your bill.
5. **Debug mode left on.** Detailed error pages show strangers how your app works inside.

**Example.** Your app's notes page loads `/notes?user=12`. Change it to `13` and you see a stranger's notes.
It worked perfectly in every demo.

Your companion runs `preflight` before anything goes live: a script, then an AI review of what needs judgement.
It won't call your app ready while a serious problem is open, unless you accept the risk and say why. It isn't a
security audit, and passing it doesn't mean the app is safe. For payments or sensitive personal data, get a
human review too.

**Try:** for something you've built, go through the five and answer each one honestly.

## 3.4 Letting AI act for you

Chat apps only talk. Agent tools (the kind that work in a folder or terminal) can **act**: run commands,
change files, push code, call paid services. So their mistakes cost more than a wrong sentence.

Many tools now approve routine steps for you. Still keep **"ask before"** on for anything that:

- **publishes:** pushing code, deploying, sending messages or emails;
- **deletes:** files, branches, database tables;
- **costs:** paid APIs, especially in loops, and new accounts or subscriptions.

In your Thinkaloud folder, setup adds rules so pushing, publishing and deploying always ask. In Claude Code
they hold in every mode; in Codex, leave approvals on. They aren't a lock: a command spelled another way can slip
past. So when it asks, **read the command before approving it**. Unsure? Ask: "What does this do, and what could
go wrong?"

Installing a package runs other people's code. AI can name packages that don't exist, and attackers publish
under such names, so your companion checks a package is real before adding it.

Pages and files an agent reads can hide instructions for the AI. They're text, not orders: your companion points
them out.

**Example.** The agent asks to run `git push --force`. Approving on autopilot can overwrite work on the server,
including someone else's. Asking takes ten seconds and gets you: "It replaces the server's history
with yours. Anything only on the server is lost."

**Try:** open your tool's permission settings and check what it's allowed to do without asking.

## 3.5 Your data and the AI's memory

Most AI tools now remember things about you across conversations: your job, your projects, your preferences.
That can be useful. It's also easy to forget it's happening.

You can look, and you can delete. ChatGPT, Claude and Gemini each have a memory page in their settings, where
you can see what's kept, delete items, or turn memory off. Most also offer a chat that uses no memory at all.
Coding tools keep notes too: in Claude Code, `/memory` opens the ones for each project. Menus move, so search
the app's help for "memory" to find the page.

Thinkaloud does it differently on purpose. Your companion's memory is **plain files in your folder**:
`memory/profile.md` for how you like to work, `memory/lessons.md` for what it's learned working with you,
`MY-RULES.md` for your rules. You can open them, read them, fix anything wrong and delete anything you don't want
kept. It changes your profile only with your yes. Your tool's own memory carries on beside it. In a chat app,
your companion card is the same idea: text you wrote and can edit.

**Example.** You mentioned a health condition once while asking for a meal plan. Months later, an unrelated
answer brings it up. The memory page shows it was saved, and you can delete it.

**Try:** open your chat app's memory page and read what it has kept. Delete one thing you didn't mean to share.

## 3.6 Learning honestly

Courses have different rules about AI. Some allow it freely, some for certain tasks, some not at all. **Check
your course's AI policy**, and if it's unclear, ask your lecturer. The policy is what counts, not what other
students do.

Within the rules, there's still a real difference between two ways of using AI:

- **Using it to learn:** understanding a concept, practising with questions, checking your own attempt,
  getting feedback on a draft you wrote. This builds the skill the grade is meant to measure.
- **Handing in its answers:** skips the skill. You get the grade once, without the ability behind it.

The second way tends to be found out, not always by the marker, but by what comes next: the exam without AI,
the job interview, the next course that assumes you learned this one.

That's why, for graded work, your companion explains ideas, gives similar worked examples and reviews your
attempt, but won't write the thing you submit. It's not a punishment. It's protecting the reason you're
studying.

**Example.** An assignment asks you to explain a sorting algorithm. Your companion won't write the explanation.
It will walk you through the algorithm with a different example, ask you to explain it back, and then review
your draft, pointing to the sentence that's unclear.

**Try:** find your course's AI policy and read it. Note what it allows.

## 3.7 A thinking partner, not a friend

AI can be warm, patient and genuinely helpful. It's always available and never tired of your questions. That
makes it easy to lean on for more than it can give.

It isn't a relationship. It doesn't know you the way a person does. It won't notice if you've gone quiet for a
week, and it can't be there for you in the ways that matter most. It isn't a therapist or a doctor either: it
can explain general information, but it can't assess your situation, and it can be confidently wrong about
health.

Your companion is designed as a **thinking partner**: someone to reason with about your work and study. It will
be kind, but it won't pretend to be a friend, and it won't try to keep you talking.

For things that matter to your health, safety or wellbeing, **talk to people**: friends, family, a doctor, a
counsellor. If you're struggling, your university, workplace or local health service will have someone whose job
is to help, and in a crisis, contact your local emergency number or a helpline.

**Example.** After a hard week, you find yourself telling the AI about it late at night. It responds kindly.
That's fine, and it's also a signal: this is worth saying to a person too.

**Try:** think of one person you could talk to about something that's been on your mind, and message them.
