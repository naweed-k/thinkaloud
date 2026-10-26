import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { estimateTokens } from '../lib/budgets.mjs';
import { COPY_IN, SKILLS } from '../lib/workspace.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = path.join(root, 'template');
const join = (base, rel) => path.join(base, ...rel.split('/').filter(Boolean));

// Companion descriptions get a quarter of the 2,000-token skill-description budget; the rest is for the ~12
// core third-party skills. Every description loads in every session, so they stay short.
const DESCRIPTION_BUDGET_TOKENS = 500;

function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, 'no front matter');
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2];
  }
  return { fields, body: text.slice(m[0].length) };
}

const skills = SKILLS.map((name) => {
  const file = join(template, `skills/${name}/SKILL.md`);
  assert.ok(existsSync(file), `skills/${name}/SKILL.md is missing`);
  const text = readFileSync(file, 'utf8');
  return { name, text, ...frontMatter(text) };
});

test('each skill has a valid name matching its folder (Agent Skills spec)', () => {
  for (const s of skills) {
    assert.equal(s.fields.name, s.name);
    assert.match(s.fields.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  }
});

test('no unexpected skill folders in template/skills', () => {
  const folders = readdirSync(join(template, 'skills'));
  for (const f of folders) assert.ok(SKILLS.includes(f), `unexpected skills/${f}`);
});

test('descriptions are ≤ 200 characters, and name their keyword', () => {
  for (const s of skills) {
    const d = s.fields.description;
    assert.ok(d && d.length <= 200, `${s.name}: ${d?.length} characters`);
    assert.match(d, new RegExp(`"${s.name}"`), `${s.name}: description should name its keyword`);
  }
});

test(`companion skill descriptions total ≤ ${DESCRIPTION_BUDGET_TOKENS} tokens`, () => {
  const total = skills.reduce((n, s) => n + s.fields.name.length + s.fields.description.length, 0);
  assert.ok(estimateTokens('x'.repeat(total)) <= DESCRIPTION_BUDGET_TOKENS, `${total} characters`);
});

// guide/models.md names each skill's tier too; budget.test.mjs keeps the two in step.
test('each skill tier is one of strongest / everyday / light', () => {
  for (const s of skills) {
    const tier = s.text.match(/thinkaloud-tier: (\w+)/)?.[1];
    assert.ok(['strongest', 'everyday', 'light'].includes(tier), `${s.name}: ${tier}`);
  }
});

test('skills that write memory point to memory/README.md', () => {
  for (const name of ['start', 'kickoff', 'next', 'learn', 'close']) {
    assert.match(skills.find((s) => s.name === name).body, /follow the rules in `memory\/README\.md`/, name);
  }
});

// Files a skill may name that are created while working, not shipped in the template.
const CREATED_AT_RUNTIME = new Set(['.env', '.env.example', 'PREFLIGHT.md', 'preflight-report.json']);

function resolves(ref, skill) {
  if (CREATED_AT_RUNTIME.has(ref)) return true;
  const generic = ref.replace(/<[a-z]+>/g, '_template');
  const copied = new Set(COPY_IN.map((c) => c.to));
  const candidates = generic.includes('/')
    ? [generic]
    : [`skills/${skill}/${generic}`, generic, `projects/_template/${generic}`, `learn/_template/${generic}`, `memory/${generic}`];
  return candidates.some((c) => copied.has(c) || existsSync(join(template, c)));
}

test('each skill references only files that exist in the workspace', () => {
  const missing = [];
  for (const s of skills) {
    for (const [, ref] of s.body.matchAll(/`([^`\s]+)`/g)) {
      const looksLikePath = /\.(md|json)$/.test(ref) || ref.endsWith('/') || ref.startsWith('.env');
      if (!looksLikePath) continue;
      if (!resolves(ref, s.name)) missing.push(`${s.name}: ${ref}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('COPY_IN sources exist, and each lands in a skill folder', () => {
  for (const c of COPY_IN) {
    assert.ok(existsSync(join(root, c.from)), c.from);
    const skill = c.to.split('/').slice(0, 2).join('/'); // skills/<name>
    assert.ok(existsSync(join(template, `${skill}/SKILL.md`)), c.to);
  }
});

test('the start skill uses the question fields that questions.json actually has', () => {
  const body = skills.find((s) => s.name === 'start').body;
  const q = JSON.parse(readFileSync(join(root, 'interview/questions.json'), 'utf8'));
  const keys = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x); }
  };
  walk(q);
  for (const k of ['in_both', 'exclusive', 'other_text', 'text_field', 'chips', 'echo', 'scene', 'reveal',
    'mirror', 'extra', 'skip_label', 'intro', 'caught_if', 'why', 'opening', 'closing', 'phrases', 'companion_card']) {
    assert.ok(keys.has(k), `questions.json has no ${k}`);
    assert.ok(body.includes(k), `start skill doesn't mention ${k}`);
  }
});
