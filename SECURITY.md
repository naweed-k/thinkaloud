# Security

## Reporting a problem

If you find a security problem in Thinkaloud, please report it privately: use **Report a vulnerability** on the
repository's Security tab (GitHub private vulnerability reporting). Don't open a public issue for it.

Say what you found, how to reproduce it, and what it lets someone do. You'll get a reply within a week. Fixes go
into the next release and the changelog, with credit if you'd like it.

Only the latest release is supported. `npx thinkaloud@latest` always runs it.

## What Thinkaloud writes and runs

So you can judge it before you run it.

**`init [folder]`**
- Writes a new workspace into an empty or new folder, and refuses a folder that isn't empty.
- Runs `git init` there.
- Runs the third-party installers in [CREDITS.md](CREDITS.md) through `npx`, at pinned versions. They download from
  npm and GitHub, and write skills into the workspace. `--with-browser` installs Playwright CLI for your whole
  computer, and says so first.
- Writes rules that make your AI tool ask before it publishes or deploys: `.claude/settings.json` for Claude Code
  and `.codex/rules/thinkaloud.rules` for Codex. In Claude Code they also ask before reading a `.env` file (not
  `.env.example`), because what the agent reads goes to the AI provider. They're a prompt, not a sandbox: a command
  spelled another way can slip past, so read what you approve.

**`update [folder]`**
- Replaces only the files Thinkaloud owns, listed with their hashes in `.thinkaloud/manifest.json`.
- If you edited one, your copy is kept next to the new one as `<file>.mine`.
- Never touches `MY-RULES.md`, `memory/`, `projects/` or `learn/`.
- In `.claude/settings.json`, adds any missing ask rules and leaves your other settings as they are.
- Won't write through a link inside the workspace, and refuses a workspace made by a newer Thinkaloud.

**`doctor` and `budget`**
- Read only. They look for your tools on PATH without running them. `doctor` runs `git rev-parse` in your
  projects to spot repositories git won't open.

**`preflight [project]`**
- Reads the project and never runs its code.
- Runs audit tools only if they're installed: npm, pnpm or yarn audit, pip-audit (only on fully pinned
  requirements), gitleaks and osv-scanner. Each starts by its full path, with switches that stop it loading the
  project's own scripts or config code.
- Stops any audit or git call after 2 minutes and reports that check as not run. Refuses to run on a workspace's
  root or your home folder: name a project.
- Writes `PREFLIGHT.md` and `preflight-report.json` into the project. They show at most 4 characters of any key
  they find.

**Never**
- No accounts, no telemetry, and no network requests of Thinkaloud's own.
- Your keys and passwords are never stored by Thinkaloud, and the companion is told never to write them into code,
  memory, logs or git.

## Limits

`preflight` catches common, serious mistakes before something goes live. It isn't a security audit, and passing it
doesn't make an app safe. The companion reduces AI slips; it doesn't remove them.
