import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'thinkaloud.mjs');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

function run(...args) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
}

test('--help prints usage and every command, exit 0', () => {
  const r = run('--help');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage: thinkaloud <command>/);
  for (const cmd of ['init', 'update', 'doctor', 'preflight', 'budget']) {
    assert.match(r.stdout, new RegExp(`^  ${cmd}\\b`, 'm'), `help lists ${cmd}`);
  }
});

test('the install command lives in one constant, and no shipped file names an older channel', async () => {
  const { INSTALL_CMD } = await import('../lib/install.mjs');
  assert.equal(INSTALL_CMD, `npx ${pkg.name}@latest`);
  assert.match(run('--help').stdout, new RegExp(`Without installing: ${INSTALL_CMD.replace(/[.@]/g, '\\$&')}`));
  const { listFiles } = await import('../lib/fsutil.mjs');
  const shipped = pkg.files.flatMap((entry) => (entry.endsWith('/')
    ? listFiles(path.join(root, entry)).map((f) => path.join(entry, f))
    : [entry]));
  shipped.push('README.md');
  for (const rel of shipped.filter((f) => /\.(mjs|md|json)$/.test(f))) {
    const text = readFileSync(path.join(root, rel), 'utf8');
    assert.ok(!/npx (-y )?github:/.test(text), `${rel} still names npx github:`);
    // Only lib/install.mjs spells the command out in code; everything else imports it.
    if (rel.endsWith('.mjs') && !rel.endsWith(path.join('lib', 'install.mjs'))) {
      assert.ok(!text.includes(INSTALL_CMD), `${rel} hard-codes the install command`);
    }
  }
});

test('no arguments prints help too', () => {
  const r = run();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage:/);
});

test('--version matches package.json', () => {
  const r = run('--version');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), pkg.version);
});

test('unknown command exits 2 with a pointer to --help', () => {
  const r = run('frobnicate');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--help/);
});

test('every command has its own --help with options and examples, exit 0', () => {
  for (const cmd of ['init', 'update', 'doctor', 'preflight', 'budget']) {
    for (const args of [[cmd, '--help'], [cmd, '-h'], ['help', cmd]]) {
      const r = run(...args);
      assert.equal(r.status, 0, args.join(' '));
      assert.match(r.stdout, new RegExp(`^Usage: thinkaloud ${cmd} `), args.join(' '));
      assert.match(r.stdout, /\nOptions:\n/);
      assert.match(r.stdout, new RegExp(`\\nExamples:\\n  thinkaloud ${cmd}`));
    }
  }
  assert.match(run('init', '--help').stdout, /--tools=<list>/);
  assert.match(run('preflight', '--help').stdout, /--strictness=<level>/);
  assert.match(run('--help').stdout, /thinkaloud <command> --help/);
});

test('a wrong option is one plain sentence that points to the command\'s help, exit 2', () => {
  let r = run('init', '--tool=claude');
  assert.equal(r.status, 2);
  assert.equal(r.stderr, 'thinkaloud init: "--tool" isn\'t an option for init. Run "thinkaloud init --help" to see its options.\n');
  r = run('update', '--tools');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^thinkaloud update: --tools needs a value, like --tools=<value>\./);
  r = run('doctor', '--yes');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /"--yes" isn't an option for doctor/);
});

test('a folder name with spaces, unquoted, is caught instead of half-used', () => {
  const r = run('doctor', 'My', 'Workspace');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /takes one folder, but got 2: "My", "Workspace"\. If the name has spaces, put it in quotes/);
});

test('package.json has the bin, engines and module type', () => {
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.bin.thinkaloud, 'bin/thinkaloud.mjs');
  assert.equal(pkg.engines.node, '>=22');
  assert.equal(pkg.license, 'MIT');
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'zero runtime dependencies');
});
