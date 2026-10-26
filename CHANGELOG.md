# Changelog

Each release, newest first. Tool facts that were re-checked (commands, menus, model names, pins) are noted with
their source and date, as `MAINTAINING.md` describes.

## 1.0.0 (26 Oct 2026)

The first public release.

- **Chat apps:** `chat/pocket.md` for every chat, `chat/full.md` for a project, and `chat/thinkaloud-skill.zip`, an
  Agent Skill to install once (Claude on every plan; ChatGPT where your plan has Skills; Gemini makes skills in the
  app from `full.md`).
- **Workbench:** `npx thinkaloud@latest init` creates a workspace for Claude Code and Codex CLI (Antigravity CLI
  best effort), with nine skills (`start`, `learn`, `kickoff`, `next`, `explain`, `check`, `preflight`, `budget`,
  `close`), plain-Markdown memory that changes only with a yes, and rules that ask before publishing.
- **Commands:** `init`, `update` (keeps your edits as `.mine`), `doctor`, `preflight` and `budget`, each with its
  own `--help`.
- **Preflight:** keys in code and git history, risky settings, AI keys that reach the browser, and known-vulnerable
  dependencies. It never runs the project's code.
- **The interview** (`interview/questions.json`) and the companion card, shared by the agent and the web page.
- Tool facts last checked on 13 Oct 2026 (`lib/tools.mjs`).
