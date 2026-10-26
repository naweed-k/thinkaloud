// The ten plain pattern names (promise 6) must read the same everywhere the person meets them.
// guide/ai-patterns.md is the source; AGENTS.md, the check and close skills, full.md, the chat skill and round 2 are copies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, ...rel.split('/')), 'utf8');
// Skills wrap lines; fold them so a name split across two lines still counts.
const fold = (s) => s.replace(/\s+/g, ' ');

// The source: one entry per pattern (### 01 · acting before looking / *Essay: Insufficient observation*).
const entries = [...read('template/guide/ai-patterns.md').matchAll(/^### (\d\d) · (.+)\n\*Essay: (.+)\*$/gm)];
const NAMES = [...entries].sort((a, b) => a[1].localeCompare(b[1])).map((m) => m[2]);

test('guide/ai-patterns.md has ten entries, numbered 01–10, with unique plain names and essay titles', () => {
  assert.equal(entries.length, 10);
  assert.deepEqual(entries.map((e) => e[1]).sort(), ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
  assert.equal(new Set(NAMES).size, 10);
  for (const name of NAMES) assert.match(name, /^[a-z ]+$/, `plain name: ${name}`);
  assert.equal(new Set(entries.map((e) => e[3])).size, 10);
  // Grouped the way the essay's map groups them.
  const order = entries.map((e) => e[1]).join(' ');
  assert.equal(order, '01 02 06 05 07 10 03 04 08 09');
});

test('guide entries are 60–100 words each (the extra under 01 aside), and it credits its sources', () => {
  const guide = read('template/guide/ai-patterns.md');
  for (const part of guide.split(/^### /m).slice(1)) {
    const entry = part.split(/^## /m)[0].split('\n\nA close cousin')[0];
    const words = entry.split('\n').slice(2).join(' ').split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 60 && words <= 100, `${part.split('\n')[0]}: ${words} words`);
  }
  assert.ok(fold(guide).includes('When these go unnoticed, the result is slop.'));
  // Ways AI can slip, worth knowing: no claims about how often (Naweed, 26 Sep 2026).
  assert.ok(fold(guide).includes('AI can slip in recognisable ways'));
  assert.ok(fold(guide).includes('so the list that matters most becomes yours.'));
  assert.ok(guide.includes('*Checkable Reasoning*'));
  assert.ok(guide.includes('https://arxiv.org/abs/2305.04388'));
});

// Every mention of the essay links to the original (Naweed, 26 Sep 2026).
test('the guide, README and CREDITS link the essay', () => {
  for (const file of ['template/guide/ai-patterns.md', 'README.md', 'CREDITS.md']) {
    assert.match(read(file).replace(/\s+/g, ' '), /\[\*Checkable Reasoning\*\]\(https:\/\/naweedkabir\.com\/research\/checkable-reasoning\/\)/, file);
  }
});

for (const file of ['template/AGENTS.md', 'template/skills/check/SKILL.md', 'template/skills/close/SKILL.md', 'chat/full.md', 'chat/skill/thinkaloud/SKILL.md']) {
  test(`${file} uses all ten plain names exactly`, () => {
    const text = fold(read(file));
    for (const name of NAMES) assert.ok(text.includes(name), `${file}: missing "${name}"`);
  });
}

test('the skills\' and full.md\'s lists of the ten names are in the guide\'s numbered order', () => {
  // Each copy lists them in one line, separated by " · ".
  for (const file of ['template/skills/check/SKILL.md', 'template/skills/close/SKILL.md', 'chat/full.md', 'chat/skill/thinkaloud/SKILL.md']) {
    const text = fold(read(file));
    const list = NAMES.join(' · ');
    assert.ok(text.includes(list), `${file}: the list differs from the guide's`);
  }
});

test('AGENTS.md pairs each evidence rule with its pattern, in order', () => {
  const rules = [...read('template/AGENTS.md').matchAll(/^(\d+)\. .+ \(([a-z ]+)\)$/gm)];
  assert.deepEqual(rules.map((m) => m[2]), NAMES);
});

test('round-2 scenes name only real patterns', () => {
  const doc = JSON.parse(read('interview/questions.json'));
  for (const q of doc.practice) {
    for (const p of q.patterns) assert.ok(NAMES.includes(p), `${q.id}: "${p}" is not a plain pattern name`);
  }
});
