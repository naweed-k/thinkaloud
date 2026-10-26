// Preflight stage 1, the script. Fixtures are generated in temp folders; audit tools are
// faked so nothing touches the network. git runs for real.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, linkSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAKE, fakeTools, makeApp, PLANTED } from '../fixtures/make-vulnerable-app.mjs';
import { parseAdvisories, parseOsv, parsePipAudit, parseYarnAudit } from '../lib/preflight/deps.mjs';
import { aiChecks } from '../lib/preflight/ai.mjs';
import { configChecks } from '../lib/preflight/config.mjs';
import { exec, REPORT_JSON, REPORT_MD, TIMED_OUT, which } from '../lib/preflight/files.mjs';
import { clientSecrets, secretsInFiles } from '../lib/preflight/secrets.mjs';
import { findSecret, isPlaceholder, KEY_PATTERNS, redact } from '../lib/preflight/patterns.mjs';
import { runPreflight, writeReports } from '../lib/preflight/preflight.mjs';
import { LIMIT, renderMarkdown } from '../lib/preflight/report.mjs';
import { COPY_IN } from '../lib/workspace.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'thinkaloud.mjs');

const made = [];
after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
function tmp() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'thinkaloud-pf-'));
  made.push(dir);
  return dir;
}

function app(vulnerable) {
  const dir = path.join(tmp(), vulnerable ? 'bad app' : 'good app'); // a space, to catch quoting bugs
  makeApp(dir, { vulnerable });
  return dir;
}

const key = (f) => `${f.id} ${f.severity} ${f.file}`;

// ---------- patterns

// A JWT with this payload, built at runtime (the header and signature are dummies).
const jwt = (payload) => ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', Buffer.from(JSON.stringify(payload)).toString('base64url'),
  'ZmFrZXNpZ25hdHVyZWZha2VzaWduYXR1cmU'].join('.');

test('every key pattern matches a sample of its shape (samples built from fragments)', () => {
  const samples = {
    'Anthropic API key': ['sk', 'ant', 'api03', 'A'.repeat(40)].join('-'),
    'OpenRouter API key': ['sk', 'or', 'v1', '0123456789abcdef'.repeat(4)].join('-'),
    'DeepSeek API key': ['sk', '0123456789abcdef'.repeat(2)].join('-'),
    'OpenAI API key': FAKE.openai,
    'xAI API key': ['xai', 'Fake0Fake0'.repeat(8)].join('-'),
    'Google API key': FAKE.google,
    'AWS access key ID': ['AK', 'IA', 'ABCDEFGHIJKLMNOP'].join(''),
    'AWS secret access key': `aws_secret_access_key = ${'aB1/'.repeat(10)}`,
    'GitHub token': ['gh', 'p_', 'a'.repeat(36)].join(''),
    'Stripe live key': FAKE.stripe,
    'Stripe test key': ['sk', 'test', 'FAKE0FAKE0FAKE0FAKE0'].join('_'),
    'Slack token': ['xo', 'xb-', '1234567890-abcdef'].join(''),
    'Slack webhook URL': ['https://hooks', 'slack', `com/services/T00000000/B00000000/${'X'.repeat(24)}`].join('.'),
    'Discord webhook URL': ['https://discord', `com/api/webhooks/${'1'.repeat(18)}/${'Fake0'.repeat(14)}`].join('.'),
    'Telegram bot token': ['123456789', `AA${'Fake0'.repeat(6)}Fak`].join(':'),
    'Google OAuth client secret': ['GOCSPX', `${'Fake0'.repeat(5)}Fak`].join('-'),
    'Resend API key': ['re', 'Fake0Fak', `${'Fake0'.repeat(4)}Fake`].join('_'),
    'Perplexity API key': ['pplx', `${'Fake0'.repeat(9)}Fak`].join('-'),
    'Supabase secret key': ['sb', 'secret', 'FAKEfakeFAKEfakeFAKE01'].join('_'),
    'Supabase service-role key': jwt({ iss: 'supabase', role: 'service_role' }),
    'Hugging Face token': ['hf', 'FakeFakeFakeFakeFakeFakeFakeFakeFa'].join('_'),
    'Groq API key': ['gsk', 'Fake0'.repeat(10)].join('_'),
    'Replicate API token': ['r8', `${'Fake0'.repeat(7)}Fa`].join('_'),
    'SendGrid API key': ['SG', 'a'.repeat(22), 'b'.repeat(43)].join('.'),
    'Twilio API key': ['S', 'K', '0123456789abcdef'.repeat(2)].join(''),
    'npm access token': ['npm', `${'Fake0'.repeat(7)}F`].join('_'),
    'private key': ['-----BEGIN', 'RSA PRIVATE KEY-----'].join(' '),
    'connection string with a password': ['postgres://app', 'Hunter2Secret@db.prod-host.com:5432/app'].join(':'),
  };
  // Both ways, so a pattern can't go missing along with its check.
  assert.deepEqual(KEY_PATTERNS.map((p) => p.name).sort(), Object.keys(samples).sort());
  for (const p of KEY_PATTERNS) {
    assert.ok(samples[p.name], `no sample for ${p.name}`);
    assert.equal(findSecret(`const x = "${samples[p.name]}";`)?.name, p.name, p.name);
  }
});

test('the tighter OpenAI and Twilio shapes: real-looking keys match, look-alikes don\'t', () => {
  // A legacy key carries OpenAI's marker, T3BlbkFJ.
  assert.equal(findSecret(['sk', `${'Fake0'.repeat(4)}T3BlbkFJ${'Fake0'.repeat(4)}`].join('-'))?.name, 'OpenAI API key');
  for (const line of [
    '<div class="sk-loading-spinner-container-wide">', // a CSS class, not a key
    'const id = "sk-my-component-name-that-is-long";',
    ['sk', 'proj', 'short0example'].join('-'), // a truncated example in docs
    ['S', 'K', '0123456789ABCDEF'.repeat(2)].join(''), // upper-case hex: not how Twilio writes SIDs
  ]) assert.equal(findSecret(line), null, line);
});

test('placeholders, local connection strings and env lookups are not secrets', () => {
  for (const line of [
    'OPENAI_API_KEY=your-key-here',
    'password = "changeme"',
    'api_key: "<your key>"',
    'password: "${DB_PASSWORD}"',
    'const apiKey = process.env.OPENAI_API_KEY;',
    'DATABASE_URL=postgres://postgres:postgres@localhost:5432/dev',
    'const client = new OpenAI({ apiKey: "sk-proj-9f2c…" });',
  ]) assert.equal(findSecret(line, { literals: true }), null, line);
  assert.ok(findSecret('password = "Tr0ub4dor&3xyz"', { literals: true }));
  assert.ok(isPlaceholder('xxxxxxxx'));
});

test('an anon JWT is public and not flagged; a service-role JWT is; a test key only warns', () => {
  assert.equal(findSecret(`createClient(url, "${jwt({ iss: 'supabase', role: 'anon' })}")`), null);
  assert.equal(findSecret(`createClient(url, "${jwt({ iss: 'supabase', role: 'service_role' })}")`)?.name, 'Supabase service-role key');
  assert.equal(findSecret(['sk', 'test', 'FAKE0FAKE0FAKE0FAKE0'].join('_')).severity, 'warn');
  assert.equal(findSecret(FAKE.stripe).severity, 'fail');
});

test('redact never shows more than 4 characters of a secret', () => {
  const r = redact(FAKE.stripe);
  assert.ok(r.startsWith(FAKE.stripe.slice(0, 4)));
  assert.ok(!r.includes(FAKE.stripe.slice(4, 10)));
  assert.equal(redact('short'), '****');
});

test('the new shapes don\'t match their look-alikes', () => {
  for (const line of [
    ['re', 'validate', 'emailaddressformatchecker()'].join('_'), // a snake_case name
    'Doors open at 19:30:00, 2026-10-19',
    'Join us: https://discord.com/invite/abcdef',
    'https://hooks.slack.com/services/T00000000/B00000000/short',
  ]) assert.equal(findSecret(line, { literals: true }), null, line);
});

test('Slack workflow webhooks and longer Google secrets match too', () => {
  const slack = ['https://hooks', 'slack', `com/workflows/T00000000/A00000000/${'1'.repeat(18)}/${'X'.repeat(24)}`].join('.');
  assert.equal(findSecret(slack)?.name, 'Slack webhook URL');
  assert.equal(findSecret(['GOCSPX', `${'Fake0'.repeat(6)}F`].join('-'))?.name, 'Google OAuth client secret');
});

test('password literals: prefixed names like OPENAI_API_KEY count, longer words like apiKeyName don\'t', () => {
  for (const line of [
    'OPENAI_API_KEY = "Abc123def456ghi789"',
    'STRIPE_SECRET_KEY: "Abc123def456ghi789"',
    'export const DB_PASSWORD = "Tr0ub4dor&3xyz";',
    '"client_secret": "Abc123def456ghi789"',
  ]) assert.equal(findSecret(line, { literals: true })?.name, 'hard-coded password or key', line);
  for (const line of [
    'const apiKeyName = "openai-primary";',
    'API_KEY_NAME = "primary-key-label"',
    'password_hint = "firstpet123"',
  ]) assert.equal(findSecret(line, { literals: true }), null, line);
});

// ---------- missed problems and false fails (19 Oct 2026)

// A git repository holding these files (text or bytes). Only `commit` gets committed.
function project(files, commit = []) {
  const dir = tmp();
  spawnSync('git', ['init', '-q', dir]);
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(dir, ...rel.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, body);
  }
  if (commit.length) {
    spawnSync('git', ['-C', dir, 'add', '--', ...commit]);
    spawnSync('git', ['-C', dir, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false',
      'commit', '-qm', 'files']);
  }
  return dir;
}
const findings = (dir) => runPreflight(dir, { has: () => false }).findings;

test('build output is read up to 10 MB, so a key inlined in a big bundle is found; other files stop at 1 MB', () => {
  const big = `${'x'.repeat(2_000_000)}\nconst key = "${FAKE.stripe}";\n`;
  const dir = project({ 'dist/assets/index.js': big, 'src/big.js': big });
  assert.deepEqual(findings(dir).filter((f) => f.id === 'SEC-01').map((f) => `${f.file}:${f.line}`), ['dist/assets/index.js:2']);
});

test('UTF-16 env files (PowerShell 5.1\'s `>`) are read as text, not skipped as binary', () => {
  const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`NEXT_PUBLIC_STRIPE=${FAKE.stripe}\r\n`, 'utf16le')]);
  const be = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(`VITE_OPENAI=${FAKE.openai}\n`, 'utf16le').swap16()]);
  const dir = project({ '.env': le, '.env.local': be }, ['.env']);
  const found = findings(dir).map(key).sort();
  // .env.local isn't ignored, so the next commit would take it: SEC-01 too.
  assert.deepEqual(found, ['SEC-01 fail .env', 'SEC-01 fail .env.local', 'SEC-02 fail .env', 'SEC-02 fail .env.local',
    'SEC-04 fail .env', 'SEC-04 fail .env.local']);
});

test('an env file inside a deploy folder fails, even when git ignores it, and its value is never shown', () => {
  const dir = project({
    '.gitignore': 'dist/\n.env*\n!.env.example\n',
    'dist/.env': `STRIPE_KEY=${FAKE.stripe}\n`,
    'public/.env.example': 'STRIPE_KEY=your-key-here\n',
  }, ['.gitignore']);
  const sec02 = findings(dir).filter((f) => f.id === 'SEC-02');
  assert.deepEqual(sec02.map(key), ['SEC-02 fail dist/.env']);
  assert.match(sec02[0].what, /deploy folder `dist`/);
  assert.ok(!JSON.stringify(sec02).includes(FAKE.stripe.slice(4)));
});

test('preflight refuses a Thinkaloud workspace root or the home folder, and asks for a project', () => {
  const ws = tmp();
  mkdirSync(path.join(ws, '.thinkaloud'));
  writeFileSync(path.join(ws, '.thinkaloud', 'manifest.json'), '{}\n');
  const r1 = cli([ws]);
  assert.equal(r1.status, 2, r1.stdout);
  assert.match(r1.stderr, /is your Thinkaloud workspace, not a project\. Name a project: preflight projects\/<name>/);
  assert.ok(!existsSync(path.join(ws, REPORT_MD)));

  const home = tmp();
  const r2 = cli([home], { ...fakeNpmEnv(), HOME: home, USERPROFILE: home });
  assert.equal(r2.status, 2, r2.stdout);
  assert.match(r2.stderr, /is your home folder, not a project/);

  mkdirSync(path.join(ws, 'projects', 'demo'), { recursive: true });
  assert.equal(cli([path.join(ws, 'projects', 'demo')]).status, 0, 'a project inside the workspace still runs');
});

test('an audit that hangs is stopped and reported as not run', () => {
  const saved = process.env.THINKALOUD_PREFLIGHT_TIMEOUT_MS;
  process.env.THINKALOUD_PREFLIGHT_TIMEOUT_MS = '500';
  const started = Date.now();
  try {
    // npm audit stands in for a tool waiting on a network that never answers.
    const run = (cmd, a, o) => (cmd === 'git' ? exec(cmd, a, o) : exec('node', ['-e', 'setTimeout(() => {}, 30000)'], o));
    const dep01 = runPreflight(app(false), { run, has: () => false }).findings.find((f) => f.id === 'DEP-01');
    assert.equal(dep01.severity, 'warn');
    assert.equal(dep01.why, TIMED_OUT);
  } finally {
    if (saved === undefined) delete process.env.THINKALOUD_PREFLIGHT_TIMEOUT_MS;
    else process.env.THINKALOUD_PREFLIGHT_TIMEOUT_MS = saved;
  }
  assert.ok(Date.now() - started < 20_000, 'stopped, not waited out');

  // git log stopped before it printed anything, or part-way: either way the report says the history wasn't all read.
  const gitLog = (stdout) => (cmd, a, o) => (cmd === 'git' && a.includes('log')
    ? { status: null, stdout, stderr: '', error: Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT' }) }
    : exec(cmd, a, o));
  const sec03 = (stdout) => runPreflight(app(false), { run: gitLog(stdout), has: () => false }).findings.filter((f) => f.id === 'SEC-03');
  assert.deepEqual(sec03('').map((f) => `${f.severity} ${f.why}`), [`info ${TIMED_OUT}`]);
  const partial = sec03(`commit ${'a'.repeat(40)}\n+++ b/old.js\n+const k = "${FAKE.google}";\n`);
  assert.deepEqual(partial.map((f) => f.severity).sort(), ['fail', 'info']);
  assert.match(partial.find((f) => f.severity === 'info').what, /longer than 2 minutes, so only part of it was checked/);
});

test('labels aren\'t logins: "password": "Password" passes CFG-04; password: \'password\' in code still fails', () => {
  const texts = new Map([
    ['messages/en.json', '{\n  "password": "Password",\n  "pass": "Pass"\n}\n'],
    ['locales/de.json', '{ "password": "password" }\n'],
    ['seed.js', "export const admin = { user: 'admin', password: 'password' };\n"],
    ['.env', 'ADMIN_PASSWORD=password\n'],
  ]);
  const found = configChecks({ texts, output: [], stack: { scripts: {} } }).map((f) => `${f.id} ${f.file}`);
  assert.deepEqual(found.sort(), ['CFG-04 .env', 'CFG-04 seed.js']);
});

test('translation files skip the password-literal check, but real key shapes in them still count', () => {
  const texts = new Map([
    ['src/locales/fr.json', '{ "password": "MotDePasse1", "secret": "Geheimnis99" }\n'],
    ['i18n/en.json', `{ "demo": "${FAKE.stripe}" }\n`],
    ['po/de.po', 'msgid "password"\nmsgstr "password = \'Kennwort123\'"\n'],
    ['src/config.js', 'const password = "MotDePasse1";\n'],
  ]);
  const found = secretsInFiles({ texts, committable: new Set(texts.keys()) }).map((f) => f.file);
  assert.deepEqual(found.sort(), ['i18n/en.json', 'src/config.js']);
});

// ---------- the fixtures (acceptance)

test('vulnerable fixture: every planted issue is found with the right id, severity and file, and nothing else', () => {
  const dir = app(true);
  const tools = fakeTools(exec);
  const report = runPreflight(dir, { run: tools.run, has: tools.has, strictness: 'public' });
  assert.deepEqual(report.findings.map(key).sort(), PLANTED.map(key).sort());
  assert.equal(report.ready, false);
  assert.equal(report.summary.fail, PLANTED.filter((p) => p.severity === 'fail').length);
  for (const f of report.findings) {
    assert.ok(f.what && f.why && f.fix, `${f.id} has what, why and fix`);
  }
  assert.ok(report.findings.find((f) => f.id === 'SEC-03').fix.includes('Rotate'), 'history secrets say rotate');
});

test('clean fixture: no findings at all, ready, exit-worthy', () => {
  const dir = app(false);
  const tools = fakeTools(exec, { vulnerable: false });
  const report = runPreflight(dir, { run: tools.run, has: tools.has });
  assert.deepEqual(report.findings.map(key), []);
  assert.equal(report.ready, true);
  assert.deepEqual(tools.calls.map((c) => c.split(' ')[0]).sort(), ['npm', 'osv-scanner', 'pip-audit']);
});

test('reports never contain a secret, and always carry the honest limit', () => {
  const dir = app(true);
  const tools = fakeTools(exec);
  writeReports(dir, runPreflight(dir, { run: tools.run, has: tools.has }));
  for (const file of [REPORT_JSON, REPORT_MD]) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    for (const secret of [FAKE.stripe, FAKE.google]) assert.ok(!text.includes(secret), `${file} leaks a key`);
    assert.ok(text.includes(LIMIT), `${file} has the limit`);
  }
  const md = readFileSync(path.join(dir, REPORT_MD), 'utf8');
  assert.ok(md.indexOf('## Fails') < md.indexOf('## Warnings'), 'fails come before warnings');
  // A second run doesn't scan its own reports.
  const again = runPreflight(dir, { run: tools.run, has: tools.has });
  assert.deepEqual(again.findings.map(key).sort(), PLANTED.map(key).sort());
});

// ---------- strictness and the gate

test('strictness decides what blocks: personal = secrets, small = + deps and auth, public = every fail', () => {
  const dir = app(true);
  const tools = fakeTools(exec);
  const blocking = (level) => runPreflight(dir, { run: tools.run, has: tools.has, strictness: level })
    .findings.filter((f) => f.blocking).map((f) => f.id).sort();
  assert.deepEqual(blocking('personal'), ['AI-01', 'SEC-01', 'SEC-02', 'SEC-03']);
  assert.deepEqual(blocking('small'), ['AI-01', 'DEP-01', 'SEC-01', 'SEC-02', 'SEC-03']);
  assert.equal(blocking('public').length, PLANTED.filter((p) => p.severity === 'fail').length);
});

test('strictness comes from PLAN.md, then the workspace profile, then defaults to public', () => {
  const ws = tmp();
  const dir = path.join(ws, 'projects', 'demo');
  mkdirSync(dir, { recursive: true });
  mkdirSync(path.join(ws, 'memory'));
  const tools = fakeTools(exec, { vulnerable: false });
  const level = () => {
    const r = runPreflight(dir, { run: tools.run, has: tools.has });
    return `${r.strictness} ${r.strictnessFrom}`;
  };
  assert.equal(level(), 'public default');
  writeFileSync(path.join(ws, 'memory', 'profile.md'), '---\nbuild:\n  audience: small      # personal | small | public\n---\n');
  assert.equal(level(), 'small memory/profile.md');
  writeFileSync(path.join(dir, 'PLAN.md'), '# Demo: plan\n\nApproved: yes, 2026-09-24\nAudience: personal\n');
  assert.equal(level(), 'personal PLAN.md');
});

test('a lower strictness than the profile\'s is reported, not silent', () => {
  const ws = tmp();
  const dir = path.join(ws, 'projects', 'demo');
  mkdirSync(dir, { recursive: true });
  mkdirSync(path.join(ws, 'memory'));
  writeFileSync(path.join(ws, 'memory', 'profile.md'), '---\nbuild:\n  audience: small\n---\n');
  writeFileSync(path.join(dir, 'PLAN.md'), 'Audience: personal\n');
  const tools = fakeTools(exec, { vulnerable: false });
  const r = runPreflight(dir, { run: tools.run, has: tools.has });
  assert.equal(r.strictnessLowered, 'small');
  assert.match(renderMarkdown(r), /Strictness is lower than your profile's/);
  writeFileSync(path.join(dir, 'PLAN.md'), 'Audience: public\n');
  assert.equal(runPreflight(dir, { run: tools.run, has: tools.has }).strictnessLowered, undefined);
});

// A decision card the way the preflight skill writes one.
const card = (n, accepts, { date = '2026-09-24', reason = 'Chosen: accept it for the demo. Reason: it never goes public.' } = {}) =>
  `## D${n} · ${date} · Accept a preflight risk\n${reason}\n${accepts}\n\n`;

test('bare, fileless or cardless Accepts: lines are ignored and reported, so they can\'t clear the gate', () => {
  const dir = app(true);
  const tools = fakeTools(exec);
  const before = runPreflight(dir, { run: tools.run, has: tools.has });
  const ids = [...new Set(before.findings.filter((f) => f.blocking).map((f) => f.id))];
  writeFileSync(path.join(dir, 'DECISIONS.md'), [
    '# Decisions\n',
    ...ids.map((id) => `Accepts: ${id}\n`), // no card at all
    card(1, 'Accepts: CFG-02'), // no file
    card(2, 'Accepts: CFG-04 seed.js', { reason: '' }), // no reason
    card(3, 'Accepts: CFG-01 app.py', { date: 'someday' }), // no date
    '<!-- Accepts: CFG-02 server.js -->\n', // a comment
  ].join(''));
  const r = runPreflight(dir, { run: tools.run, has: tools.has });
  assert.equal(r.summary.accepted, 0);
  assert.equal(r.summary.blocking, before.summary.blocking);
  assert.equal(r.ready, false);
  assert.equal(r.ignoredAcceptances.length, ids.length + 3);
  assert.match(renderMarkdown(r), /## Ignored `Accepts:` lines/);
});

test('accepting a secret needs its ref, so a different key in the same file stays open', () => {
  const dir = app(true);
  const tools = fakeTools(exec);
  const sec = runPreflight(dir, { run: tools.run, has: tools.has }).findings.find((f) => f.id === 'SEC-01');
  assert.match(sec.ref, /^[0-9a-f]{8}$/);
  const accept = (line) => {
    writeFileSync(path.join(dir, 'DECISIONS.md'), `# Decisions\n\n${card(1, line)}`);
    return runPreflight(dir, { run: tools.run, has: tools.has }).findings.find((f) => f.id === 'SEC-01' && f.file === sec.file);
  };
  assert.equal(accept(`Accepts: SEC-01 ${sec.file}`).status, 'open');
  assert.equal(accept(`Accepts: SEC-01 ${sec.file} 00000000`).status, 'open');
  const ok = accept(`Accepts: SEC-01 ${sec.file} ${sec.ref}`);
  assert.equal(ok.status, 'accepted');
  assert.match(ok.acceptedBy, /^D1 · 2026-09-24/);
});

test('a risk accepted in DECISIONS.md shows as accepted and stops blocking', () => {
  const dir = app(true);
  writeFileSync(path.join(dir, 'DECISIONS.md'), `# Decisions\n\n${card(1, 'Accepts: CFG-02 server.js')}`);
  const tools = fakeTools(exec);
  const r = runPreflight(dir, { run: tools.run, has: tools.has });
  const cors = r.findings.find((f) => f.id === 'CFG-02');
  assert.equal(cors.status, 'accepted');
  assert.equal(cors.blocking, false);
  assert.equal(r.summary.accepted, 1);
});

// ---------- tools and formats

test('gitleaks is used for the history when installed, with the verified flags', () => {
  const dir = app(true);
  const base = fakeTools(exec, { installed: ['gitleaks'] });
  let args;
  const run = (cmd, a, o) => {
    if (cmd !== 'gitleaks') return base.run(cmd, a, o);
    args = a;
    const out = a[a.indexOf('--report-path') + 1];
    writeFileSync(out, JSON.stringify([{ RuleID: 'gcp-api-key', File: 'config/old-keys.js', StartLine: 1, Commit: 'abcdef1234' }]));
    return { status: 0, stdout: '', stderr: '' };
  };
  const r = runPreflight(dir, { run, has: base.has });
  assert.deepEqual(args.slice(0, 1), ['git']);
  for (const flag of ['--no-banner', '--redact', '--report-format', '--report-path', '--exit-code']) assert.ok(args.includes(flag), flag);
  const sec03 = r.findings.filter((f) => f.id === 'SEC-03');
  assert.equal(sec03.length, 1);
  assert.match(sec03[0].what, /gitleaks.*gcp-api-key.*abcdef1/);
});

test('an audit that couldn\'t run warns (never fails), so it isn\'t mistaken for a clean one; a missing tool is info', () => {
  const dir = app(false);
  const run = (cmd, a, o) => (cmd === 'git' ? exec(cmd, a, o) : { status: 1, stdout: 'not json', stderr: 'network down' });
  const r = runPreflight(dir, { run, has: () => false });
  assert.deepEqual(r.findings.map((f) => `${f.id} ${f.severity}`).sort(), ['DEP-01 warn', 'DEP-02 info']);
  assert.equal(r.ready, true);
});

test('audit parsers: pnpm advisories, yarn lines and exit bitmask, pip-audit list form, osv', () => {
  const adv = parseAdvisories({ advisories: { 1: { module_name: 'a', severity: 'high', title: 't', patched_versions: '>=2' },
    2: { module_name: 'b', severity: 'low' } } }, 'pnpm');
  assert.deepEqual(adv.map((f) => `${f.id} ${f.severity}`), ['DEP-01 fail']);
  const line = JSON.stringify({ type: 'auditAdvisory', data: { advisory: { module_name: 'c', severity: 'moderate', title: 't' } } });
  assert.deepEqual(parseYarnAudit(`${line}\n{"type":"auditSummary"}`, 4).map((f) => f.severity), ['warn']);
  assert.deepEqual(parseYarnAudit('', 16).map((f) => f.severity), ['fail']);
  assert.deepEqual(parseYarnAudit('', 2), []);
  assert.equal(parsePipAudit([{ name: 'flask', version: '0.5', vulns: [{ id: 'X', fix_versions: ['1.0'] }] }], 'requirements.txt').length, 1);
  assert.deepEqual(parseOsv({ results: [] }), []);
});

// ---------- never running the project's code (T6)

const win = process.platform === 'win32';

// A program in the project folder that leaves a marker if it ever runs.
function plant(dir, name) {
  if (win) writeFileSync(path.join(dir, `${name}.cmd`), `@echo off\r\necho planted> "%~dp0PLANTED-${name}"\r\n`);
  else {
    writeFileSync(path.join(dir, name), `#!/bin/sh\necho planted > "$(dirname "$0")/PLANTED-${name}"\n`);
    chmodSync(path.join(dir, name), 0o755);
  }
}

test('which() reads only absolute PATH entries, so "." can\'t mean the project folder', () => {
  const dir = tmp();
  plant(dir, 'thinkaloud-probe');
  const env = (entries) => ({ PATH: entries.join(win ? ';' : ':'), PATHEXT: '.CMD' });
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    assert.equal(which('thinkaloud-probe', env(['.', `.${path.sep}`])), null);
  } finally {
    process.chdir(cwd);
  }
  assert.equal(which('thinkaloud-probe', env(['.', dir]))?.toLowerCase(),
    path.join(dir, win ? 'thinkaloud-probe.cmd' : 'thinkaloud-probe').toLowerCase());
});

test('a program planted in the project folder never runs, even in a terminal that would look there first', () => {
  const dir = tmp();
  for (const name of ['npm', 'git']) plant(dir, name);
  // A plain Windows terminal doesn't set this, so cmd.exe searches the current folder first. Some shells
  // (Claude Code's) do set it, which would hide the bug.
  const saved = process.env.NoDefaultCurrentDirectoryInExePath;
  delete process.env.NoDefaultCurrentDirectoryInExePath;
  try {
    assert.match(exec('npm', ['--version'], { cwd: dir }).stdout, /^\d+\.\d+/);
    assert.match(exec('git', ['--version'], { cwd: dir }).stdout, /^git version/);
  } finally {
    if (saved !== undefined) process.env.NoDefaultCurrentDirectoryInExePath = saved;
  }
  assert.deepEqual(readdirSync(dir).filter((f) => f.startsWith('PLANTED')), []);
});

test('tools get the switches that stop yarn, pnpm and Corepack running project files', () => {
  const r = exec('node', ['-e', 'const e = process.env; console.log(JSON.stringify([e.YARN_IGNORE_PATH, '
    + 'e.npm_config_ignore_pnpmfile, e.COREPACK_ENV_FILE, e.COREPACK_ENABLE_PROJECT_SPEC, e.NoDefaultCurrentDirectoryInExePath]))']);
  assert.deepEqual(JSON.parse(r.stdout), ['1', 'true', '0', '0', '1']);
});

test('git ignores the project\'s fsmonitor setting', () => {
  const dir = tmp();
  spawnSync('git', ['init', '-q', dir]);
  spawnSync('git', ['-C', dir, 'config', 'core.fsmonitor', 'sh -c "echo planted > PLANTED"']);
  assert.equal(exec('git', ['config', '--get', 'core.fsmonitor'], { cwd: dir }).stdout.trim(), 'false');
  exec('git', ['ls-files', '--others'], { cwd: dir });
  assert.ok(!existsSync(path.join(dir, 'PLANTED')));
});

test('pnpm audit runs with its pnpmfile off, and not at all with configDependencies', () => {
  const dir = app(false);
  rmSync(path.join(dir, 'package-lock.json'));
  writeFileSync(path.join(dir, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
  const calls = [];
  const run = (cmd, a, o) => {
    if (cmd === 'git') return exec(cmd, a, o);
    calls.push([cmd, ...a].join(' '));
    return { status: 0, stdout: JSON.stringify({ advisories: {} }), stderr: '' };
  };
  runPreflight(dir, { run, has: () => false });
  assert.deepEqual(calls, ['pnpm audit --json --config.ignore-pnpmfile=true']);

  writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'configDependencies:\n  some-hooks: 1.0.0\n');
  calls.length = 0;
  const r = runPreflight(dir, { run, has: () => false });
  assert.deepEqual(calls, []);
  assert.match(r.findings.find((f) => f.id === 'DEP-01').why, /configDependencies/);
});

test('pip-audit only checks pinned requirements, and never installs them', () => {
  const pinned = app(false); // flask==3.1.2, openai==1.109.1
  const tools = fakeTools(exec); // the fake reports a vulnerable flask
  const r = runPreflight(pinned, { run: tools.run, has: tools.has });
  const call = tools.calls.find((c) => c.startsWith('pip-audit'));
  assert.match(call, /-r requirements\.txt --no-deps --disable-pip/);
  assert.equal(r.findings.find((f) => f.id === 'DEP-02').severity, 'warn');

  const loose = app(true); // flask, openai: no versions
  const tools2 = fakeTools(exec);
  const r2 = runPreflight(loose, { run: tools2.run, has: tools2.has });
  assert.ok(!tools2.calls.some((c) => c.startsWith('pip-audit')), 'pip-audit not run on unpinned requirements');
  const dep02 = r2.findings.find((f) => f.id === 'DEP-02');
  assert.equal(dep02.severity, 'info');
  assert.match(dep02.why, /never does it for you/);

  rmSync(path.join(pinned, 'requirements.txt'));
  writeFileSync(path.join(pinned, 'pyproject.toml'), '[project]\nname = "x"\ndependencies = ["flask"]\n');
  const tools3 = fakeTools(exec);
  runPreflight(pinned, { run: tools3.run, has: tools3.has });
  assert.ok(!tools3.calls.some((c) => c.startsWith('pip-audit')), 'a project folder is never built to audit it');
});

test('the reports replace a link in their place instead of writing through it', () => {
  const dir = app(false);
  const outside = path.join(tmp(), 'someone-elses-file.txt');
  writeFileSync(outside, 'keep me\n');
  try {
    symlinkSync(outside, path.join(dir, REPORT_MD), 'file');
  } catch {
    // Windows needs Developer Mode for a file symlink. A hard link has the same danger (writing through it changes
    // the other file) and needs no rights.
    linkSync(outside, path.join(dir, REPORT_MD));
  }
  const tools = fakeTools(exec, { vulnerable: false });
  assert.equal(writeReports(dir, runPreflight(dir, { run: tools.run, has: tools.has })), null);
  assert.equal(readFileSync(outside, 'utf8'), 'keep me\n');
  assert.match(readFileSync(path.join(dir, REPORT_MD), 'utf8'), /Preflight/);
});

test('browser-exposed prefixes: Nuxt, Gatsby, SvelteKit and Astro too, and NEXT_PUBLIC_ is named whole', () => {
  const env = new Map([['.env', [
    'NUXT_PUBLIC_STRIPE_SECRET=x',
    'GATSBY_API_KEY=x',
    'PUBLIC_SUPABASE_SERVICE_ROLE=x',
    `PUBLIC_AI=${FAKE.openai}`,
    'NEXT_PUBLIC_PRIVATE_TOKEN=x',
    'PUBLIC_URL=https://example.com',
  ].join('\n')]]);
  const found = clientSecrets({ env, texts: new Map() }).map((f) => `${f.severity} ${f.what.match(/`([^`]+)`/)[1]}`).sort();
  assert.deepEqual(found, ['fail PUBLIC_AI', 'warn GATSBY_API_KEY', 'warn NEXT_PUBLIC_PRIVATE_TOKEN',
    'warn NUXT_PUBLIC_STRIPE_SECRET', 'warn PUBLIC_SUPABASE_SERVICE_ROLE']);
});

test('AI checks know the AI SDK providers, OpenRouter, xAI and DeepSeek, and not the browser-side AI SDK hooks', () => {
  const stack = { clientOnly: false };
  const ids = (files) => aiChecks({ texts: new Map(Object.entries(files)), stack }).map((f) => `${f.id} ${f.file}`);
  assert.deepEqual(ids({
    'app/chat.tsx': '\'use client\';\nimport { createOpenAI } from \'@ai-sdk/openai\';',
    'app/ui.tsx': '\'use client\';\nimport { useChat } from \'@ai-sdk/react\';\nimport { DefaultChatTransport } from \'ai\';',
    'public/app.js': 'fetch("https://openrouter.ai/api/v1/chat/completions")',
    'app/api/grok/route.ts': 'export async function POST() { return fetch("https://api.x.ai/v1/chat/completions"); }',
    'app/api/ds/route.ts': 'import { deepseek } from \'@ai-sdk/deepseek\';\nexport async function POST() { await requireAuth(); }',
    'app/api/py.py': 'from xai_sdk import Client\n@app.post("/chat")\ndef chat(): pass',
  }).sort(), ['AI-01 app/chat.tsx', 'AI-01 public/app.js', 'AI-02 app/api/grok/route.ts', 'AI-02 app/api/py.py']);
});

// ---------- CLI and the workspace copy

// Fake npm first on PATH, answering `npm audit --json` with no vulnerabilities.
function fakeNpmEnv() {
  const dir = tmp();
  const json = '{"auditReportVersion":2,"vulnerabilities":{},"metadata":{}}';
  if (process.platform === 'win32') writeFileSync(path.join(dir, 'npm.cmd'), `@echo off\r\necho ${json}\r\n`);
  else {
    writeFileSync(path.join(dir, 'npm'), `#!/bin/sh\necho '${json}'\n`);
    chmodSync(path.join(dir, 'npm'), 0o755);
  }
  const PATH = `${dir}${path.delimiter}${process.env.PATH ?? process.env.Path}`;
  return { ...process.env, PATH, Path: PATH };
}

const cli = (args, env = fakeNpmEnv()) => spawnSync(process.execPath, [bin, 'preflight', ...args], { encoding: 'utf8', env });

test('CLI: exit 1 with blocking fails, 0 when clean, 2 for bad input; writes both reports', () => {
  const bad = app(true);
  const r1 = cli([bad]);
  assert.equal(r1.status, 1, r1.stderr);
  assert.match(r1.stdout, /Not ready to go live/);
  assert.match(r1.stdout, /✗ SEC-01 server\.js:6/);
  assert.ok(!r1.stdout.includes(FAKE.stripe));
  assert.ok(existsSync(path.join(bad, REPORT_JSON)) && existsSync(path.join(bad, REPORT_MD)));

  const good = app(false);
  const r2 = cli([good]);
  assert.equal(r2.status, 0, r2.stdout + r2.stderr);
  assert.equal(JSON.parse(readFileSync(path.join(good, REPORT_JSON), 'utf8')).summary.fail, 0);

  assert.equal(cli([good, '--strictness=everyone']).status, 2);
  assert.equal(cli([path.join(good, 'nope')]).status, 2);
});

test('the workspace copy runs on its own, from skills/preflight/scripts/', () => {
  const ws = tmp();
  for (const c of COPY_IN.filter((x) => x.to.startsWith('skills/preflight/'))) {
    mkdirSync(path.join(ws, ...path.posix.dirname(c.to).split('/')), { recursive: true });
    cpSync(path.join(root, ...c.from.split('/')), path.join(ws, ...c.to.split('/')));
  }
  const good = app(false);
  const r = spawnSync(process.execPath, [path.join(ws, 'skills', 'preflight', 'scripts', 'preflight.mjs'), good],
    { encoding: 'utf8', env: fakeNpmEnv() });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Nothing blocks going live/);

  // Through a linked folder, as on macOS, where the temp folder /var is a link to /private/var. A junction needs no
  // admin rights on Windows.
  const link = path.join(tmp(), 'linked');
  symlinkSync(ws, link, 'junction');
  const r2 = spawnSync(process.execPath, [path.join(link, 'skills', 'preflight', 'scripts', 'preflight.mjs'), good],
    { encoding: 'utf8', env: fakeNpmEnv() });
  assert.equal(r2.status, 0, r2.stdout + r2.stderr);
  assert.match(r2.stdout, /Nothing blocks going live/);
});

test('lib/preflight is self-contained: only node: built-ins and its own files, all copied into the workspace', () => {
  const dir = path.join(root, 'lib', 'preflight');
  const files = readdirSync(dir).filter((f) => f.endsWith('.mjs'));
  const copied = new Set(COPY_IN.filter((c) => c.from.startsWith('lib/preflight/')).map((c) => path.posix.basename(c.from)));
  assert.deepEqual([...copied].sort(), files.sort());
  for (const f of files) {
    for (const [, spec] of readFileSync(path.join(dir, f), 'utf8').matchAll(/^import .* from '([^']+)';$/gm)) {
      assert.ok(spec.startsWith('node:') || (spec.startsWith('./') && files.includes(spec.slice(2))), `${f} imports ${spec}`);
    }
  }
});
