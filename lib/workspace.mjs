// What a workspace contains, and which parts Thinkaloud owns. Paths use '/' and are joined with path.join by callers.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { listFiles, toNative } from './fsutil.mjs';
import { guardrailFiles, guardrailMerges } from './guardrails.mjs';
import { SKILL_DIRS } from './tools.mjs';

// Files kept once in the repo and copied into the workspace by `init` and `update`, so there's one source.
// `from` is relative to the package root; `to` is relative to the workspace root.
export const COPY_IN = [
  { from: 'interview/questions.json', to: 'skills/start/questions.json' },
  { from: 'interview/profile.template.md', to: 'skills/start/profile.template.md' },
  // check runs spot-the-problem round 2 from the same file (its `practice` scenes).
  { from: 'interview/questions.json', to: 'skills/check/questions.json' },
  // Preflight's script runs inside the workspace too, with no install: node skills/preflight/scripts/preflight.mjs
  ...['preflight', 'files', 'patterns', 'secrets', 'deps', 'config', 'ai', 'report'].map((name) => ({
    from: `lib/preflight/${name}.mjs`,
    to: `skills/preflight/scripts/${name}.mjs`,
  })),
];

// The companion's skills: one folder each in template/skills/, and one keyword each in AGENTS.md.
export const SKILLS = ['start', 'learn', 'kickoff', 'next', 'explain', 'check', 'preflight', 'budget', 'close'];

// Tool-owned paths: `update` replaces these. Everything else in template/ (MY-RULES.md, memory/, projects/,
// learn/) is the person's: copied once by `init`, added by `update` only if missing, never overwritten.
const OWNED_PREFIXES = ['AGENTS.md', 'CLAUDE.md', 'skills/', 'guide/'];

function isOwned(rel) {
  return OWNED_PREFIXES.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));
}

export const MANIFEST = '.thinkaloud/manifest.json';

// Written by code, not kept in template/, because npm leaves .gitignore files out of packages.
const GITIGNORE = [
  '# Secrets stay out of git. Document the names in .env.example instead.',
  '.env*',
  '!.env.example',
  'private/',
  'node_modules/',
  '# Your own Claude Code approvals. Claude Code treats a tracked copy as someone else\'s.',
  '.claude/settings.local.json',
  '.DS_Store',
  'Thumbs.db',
  '# Each project has its own git repository, so the workspace leaves them alone.',
  'projects/*/',
  '!projects/_template/',
  '',
].join('\n');

// Everything a workspace should hold for these tools, from the package at pkgRoot.
// owned: files `update` keeps current; seed: files created once if missing; merged: files shared with the person
// (a tool's settings), each with a function that adds Thinkaloud's part to whatever is there.
export function buildFiles(pkgRoot, tools) {
  const template = path.join(pkgRoot, 'template');
  const owned = new Map();
  const seed = new Map();
  for (const rel of listFiles(template)) {
    (isOwned(rel) ? owned : seed).set(rel, readFileSync(toNative(template, rel)));
  }
  for (const { from, to } of COPY_IN) owned.set(to, readFileSync(toNative(pkgRoot, from)));
  seed.set('.gitignore', Buffer.from(GITIGNORE));

  const dirs = [...new Set(tools.map((t) => SKILL_DIRS[t]))];
  for (const [rel, content] of [...owned]) {
    if (!rel.startsWith('skills/')) continue;
    for (const dir of dirs) owned.set(`${dir}/${rel.slice('skills/'.length)}`, content);
  }
  // Each tool's own ask rules for publishing and deploying, scoped to this folder (lib/guardrails.mjs).
  for (const [rel, text] of guardrailFiles(tools)) owned.set(rel, Buffer.from(text));
  const merged = new Map(guardrailMerges(tools));
  return { owned, seed, merged };
}
