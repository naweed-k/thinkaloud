import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validate } from '../lib/schema.mjs';
import { estimateTokens, countLines } from '../lib/budgets.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(path.join(root, ...parts), 'utf8');
const doc = JSON.parse(read('interview', 'questions.json'));
const schema = JSON.parse(read('interview', 'questions.schema.json'));
const profileTemplate = read('interview', 'profile.template.md');
const questions = doc.questions;
const practice = doc.practice;
const byId = Object.fromEntries([...questions, ...practice].map((q) => [q.id, q]));

// Profile fields as dotted paths, with the enum from each field's comment (if any).
function profileFields(text) {
  const body = text.split(/^---$/m)[2];
  const fields = new Map();
  let parent = null;
  for (const line of body.split('\n')) {
    const m = line.match(/^( *)([a-z0-9_]+):(.*)$/);
    if (!m) continue;
    const [, indent, key, rest] = m;
    const [value, comment = ''] = rest.split('#');
    const name = indent ? `${parent}.${key}` : key;
    if (!indent) parent = key;
    const choices = /\|/.test(comment) ? comment.trim().split(/\s*\|\s*/) : null;
    fields.set(name, choices);
    if (value.trim().startsWith('{')) {
      for (const inner of value.matchAll(/([a-z0-9_]+):/g)) fields.set(`${key}.${inner[1]}`, null);
    }
  }
  return fields;
}
const fields = profileFields(profileTemplate);

test('questions.json passes questions.schema.json', () => {
  assert.deepEqual(validate(doc, schema), []);
});

test('the schema validator catches errors and refuses unknown keywords', () => {
  const bad = structuredClone(doc);
  delete bad.questions[0].maps_to;
  bad.questions[1].type = 'dropdown';
  bad.questions[2].surprise = true;
  const errors = validate(bad, schema);
  assert.ok(errors.some((e) => e.includes('missing maps_to')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('must be one of')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('unexpected property surprise')), errors.join('\n'));
  const calibration = structuredClone(doc);
  delete calibration.questions.find((q) => q.type === 'calibration').reveal;
  assert.ok(validate(calibration, schema).some((e) => e.includes('missing reveal')));
  assert.throws(() => validate({}, { oneOf: [] }), /not supported: oneOf/);
});

test('question ids are unique, and option ids are unique within a question', () => {
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
  for (const q of questions) {
    const ids = (q.options ?? []).map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, q.id);
  }
});

test('27 questions, in chapter order', () => {
  assert.equal(questions.length, 27);
  const chapters = questions.map((q) => q.chapter);
  assert.deepEqual(chapters, [...chapters].sort((a, b) => a - b));
});

test('every question maps to a profile field (or MY-RULES.md, or nothing for the info screen)', () => {
  const targets = [];
  for (const q of questions) {
    if (q.type === 'info') { assert.equal(q.maps_to, null, q.id); continue; }
    assert.ok(q.maps_to, `${q.id} has no maps_to`);
    targets.push([q.id, q.maps_to]);
    if (q.text_field) targets.push([q.id, q.text_field.maps_to]);
  }
  targets.push(['mirror', doc.chapters.find((c) => c.mirror).mirror.maps_to]);
  for (const q of practice) targets.push([q.id, q.maps_to]);
  targets.push(['practice_mirror', doc.practice_mirror.maps_to]);
  for (const [id, target] of targets) {
    if (target === 'MY-RULES.md') {
      assert.ok(existsSync(path.join(root, 'template', 'MY-RULES.md')), id);
      continue;
    }
    assert.ok(fields.has(target.replace(/^profile\./, '')), `${id} → ${target} is not in profile.template.md`);
  }
});

test('every profile field is filled by a question, apart from the ones set by the tool', () => {
  const mapped = new Set();
  for (const q of questions) {
    if (q.maps_to?.startsWith('profile.')) mapped.add(q.maps_to.slice(8));
    if (q.text_field) mapped.add(q.text_field.maps_to.slice(8));
  }
  mapped.add(doc.chapters.find((c) => c.mirror).mirror.maps_to.slice(8));
  for (const q of practice) mapped.add(q.maps_to.slice(8));
  // knows: is written by the companion as the person shows what they understand (contract §4).
  const byTool = new Set(['tips', 'open', 'knows']);
  for (const [name] of fields) {
    const isParent = [...fields.keys()].some((k) => k.startsWith(`${name}.`));
    if (isParent || byTool.has(name)) continue;
    assert.ok(mapped.has(name), `profile field ${name} has no question`);
  }
});

test('option values match the choices listed in profile.template.md', () => {
  for (const q of questions) {
    if (!q.options || !q.maps_to?.startsWith('profile.')) continue;
    const choices = fields.get(q.maps_to.slice(8));
    if (!choices) continue;
    const values = new Set(q.options.map((o) => o.value));
    assert.deepEqual([...values].sort(), [...choices].sort(), q.id);
  }
});

// One rule says when round 2 is due. check runs it and close offers it, so both point here, and neither
// keeps its own copy of the numbers.
test('practice_due is the one place for the round-2 thresholds', () => {
  const { after_days, min_sessions, rule } = doc.practice_due;
  assert.ok(rule.includes('after_days') && rule.includes('min_sessions'), 'the rule names its fields');
  for (const skill of ['check', 'close']) {
    const text = read('template', 'skills', skill, 'SKILL.md');
    assert.ok(text.includes('`practice_due`'), `${skill} points to practice_due`);
    for (const n of [after_days, min_sessions]) {
      assert.doesNotMatch(text, new RegExp(`\\b${n} or more\\b`), `${skill} repeats a threshold`);
    }
  }
});

test('the three calibration scenes each have a reveal and a correct answer', () => {
  const cal = questions.filter((q) => q.type === 'calibration');
  assert.deepEqual(cal.map((q) => q.id), ['cal_citation', 'cal_key', 'cal_claim']);
  for (const q of cal) {
    assert.ok(q.reveal.length > 100, `${q.id} reveal`);
    const correct = q.options.filter((o) => o.correct).map((o) => o.id);
    assert.ok(correct.length >= 1, q.id);
    assert.equal(q.caught_if, q.multi ? 'all-correct' : 'any-correct', q.id);
  }
  assert.deepEqual(byId.cal_citation.options.filter((o) => o.correct).map((o) => o.id), ['C']);
  assert.deepEqual(byId.cal_key.options.filter((o) => o.correct).map((o) => o.id), ['B', 'C']);
  assert.deepEqual(byId.cal_claim.options.filter((o) => o.correct).map((o) => o.id), ['B', 'C']);
});

test('round 2 (practice): three scenes, each with a reveal, a correct answer and its patterns', () => {
  assert.deepEqual(practice.map((q) => q.id), ['cal2_evidence', 'cal2_extract', 'cal2_look']);
  for (const q of practice) {
    assert.equal(q.type, 'calibration', q.id);
    assert.equal(q.chapter, undefined, `${q.id}: round 2 isn't an interview chapter`);
    assert.ok(q.reveal.length > 100, `${q.id} reveal`);
    assert.ok(q.options.some((o) => o.correct), q.id);
    assert.equal(q.caught_if, q.multi ? 'all-correct' : 'any-correct', q.id);
    assert.match(q.maps_to, /^profile\.calibration_2\./);
  }
  assert.deepEqual(byId.cal2_evidence.options.filter((o) => o.correct).map((o) => o.id), ['B']);
  assert.deepEqual(byId.cal2_extract.options.filter((o) => o.correct).map((o) => o.id), ['B', 'C']);
  assert.deepEqual(byId.cal2_look.options.filter((o) => o.correct).map((o) => o.id), ['B']);
  assert.deepEqual(practice.map((q) => q.maps_to.split('.').pop()), ['evidence', 'extract', 'look']);
  const mirror = doc.chapters.find((c) => c.mirror).mirror;
  assert.deepEqual(doc.practice_mirror.validation, mirror.validation, 'same thresholds as round 1');
});

test('the schema rejects a round-2 scene without patterns, or one that writes outside calibration_2', () => {
  const bad = structuredClone(doc);
  delete bad.practice[0].patterns;
  bad.practice[1].maps_to = 'profile.calibration.key';
  delete bad.practice[2].reveal;
  const errors = validate(bad, schema);
  assert.ok(errors.some((e) => e.includes('practice[0]: missing patterns')), errors.join('\n'));
  assert.ok(errors.some((e) => e.startsWith('$.practice[1].maps_to')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('practice[2]: missing reveal')), errors.join('\n'));
  const noPractice = structuredClone(doc);
  delete noPractice.practice;
  assert.ok(validate(noPractice, schema).some((e) => e.includes('missing practice')));
});

test('the mirror covers 0–3 caught exactly once, and sets coaching.validation from the count caught', () => {
  const mirror = doc.chapters.find((c) => c.mirror).mirror;
  assert.deepEqual(mirror.lines.flatMap((l) => l.caught).sort(), [0, 1, 2, 3]);
  assert.deepEqual(mirror.validation, { 0: 'high', 1: 'high', 2: 'medium', 3: 'light' });
  assert.deepEqual(mirror.extra.when, { trust_now_min: 4, caught_max: 1 });
});

test('echoes sit on the path options and the API key option', () => {
  assert.ok(byId.path.options.every((o) => o.echo));
  const echoed = questions.flatMap((q) => (q.options ?? []).filter((o) => o.echo).map((o) => `${q.id}.${o.id}`));
  assert.deepEqual(echoed, ['path.learn', 'path.build', 'path.both', 'sensitive.ai-key']);
});

test('branching: chapter 2 splits by path, and "both" asks a short version of each branch', () => {
  for (const q of questions) {
    if (q.branch === 'all') assert.equal(q.in_both, undefined, q.id);
    else {
      assert.equal(q.chapter, 2, q.id);
      assert.equal(typeof q.in_both, 'boolean', q.id);
    }
  }
  for (const branch of ['learn', 'build']) {
    const qs = questions.filter((q) => q.branch === branch);
    const short = qs.filter((q) => q.in_both);
    assert.ok(short.length > 0 && short.length < qs.length, branch);
  }
  const main = questions.filter((q) => q.branch === 'all' || q.branch === 'learn');
  assert.ok(main.length >= 14 && main.length <= 24, `main path has ${main.length} screens`);
});

test('every chapter has questions, and "not sure" audience is stored as public', () => {
  for (const c of doc.chapters) assert.ok(questions.some((q) => q.chapter === c.number), c.id);
  assert.equal(byId.audience.options.find((o) => o.id === 'unsure').value, 'public');
});

test('closing card phrases use real option values', () => {
  const fieldToQuestion = Object.fromEntries(questions.filter((q) => q.maps_to).map((q) => [q.maps_to.slice(8), q]));
  for (const [field, phrases] of Object.entries(doc.closing.card.phrases)) {
    const q = fieldToQuestion[field];
    assert.ok(q, `phrase field ${field}`);
    const values = new Set(q.options.map((o) => o.value));
    for (const v of Object.keys(phrases)) assert.ok(values.has(v), `${field}: ${v}`);
  }
});

test('profile.template.md is within budget, and a filled "both" profile stays within 600 tokens', () => {
  assert.ok(countLines(profileTemplate) <= 60);
  assert.match(profileTemplate, /^---\nstatus: interviewed\b/);
  const filled = read('fixtures', 'profile-both.md');
  assert.ok(estimateTokens(filled) <= 600, `${estimateTokens(filled)} tokens`);
  assert.ok(countLines(filled) <= 60, `${countLines(filled)} lines`);
  assert.deepEqual([...profileFields(filled).keys()], [...fields.keys()]);
});
