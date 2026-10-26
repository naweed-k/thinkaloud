// T5: the chat companion as an Agent Skill (chat/skill/thinkaloud/ and its zip), built from chat/full.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles } from '../lib/fsutil.mjs';
import { estimateTokens } from '../lib/budgets.mjs';
import { SKILL_DIR, SKILL_NAME, skillFiles, ZIP_PATH, zipEntries, zipStore } from '../scripts/pack-skill.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');
const REBUILD = 'run: node scripts/pack-skill.mjs';

// CRC-32 written out here, so the check doesn't share code with the writer.
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Reads a zip the way an unzipper does: from the end record, through the central directory, to each local entry.
function readZip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, 'has an end-of-directory record');
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(at), 0x02014b50, 'central directory entry');
    const method = buf.readUInt16LE(at + 10);
    const crc = buf.readUInt32LE(at + 16);
    const size = buf.readUInt32LE(at + 24);
    const nameLen = buf.readUInt16LE(at + 28);
    const skip = nameLen + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    const local = buf.readUInt32LE(at + 42);
    assert.equal(buf.readUInt32LE(local), 0x04034b50, `${name}: local header`);
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(dataAt, dataAt + size);
    assert.equal(method, 0, `${name}: stored`);
    assert.equal(crc32(data), crc, `${name}: CRC`);
    entries.set(name, data);
    at += 46 + skip;
  }
  return entries;
}

test('chat/skill/thinkaloud/ is what pack-skill builds from full.md', () => {
  const expected = skillFiles();
  const dir = path.join(root, SKILL_DIR);
  assert.deepEqual(listFiles(dir).sort(), expected.map(([rel]) => rel).sort(), REBUILD);
  for (const [rel, text] of expected) assert.equal(read(`${SKILL_DIR.split(path.sep).join('/')}/${rel}`), text, `${rel}: ${REBUILD}`);
});

test('the zip round-trips: its files are the folder\'s, under one thinkaloud/ folder', () => {
  const zip = readFileSync(path.join(root, ZIP_PATH));
  assert.ok(zip.equals(zipStore(zipEntries())), `the zip is out of date: ${REBUILD}`);
  const entries = readZip(zip);
  for (const name of entries.keys()) assert.ok(name.startsWith(`${SKILL_NAME}/`), `${name} is inside ${SKILL_NAME}/`);
  const files = [...entries].filter(([name]) => !name.endsWith('/'));
  const expected = skillFiles();
  assert.equal(files.length, expected.length);
  for (const [rel, text] of expected) assert.equal(entries.get(`${SKILL_NAME}/${rel}`)?.toString('utf8'), text, rel);
});

// agentskills.io/specification, checked 13 Oct 2026; Claude's upload also needs the folder to match the name.
test('SKILL.md meets the Agent Skills format and stays small', () => {
  const skill = skillFiles().find(([rel]) => rel === 'SKILL.md')[1];
  const fm = skill.match(/^---\nname: (.+)\ndescription: '(.+)'\n---\n/);
  assert.ok(fm, 'frontmatter with name and a quoted description');
  assert.equal(fm[1], SKILL_NAME);
  assert.match(fm[1], /^[a-z0-9]+(-[a-z0-9]+)*$/);
  const description = fm[2].replace(/''/g, '\'');
  assert.ok(description.length >= 1 && description.length <= 1024, `description: ${description.length} characters`);
  assert.ok(skill.split('\n').length < 500, 'under 500 lines');
  assert.ok(estimateTokens(skill) < 5000, `body: ${estimateTokens(skill)} tokens`);
  for (const ref of ['references/set-up.md', 'references/check.md', 'references/ai-patterns.md']) {
    assert.ok(skill.includes(`\`${ref}\``), `SKILL.md points to ${ref}`);
  }
});

test('every paragraph of full.md is in the skill, apart from the line about where the card is', () => {
  const all = skillFiles().map(([, text]) => text).join('\n');
  const paras = read('chat/full.md').trim().split('\n\n');
  for (const p of paras.slice(1)) {
    // The set-up runs to the end of full.md as one reference; the others are whole paragraphs.
    for (const line of p.split('\n')) assert.ok(all.includes(line), `missing from the skill: ${line.slice(0, 60)}`);
  }
  assert.ok(all.includes(paras[0].split(' My companion card')[0]), 'the opening sentences');
  assert.equal(read('chat/skill/thinkaloud/references/ai-patterns.md'), read('template/guide/ai-patterns.md'));
});
