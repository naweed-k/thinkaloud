// Importing the profile.md exported by the interview page (`init --profile <file>`).
//
// Export format: the filled `interview/profile.template.md` (front matter with `status: interviewed`),
// optionally followed by a `## My rules` section holding the answer to Q14 (`never`), one rule per
// line. On import the rules move into MY-RULES.md and the section is dropped from memory/profile.md,
// because MY-RULES.md is where the companion reads standing rules.
//
// The profile is read by the AI at the start of every session, so an imported file is checked like any
// input from outside: every line must be a field the template has, with a value the interview can produce.
// A file that holds anything else (extra text, instructions, unknown fields) is refused, not trimmed, and
// the error says which line. The allowed values come from interview/questions.json, the one source.

import { readFileSync } from 'node:fs';
import { BUDGETS, countLines, estimateTokens } from './budgets.mjs';

const MAX_BYTES = 20_000;
const RULES_HEADING = /^## My rules[ \t]*$/m;
export const MAX_RULES = 10;
export const MAX_RULE_CHARS = 120;

const QUESTIONS = JSON.parse(readFileSync(new URL('../interview/questions.json', import.meta.url), 'utf8'));
const optionsOf = (id) => QUESTIONS.questions.find((q) => q.id === id).options.map((o) => o.value);
const QUESTION_IDS = new Set([...QUESTIONS.questions, ...QUESTIONS.practice].map((q) => q.id));

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const empty = (v) => v === '';
const list = (v) => {
  const m = v.match(/^\[(.*)\]$/);
  return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : null;
};

// Each validator returns null when the value is fine, or what's wrong with it.
const oneOf = (values) => (v) => (empty(v) || values.includes(v) ? null : `should be one of: ${values.join(', ')}`);
const text = (max) => (v) => (v.length <= max ? null : `is longer than ${max} characters`);
const listOf = (check, max) => (v) => {
  const items = list(v);
  if (!items) return 'should be a list in square brackets, like [a, b]';
  if (items.length > max) return `has more than ${max} items`;
  for (const item of items) {
    const e = check(item);
    if (e) return `"${item.slice(0, 40)}" ${e}`;
  }
  return null;
};
const flags = (keys) => (v) => {
  const m = v.match(/^\{(.*)\}$/);
  if (!m) return `should look like { ${keys.map((k) => `${k}: `).join(', ')}}`;
  const seen = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.split(':').map((x) => x.trim()));
  for (const [k, val = ''] of seen) {
    if (!keys.includes(k)) return `has "${k}", which isn't one of ${keys.join(', ')}`;
    if (!['', 'true', 'false'].includes(val)) return `${k} should be true, false or blank`;
  }
  return null;
};
const withOther = (values, max) => (item) => {
  if (values.includes(item)) return null;
  const other = item.match(/^other:\s*(.*)$/);
  return other && other[1].length <= max ? null : `isn't one of ${values.join(', ')} (or "other: …" up to ${max} characters)`;
};

const FRONT = {
  status: oneOf(['new', 'interviewed']),
  version: oneOf(['1']),
  created: (v) => (empty(v) || DATE.test(v) ? null : 'should be a date like 2026-09-24'),
  updated: (v) => (empty(v) || DATE.test(v) ? null : 'should be a date like 2026-09-24'),
};

const FIELDS = {
  name: text(40),
  language: (v) => (optionsOf('language').includes(v) ? null : text(30)(v)),
  tools: listOf(withOther(optionsOf('tools'), 40), 8),
  usage_now: listOf(oneOf(optionsOf('usage_now')), 8),
  trust_self_report: oneOf(['1', '2', '3', '4', '5']),
  code_level: oneOf(optionsOf('code_level')),
  path: oneOf(optionsOf('path')),
  decision_style: oneOf(optionsOf('decision_style')),
  explain_depth: oneOf(optionsOf('explain_depth')),
  check_ins: oneOf(optionsOf('check_ins')),
  stuck: oneOf(optionsOf('stuck')),
  tone: oneOf(optionsOf('tone')),
  tips: oneOf(['on', 'off']),
  hours_per_week: oneOf(optionsOf('hours')),
  'learn.level': oneOf(optionsOf('study_level')),
  'learn.subjects': listOf(text(60), 5),
  'learn.style': oneOf(optionsOf('learn_style')),
  'learn.graded_work': oneOf(optionsOf('graded_work')),
  'learn.deadlines': listOf((d) => (/^\d{4}-\d{2}-\d{2}( .{1,60})?$/.test(d) ? null : 'should be a date, optionally with a short note'), 5),
  'build.idea': text(200),
  'build.audience': oneOf([...new Set(optionsOf('audience'))]),
  'build.sensitive': listOf(oneOf(optionsOf('sensitive')), 6),
  'build.keyboard': oneOf(optionsOf('keyboard')),
  calibration: flags(['citation', 'key', 'claim']),
  calibration_2: flags(['evidence', 'extract', 'look']),
  'coaching.validation': oneOf(['high', 'medium', 'light']),
  'usage.plan': oneOf(optionsOf('subscription')),
  knows: text(200),
  open: listOf((id) => (QUESTION_IDS.has(id) ? null : 'isn\'t a question id'), QUESTION_IDS.size),
};
const SECTIONS = new Set(['learn', 'build', 'coaching', 'usage']);

// The template's comments start after two spaces ("audience: small      # personal | …"). A single space
// before # is kept, so "C# app" survives in free text.
const stripComment = (line) => line.replace(/(^\s*|\s{2,})#.*$/, '').replace(/\s+$/, '');

function check(lines, spec, where) {
  const seen = new Set();
  let section = null;
  for (const [i, raw] of lines.entries()) {
    if (spec === FIELDS && /^# Profile\s*$/.test(raw)) continue;
    const line = stripComment(raw);
    if (!line.trim()) continue;
    const at = `line ${i + where}`;
    const m = line.match(/^( {2})?([a-z_0-9]+):(?:\s+(.*))?$/);
    if (!m) return `${at} isn't part of a Thinkaloud profile: "${raw.trim().slice(0, 50)}"`;
    const [, indent, key, value = ''] = m;
    let field = key;
    if (indent) {
      if (!section) return `${at}: "${key}" is indented but isn't under learn, build, coaching or usage`;
      field = `${section}.${key}`;
    } else if (spec === FIELDS && SECTIONS.has(key) && !value) {
      section = key;
      if (seen.has(field)) return `${at}: "${key}" appears twice`;
      seen.add(field);
      continue;
    } else {
      section = null;
    }
    if (!spec[field]) return `${at}: "${field}" isn't a profile setting`;
    if (seen.has(field)) return `${at}: "${field}" appears twice`;
    seen.add(field);
    const problem = spec[field](value.trim());
    if (problem) return `${at}: ${field} ${problem}`;
  }
  return null;
}

// Returns { profile, rules } or { error }. `rules` is a list of rule texts, without list markers (may be empty).
export function parseExport(text) {
  if (text.length > MAX_BYTES) return { error: 'this file is too big to be a Thinkaloud profile' };
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const fm = clean.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) return { error: "this doesn't look like a Thinkaloud profile (no front matter at the top)" };
  if (!/^status:\s*interviewed\b/m.test(fm[1])) {
    return { error: 'this profile isn\'t finished (it should say "status: interviewed")' };
  }
  if (!/^version:\s*1\b/m.test(fm[1])) return { error: 'this profile is from a version of Thinkaloud this one doesn\'t know' };

  const heading = clean.match(RULES_HEADING);
  const profile = heading ? clean.slice(0, heading.index).replace(/\n+$/, '\n') : clean;
  const section = heading ? clean.slice(heading.index + heading[0].length) : '';
  if (/^#{1,6} /m.test(section)) return { error: 'the "## My rules" section must come last, with nothing after it' };
  const rules = section.split('\n').map((l) => l.trim().replace(/^[-*]\s*/, '')).filter(Boolean);

  const bodyStart = fm[0].split('\n').length; // the line number where the body starts
  const problem = check(fm[1].split('\n'), FRONT, 2) ?? check(profile.slice(fm[0].length).split('\n'), FIELDS, bodyStart);
  if (problem) return { error: problem };

  const budget = BUDGETS.find((b) => b.file === 'memory/profile.md');
  if (estimateTokens(profile) > budget.tokens || countLines(profile) > budget.lines) {
    return { error: `the profile is longer than a Thinkaloud profile can be (${budget.lines} lines, about ${budget.tokens * 4} characters)` };
  }
  if (rules.length > MAX_RULES) return { error: `"My rules" has ${rules.length} rules; the most is ${MAX_RULES}` };
  const long = rules.find((r) => r.length > MAX_RULE_CHARS);
  if (long) return { error: `a rule is longer than ${MAX_RULE_CHARS} characters: "${long.slice(0, 50)}…"` };
  return { profile, rules };
}

// Adds rules to MY-RULES.md below its header, as "- rule" lines.
export function addRules(myRules, rules) {
  if (!rules.length) return myRules;
  const lines = rules.map((r) => `- ${r.replace(/^[-*]\s*/, '')}`);
  return `${myRules.replace(/\n*$/, '\n')}\n${lines.join('\n')}\n`;
}
