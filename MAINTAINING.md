# Maintaining Thinkaloud

Most of Thinkaloud doesn't date: the promises, "you decide", evidence over claims, found text treated as data,
and memory that changes only with a yes. What dates is a small set of facts about other people's tools:
commands, folders, menus, model names, limits and pinned versions. They all live in a few known places, each
with the date it was last checked, so keeping Thinkaloud current is a routine, not a hunt.

## When to refresh

- **Every quarter.** `thinkaloud doctor` prints "Tool facts last checked …" and starts suggesting an update once
  that's more than 90 days old (`STALE_AFTER_DAYS` in `lib/tools.mjs`).
- **When a supported tool ships a big change**: a new skills folder, a renamed command, a new model family, or a
  chat app that moves its settings.
- **When someone reports** a command or menu that no longer exists.

Check against the official docs only. Third-party guides often disagree with each other, so where the official
page says nothing, keep the current fact and note that it's unconfirmed (the way Antigravity is marked best effort).

## Where each fact lives

| Fact | Lives in | Guarded by |
|---|---|---|
| Each coding agent's command, install page, start hint, skills folder, guardrail file and usage commands | `lib/tools.mjs`, one record per tool, each with `checked` | `test/tools.test.mjs` |
| The guardrail files' syntax and the publish and deploy prefixes | `lib/guardrails.mjs` | `test/workspace.test.mjs` |
| Usage commands and chat-app usage pages, for people | `template/guide/usage.md` | `test/budget.test.mjs` (matches `lib/tools.mjs`) |
| Model names for each tier | `template/guide/models.md` | `test/budget.test.mjs` (a column per tool, tiers match the skills) |
| Chat-app menus, character limits and memory menus | `chat/README.md` (`CHAT_APPS_CHECKED` in `lib/tools.mjs`) | `test/chat.test.mjs` |
| Third-party skill pins, installer flags and description costs | `lib/packs.mjs` (`PACKS_CHECKED`) | `test/packs.test.mjs` |
| Key shapes, browser-exposed prefixes, AI packages and hosts | `lib/preflight/patterns.mjs`, `secrets.mjs` (`CLIENT_PREFIXES`), `files.mjs` (`AI_PACKAGES`), `ai.mjs` | `test/preflight.test.mjs` |
| The switches that stop audit tools running a project's own code (yarn, pnpm, Corepack, git, pip-audit) | `lib/preflight/files.mjs` (`SAFE_ENV`, `GIT_SAFE`), `deps.mjs` | `test/preflight.test.mjs` |

The companion's skills name no tool commands; they point to `guide/usage.md` and `guide/models.md`, so a
refresh never touches them. A test fails if a skill starts naming a usage command again.

## The routine

1. **Re-check each tool record** in `lib/tools.mjs` against its official docs: the command name, the install
   page, the skills folder, the guardrail file and the usage commands. Fix what moved and set that record's
   `checked` to today (`YYYY-MM-DD`).
2. **Re-check the guides**: model names in `guide/models.md`, the usage table in `guide/usage.md`, and the menus
   and limits in `chat/README.md`. Set `CHAT_APPS_CHECKED` once the chat apps are done.
3. **Update the "Last checked" line** in all three guides to the newest date (the format is `13 Oct 2026`).
   `test/tools.test.mjs` fails until they match.
4. **Re-check preflight's audit tools** when npm, pnpm, yarn, pip-audit or Corepack ship a major version: does
   each still honour its switch in `files.mjs` and `deps.mjs`? Try it with a project whose config tries to run a
   file (a `.pnpmfile.cjs`, a `.yarnrc` `yarn-path`). A switch that stops working means preflight runs project
   code, so drop that audit until it's fixed.
5. **Run `npm test`.** Then run `thinkaloud init` in an empty folder for each tool you can, and type `start`.
6. **Write down what you found** in the changelog: what changed, the source, and the date.

## The web interview

The interview on the Thinkaloud site renders `interview/questions.json` and downloads a `profile.md` in the shape
of `interview/profile.template.md`, which `init --profile` imports (`lib/profile.mjs`). The site lives in a
separate repo, so a change to a question id, an option value or the template is a change to that format: check
the site still exports a profile `parseExport` accepts, and keep `version: 1` unless the format really changes.

## Bumping a third-party pin

Each pack in `lib/packs.mjs` installs from its own source at a pinned version; nothing is bundled.

1. Read the project's release notes and licence. A licence change is a reason to stop and ask, not to bump.
2. Change the pin. For `CORE`, pin the full commit the tag points to, not just the tag, because a tag can be
   moved.
3. Install it into a fresh workspace (`init --with-design --with-uiux --with-browser`), then run
   `thinkaloud doctor` there. Copy each pack's measured description cost into its `descTokens`, and check no new
   skill name clashes with a companion skill (`test/packs.test.mjs`).
4. Set `PACKS_CHECKED` to today. Existing workspaces get the new pin on their next `update`.

## Adding a tool

Add a record to `TOOLS` in `lib/tools.mjs`. Detection, `init`, the workspace files, `budget` and `doctor` all
read from it. If the tool has a project-level rules file, add a builder for it in `lib/guardrails.mjs`: in `OWNED`
if the file is Thinkaloud's alone, or in `MERGED` if the person keeps their own settings in it too. Add its
installer names to `SKILLS_AGENT` and `PW_TARGET` in `lib/packs.mjs`, because each third-party installer names
tools its own way. Then add its column to the tables in `guide/models.md` and `guide/usage.md`.
