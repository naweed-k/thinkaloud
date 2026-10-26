// Small file helpers shared by init, update and doctor. Relative paths use '/' everywhere so the
// manifest is the same on every OS; toNative() turns them into real paths with path.join.

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function toNative(base, rel) {
  return path.join(base, ...rel.split('/').filter(Boolean));
}

// Is `rel` a plain '/'-separated path that stays inside `base`? Paths read from a manifest on disk go through
// this before anything is written, renamed or deleted, so a crafted manifest can't reach outside the workspace.
export function isInside(base, rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\0') || rel.includes('\\')) return false;
  if (rel.startsWith('/') || /^[A-Za-z]:/.test(rel) || rel.split('/').some((p) => p === '..' || p === '.')) return false;
  const back = path.relative(base, toNative(base, rel));
  return Boolean(back) && !back.startsWith('..') && !path.isAbsolute(back);
}

// Is every part of `rel` below `base` a real file or folder, not a link? isInside() checks the text of a path; a
// link in a folder someone shared (a cloned repo can carry them) could still point the write somewhere else.
export function linkFree(base, rel) {
  let at = base;
  for (const part of rel.split('/').filter(Boolean)) {
    at = path.join(at, part);
    let st;
    try {
      st = lstatSync(at);
    } catch {
      return true; // doesn't exist yet: nothing below it can be a link
    }
    if (st.isSymbolicLink()) return false;
  }
  return true;
}

// Writes a file in one step: a crash leaves the old file or the new one, never half of one.
export function writeFileAtomic(base, rel, content) {
  const file = toNative(base, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, content, { flag: 'wx' });
  try {
    renameSync(tmp, file);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch { /* already gone */ }
    throw e;
  }
}

// Every file under dir, as '/'-separated paths relative to dir, sorted.
export function listFiles(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

// Hash with line endings and a leading BOM normalised, so a CRLF checkout of an unedited file, or an editor that
// adds a BOM on save, still counts as unedited.
export function hash(content) {
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : content;
  return createHash('sha256').update(text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')).digest('hex');
}

// Atomic too: a half-written file would later hash as the person's edit and turn into a junk .mine.
export function writeFile(base, rel, content) {
  writeFileAtomic(base, rel, content);
}

// Like existsSync, but a link that points nowhere still counts as there.
export function taken(base, rel) {
  try {
    lstatSync(toNative(base, rel));
    return true;
  } catch {
    return false;
  }
}

export function readIfExists(base, rel) {
  const file = toNative(base, rel);
  return existsSync(file) ? readFileSync(file) : null;
}
