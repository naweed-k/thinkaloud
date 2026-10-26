# Models: which one for what

Thinkaloud names three tiers instead of model names, because model names change every few months. This is
the one file that maps them to today's models.

**Model names change every few months**, so treat the table as a starting point and the official pages as
the source of truth: [Claude Code models](https://code.claude.com/docs/en/model-config),
[Codex models](https://learn.chatgpt.com/docs/models) and
[Antigravity CLI reference](https://antigravity.google/docs/cli/reference/).

Last checked: 13 Oct 2026.

| Tier | Use it for | Claude Code | Codex CLI | Antigravity CLI |
|---|---|---|---|---|
| **strongest** | `start`, `kickoff`, `preflight` (security review), hard debugging | `opus` | `gpt-6-astra` (Astra) | a Pro model (e.g. Gemini 3.1 Pro) |
| **everyday** | `learn`, `next`, `explain`, `check` | `sonnet` | `gpt-6.1-sol` (GPT-6.1 Sol) | the default |
| **light** | `budget`, `close`, summaries | `haiku` | `gpt-6-luna` (6 Luna) | a Flash model (e.g. Gemini 3.5 Flash) |

**How to switch**
- Claude Code: `/model sonnet` (or `/model` for a picker), or start with `claude --model sonnet`. The names above
  are aliases that always point to the latest model of that kind. `best` picks the most capable model your
  plan has. Pro and Max plans start on Opus.
- Codex CLI: `/model` to pick a model and reasoning effort, or start with `codex --model gpt-6.1-sol`. GPT-6.1 Sol is
  for paid plans; on Free and Go, `gpt-6-luna` is the everyday choice.
- Antigravity CLI: `/model` to pick a model; your choice is kept for the next session. Thinkaloud supports
  Antigravity on a best-effort basis: it reads the same files as Codex, but hasn't had a full test session yet.

## When to switch, and when not to

**Choose at the start of a conversation.** In Claude Code, switching model part-way means the next reply
re-reads the whole conversation without its cache, which is slower and costs more (Claude Code's docs on
prompt caching). So:

- Starting a session to plan a project or chase a hard bug: pick **strongest**.
- A normal building or study session: **everyday**.
- A quick session just for `budget` or `close`: **light**.
- Already deep in a session and want to `close`? Stay on the model you're on. Switching down now can cost
  more than it saves.

You don't need to switch at all. The tiers are a way to spend less, not a requirement.

## Effort: how hard it thinks

Most tools now let you set **effort** as well as the model: how long the model reasons before it answers. In
Claude Code it's `/effort` (low to max; today's Opus and Sonnet start at medium). In Codex, `/model` asks for the
model and the effort together. Higher effort suits `kickoff`, hard bugs and security review; lower effort suits
`budget`, `close` and quick questions.

In Claude Code, on today's Opus and Sonnet models with a Claude plan, changing effort keeps the cache, so it's the
cheaper lever mid-session. Switching model doesn't keep it. On older models, changing effort starts the cache
again too, and Claude Code asks you first.

## Your tool's own modes

Tools have settings that change how they work with you. Some fit your companion; some pull against it.

- **Claude Code output styles** (`/output-style`). *Explanatory* and *Learning* fit well: they add short
  explanations, and *Learning* leaves small pieces of code for you to write. *Concise* keeps warnings but trims
  explanations, so why cards come out shorter. *Proactive* makes assumptions instead of asking, which works against
  "you decide", so leave it off in this folder.
- **Claude Code permission modes** (Shift+Tab). In *auto mode*, a second model approves routine actions for you.
  Your workspace adds rules so pushing, publishing and deploying still ask (guide 3.4). Other folders are unchanged.
  The rules are in `.claude/settings.json` (Claude Code) and `.codex/rules/thinkaloud.rules` (Codex, once you trust
  the folder). They cover the usual forms of each command, not every spelling, so your companion still asks for the
  rest. `.claude/settings.json` is shared: `update` only adds its ask rules there and leaves your other settings
  alone. Your own approvals go in `.claude/settings.local.json`. If you edit the Codex rules file, `update` keeps your
  version as `.mine`.
- **Study modes in chat apps.** ChatGPT's Study mode, Claude's Learning style and Gemini's Guided Learning work
  alongside the pocket prompt: see `chat/README.md`.

## When the names change

When a tool renames its models, update the table above. Nothing else in Thinkaloud names a model.
