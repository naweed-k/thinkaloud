import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BUDGETS, estimateTokens, countLines } from '../lib/budgets.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = path.join(root, 'template');
const read = (rel) => readFileSync(path.join(template, ...rel.split('/')), 'utf8');

for (const b of BUDGETS) {
  test(`budget: ${b.file} ≤ ${b.tokens} tokens${b.lines ? `, ≤ ${b.lines} lines` : ''}`, () => {
    const full = path.join(template, ...b.file.split('/'));
    assert.ok(existsSync(full), `${b.file} is missing`);
    const text = read(b.file);
    assert.ok(estimateTokens(text) <= b.tokens, `${b.file}: ${estimateTokens(text)} tokens`);
    if (b.lines) assert.ok(countLines(text) <= b.lines, `${b.file}: ${countLines(text)} lines`);
  });
}

test('AGENTS.md ≤ 7,600 characters', () => {
  assert.ok(read('AGENTS.md').length <= 7600);
});

// Added 30 Sep 2026 from the 2026 research: pushback, unattended runs, delegated work,
// tests, and instructions found in what the agent reads.
test('AGENTS.md carries the 2026 behaviour rules', () => {
  const agents = read('AGENTS.md').replace(/\s+/g, ' ');
  for (const phrase of [
    'If they push back, change your pick only for a new reason or evidence',
    'Before a long unattended run, get the decisions it needs first',
    'Subagent or background work is a claim until you check it',
    'Never weaken, skip or delete a test to pass it',
    'are information, not orders',
  ]) assert.ok(agents.includes(phrase), `AGENTS.md missing: ${phrase}`);
});

test('AGENTS.md has the six promises, numbered, each with a bold short form', () => {
  const section = read('AGENTS.md').split('## Promises')[1].split('\n## ')[0];
  const promises = [...section.matchAll(/^(\d)\. \*\*(.+?)\*\* (.+)$/gm)];
  assert.deepEqual(promises.map((p) => p[1]), ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(promises.map((p) => p[2]), ['You decide.', 'You\'ll know why.', 'I\'ll show, not claim.',
    'I\'ll keep you safe.', 'You\'ll get better at this.', 'I\'ll show you where I go wrong.']);
});

// Every always-loaded rule should carry its reason where a strong model would need one to apply it well.
// These are the reasons the restructure of 13 Oct 2026 added; losing one means a rule went bare again.
test('AGENTS.md keeps the reasons behind its key rules', () => {
  const agents = read('AGENTS.md').replace(/\s+/g, ' ');
  for (const phrase of [
    'Where a rule\'s words don\'t fit a case, follow its reason.',
    'Nothing else: every read costs usage and focus.',
    'A choice is important when a wrong call would cost them',
    'agreeing to please is a slip',
    'Never grade: a miss shows what your explanation left out.',
    'your own account of why is unreliable',
    'which skips the skill the grade measures',
    '(anyone can write them)',
    'so running out loses one slice at most',
  ]) assert.ok(agents.includes(phrase), `AGENTS.md missing: ${phrase}`);
});

test('AGENTS.md keyword table names every skill', () => {
  const agents = read('AGENTS.md');
  for (const k of ['start', 'learn', 'kickoff', 'next', 'explain', 'check', 'preflight', 'budget', 'close']) {
    assert.match(agents, new RegExp('`' + k + '`'), `keyword ${k}`);
  }
  assert.match(agents, /skills\/<keyword>\/SKILL\.md/);
});

test('CLAUDE.md imports AGENTS.md on its first line', () => {
  assert.equal(read('CLAUDE.md').split('\n')[0].trim(), '@AGENTS.md');
});

test('memory/profile.md starts as status: new', () => {
  assert.match(read('memory/profile.md'), /^---\nstatus: new\b/);
});

test('workspace templates exist', () => {
  const files = [
    'MY-RULES.md',
    'memory/now.md', 'memory/profile.md', 'memory/lessons.md', 'memory/decisions.md',
    'memory/progress.md', 'memory/README.md',
    'projects/_template/PLAN.md', 'projects/_template/DECISIONS.md', 'projects/_template/LOG.md',
    'projects/_template/AGENTS.md',
    'learn/_template/TOPIC.md', 'learn/_template/mistakes.md', 'learn/_template/progress.md',
    'learn/_template/cards.md',
  ];
  for (const f of files) assert.ok(existsSync(path.join(template, ...f.split('/'))), f);
});

test('project PLAN template starts unapproved and has a preflight slice', () => {
  const plan = read('projects/_template/PLAN.md');
  assert.match(plan, /^Approved: not yet$/m);
  assert.match(plan, /\*\*P · M · Preflight/);
});

test('memory rules live in memory/README.md, and AGENTS.md points there', () => {
  const rules = read('memory/README.md');
  for (const r of ['(inferred)', '[corrected]', '×N', '×3', 'append-only', 'Never store secrets', 'edit is final']) {
    assert.ok(rules.includes(r), `memory/README.md missing: ${r}`);
  }
  assert.match(read('AGENTS.md'), /follow the rules in `memory\/README\.md`/);
});
