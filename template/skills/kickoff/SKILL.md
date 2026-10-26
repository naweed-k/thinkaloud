---
name: kickoff
description: Kick off a project. Pin down the problem, cut the scope, choose the stack with decision cards, write PLAN.md in small slices, then get approval. Use on "kickoff" or when starting to build something.
metadata:
  thinkaloud-tier: strongest
---
# kickoff: start a project

**No application code in this skill.** They decide the shape first; once code exists, changing it costs more.
Before writing anything, follow the rules in `memory/README.md`.

## 1. Problem
2–4 questions, one at a time: what is it, who is it for, what do they do today without it, and what do you
want to learn from building it. Start from `build.idea` in `memory/profile.md` if it's there.

## 2. Scope
Propose a v1 list (3–6 items) and an explicit *out of scope* list. Size guard: estimate the weeks it takes
at their `hours_per_week`. Over about 4 weeks, propose cuts: a small v1 gets finished and used, and teaches
them what the rest should be.

## 3. Shape, with decision cards
Stack, architecture in a few lines, data model, where secrets live, hosting. Default to boring,
well-documented choices that suit their `code_level`: they'll find help when they're stuck. Each important
choice is a decision card (see `AGENTS.md`), one at a time, recorded in the project's `DECISIONS.md`. Minor
choices that belong together (say, the formatter, folder layout and test runner) can share one card. Anything
touching security, money or data always gets its own. Secrets always live in `.env` (git-ignored), documented
in `.env.example`. Name only libraries and services you've checked exist (their registry page or docs): an
invented package name is a real risk, because attackers publish under names AI can invent.

## 4. Write the project
Copy `projects/_template/` to `projects/<name>/` (short, lowercase, hyphens) and fill it in:
- `PLAN.md`: the brief, the architecture (a few lines and a Mermaid diagram), and **slices**.
  - S1 is always a walking skeleton that runs locally with one test, so every later slice starts from
    something that works.
  - Every slice leaves the app working, has a *Verify by*, and a size: `S` (one file or a small change and
    a test), `M` (a feature across a few files, with tests) or `L` (a new subsystem, a migration, or anything
    with an unknown). Split `L` slices where you can. Sizes are relative, not token estimates: an `S` fits a
    short session, an `M` a normal one, and an `L` needs a fresh session with plenty of usage left
    (`guide/usage.md`). Tell them this once, in a line, when you show the slices.
  - Put the riskiest unknown early, while changing course is still cheap.
  - Keep the final **P · Preflight** slice unless `build.audience` is `personal`. Going live means others can
    reach it, and a personal project only runs for them. If that changes, add the slice back before it does.
  - Set `Audience:` from `build.audience`, and leave `Approved: not yet`. A lower audience than the profile's (it drops
    checks, and `personal` drops the preflight slice) is a decision card, never your call.
- `DECISIONS.md` (the cards from step 3), `LOG.md`, and the project `AGENTS.md` (name, one line, run and
  test commands).
- Run `git init` inside `projects/<name>/`. Local only: never add a remote or push. Going public is their
  call, later.

## 5. Approval
Summarise in a few lines: the pitch, v1 scope, stack, slices with sizes, and the biggest risk. Ask if it's
good to go. A clear yes ("looks good", "go") counts as approval; silence doesn't, because `next` builds only
an approved plan.

On approval: set `Approved: yes, <date>` in `PLAN.md`, set `active` and the next step (`next`, for S1) in
`memory/now.md`, and prepend a line to `memory/progress.md`.
