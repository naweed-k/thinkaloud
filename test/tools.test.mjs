// T4: one dated layer for the facts about AI tools that change between releases (lib/tools.mjs).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectTools, findOnPath } from '../lib/detect.mjs';
import { doctor } from '../lib/doctor.mjs';
import { PACKS_CHECKED, UIUX } from '../lib/packs.mjs';
import {
  AGENT_TOOLS, CHAT_APPS_CHECKED, factsAgeDays, FACTS_CHECKED, formatDate, GUARDRAIL_FILES, SKILL_DIRS,
  STALE_AFTER_DAYS, TOOLS, USAGE,
} from '../lib/tools.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'thinkaloud.mjs');
const read = (rel) => readFileSync(path.join(root, ...rel.split('/')), 'utf8');
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const made = [];
after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
function tmp() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'thinkaloud tools '));
  made.push(dir);
  return dir;
}

test('every tool record is complete and dated', () => {
  for (const t of TOOLS) {
    for (const key of ['id', 'name', 'command', 'installDocs', 'start', 'skillDir', 'checked']) {
      assert.ok(t[key], `${t.id ?? '?'}: ${key}`);
    }
    assert.ok('guardrailFile' in t, `${t.id}: guardrailFile (null when the tool has none)`);
    assert.match(t.installDocs, /^https:\/\//, t.id);
    assert.match(t.checked, ISO, t.id);
    assert.ok(t.start.startsWith(t.command), `${t.id}: the start hint uses its command`);
    for (const k of ['usage', 'usageNote', 'context', 'contextNote', 'extra']) assert.ok(t.usage[k], `${t.id}: usage.${k}`);
  }
  assert.deepEqual(AGENT_TOOLS, TOOLS.map((t) => t.id));
  assert.equal(new Set(AGENT_TOOLS).size, AGENT_TOOLS.length, 'ids are unique');
  assert.match(CHAT_APPS_CHECKED, ISO);
  assert.match(PACKS_CHECKED, ISO);
});

test('the derived maps come from the records', () => {
  for (const t of TOOLS) {
    assert.equal(SKILL_DIRS[t.id], t.skillDir);
    assert.equal(GUARDRAIL_FILES[t.id], t.guardrailFile ?? undefined);
    assert.equal(USAGE.find((u) => u.tool === t.id).usage, t.usage.usage);
  }
});

test('FACTS_CHECKED is the newest date, and the dated guides print it', () => {
  const all = [...TOOLS.map((t) => t.checked), CHAT_APPS_CHECKED];
  assert.ok(all.every((d) => d <= FACTS_CHECKED));
  assert.ok(all.includes(FACTS_CHECKED));
  const line = `Last checked: ${formatDate(FACTS_CHECKED)}.`;
  for (const file of ['template/guide/models.md', 'template/guide/usage.md', 'chat/README.md']) {
    assert.ok(read(file).includes(line), `${file} should say "${line}"`);
  }
});

test('formatDate and factsAgeDays', () => {
  assert.equal(formatDate('2026-10-13'), '13 Oct 2026');
  assert.equal(formatDate('2027-01-02'), '2 Jan 2027');
  assert.equal(factsAgeDays(new Date('2026-10-23T12:00:00Z'), '2026-10-13'), 10);
});

test('guide/models.md names each tool\'s guardrail file', () => {
  const models = read('template/guide/models.md');
  for (const file of Object.values(GUARDRAIL_FILES)) assert.ok(models.includes(`\`${file}\``), file);
});

// Commands move between releases, so skills point to guide/usage.md instead of naming them.
test('no companion skill names a tool\'s slash command', () => {
  const commands = new Set(USAGE.flatMap((u) => [u.usage, u.context]));
  for (const name of readdirSync(path.join(root, 'template', 'skills'))) {
    const text = read(`template/skills/${name}/SKILL.md`);
    for (const c of commands) assert.ok(!new RegExp(`\`${c}\\b`).test(text), `${name} names ${c}`);
  }
});

test('init with no agent found lists every tool\'s install page', () => {
  // A PATH with only node and git on it, so no agent is found.
  const PATH = [path.dirname(process.execPath), path.dirname(findOnPath('git'))].join(path.delimiter);
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() !== 'PATH')), PATH };
  if (detectTools(env).length) return; // an agent shares a folder with node or git here; nothing to check
  const r = spawnSync(process.execPath, [bin, 'init', 'ws', '-y'], { cwd: tmp(), encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  for (const t of TOOLS) assert.ok(r.stdout.includes(t.installDocs), t.name);
  assert.ok(r.stdout.includes(TOOLS.map((t) => t.command).join(', ')));
});

test('doctor prints the facts date, and asks for an update once it is old', () => {
  const parent = tmp();
  assert.equal(spawnSync(process.execPath, [bin, 'init', 'ws', '--tools=none', '-y'], { cwd: parent }).status, 0);
  const ws = path.join(parent, 'ws');
  const capture = () => {
    let text = '';
    return { write: (s) => { text += s; }, get text() { return text; } };
  };
  const fresh = capture();
  doctor({}, [ws], fresh, new Date(`${FACTS_CHECKED}T12:00:00Z`));
  assert.ok(fresh.text.includes(`Tool facts last checked ${formatDate(FACTS_CHECKED)}.`));
  assert.ok(!fresh.text.includes('facts about the AI tools are over'));

  const later = new Date(Date.parse(`${FACTS_CHECKED}T12:00:00Z`) + (STALE_AFTER_DAYS + 1) * 86_400_000);
  const old = capture();
  doctor({}, [ws], old, later);
  assert.match(old.text, new RegExp(`facts about the AI tools are over ${STALE_AFTER_DAYS} days old`));
});

test('init and help quote the pack costs from lib/packs.mjs', () => {
  const init = read('lib/init.mjs');
  assert.ok(!/\b(225|690) tokens/.test(init), 'no token numbers in the prose');
  const help = spawnSync(process.execPath, [bin, 'init', '--help'], { encoding: 'utf8' }).stdout;
  assert.ok(help.includes(`ui-ux-pro-max, ${UIUX.skills.length} skills`));
});
