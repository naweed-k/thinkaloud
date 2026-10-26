---
name: preflight
description: Security gate before going live. Runs the preflight script, then a focused AI review, explains each finding and fixes them one at a time. Use on "preflight", or before deploying or sharing an app.
metadata:
  thinkaloud-tier: strongest
---
# preflight: the security gate

Two stages: **the script first, then you.** The script checks what can be checked mechanically, for free.
You review only what needs judgement. Every finding is explained in plain language: the gate is also a lesson.
Before writing to memory, follow the rules in `memory/README.md`.

Say this limit once, at the start, in these words, so it's never softened: *"Preflight catches common, serious mistakes. It is not a
security audit and passing it doesn't mean the app is safe. For anything handling payments or sensitive
personal data, get a human review too."*

## 1. Run the script
The project is the active one in `memory/now.md`, unless they name another. From the workspace root, run
`node skills/preflight/scripts/preflight.mjs projects/<name>` (add `--strictness=personal|small|public` only
if they ask). It writes `preflight-report.json` and `PREFLIGHT.md` into the project. Read the JSON: `strictness`,
`summary`, and each finding's `id`, `severity`, `file`, `line`, `what`, `why`, `fix`, `status` and `blocking`.
If Node can't run it, tell them and do stage 2 alone, saying the mechanical checks didn't run.

Strictness comes from the `Audience:` line in the project's `PLAN.md`, else `build.audience` in
`memory/profile.md`, else `public`. Say which, in one line.

## 2. Explain what it found
Fails first, then warnings; info in one line. A warning that an audit "couldn't run" means that check didn't
happen: say so plainly, never as if it passed. For each: what it is, why it matters to *this* app, and the fix,
at their `explain_depth`. Never repeat a secret's value, even from the file itself. For any secret that was
committed or deployed, the fix is to **rotate the key**; deleting it isn't enough, and say why.

## 3. AI review (scoped, not a whole-codebase read)
Look only at what the script handed on (`AI-02` and other warnings that need judgement) plus this checklist,
limited to what `sensitive` in `memory/profile.md` and the project's `PLAN.md` say the app handles. Use
`security-and-hardening` if it's installed.
- **Logins:** every server route that reads or changes user data checks who's asking, and one user can't read
  another's data by changing an ID in the URL.
- **Database rules:** with Supabase, Firebase or similar, row-level security or security rules are on for every
  table or collection the browser can reach. Check this explicitly: it's the classic breach for AI-built apps.
- **Input:** validated on the server, queries parameterised, user content escaped when shown.
- **Payments:** webhooks verify signatures; prices are set on the server, never taken from the browser.
- **Personal data:** only what's needed, nothing sensitive in logs, and a way to delete it.
- **AI endpoints:** a login or rate limit, a spend cap on the provider account, and prompt injection
  considered wherever the model's output triggers actions.
- **Headers and HTTPS** (only if they give a live URL): fetch it and check HTTPS, HSTS and basic security headers.

Each finding uses the script's shape (`id` like `AI-R1`, `severity`, `file`, `line`, `what`, `why`, `fix`) plus a
label from `AGENTS.md` (`verified` · `from source` · `from memory` · `guess`). Anything you couldn't verify is
`warn`, never `fail`: a fail blocks going live, so it needs evidence. Append them to the project's `PREFLIGHT.md` under `## AI review (<date>)`.

## 4. The gate
- Any open fail that blocks at this strictness (the script's `blocking`, plus your verified fails) means
  **don't call it ready to go live.** Say so plainly, and what's left.
- They can accept a risk; you never can, because it's their app and their users. Only when they say so in this conversation, add a decision card to the
  project's `DECISIONS.md`: a heading with the date (`## D4 · 2026-10-02 · Accept: open CORS`), a `Reason:` line in
  their words, and `Accepts: <ID> <file>`, plus the finding's `ref` when it has one (`Accepts: SEC-01 server.js 3f9a1c07`).
  The script ignores any other form and lists it in the report. Never write `Accepts:` to get a run to pass.
- If the report says strictness is lower than the profile's, say so in one line. Only they can lower `Audience:`.
- Offer to fix the findings one at a time, smallest first, so each fix is easy to check. Each fix is a mini slice: say the change, make it,
  re-run the script, and show that the finding is gone.

## 5. Finish
When nothing blocks and your review has no open fails: if this was the **P · Preflight** slice, tick it in
`PLAN.md`, commit in the project, and set the next step in `memory/now.md`. Then one takeaway line naming the habit,
e.g. "secrets live in `.env`, never in code."
