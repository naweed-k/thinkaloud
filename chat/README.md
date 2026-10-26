# Your companion in a chat app

No install. Copy and paste, or upload one file. Free plans work.

Start with **your companion card**: who you are and how you like to work. The interview makes it for you. No
card yet? `full.md` and the skill both run a short interview in the chat and write the card at the end.

Then choose a route:

| Route | What goes where | Good for |
|---|---|---|
| **Every chat** | `pocket.md` and your card, in your settings | the rules in every new chat, in any app |
| **One subject** | `full.md` and your card, in a project | a course or a build, with the study, build and check modes |
| **Install once** | the Thinkaloud skill, with your card in your settings | the full rules wherever you chat, loaded only when they're needed |

The files:

- **`pocket.md`** (about 1,300 characters): the seven rules, short enough for every app's settings.
- **`full.md`** (under 8,000 characters): the same rules in full, plus study, build and check modes, the
  interview and the AI patterns.
- **`thinkaloud-skill.zip`**: `full.md` as a skill. The `skill/thinkaloud/` folder holds the same files.
  Its main file holds the rules; the set-up, check mode and the guide to the ten AI patterns load only when
  they're needed.

Routes combine. Pocket and card in your settings with the skill installed is a good default: the card tells
the skill who you are.

Menu names and limits change, so the apps' own help pages are the source of truth:
[ChatGPT](https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions),
[Claude](https://support.claude.com/en/articles/10185728-understanding-claude-s-personalization-features) and
[Gemini](https://support.google.com/gemini/answer/16598625). If a menu has moved, search the app's help for the
name in quotes.

Last checked: 13 Oct 2026.

## ChatGPT

**Every chat (pocket + card)**
1. Settings → Personalization → Custom instructions.
2. Paste `pocket.md` where it asks how ChatGPT should respond. Paste your card in the field about you
   ("More about you" or similar).
3. Save, then start a new chat.

At the time of writing, each field takes up to 1,500 characters on Free and Go, and more on paid plans
([check the current limits](https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions)). If
your card doesn't fit, shorten its `Knows:` and `My rules:` lines.

**One subject or build (full + card)**
1. In the sidebar: New project.
2. Open the project's menu (the three dots) → Instructions. Paste `full.md`.
3. Your card is already in your custom instructions, so it comes along. If it isn't, paste it under `full.md`.

**Install once (the skill)**
Skills are reaching ChatGPT plan by plan, workplace plans first, so you may not have them yet. Where you do:
1. In Skills: New skill → Upload from your computer, and choose `thinkaloud-skill.zip`.
2. Keep your card in your custom instructions, then start a new chat.

## Claude

**Every chat (pocket + card)**
1. Click your initials (bottom left) → Settings.
2. Under "What personal preferences should Claude consider in responses?", paste `pocket.md`, then your card.
3. Save, then start a new chat.

**One subject or build (full + card)**
1. Projects → New project. Free plans can have up to five.
2. Set project instructions: paste `full.md`, then your card.
3. Save instructions, then start a chat inside the project.

**Install once (the skill)**
Skills work on every plan, free included, with code execution turned on
([help](https://support.claude.com/en/articles/12512180-use-skills-in-claude)).
1. Customize → Skills → "+" → Create skill → Upload a skill, and choose `thinkaloud-skill.zip`. Upload the zip
   as it is: Claude checks that the folder inside is named after the skill.
2. Keep your card in your personal preferences, then start a new chat. The skill runs when a request fits it,
   or when you name it.

## Gemini

**Every chat (pocket + card)**
1. At gemini.google.com: Settings & help → Personal Intelligence → Instructions for Gemini.
2. Add: paste `pocket.md`, then your card. Submit.
3. Start a new chat.

This setting isn't offered on work, school or supervised accounts, and may not be offered in every country.
If you don't see it, use a skill instead (below).

**Install once (a Gemini skill)**
Gemini's skills replace Gems, which personal accounts can use until November 2026; Gems you made move into
skills by themselves ([Google's announcement](https://blog.google/products-and-platforms/products/gemini/automate-tasks-with-skills/)).
Gemini makes skills in the app, so there's no file to upload:
1. Create a new skill and name it `thinkaloud`.
2. Paste `full.md` as its instructions, then your card under it.
3. Save. Type `/thinkaloud` in a chat to use it, or just ask: it also runs when a request fits it.

## Study modes

Each app has its own learning mode. They work alongside the companion: the mode handles the tutoring, and
the companion adds the rest (you decide, evidence, safety, your card).

- **ChatGPT:** Study mode, from the tools menu or by typing `@study`
  ([help](https://help.openai.com/en/articles/11780217)).
- **Claude:** the Learning skill (Customize → Skills), which replaces the Learning style
  ([help](https://support.claude.com/en/articles/10181068-styles-are-moving-to-skills)).
- **Gemini:** Guided Learning, at the bottom of the chat box ([help](https://support.google.com/gemini/answer/16448384)).

For graded work, the companion's rule still holds: it helps you understand and checks your attempt, but won't
write what you hand in.

## What the app remembers, and your card

ChatGPT, Claude and Gemini can each remember things from your chats, separately from what you paste here.
You can see it and delete it:

- **ChatGPT:** Settings → Personalization → Manage memories. A Temporary Chat uses no memory.
- **Claude:** Settings → Memory. You can pause it or reset it.
- **Gemini:** Settings & help → Personal Intelligence, where memory of past chats can be turned off. Deleting
  a chat in Gemini Apps Activity removes what it learned from that chat.

Your card is different. The app decides what its memory keeps, and that memory stays in that app. Your card is
plain text you wrote and can read, and it goes into any app, so each one knows you the same way. Edit it
whenever it stops being true.

## Keeping the card up to date

When you've finished for the day, say **"done for today"** (with `full.md` or the skill). You get up to three
lines, such as `Knows: SQL joins`, to paste into your card. You decide what goes in.

## Check it's working

Ask something with a real choice in it, like "which phone contract should I go for?" A companion shows you
options with trade-offs, says which it would pick, and waits. If it just picks one, check the prompt or the
skill saved.
