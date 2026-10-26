// Writes the tool's files into a workspace. Shared by `init` (empty folder, no manifest) and `update`.
// Tool-owned files the person edited are never lost: their copy is kept next to the new one as <file>.mine.

import { existsSync, readdirSync, readFileSync, renameSync, rmdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_TOOLS } from './tools.mjs';
import { hash, isInside, linkFree, readIfExists, taken, toNative, writeFile, writeFileAtomic } from './fsutil.mjs';
import { buildFiles, MANIFEST } from './workspace.mjs';

// The installed package's root (holds template/ and interview/).
export const PKG_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// How people run Thinkaloud. Every message that tells them a command uses this, so the channel lives in one place.
// `@latest` makes npx fetch the newest release instead of reusing an old cached copy.
export const INSTALL_CMD = 'npx thinkaloud@latest';

// The manifest is a file on disk, so it's checked like any input: only paths inside the workspace and known tools
// are kept. Anything else is listed in `rejected`, and update and doctor say so instead of acting on it.
export function readManifest(ws) {
  const text = readIfExists(ws, MANIFEST);
  if (!text) return null;
  let m;
  try {
    m = JSON.parse(text);
  } catch {
    return null;
  }
  if (!m || typeof m.files !== 'object' || m.files === null || Array.isArray(m.files)) return null;
  const rejected = [];
  const checked = (map) => {
    const out = {};
    if (!map || typeof map !== 'object' || Array.isArray(map)) return out;
    for (const [rel, h] of Object.entries(map)) {
      if (isInside(ws, rel) && typeof h === 'string') out[rel] = h;
      else rejected.push(rel);
    }
    return out;
  };
  const files = checked(m.files);
  // `pending` is only there while an update is writing files (or if one was interrupted).
  const pending = checked(m.pending);
  const tools = Array.isArray(m.tools) ? m.tools.filter((t) => AGENT_TOOLS.includes(t)) : [];
  const packs = m.packs && typeof m.packs === 'object' && !Array.isArray(m.packs) ? m.packs : {};
  return { ...m, files, pending, tools, packs, rejected: [...new Set(rejected)] };
}

export function packageVersion(pkgRoot) {
  return JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8')).version;
}

// Compares two semver versions: -1, 0 or 1, or null if either isn't one. A pre-release sorts before its release.
export function compareVersions(a, b) {
  const parse = (v) => (typeof v === 'string' ? v.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/) : null);
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return null;
  for (let i = 1; i <= 3; i++) {
    if (Number(x[i]) !== Number(y[i])) return Number(x[i]) < Number(y[i]) ? -1 : 1;
  }
  if (x[4] === y[4]) return 0;
  if (!x[4]) return 1;
  if (!y[4]) return -1;
  const p = x[4].split('.');
  const q = y[4].split('.');
  for (let i = 0; i < Math.max(p.length, q.length); i++) {
    if (p[i] === undefined) return -1;
    if (q[i] === undefined) return 1;
    if (p[i] === q[i]) continue;
    const [pn, qn] = [/^\d+$/.test(p[i]), /^\d+$/.test(q[i])];
    if (pn && qn) return Number(p[i]) < Number(q[i]) ? -1 : 1;
    if (pn !== qn) return pn ? -1 : 1;
    return p[i] < q[i] ? -1 : 1;
  }
  return 0;
}

// A dangling link counts as taken, so the person's copy is never written through a link planted at the .mine name.
function freeMinePath(ws, rel) {
  let candidate = `${rel}.mine`;
  for (let n = 2; taken(ws, candidate); n++) candidate = `${rel}.${n}.mine`;
  return candidate;
}

// Removes now-empty folders left behind by a deleted file, stopping at the workspace root.
function pruneEmptyDirs(ws, rel) {
  let dir = path.dirname(toNative(ws, rel));
  const inside = (d) => {
    const back = path.relative(ws, d);
    return Boolean(back) && !back.startsWith('..') && !path.isAbsolute(back);
  };
  while (inside(dir) && existsSync(dir) && readdirSync(dir).length === 0) {
    rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

export function applyFiles(ws, pkgRoot, tools, oldManifest = null) {
  const { owned, seed, merged } = buildFiles(pkgRoot, tools);
  const old = oldManifest?.files ?? {};
  const pending = oldManifest?.pending ?? {};
  const report = { added: [], updated: [], kept: [], removed: [], warnings: [] };
  for (const rel of oldManifest?.rejected ?? []) {
    report.warnings.push(`the manifest lists "${rel}", which isn't a path inside this workspace, so it was left alone.`);
  }
  // A link in the path could send a write, rename or delete outside the workspace.
  const safe = (rel) => {
    if (linkFree(ws, rel)) return true;
    report.warnings.push(`${rel} is (or is inside) a link to another place, so Thinkaloud left it alone. `
      + 'Replace the link with a real file or folder, then run update again.');
    return false;
  };
  // Unedited: what Thinkaloud wrote last time, or what an interrupted update had started to write.
  const unedited = (rel, h) => h === old[rel] || h === pending[rel];

  const files = {};
  for (const [rel, content] of owned) files[rel] = hash(content);
  // Before touching anything, note what this update is about to write. If it's interrupted, the next run still
  // knows those files as Thinkaloud's, and doesn't mistake them for the person's edits.
  const packs = oldManifest?.packs ?? {};
  const base = { tool: 'thinkaloud', version: oldManifest?.version ?? packageVersion(pkgRoot), tools: oldManifest?.tools ?? tools, packs };
  writeManifest(ws, { ...base, files: old, pending: { ...pending, ...files } });

  for (const [rel, content] of owned) {
    if (!safe(rel)) continue;
    const next = files[rel];
    const current = readIfExists(ws, rel);
    if (current === null) {
      writeFile(ws, rel, content);
      report.added.push(rel);
      continue;
    }
    const now = hash(current);
    if (now === next) continue;
    if (!unedited(rel, now)) {
      // Edited by the person, or not ours to begin with: keep their copy.
      const mine = freeMinePath(ws, rel);
      writeFile(ws, mine, current);
      report.kept.push({ file: rel, mine });
    } else {
      report.updated.push(rel);
    }
    writeFile(ws, rel, content);
  }

  // Settings shared with the person: add Thinkaloud's part and keep the rest.
  for (const [rel, merge] of merged) {
    if (!safe(rel)) continue;
    const current = readIfExists(ws, rel)?.toString('utf8') ?? null;
    const { text, merged: ok } = merge(current);
    if (text === current) continue;
    if (current === null) report.added.push(rel);
    else if (ok) report.updated.push(rel);
    else {
      const mine = freeMinePath(ws, rel);
      writeFile(ws, mine, current);
      report.kept.push({ file: rel, mine });
    }
    writeFile(ws, rel, text);
  }

  for (const rel of Object.keys(old)) {
    // An older version owned the settings file outright; it's merged now, so it stays.
    if (owned.has(rel) || merged.has(rel)) continue;
    if (!safe(rel)) continue;
    const current = readIfExists(ws, rel);
    if (current === null) continue;
    if (unedited(rel, hash(current))) {
      unlinkSync(toNative(ws, rel));
      report.removed.push(rel);
    } else {
      const mine = freeMinePath(ws, rel);
      renameSync(toNative(ws, rel), toNative(ws, mine));
      report.kept.push({ file: rel, mine });
    }
    pruneEmptyDirs(ws, rel);
  }

  for (const [rel, content] of seed) {
    if (!linkFree(ws, rel) || readIfExists(ws, rel) !== null) continue;
    writeFile(ws, rel, content);
    report.added.push(rel);
  }

  writeManifest(ws, { ...base, version: packageVersion(pkgRoot), tools, files });
  return report;
}

// In one step, so a crash can't leave a half-written manifest (which would make the folder stop counting as a workspace).
function writeManifest(ws, manifest) {
  writeFileAtomic(ws, MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

// Records the third-party packs that installed, with their pinned versions.
export function recordPacks(ws, installed, versions) {
  const { rejected, pending, ...manifest } = readManifest(ws);
  for (const pack of installed) manifest.packs = { ...manifest.packs, [pack]: versions[pack] };
  writeManifest(ws, manifest);
}

export function printReport(report, out) {
  const list = (label, items) => {
    if (items.length) out.write(`${label} (${items.length}):\n${items.map((i) => `  ${i}`).join('\n')}\n`);
  };
  list('Updated', report.updated);
  list('Added', report.added);
  list('Removed (no longer part of Thinkaloud, and unedited)', report.removed);
  if (report.kept.length) {
    out.write(`You had edited ${report.kept.length} Thinkaloud file(s). Your version is kept next to the new one:\n`);
    for (const { file, mine } of report.kept) out.write(`  ${file}  →  yours: ${mine}\n`);
    out.write('Compare them, copy back anything you want to keep, then delete the .mine file.\n');
    out.write('Rules you want to keep for good belong in MY-RULES.md, which updates never touch.\n');
  }
  for (const w of report.warnings) out.write(`Warning: ${w}\n`);
}
