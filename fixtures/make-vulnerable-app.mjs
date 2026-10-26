// Generates a small Node + Python project for the preflight tests and the CI smoke test.
// makeApp(dir, { vulnerable: true }) plants one instance of every script check and returns what preflight
// should find; { vulnerable: false } builds the same app done right, which should produce no findings.
//
// Generated, never committed: GitHub push protection blocks committed strings that look like real keys.
// So every fake key is assembled from fragments here, at runtime.

import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FAKE = {
  stripe: ['sk', 'live', 'FAKE0FAKE0FAKE0FAKE0'].join('_'),
  google: ['AI', 'za', 'FakeFakeFakeFakeFakeFakeFakeFake123'].join(''),
  openai: ['sk', 'proj', 'FAKEfake0'.repeat(6)].join('-'),
};

function write(dir, rel, text) {
  const file = path.join(dir, ...rel.split('/'));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function git(dir, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', '-c', 'commit.gpgsign=false',
    '-c', 'core.autocrlf=false', ...args], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
}

const PACKAGE = JSON.stringify({
  name: 'fixture-app', version: '1.0.0', private: true, type: 'module',
  scripts: { start: 'node server.js' },
  dependencies: { cors: '2.8.5', express: '4.21.2', next: '15.5.0', openai: '5.20.0' },
}, null, 2);

export function makeApp(dir, { vulnerable = true } = {}) {
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');

  if (vulnerable) {
    // SEC-03: a key committed once, then deleted. It stays in the history.
    write(dir, 'config/old-keys.js', `export const GOOGLE_KEY = "${FAKE.google}";\n`);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'add config');
    rmSync(path.join(dir, 'config'), { recursive: true });
  }

  write(dir, 'package.json', `${PACKAGE}\n`);
  write(dir, 'package-lock.json', '{\n  "name": "fixture-app",\n  "lockfileVersion": 3,\n  "packages": {}\n}\n');

  if (vulnerable) {
    write(dir, '.gitignore', 'node_modules/\ndist/\n'); // SEC-02: .env isn't ignored, and gets committed
    write(dir, '.env', 'PORT=3000\n');
    write(dir, 'server.js', [
      "import express from 'express';",
      "import cors from 'cors';",
      "import OpenAI from 'openai';",
      "import Stripe from 'stripe';",
      '',
      `const stripe = new Stripe("${FAKE.stripe}");`, // SEC-01
      'const openai = new OpenAI();',
      'const app = express();',
      "app.use(cors({ origin: '*', credentials: true }));", // CFG-02
      '',
      "app.post('/api/chat', async (req, res) => {", // AI-02: no login check, no rate limit
      "  const r = await openai.responses.create({ model: 'gpt-5', input: req.body.message });",
      '  res.json({ text: r.output_text });',
      '});',
      '',
      'app.listen(process.env.PORT ?? 3000);', // SEC-05: reads env, no .env.example
      '',
    ].join('\n'));
    write(dir, 'src/components/Chat.jsx', [
      "'use client';",
      "import OpenAI from 'openai';", // AI-01
      '',
      'const client = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, dangerouslyAllowBrowser: true });', // SEC-04 (name)
      '',
      'export default function Chat() {',
      '  return null;',
      '}',
      '',
    ].join('\n'));
    write(dir, 'settings.py', 'import os\n\nDEBUG = True\nALLOWED_HOSTS = ["*"]\n'); // CFG-01
    write(dir, 'seed.js', "export const users = [{ email: 'admin@example.com', password: 'admin123' }];\n"); // CFG-04
    // DEP-03 (not pinned), so DEP-02 is info: pip-audit would have to install them to check them.
    write(dir, 'requirements.txt', 'flask\nopenai\n');
    write(dir, 'dist/app.js', 'console.log("built");\n');
    write(dir, 'dist/app.js.map', '{"version":3,"sources":["../src/app.js"],"mappings":"AAAA"}\n'); // CFG-03 (warn)
    write(dir, 'dist/.git/HEAD', 'ref: refs/heads/main\n'); // CFG-03 (fail)
  } else {
    write(dir, '.gitignore', 'node_modules/\ndist/\n.env*\n!.env.example\n');
    write(dir, '.env', `OPENAI_API_KEY=${FAKE.openai}\nSTRIPE_KEY=${FAKE.stripe}\nPORT=3000\n`); // ignored: where secrets belong
    write(dir, '.env.example', 'OPENAI_API_KEY=your-key-here\nSTRIPE_KEY=your-key-here\nPORT=3000\n');
    write(dir, 'server.js', [
      "import express from 'express';",
      "import cors from 'cors';",
      "import rateLimit from 'express-rate-limit';",
      "import OpenAI from 'openai';",
      "import Stripe from 'stripe';",
      '',
      'const stripe = new Stripe(process.env.STRIPE_KEY);',
      'const openai = new OpenAI();',
      'const app = express();',
      "app.use(cors({ origin: ['https://fixture.example.com'], credentials: true }));",
      '',
      "app.post('/api/chat', rateLimit({ windowMs: 60_000, limit: 10 }), async (req, res) => {",
      "  const r = await openai.responses.create({ model: 'gpt-5', input: req.body.message });",
      '  res.json({ text: r.output_text });',
      '});',
      '',
      'app.listen(process.env.PORT ?? 3000);',
      '',
    ].join('\n'));
    write(dir, 'src/components/Chat.jsx', [
      "'use client';",
      '',
      'export async function ask(message) {',
      "  const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ message }) });",
      '  return r.json();',
      '}',
      '',
    ].join('\n'));
    write(dir, 'settings.py', 'import os\n\nDEBUG = os.environ.get("DEBUG") == "1"\n');
    write(dir, 'seed.js', "export const users = [{ email: 'admin@example.com', password: process.env.ADMIN_PASSWORD }];\n");
    write(dir, 'requirements.txt', 'flask==3.1.2\nopenai==1.109.1\n');
    write(dir, 'dist/app.js', 'console.log("built");\n');
  }

  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'app');

  return vulnerable ? PLANTED : [];
}

// What preflight must find in the vulnerable app: id, severity and file, one line per planted issue.
export const PLANTED = [
  { id: 'SEC-01', severity: 'fail', file: 'server.js' },
  { id: 'SEC-02', severity: 'fail', file: '.env' },
  { id: 'SEC-03', severity: 'fail', file: 'config/old-keys.js' },
  { id: 'SEC-04', severity: 'warn', file: 'src/components/Chat.jsx' },
  { id: 'SEC-05', severity: 'warn', file: '.env.example' },
  { id: 'DEP-01', severity: 'fail', file: 'package.json' },
  { id: 'DEP-02', severity: 'info', file: 'requirements.txt' },
  { id: 'DEP-03', severity: 'warn', file: 'requirements.txt' },
  { id: 'DEP-04', severity: 'warn', file: 'package-lock.json' },
  { id: 'CFG-01', severity: 'fail', file: 'settings.py' },
  { id: 'CFG-02', severity: 'fail', file: 'server.js' },
  { id: 'CFG-03', severity: 'fail', file: 'dist/.git' },
  { id: 'CFG-03', severity: 'warn', file: 'dist/app.js.map' },
  { id: 'CFG-04', severity: 'fail', file: 'seed.js' },
  { id: 'AI-01', severity: 'fail', file: 'src/components/Chat.jsx' },
  { id: 'AI-02', severity: 'warn', file: 'server.js' },
];

// Stand-ins for the audit tools, so tests never touch the network. git runs for real.
// Returns { run, has } for runPreflight, plus `calls`, the audit commands it was asked to run.
export function fakeTools(realRun, { vulnerable = true, installed = ['pip-audit', 'osv-scanner'] } = {}) {
  const calls = [];
  const run = (cmd, args, options) => {
    if (cmd === 'git') return realRun(cmd, args, options);
    calls.push([cmd, ...args].join(' '));
    if (cmd === 'npm' && args[0] === 'audit') {
      const vulnerabilities = vulnerable
        ? { minimist: { name: 'minimist', severity: 'critical', via: [{ title: 'Prototype Pollution in minimist' }], fixAvailable: { name: 'minimist', version: '1.2.8', isSemVerMajor: false } } }
        : {};
      return { status: vulnerable ? 1 : 0, stdout: JSON.stringify({ auditReportVersion: 2, vulnerabilities, metadata: {} }), stderr: '' };
    }
    if (cmd === 'pip-audit') {
      const deps = vulnerable
        ? [{ name: 'flask', version: '0.5', vulns: [{ id: 'PYSEC-2019-179', fix_versions: ['1.0'] }] }]
        : [{ name: 'flask', version: '3.1.2', vulns: [] }];
      return { status: vulnerable ? 1 : 0, stdout: JSON.stringify({ dependencies: deps, fixes: [] }), stderr: '' };
    }
    if (cmd === 'osv-scanner') {
      const results = vulnerable
        ? [{ source: { path: path.join('x', 'package-lock.json'), type: 'lockfile' }, packages: [{ package: { name: 'minimist', version: '1.2.5', ecosystem: 'npm' }, vulnerabilities: [{ id: 'GHSA-xvch-5gv4-984h' }] }] }]
        : [];
      return { status: vulnerable ? 1 : 0, stdout: JSON.stringify({ results }), stderr: '' };
    }
    return { status: 127, stdout: '', stderr: `${cmd}: not found`, error: Object.assign(new Error('ENOENT'), { code: 'ENOENT' }) };
  };
  return { run, has: (cmd) => installed.includes(cmd), calls };
}

// From a terminal (the CI smoke test): node fixtures/make-vulnerable-app.mjs <folder> [--clean]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    process.stderr.write('Usage: node fixtures/make-vulnerable-app.mjs <folder> [--clean]\n');
    process.exitCode = 2;
  } else {
    makeApp(path.resolve(dir), { vulnerable: !process.argv.includes('--clean') });
  }
}
