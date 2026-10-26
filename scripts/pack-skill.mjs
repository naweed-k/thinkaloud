#!/usr/bin/env node
// Builds the chat companion as an Agent Skill: chat/skill/thinkaloud/ and chat/thinkaloud-skill.zip.
// chat/full.md is the source. The skill's body is full.md's rules word for word, and the parts that are only
// needed sometimes (set-up, check mode, the patterns guide) go in references/, which the app loads on demand.
// Run it after editing chat/full.md or template/guide/ai-patterns.md; test/skill.test.mjs fails until you do.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SKILL_NAME = 'thinkaloud';
export const SKILL_DIR = path.join('chat', 'skill', SKILL_NAME);
export const ZIP_PATH = path.join('chat', 'thinkaloud-skill.zip');

// What the skill list shows the AI, so it knows when to use the skill. Agent Skills allow up to 1,024 characters.
const DESCRIPTION = 'Be the person\'s companion, not just their assistant: show your reasoning, let them decide important '
  + 'choices, separate what you checked from what you remember, and help them check AI work. Use in every '
  + 'conversation where they learn, build, decide or write. Also use when they say "check" about an AI answer, '
  + '"done for today", or have no companion card yet.';

// full.md speaks to a pasted prompt; a skill sits apart from the card, so this sentence changes.
const PASTED = 'My companion card is at the end; use it. If there\'s no card, start with "Set-up" below.';
const INSTALLED = 'These are my own rules for you, in my voice: "I" and "me" are me. My companion card is in my '
  + 'custom instructions or preferences, or pasted in this chat; use it. If there\'s no card, offer the set-up in '
  + '`references/set-up.md`.';

const read = (rel) => readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');

// full.md's paragraphs by what they start with. Throws if one moved, so the skill never ships half a prompt.
function parts(full) {
  const paras = full.trim().split('\n\n');
  const take = (start) => {
    const i = paras.findIndex((p) => p.startsWith(start));
    if (i < 0) throw new Error(`chat/full.md has no paragraph starting "${start}"`);
    return i;
  };
  const setUp = take('Set-up (no card yet).');
  const check = take('Check mode.');
  const intro = paras[0];
  if (!intro.includes(PASTED)) throw new Error('chat/full.md\'s opening changed; update PASTED in scripts/pack-skill.mjs');
  return {
    intro: intro.replace(PASTED, INSTALLED),
    body: paras.slice(1, setUp).filter((_, i) => i + 1 !== check),
    check: paras[check],
    setUp: paras.slice(setUp).join('\n\n'),
  };
}

// The skill's files, as [path inside the skill folder, text] in a fixed order.
export function skillFiles() {
  const p = parts(read('chat/full.md'));
  const body = p.body.map((para) => (para.startsWith('AI patterns.')
    ? `${para} What each pattern looks like and how to catch it: \`references/ai-patterns.md\`.`
    : para));
  const skill = [
    '---',
    `name: ${SKILL_NAME}`,
    // Single-quoted YAML, because the text has ': ' in it; a quote inside is written twice.
    `description: '${DESCRIPTION.replace(/'/g, '\'\'')}'`,
    '---',
    '',
    '# Thinkaloud: be my companion',
    '',
    p.intro,
    '',
    ...body.flatMap((para) => [para, '']),
    'Check mode. When I paste an AI answer and say "check", follow `references/check.md`.',
    '',
  ].join('\n');
  return [
    ['SKILL.md', skill],
    ['references/ai-patterns.md', read('template/guide/ai-patterns.md')],
    ['references/check.md', `${p.check}\n`],
    ['references/set-up.md', `${p.setUp}\n`],
  ];
}

// CRC-32, from node:zlib where it exists (Node 22.2+), otherwise the standard table.
let table;
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf);
  table ??= Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// A stored (uncompressed) zip. Every entry gets the same date, so the same files always make the same bytes.
// entries: [name, Buffer | null] with '/' separators; null makes a folder entry (name ends in '/').
export function zipStore(entries) {
  const DOS_TIME = 0;
  const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 1 Jan 2026
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const content = data ?? Buffer.alloc(0);
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // names are UTF-8
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    // extra, comment, disk, internal attributes: 0
    central.writeUInt32LE(data === null ? 0x10 : 0, 38); // DOS folder flag
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + content.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// The zip's entries: the skill folder at its root, as Claude's upload expects (the folder name is the skill name).
export function zipEntries(files = skillFiles()) {
  const dirs = new Set([`${SKILL_NAME}/`]);
  for (const [rel] of files) {
    const parts = rel.split('/').slice(0, -1);
    parts.forEach((_, i) => dirs.add(`${SKILL_NAME}/${parts.slice(0, i + 1).join('/')}/`));
  }
  const entries = [...[...dirs].map((d) => [d, null]), ...files.map(([rel, text]) => [`${SKILL_NAME}/${rel}`, Buffer.from(text, 'utf8')])];
  return entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function packSkill(root = ROOT) {
  const files = skillFiles();
  const dir = path.join(root, SKILL_DIR);
  rmSync(dir, { recursive: true, force: true });
  for (const [rel, text] of files) {
    const file = path.join(dir, ...rel.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  writeFileSync(path.join(root, ZIP_PATH), zipStore(zipEntries(files)));
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const files = packSkill();
  for (const [rel, text] of files) process.stdout.write(`wrote ${path.join(SKILL_DIR, rel)} (${text.length} characters)\n`);
  process.stdout.write(`wrote ${ZIP_PATH}\n`);
}
