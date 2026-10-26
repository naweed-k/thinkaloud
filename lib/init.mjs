// `thinkaloud init [folder]`: create a workspace.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { BUDGETS, countLines, estimateTokens } from './budgets.mjs';
import { detectTools, findOnPath, parseTools, spawnTool } from './detect.mjs';
import { readIfExists, writeFile } from './fsutil.mjs';
import { applyFiles, INSTALL_CMD, PKG_ROOT, printReport, recordPacks } from './install.mjs';
import { DESIGN, PACK_VERSIONS, planInstalls, runInstalls, UIUX } from './packs.mjs';
import { addRules, parseExport } from './profile.mjs';
import { AGENT_TOOLS, TOOLS, toolById } from './tools.mjs';
import { MANIFEST } from './workspace.mjs';

export const INIT_OPTIONS = {
  tools: { type: 'string' },
  profile: { type: 'string' },
  yes: { type: 'boolean', short: 'y' },
  'with-design': { type: 'boolean' },
  'with-uiux': { type: 'boolean' },
  'with-browser': { type: 'boolean' },
};

// PowerShell and cmd pass `~` through to programs as it is, so `init ~/Thinkaloud` would make a folder named `~`.
// `\` separates folders only on Windows; on macOS and Linux it's part of a name.
const HOME_PREFIX = process.platform === 'win32' ? /^~(?=$|[\\/])/ : /^~(?=$|\/)/;
export function expandHome(p) {
  return HOME_PREFIX.test(p) ? path.join(os.homedir(), p.slice(1)) : p;
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

function checkBasics(err) {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22) {
    err.write(`Thinkaloud needs Node.js 22 or newer (you have ${process.versions.node}). Get it from https://nodejs.org\n`);
    return false;
  }
  if (!findOnPath('git')) {
    err.write('Thinkaloud needs git, so every step can be undone. Install it from https://git-scm.com/downloads, then run this again.\n');
    return false;
  }
  return true;
}

function explainNoTools(out) {
  out.write([
    `No AI coding agent found on this computer (looked for ${TOOLS.map((t) => t.command).join(', ')}).`,
    '',
    'The Thinkaloud workspace works with an agent that can read files. Install one, then run this again:',
    ...TOOLS.map((t) => `  ${t.name}${t.bestEffort ? ' (best effort)' : ''}: ${t.installDocs}`),
    '',
    'No coding agent? You can still use the Thinkaloud companion prompt in any chat app',
    '(ChatGPT, Claude or Gemini). If you use another agent that reads AGENTS.md (Cursor, Copilot...),',
    'run this again with --tools=none.',
    '',
  ].join('\n'));
}

async function chooseTools(values, out, err) {
  if (values.tools !== undefined) {
    const parsed = parseTools(values.tools);
    if (parsed.error) err.write(`thinkaloud: ${parsed.error}\n`);
    return parsed.tools ?? null;
  }
  const detected = detectTools();
  if (!detected.length) {
    explainNoTools(out);
    return 'stop';
  }
  if (!process.stdin.isTTY || values.yes) return detected;
  for (;;) {
    const answer = await ask(`Set up Thinkaloud for which tools? Found: ${detected.join(', ')}.\n`
      + `Press Enter for those, or type a list (${AGENT_TOOLS.join(',')}): `);
    if (!answer) return detected;
    const parsed = parseTools(answer);
    if (parsed.tools) return parsed.tools;
    out.write(`${parsed.error}\n`);
  }
}

function checkTarget(target, err) {
  if (!existsSync(target)) return true;
  if (!statSync(target).isDirectory()) {
    err.write(`thinkaloud: ${target} is a file, not a folder.\n`);
    return false;
  }
  if (readdirSync(target).length === 0) return true;
  if (existsSync(path.join(target, ...MANIFEST.split('/')))) {
    err.write(`${target} is already a Thinkaloud workspace. To get the latest version, run this inside it:\n`
      + `  ${INSTALL_CMD} update\n`);
  } else {
    err.write(`thinkaloud: ${target} isn't empty, so nothing was written. Choose an empty or new folder:\n`
      + `  ${INSTALL_CMD} init <folder>\n`);
  }
  return false;
}

function readProfile(file, err) {
  if (!existsSync(file)) {
    err.write(`thinkaloud: can't find the profile file ${file}\n`);
    return null;
  }
  const parsed = parseExport(readFileSync(file, 'utf8'));
  if (parsed.error) {
    err.write(`thinkaloud: ${file}: ${parsed.error}. Nothing was written.\n`
      + 'A profile from the Thinkaloud interview page imports as it is. If you edited it, check that line.\n');
    return null;
  }
  const rules = BUDGETS.find((b) => b.file === 'MY-RULES.md');
  const merged = addRules(readFileSync(path.join(PKG_ROOT, 'template', 'MY-RULES.md'), 'utf8'), parsed.rules);
  if (estimateTokens(merged) > rules.tokens || countLines(merged) > rules.lines) {
    err.write(`thinkaloud: ${file}: the rules under "## My rules" are too long for MY-RULES.md. Shorten them. Nothing was written.\n`);
    return null;
  }
  return parsed;
}

// Rules become standing instructions for the AI, so the person sees them before they're added.
async function confirmRules(profile, values, out) {
  if (!profile.rules.length) return profile;
  out.write(`The profile has ${profile.rules.length} rule(s) for your AI to follow every session:\n`);
  for (const r of profile.rules) out.write(`  - ${r}\n`);
  if (!process.stdin.isTTY || values.yes) return profile;
  if (!/^n/i.test(await ask('Add them to MY-RULES.md? [Y/n] '))) return profile;
  out.write('Left them out. You can add rules to MY-RULES.md any time.\n');
  return { ...profile, rules: [] };
}

function importProfile(ws, { profile, rules }) {
  writeFile(ws, 'memory/profile.md', profile);
  if (rules.length) writeFile(ws, 'MY-RULES.md', addRules(readIfExists(ws, 'MY-RULES.md').toString('utf8'), rules));
  const now = readIfExists(ws, 'memory/now.md').toString('utf8');
  writeFile(ws, 'memory/now.md', now.replace(/^next:.*$/m, 'next: type `start` to check your imported profile and pick a first step'));
}

// The core engineering skills always; the optional packs only when asked for, because each adds to every session's cost.
async function choosePacks(values, tools) {
  const packs = ['core'];
  if (!tools.length) return packs;
  const interactive = process.stdin.isTTY && !values.yes;
  if (values['with-design'] || (interactive && /^y/i.test(await ask(
    `Add the design pack (impeccable, for better-looking interfaces; adds about ${DESIGN.descTokens} tokens to every session)? [y/N] `)))) {
    packs.push('design');
  }
  if (values['with-uiux'] || (interactive && /^y/i.test(await ask(
    `Add ui-ux-pro-max too (a large library of styles, palettes and fonts; ${UIUX.skills.length} skills, about ${UIUX.descTokens} tokens every session)? [y/N] `)))) {
    packs.push('uiux');
  }
  if (values['with-browser'] || (interactive && /^y/i.test(await ask(
    'Add the browser pack (Playwright CLI, so your AI can open and check web pages; installs for your whole computer)? [y/N] ')))) {
    packs.push('browser');
  }
  return packs;
}

export async function init(values, positionals, out = process.stdout, err = process.stderr) {
  if (!checkBasics(err)) return 1;

  const target = path.resolve(expandHome(positionals[0] ?? 'Thinkaloud'));
  if (!checkTarget(target, err)) return 1;
  let profile = values.profile ? readProfile(path.resolve(expandHome(values.profile)), err) : null;
  if (values.profile && !profile) return 1;

  const tools = await chooseTools(values, out, err);
  if (tools === 'stop') return 0;
  if (!tools) return 2;

  if (!positionals[0] && process.stdin.isTTY && !values.yes) {
    const answer = await ask(`Create your Thinkaloud workspace in ${target}? [Y/n] `);
    if (/^n/i.test(answer)) {
      out.write(`Nothing was created. To choose a folder: ${INSTALL_CMD} init <folder>\n`);
      return 0;
    }
  }

  const packs = await choosePacks(values, tools);
  if (profile) profile = await confirmRules(profile, values, out);

  const report = applyFiles(target, PKG_ROOT, tools);
  if (profile) importProfile(target, profile);

  const git = spawnTool('git', ['init'], { cwd: target });
  const gitOk = git.status === 0;

  out.write(`Created your Thinkaloud workspace in ${target} (${report.added.length} files).\n`);
  out.write(`Set up for: ${tools.length ? tools.join(', ') : 'any agent that reads AGENTS.md'}.\n`);
  if (profile) {
    out.write(`Imported your profile into memory/profile.md${profile.rules.length ? `, and ${profile.rules.length} rule(s) into MY-RULES.md` : ''}.\n`);
  }
  out.write(gitOk
    ? 'Started a local git repository (nothing is pushed anywhere).\n'
    : `Warning: "git init" didn't work, so run it yourself in the folder. ${(git.stderr ?? '').trim()}\n`);
  printReport({ ...report, added: [] }, out);

  const steps = planInstalls(tools, packs);
  if (steps.length) {
    out.write('\nThird-party skills (credited in the README):\n');
    recordPacks(target, runInstalls(steps, target, out), PACK_VERSIONS);
  }

  const rel = path.relative(process.cwd(), target) || '.';
  out.write(`\nNext:\n  cd "${rel}"\n`);
  if (tools.length) for (const t of tools) out.write(`  ${toolById(t).start}\n`);
  else out.write('  Open this folder in your AI tool and type: start   (it reads AGENTS.md)\n');
  out.write(profile ? 'Your companion will show what it read from your profile and ask what to start with.\n'
    : 'The first session runs a short interview (about 8 minutes), so your companion knows how to work with you.\n');
  return 0;
}
