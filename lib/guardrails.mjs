// The agent tools' own ask rules, so promise 4 ("I ask before anything that publishes") holds even when a tool
// approves routine actions itself (Claude Code's auto mode). Written inside the workspace only, never to user or
// global settings, so the tools behave as before everywhere else.
// Which file each tool reads is a tool fact (lib/tools.mjs); the syntax of each file is built here.
//
// These rules make the tool ask; they aren't a sandbox. Both tools match the command as written, so another
// spelling (a full path, `sh -c "…"`) isn't caught. AGENTS.md's promise still covers those: the companion asks.

import { GUARDRAIL_FILES } from './tools.mjs';

// Command prefixes that publish or deploy. Each one prompts every time, in every permission mode.
// '*' stands for any words in between. Only Claude Code's rules can say that (Codex matches an exact prefix,
// with no wildcard), so Codex skips those entries.
export const ASK_BEFORE = [
  ['git', 'push'],
  // git -C <folder> push, git -c <setting> push.
  ['git', '*', 'push'],
  ['npm', 'publish'],
  ['pnpm', 'publish'],
  ['yarn', 'publish'],
  ['yarn', 'npm', 'publish'],
  ['bun', 'publish'],
  ['docker', 'push'],
  // A project's own deploy script, whatever it calls.
  ['npm', 'run', 'deploy'],
  ['pnpm', 'deploy'],
  ['pnpm', 'run', 'deploy'],
  ['yarn', 'deploy'],
  ['yarn', 'run', 'deploy'],
  ['bun', 'run', 'deploy'],
  ['vercel'],
  ['npx', 'vercel'],
  ['bunx', 'vercel'],
  ['pnpm', 'dlx', 'vercel'],
  ['netlify', 'deploy'],
  ['npx', 'netlify', 'deploy'],
  ['npx', 'netlify-cli', 'deploy'],
  ['bunx', 'netlify', 'deploy'],
  ['pnpm', 'dlx', 'netlify', 'deploy'],
  ['firebase', 'deploy'],
  ['npx', 'firebase', 'deploy'],
  ['npx', 'firebase-tools', 'deploy'],
  ['wrangler', 'deploy'],
  ['npx', 'wrangler', 'deploy'],
  ['bunx', 'wrangler', 'deploy'],
  ['pnpm', 'dlx', 'wrangler', 'deploy'],
  ['fly', 'deploy'],
  ['flyctl', 'deploy'],
  ['railway', 'up'],
  ['supabase', 'db', 'push'],
  ['npx', 'supabase', 'db', 'push'],
  ['gh', 'repo', 'create'],
  ['gh', 'pr', 'create'],
  ['gh', 'release', 'create'],
];

// Secrets files: whatever the agent reads goes to the AI provider, so it asks first. Gitignore-style patterns at any
// depth; the `!` lines carve the example files back out and must come after the rules they narrow. Claude Code
// applies Read rules to its file tools and to `cat`, `head` and the like in Bash. Codex has no ask-before-read
// rule, so there it's AGENTS.md's rule alone.
export const ASK_BEFORE_READING = ['Read(**/.env)', 'Read(**/.env.*)', 'Read(!.env.example)', 'Read(!.env.sample)',
  'Read(!.env.template)'];

// Claude Code: `ask` rules force a prompt in every mode, auto and bypass included, and a trailing ` *` also matches
// the bare command. Bash and PowerShell forms, so the same file works on every OS. Your own approvals go to
// settings.local.json.
export function claudeAskRules() {
  return [...ASK_BEFORE.flatMap((p) => [`Bash(${p.join(' ')} *)`, `PowerShell(${p.join(' ')} *)`]), ...ASK_BEFORE_READING];
}

function claudeSettings() {
  return `${JSON.stringify({ permissions: { ask: claudeAskRules() } }, null, 2)}\n`;
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// .claude/settings.json is shared with the person and with other tools, so Thinkaloud only adds its ask rules to it
// and leaves every other setting alone. Returns { text, merged }: merged is false when the file isn't settings JSON
// we can safely add to, and then `text` is a fresh file (the caller keeps theirs as .mine).
export function mergeClaudeSettings(current) {
  if (current === null) return { text: claudeSettings(), merged: true };
  let settings;
  try {
    settings = JSON.parse(current.replace(/^﻿/, ''));
  } catch {
    return { text: claudeSettings(), merged: false };
  }
  const perms = settings?.permissions;
  if (!isObject(settings) || (perms !== undefined && !isObject(perms))
    || (perms?.ask !== undefined && !Array.isArray(perms.ask))) {
    return { text: claudeSettings(), merged: false };
  }
  const ask = perms?.ask ?? [];
  const missing = claudeAskRules().filter((r) => !ask.includes(r));
  if (!missing.length) return { text: current, merged: true };
  settings.permissions = { ...perms, ask: [...ask, ...missing] };
  return { text: `${JSON.stringify(settings, null, 2)}\n`, merged: true };
}

// Codex: prefix rules with decision "prompt". They load once the project's .codex/ layer is trusted.
function codexRules() {
  const rules = ASK_BEFORE.filter((p) => !p.includes('*')).map((p) => [
    'prefix_rule(',
    `    pattern = [${p.map((w) => JSON.stringify(w)).join(', ')}],`,
    '    decision = "prompt",',
    '    justification = "Thinkaloud: this publishes or deploys, so it asks first.",',
    ')',
  ].join('\n'));
  return [
    '# Thinkaloud: ask before anything that publishes or deploys (promise 4).',
    '# Kept current by `thinkaloud update`. Add your own rules in another .rules file in this folder.',
    '',
    rules.join('\n\n'),
    '',
  ].join('\n');
}

// Files Thinkaloud owns outright, and files it only adds its rules to.
const OWNED = { codex: codexRules };
const MERGED = { claude: mergeClaudeSettings };

// The guardrail files Thinkaloud owns for these tools, as [relative path, content] pairs.
export function guardrailFiles(tools) {
  return tools.filter((t) => GUARDRAIL_FILES[t] && OWNED[t]).map((t) => [GUARDRAIL_FILES[t], OWNED[t]()]);
}

// The guardrail files Thinkaloud adds its rules to, as [relative path, merge function] pairs.
export function guardrailMerges(tools) {
  return tools.filter((t) => GUARDRAIL_FILES[t] && MERGED[t]).map((t) => [GUARDRAIL_FILES[t], MERGED[t]]);
}

// Whether a tool's guardrail file (as found on disk) still asks before a push.
export function asksBeforePush(tool, text) {
  if (tool === 'claude') {
    try {
      const ask = JSON.parse(text.replace(/^﻿/, ''))?.permissions?.ask;
      return Array.isArray(ask) && ask.includes('Bash(git push *)');
    } catch {
      return false;
    }
  }
  if (tool === 'codex') return /pattern = \["git", "push"\],\s*decision = "prompt"/.test(text);
  return true;
}
