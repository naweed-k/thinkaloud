// The guide: modules 1–3 as lessons the page and the workspace both read. Module 4 is ai-patterns.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, ...rel.split('/')), 'utf8');
const fold = (s) => s.replace(/\s+/g, ' ');

const MODULES = { 1: 'basics.md', 2: 'checking.md', 3: 'safety.md' };

const lessons = Object.entries(MODULES).flatMap(([n, file]) =>
  read(`template/guide/${file}`).split(/^## /m).slice(1).map((part) => {
    const [heading, ...body] = part.split('\n');
    const [, num, title] = heading.match(/^(\d\.\d) (.+)$/);
    return { module: n, file, num, title, body: body.join('\n') };
  }));

test('each module numbers its lessons 1, 2, 3… with no gaps, and titles are unique', () => {
  assert.equal(lessons.length, 19);
  for (const [n, file] of Object.entries(MODULES)) {
    const nums = lessons.filter((l) => l.file === file).map((l) => l.num);
    assert.deepEqual(nums, nums.map((_, i) => `${n}.${i + 1}`), file);
  }
  assert.equal(new Set(lessons.map((l) => l.title)).size, lessons.length);
});

test('each lesson is 150–250 words, with one example and one thing to try', () => {
  for (const l of lessons) {
    const words = l.body.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 150 && words <= 250, `${l.num}: ${words} words`);
    assert.equal(l.body.match(/^\*\*Example\.\*\*/gm)?.length, 1, `${l.num}: one **Example.**`);
    assert.equal(l.body.match(/^\*\*Try:\*\*/gm)?.length, 1, `${l.num}: one **Try:**`);
  }
});

test('each lesson carries its key points', () => {
  const text = (num) => fold(lessons.find((l) => l.num === num).body);
  const must = {
    1.2: ['Goal', 'Context', 'Constraints', 'What "done" means', 'Where to stop'],
    1.3: ['three ways', 'trade-offs'],
    1.6: ['guide/usage.md'],
    2.1: ['interview'],
    2.3: ['| A source or quote |', '| A number |', '| Code "works" |', '| "I changed / ran / checked X" |',
      '| Course content |', '| How to use a library or tool |'],
    2.4: ['show me the evidence', 'What would prove this wrong?'],
    3.1: ['change it now', 'Deleting the message doesn\'t un-send it'],
    3.2: ['.env', 'never committed', 'within minutes'],
    3.3: ['Keys in code', 'Open database rules', 'Routes without login checks', 'No rate limit', 'Debug mode',
      'It isn\'t a security audit'],
    3.4: ['publishes', 'deletes', 'costs', 'read the command before approving it'],
    3.5: ['ChatGPT', 'Claude', 'Gemini', 'plain files in your folder'],
    3.6: ['AI policy'],
    3.7: ['thinking partner', 'talk to people'],
  };
  for (const [num, phrases] of Object.entries(must)) {
    const t = text(Number(num).toFixed(1));
    for (const p of phrases) assert.ok(t.includes(p), `${num}: missing "${p}"`);
  }
});

// The pre-launch list: 3.3 is the source. The chat walk-through (full.md) and preflight (the script or the AI
// review) must each cover all five. A new item in 3.3 fails here until it's added to both.
test('every item on the 3.3 pre-launch list is covered by full.md and by preflight', () => {
  const items = [...lessons.find((l) => l.num === '3.3').body.matchAll(/^\d\. \*\*(.+?)[.:]\*\*/gm)].map((m) => m[1]);
  const full = fold(read('chat/full.md'));
  const skill = fold(read('template/skills/preflight/SKILL.md'));
  const script = (name) => read(`lib/preflight/${name}.mjs`);
  const covered = {
    'Keys in code': [full.includes('no keys in the code'), /id: 'SEC-01'/.test(script('secrets'))],
    'Open database rules': [full.includes('database access rules'), skill.includes('**Database rules:**')],
    'Routes without login checks': [full.includes('checks who\'s asking'), skill.includes('**Logins:**')],
    'No rate limit on AI features': [full.includes('rate limit'), skill.includes('a login or rate limit')],
    'Debug mode left on': [full.includes('debug mode off'), /id: 'CFG-01'/.test(script('config'))],
  };
  assert.deepEqual(items, Object.keys(covered));
  for (const [item, [inFull, inPreflight]] of Object.entries(covered)) {
    assert.ok(inFull, `full.md doesn't cover: ${item}`);
    assert.ok(inPreflight, `preflight doesn't cover: ${item}`);
  }
});

test('guide/README.md leads with the brand, and links only to guide files that exist', () => {
  const readme = read('template/guide/README.md').replace(/^> /gm, '');
  assert.ok(readme.includes('**Cut the slop. Know your AI. Let it know you.**'));
  // The guide says slop in its own words, rather than repeating the landing's line (Naweed, 26 Sep 2026).
  assert.ok(fold(readme).includes('the three things slop skips: deciding, understanding and checking.'));
  const links = [...readme.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
  for (const f of [...Object.values(MODULES), 'ai-patterns.md', 'usage.md', 'models.md']) {
    assert.ok(links.includes(f), `README links ${f}`);
  }
  for (const l of links) assert.ok(existsSync(path.join(root, 'template', 'guide', l)), `broken link: ${l}`);
});

test('no banned claims in the guide or the chat files', () => {
  const banned = /super-intelligent|hyper-personali[sz]ed|understands you perfectly|learns everything about you|!\s/i;
  const files = [...Object.values(MODULES), 'README.md'].map((f) => `template/guide/${f}`)
    .concat(['chat/README.md', 'chat/pocket.md', 'chat/full.md']);
  for (const f of files) assert.doesNotMatch(read(f).replace(/"Done! Ready to deploy\."/g, ''), banned, f);
});
