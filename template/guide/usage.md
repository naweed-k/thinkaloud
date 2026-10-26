# Usage: how much is left, and what fits

Every AI plan has limits, and a long build can run into them. Your companion can't see your plan's limits
itself, so this page shows where each tool tells you.

**These change often.** Commands, menus and limits move between releases, so the official pages are the
source of truth: [Claude Code commands](https://code.claude.com/docs/en/commands),
[Codex CLI commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli),
[Antigravity CLI `/usage`](https://antigravity.google/docs/cli/commands/usage/),
[Claude plan limits](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan) and
[Gemini app limits](https://support.google.com/gemini/answer/16275805). If a command has gone, the tool's
`/help` lists what's there now.

Last checked: 13 Oct 2026.

## Where to look

| Tool | How much is left | How full the conversation is | Also useful |
|---|---|---|---|
| Claude Code | `/usage`: plan limits, session cost and activity (`/cost` and `/stats` open the same screen) | `/context`: a grid of what fills the context window | `/statusline` can keep context % and your 5-hour and weekly limits on screen; `/skill-doctor` shows what each skill costs |
| Codex CLI | `/status`: token use, context left, and your 5-hour and weekly limits | `/status`: the "Context window" line | `/usage` shows your account usage; also [Codex usage settings](https://chatgpt.com/codex/settings/usage) |
| Antigravity CLI | `/usage`: usage limits and remaining requests or tokens for each model | `/context`: a panel showing what fills the context window | `/statusline` can keep this on screen (best effort: not yet tried in a real session) |
| Claude app (web, desktop, mobile) | Settings → Usage | — | on Pro and Max, the app and Claude Code share one limit |
| Gemini app | gemini.google.com → Settings → Usage Limits | — | it warns you when you're close; limits refresh every 5 hours, up to a weekly limit |
| ChatGPT app | Settings → Usage ([usage settings](https://chatgpt.com/settings/usage)) | — | seen on Plus; not checked on Free |

Outside a session, `npx thinkaloud@latest budget` prints the commands for the tools you set up, and
your workspace's fixed cost. `ccusage` (a community tool, not official) reads the usage your coding tools log on
your computer, if you want history over days.

## What fits in what's left

Say `budget` and your companion does this with you. Or use the table yourself:

| Left | Do |
|---|---|
| plenty (more than half) | any slice; batch several `S` slices in one session |
| about half | `S` or `M` slices; start an `L` only in a fresh session |
| low (under a fifth) | one `S` slice or a tidy-up, then `close` |
| nearly out | `close` now |

Slice sizes (`S`, `M`, `L`) are set in `kickoff`. They're relative, not token estimates: nobody can predict
tokens reliably.

## Why running out won't hurt much

Your companion commits and updates `memory/now.md` at the end of every slice. If you're cut off, you lose at
most the slice in progress, and the next session, in any tool, picks up from `now.md` in one message. `close`
is short, so leave room for it.

## Habits that save usage

- **One task per conversation.** Start fresh between unrelated tasks. A long conversation re-sends everything
  in it on every turn.
- **Pick the model at the start** (see `guide/models.md`). In Claude Code, switching model mid-conversation
  means the next reply re-reads the whole conversation without the cache, so it's slower and costs more.
- **Point, don't paste.** Name the file and the lines; don't paste whole folders.
- **Stop rework loops early.** "It's broken, fix it" ten times costs more than one message with the actual
  error. Your companion reads the error first.

**Caching.** Claude Code caches the unchanged start of each conversation automatically, so repeats cost
less. We don't quote savings: they depend on your plan and how you work.

## By plan

- **Free:** expect to hit limits sooner. Keep slices `S`, and use the terminal for anything that doesn't
  need the AI (running tests, `git status`).
- **Paid** and **higher** plans: the table above. Batching several slices in one session is fine when there's
  plenty left.
- **Pay per use (API):** every token is billed. Set a spend limit in your provider's console. It's the same
  advice `preflight` gives for AI features in your app.
