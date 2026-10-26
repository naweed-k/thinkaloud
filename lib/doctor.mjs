// `thinkaloud doctor [folder]`: re-check tools, wiring and token budgets, and print fixes. It changes nothing.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BUDGETS, countLines, estimateTokens } from './budgets.mjs';
import { detectTools, findOnPath, spawnTool } from './detect.mjs';
import { hash, listFiles, readIfExists, toNative } from './fsutil.mjs';
import { compareVersions, INSTALL_CMD, packageVersion, PKG_ROOT, readManifest } from './install.mjs';
import { notAWorkspace } from './update.mjs';
import { CORE, PACK_VERSIONS, UIUX } from './packs.mjs';
import { asksBeforePush } from './guardrails.mjs';
import { factsAgeDays, FACTS_CHECKED, formatDate, GUARDRAIL_FILES, SKILL_DIRS, STALE_AFTER_DAYS, TOOLS } from './tools.mjs';

// Project repos that git refuses to open as "dubious ownership". On Windows, Codex runs commands as a separate
// sandbox user, so a repo it creates belongs to that user (seen in a real Codex session, Sep 2026).
// Returns each such folder with '/' separators, the way git prints it.
function foreignRepos(ws) {
  const projects = path.join(ws, 'projects');
  if (!existsSync(projects)) return [];
  const found = [];
  for (const name of readdirSync(projects)) {
    const dir = path.join(projects, name);
    if (name === '_template' || !existsSync(path.join(dir, '.git'))) continue;
    const r = spawnTool('git', ['-C', dir, 'rev-parse', '--git-dir']);
    if (/dubious ownership/.test(r.stderr ?? '')) found.push(dir.split(path.sep).join('/'));
  }
  return found;
}

const DESCRIPTIONS_BUDGET = 2000;
const TOTAL_BUDGET = 5000;

function description(text) {
  const fm = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/);
  const line = fm?.[1].match(/^description:\s*(.*)$/m);
  return line ? line[1].replace(/^["']|["']$/g, '') : '';
}

// Every skill the agent tools will list at session start, once per name, with its description.
function skillDescriptions(ws, tools) {
  const also = TOOLS.filter((t) => tools.includes(t.id)).flatMap((t) => t.alsoReads ?? []);
  const dirs = [...new Set(['skills', ...tools.map((t) => SKILL_DIRS[t]), ...also])];
  const found = new Map();
  for (const dir of dirs) {
    for (const rel of listFiles(toNative(ws, dir))) {
      const parts = rel.split('/');
      if (parts.length !== 2 || parts[1] !== 'SKILL.md' || found.has(parts[0])) continue;
      found.set(parts[0], description(readFileSync(toNative(ws, `${dir}/${rel}`), 'utf8')));
    }
  }
  return found;
}

// Budget rows for the always-loaded files plus the skill descriptions.
function budgetReport(ws, tools) {
  const rows = [];
  for (const b of BUDGETS) {
    const text = readIfExists(ws, b.file)?.toString('utf8');
    if (text === undefined) continue;
    rows.push({ item: b.file, chars: text.length, tokens: estimateTokens(text), budget: b.tokens,
      lines: countLines(text), maxLines: b.lines });
  }
  const skills = skillDescriptions(ws, tools);
  const chars = [...skills].reduce((n, [name, d]) => n + name.length + d.length, 0);
  rows.push({ item: `skill descriptions (${skills.size} skills)`, chars, tokens: Math.ceil(chars / 4),
    budget: DESCRIPTIONS_BUDGET });
  const total = rows.reduce((n, r) => n + r.tokens, 0);
  const uiuxChars = [...skills].filter(([name]) => UIUX.skills.includes(name))
    .reduce((n, [name, d]) => n + name.length + d.length, 0);
  return { rows, total, uiuxTokens: Math.ceil(uiuxChars / 4) };
}

// Prints the budget table (shared by doctor and budget) and returns notes for anything over budget.
export function writeBudgets(ws, tools, packs, out) {
  const notes = [];
  const { rows, total, uiuxTokens } = budgetReport(ws, tools);
  out.write('\nToken budgets (characters ÷ 4, loaded every session):\n');
  const width = Math.max(...rows.map((r) => r.item.length));
  for (const r of rows) {
    const over = r.tokens > r.budget || (r.maxLines && r.lines > r.maxLines);
    const lines = r.maxLines ? `  ${r.lines}/${r.maxLines} lines` : '';
    out.write(`  ${over ? 'over' : 'ok  '} ${r.item.padEnd(width)}  ${String(r.tokens).padStart(5)} / ${r.budget} tokens${lines}\n`);
    if (over && r.item.startsWith('skill descriptions') && packs.uiux) {
      notes.push(`Skill descriptions are over budget because of ui-ux-pro-max (${UIUX.skills.length} skills, ${uiuxTokens} tokens here). That is the known cost of adding it.`);
    } else if (over) notes.push(`${r.item} is over its budget. Shorter files cost less every session and are followed better.`);
  }
  out.write(`  ${total > TOTAL_BUDGET ? 'over' : 'ok  '} ${'total'.padEnd(width)}  ${String(total).padStart(5)} / ${TOTAL_BUDGET} tokens\n`);
  if (total > TOTAL_BUDGET) notes.push('The fixed start-of-session cost is over budget. Trim memory/lessons.md or remove skills you don\'t use.');
  return notes;
}

export function doctor(values, positionals, out = process.stdout, now = new Date()) {
  const ws = path.resolve(positionals[0] ?? '.');
  const problems = [];
  const notes = [];
  const say = (mark, text) => out.write(`${mark} ${text}\n`);

  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 22) say('ok  ', `Node.js ${process.versions.node}`);
  else problems.push(`Node.js ${process.versions.node} is too old. Install 22 or newer from https://nodejs.org`);
  if (findOnPath('git')) say('ok  ', 'git');
  else problems.push('git is missing. Install it from https://git-scm.com/downloads');

  const manifest = readManifest(ws);
  if (!manifest) {
    notAWorkspace(ws, out);
    return 1;
  }
  const tools = Array.isArray(manifest.tools) ? manifest.tools : [];
  const detected = detectTools();
  say('ok  ', `Workspace: ${ws}`);
  say('    ', `Set up for: ${tools.length ? tools.join(', ') : 'none (AGENTS.md only)'}. Found on this computer: ${detected.join(', ') || 'none'}.`);
  for (const t of tools.filter((t) => !detected.includes(t))) {
    notes.push(`${t} is set up here but isn't installed (or isn't on PATH). Install it, or run: ${INSTALL_CMD} update --tools=${tools.filter((x) => x !== t).join(',') || 'none'}`);
  }
  for (const t of detected.filter((t) => !tools.includes(t))) {
    notes.push(`${t} is installed but not set up here. To add it: ${INSTALL_CMD} update --tools=${[...tools, t].join(',')}`);
  }

  const running = packageVersion(PKG_ROOT);
  const age = compareVersions(manifest.version, running);
  if (age === -1) notes.push(`This workspace has Thinkaloud ${manifest.version}; ${running} is available. Run: ${INSTALL_CMD} update`);
  else if (age === 1) {
    notes.push(`This workspace has Thinkaloud ${manifest.version}, newer than the ${running} you're running now, so this check may `
      + `be out of date. Run the latest instead: ${INSTALL_CMD} doctor`);
  } else if (age === null) notes.push(`The workspace's manifest doesn't say which Thinkaloud made it. Run: ${INSTALL_CMD} update`);
  if (Object.keys(manifest.pending).length) problems.push(`The last update didn't finish. Run: ${INSTALL_CMD} update`);

  // Commands, folders and menus move between tool releases (lib/tools.mjs).
  say('    ', `Tool facts last checked ${formatDate(FACTS_CHECKED)}.`);
  if (factsAgeDays(now) > STALE_AFTER_DAYS) {
    notes.push(`Thinkaloud's facts about the AI tools are over ${STALE_AFTER_DAYS} days old, so a command or menu may have moved. `
      + `Run: ${INSTALL_CMD} update. If something still doesn't match, the tool's /help lists what's there now.`);
  }

  const missing = [];
  const edited = [];
  for (const [rel, h] of Object.entries(manifest.files ?? {})) {
    let current;
    try {
      current = readIfExists(ws, rel);
    } catch {
      current = null; // a folder where the file should be, or no permission: update puts it right or says why
    }
    if (current === null) missing.push(rel);
    else if (hash(current) !== h && hash(current) !== manifest.pending[rel]) edited.push(rel);
  }
  if (missing.length) problems.push(`Missing Thinkaloud files (run update to restore them):\n${missing.map((f) => `        ${f}`).join('\n')}`);
  else say('ok  ', `Thinkaloud files present (${Object.keys(manifest.files ?? {}).length})`);
  if (manifest.rejected.length) {
    problems.push(`.thinkaloud/manifest.json lists paths outside this workspace, which Thinkaloud ignores: ${manifest.rejected.join(', ')}. `
      + 'If you didn\'t make this folder yourself, check where it came from. Running update rewrites the manifest without them.');
  }
  if (edited.length) notes.push(`You've edited: ${edited.join(', ')}. That's fine; update keeps your version as .mine. Rules you want to keep belong in MY-RULES.md.`);

  // Promise 4 in the tool itself: the ask rules for publishing and deploying (lib/guardrails.mjs).
  for (const t of tools.filter((x) => GUARDRAIL_FILES[x])) {
    const text = readIfExists(ws, GUARDRAIL_FILES[t])?.toString('utf8');
    if (text === undefined && Object.hasOwn(manifest.files, GUARDRAIL_FILES[t])) continue; // reported with the missing files above
    if (text === undefined) {
      problems.push(`${GUARDRAIL_FILES[t]} is missing, so ${t} may publish without asking you. Run: ${INSTALL_CMD} update`);
    } else if (!asksBeforePush(t, text)) {
      problems.push(`${GUARDRAIL_FILES[t]} no longer asks before git push, so ${t} may publish without asking you. `
        + `Run: ${INSTALL_CMD} update (your version is kept as .mine)`);
    }
  }

  // .mine copies only appear where Thinkaloud owns files, so don't walk projects/ (it may hold node_modules).
  const owned = [...new Set(['skills', 'guide', ...Object.values(SKILL_DIRS)])];
  const guardDirs = [...new Set(Object.values(GUARDRAIL_FILES).map((f) => path.posix.dirname(f)))]
    .filter((d) => existsSync(toNative(ws, d)));
  const mine = [...readdirSync(ws), ...owned.flatMap((d) => listFiles(toNative(ws, d)).map((f) => `${d}/${f}`)),
    ...guardDirs.flatMap((d) => readdirSync(toNative(ws, d)).map((f) => `${d}/${f}`))]
    .filter((f) => f.endsWith('.mine'));
  if (mine.length) notes.push(`Your older copies from an update are waiting to be checked: ${mine.join(', ')}. Delete each once you've copied back what you need.`);

  const gitignore = readIfExists(ws, '.gitignore')?.toString('utf8') ?? '';
  if (!/^\.env\*?$/m.test(gitignore)) problems.push('.gitignore doesn\'t list .env*, so a secret could end up in git. Add a line: .env*');
  if (!existsSync(path.join(ws, '.git'))) notes.push('This folder isn\'t a git repository yet. Run: git init');
  for (const dir of foreignRepos(ws)) {
    problems.push(`git won't open ${dir} because another user account owns it (on Windows, Codex's sandbox creates repos that way). `
      + `If you trust it, run: git config --global --add safe.directory "${dir}"`);
  }

  const packs = manifest.packs ?? {};
  if (tools.length) {
    const names = { core: 'engineering skills', design: 'design pack', uiux: 'ui-ux-pro-max', browser: 'browser pack' };
    for (const [pack, version] of Object.entries(packs)) {
      say('ok  ', `${names[pack] ?? pack}: ${version}`);
      if (version !== PACK_VERSIONS[pack]) notes.push(`A newer pinned ${names[pack] ?? pack} is available. Run: ${INSTALL_CMD} update`);
    }
    if (!packs.core) notes.push(`The engineering skills (agent-skills) are not installed yet. Run: ${INSTALL_CMD} update`);
    else {
      const lost = CORE.skills.filter((n) => tools.some((t) => !existsSync(toNative(ws, `${SKILL_DIRS[t]}/${n}/SKILL.md`))));
      if (lost.length) notes.push(`Some engineering skills are missing (${lost.join(', ')}). Run: ${INSTALL_CMD} update --tools=${tools.join(',')}`);
    }
  }

  notes.push(...writeBudgets(ws, tools, packs, out));

  out.write('\n');
  for (const p of problems) say('FIX ', p);
  for (const n of notes) say('note', n);
  if (!problems.length && !notes.length) out.write('All good.\n');
  return problems.length ? 1 : 0;
}
