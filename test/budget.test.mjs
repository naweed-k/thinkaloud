// S8: the budget skill, guide/usage.md, guide/models.md and `thinkaloud budget`.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toNative } from '../lib/fsutil.mjs';
import { USAGE } from '../lib/tools.mjs';
import { LEFT } from '../lib/usage.mjs';
import { MANIFEST, SKILLS } from '../lib/workspace.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'thinkaloud.mjs');
const read = (rel) => readFileSync(path.join(root, ...rel.split('/')), 'utf8');
const plain = (s) => s.replace(/`/g, '');

const made = [];
after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
function tmp() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'thinkaloud budget '));
  made.push(dir);
  return dir;
}
const run = (cwd, args) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8' });

// Table rows of a Markdown file, as arrays of cells with backticks removed.
function rows(text) {
  return text.split('\n').filter((l) => l.startsWith('| ') && !/^\|[-| ]+\|$/.test(l))
    .map((l) => l.slice(2, -2).split(' | ').map((c) => plain(c.trim())));
}

test('guide/usage.md has the same commands as lib/usage.mjs, one row per tool', () => {
  const table = rows(read('template/guide/usage.md'));
  for (const u of USAGE) {
    const row = table.find((r) => r[0] === u.name);
    assert.ok(row, `no row for ${u.name}`);
    assert.ok(row[1].startsWith(`${u.usage}: ${u.usageNote.split(';')[0]}`), `${u.name} usage: ${row[1]}`);
    assert.ok(row[2].startsWith(`${u.context}: `), `${u.name} context: ${row[2]}`);
  }
  // Time-sensitive guidance points to the official pages (Naweed, 26 Sep 2026); since T4 it also says when it was
  // last checked (test/tools.test.mjs).
  const usage = read('template/guide/usage.md').replace(/\s+/g, ' ');
  assert.match(usage, /These change often\..*the official pages are the source of truth/);
  assert.ok((usage.match(/\]\(https:\/\//g) ?? []).length >= 5, 'links the official pages');
});

// guide/usage.md is the one copy people and the budget skill read; lib/usage.mjs prints it in the terminal.
test('the what-fits table is the same in lib/usage.mjs and guide/usage.md, and the skill points to it', () => {
  const table = rows(read('template/guide/usage.md'));
  for (const [left, todo] of LEFT) {
    assert.ok(table.some((r) => r[0] === left && r[1] === todo), `guide/usage.md: ${left}`);
  }
  const skill = read('template/skills/budget/SKILL.md');
  assert.ok(skill.includes('"What fits in what\'s left" table in `guide/usage.md`'));
  assert.ok(read('template/guide/usage.md').includes('## What fits in what\'s left'));
  assert.equal(rows(skill).length, 0, 'the skill keeps no copy of the table');
});

test('guide/models.md maps each tier for every tool, and the tiers match the skills', () => {
  const table = rows(read('template/guide/models.md'));
  const header = table[0];
  for (const u of USAGE) assert.ok(header.includes(u.name), `models.md has a ${u.name} column`);
  const tierOf = {};
  for (const name of SKILLS) {
    tierOf[name] = read(`template/skills/${name}/SKILL.md`).match(/thinkaloud-tier: (\w+)/)[1];
  }
  const listed = [];
  for (const r of table.slice(1)) {
    const tier = r[0].replace(/\*/g, '');
    assert.ok(['strongest', 'everyday', 'light'].includes(tier), tier);
    assert.equal(r.length, header.length, `${tier}: a cell for every tool`);
    for (const skill of r[1].match(/[a-z]+/g).filter((w) => w in tierOf)) {
      assert.equal(tierOf[skill], tier, `${skill} is ${tierOf[skill]} in its SKILL.md`);
      listed.push(skill);
    }
  }
  assert.deepEqual(listed.sort(), Object.keys(tierOf).sort(), 'every skill has a tier row');
});

test('the budget skill is light tier and never promises numbers', () => {
  const skill = read('template/skills/budget/SKILL.md');
  assert.match(skill, /thinkaloud-tier: light/);
  assert.match(skill, /Never guess how many tokens or messages are left/);
  assert.match(skill, /guide\/usage\.md/);
});

test('thinkaloud budget in a workspace prints its budgets and only its tools', () => {
  const parent = tmp();
  assert.equal(run(parent, ['init', 'ws', '--tools=none', '-y']).status, 0);
  const ws = path.join(parent, 'ws');
  const m = JSON.parse(readFileSync(toNative(ws, MANIFEST), 'utf8'));
  writeFileSync(toNative(ws, MANIFEST), JSON.stringify({ ...m, tools: ['codex'] }));
  const r = run(ws, ['budget']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /AGENTS\.md\s+\d+ \/ 1900 tokens/);
  assert.match(r.stdout, /Codex CLI: \/status/);
  assert.ok(!r.stdout.includes('Claude Code:') && !r.stdout.includes('Antigravity CLI:'), 'only the tools set up');
  assert.match(r.stdout, /nearly out\s+close now/);
});

test('thinkaloud budget outside a workspace still shows every tool, exit 0', () => {
  const r = run(tmp(), ['budget']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /isn't a Thinkaloud workspace/);
  for (const u of USAGE) assert.ok(r.stdout.includes(`${u.name}: ${u.usage}`), u.name);
});
