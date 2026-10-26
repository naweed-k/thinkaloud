// SEC-01 … SEC-05: secrets in files, env files in git, secrets in history, client-exposed variables, .env.example.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CODE_EXT, ENV_EXAMPLE, ENV_FILE, onPath, outputDir, TIMED_OUT, timedOut } from './files.mjs';
import { findSecret, fingerprint, LOCALE_FILE, redact } from './patterns.mjs';

const ROTATE = 'Deleting it from the file isn\'t enough: anyone who saw the code or the git history may have it. '
  + 'Rotate it: make a new key in the provider\'s dashboard, put the new one in `.env`, and delete the old one there.';

// SEC-01: known key shapes and password literals in anything that gets committed or deployed. Translation files
// are full of `"password": "Mot de passe"`, so only key shapes count there.
export function secretsInFiles(project) {
  const findings = [];
  for (const [rel, text] of project.texts) {
    if (ENV_FILE.test(rel) && !project.committable.has(rel)) continue;
    const literals = !LOCALE_FILE.test(rel);
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const hit = findSecret(line, { literals });
      if (!hit) return;
      const deployed = !project.committable.has(rel);
      findings.push({
        id: 'SEC-01',
        severity: hit.severity,
        file: rel,
        line: i + 1,
        ref: fingerprint(hit.match),
        what: `A ${hit.name} is written in ${deployed ? 'the build output' : 'the code'}: ${redact(hit.match)}`,
        why: 'Anyone who can see the code, the repo or the deployed files can copy it and use it as you: '
          + 'run up your bill, read your data, or act for your users.',
        fix: 'Move it to `.env` (which git ignores), read it from the environment in server-side code, and list '
          + 'its name (not its value) in `.env.example`. If it was ever committed or deployed, rotate it too.',
      });
    });
  }
  return findings;
}

function ignoredByGit(project, rel, run) {
  return run('git', ['check-ignore', '-q', '--', rel], { cwd: project.dir }).status === 0;
}

// SEC-02: .env files git tracks, or would pick up, and ones inside a deploy folder.
export function envInGit(project, run) {
  const findings = [];
  const envs = [...project.env.keys()].filter((rel) => !ENV_EXAMPLE.test(rel));
  for (const rel of envs.filter(outputDir)) {
    findings.push({
      id: 'SEC-02', severity: 'fail', file: rel,
      what: `\`${rel}\` is inside the deploy folder \`${outputDir(rel)}\`.`,
      why: 'Everything in that folder is uploaded, so anyone can download this file from the live site and read every secret in it.',
      fix: 'Delete it from the output folder and make sure the build doesn\'t copy it there (keep `.env` files out of '
        + '`public/`). If it was ever deployed, rotate every key that was in it.',
    });
  }
  if (!project.git) {
    if (envs.length) {
      findings.push({
        id: 'SEC-02', severity: 'warn', file: envs[0],
        what: 'This project isn\'t a git repository, so preflight couldn\'t check that `.env` stays out of it.',
        why: 'Once you use git, a `.env` without a `.gitignore` rule gets committed with everything else.',
        fix: 'Run `git init`, then add `.env*` and `!.env.example` to `.gitignore` before the first commit.',
      });
    }
    return findings;
  }
  for (const rel of envs) {
    const tracked = run('git', ['ls-files', '--error-unmatch', '--', rel], { cwd: project.dir }).status === 0;
    if (tracked) {
      findings.push({
        id: 'SEC-02', severity: 'fail', file: rel,
        what: `\`${rel}\` is committed to git.`,
        why: 'Whoever can see the repo can read every secret in it, now and in every past commit.',
        fix: `Run \`git rm --cached ${rel}\`, add \`.env*\` and \`!.env.example\` to \`.gitignore\`, commit, and rotate `
          + 'every key that was in it.',
      });
    } else if (!ignoredByGit(project, rel, run)) {
      findings.push({
        id: 'SEC-02', severity: 'fail', file: rel,
        what: `\`${rel}\` isn't in \`.gitignore\`, so the next \`git add .\` will commit it.`,
        why: 'Committed secrets are readable by anyone with the repo and stay in its history.',
        fix: 'Add `.env*` and `!.env.example` to `.gitignore`.',
      });
    }
  }
  return findings;
}

// SEC-03: secrets anywhere in git history. Uses gitleaks if it's installed, otherwise our own scan.
const HISTORY_CAP_BYTES = 20 * 1024 * 1024;

export function secretsInHistory(project, run, has = onPath) {
  if (!project.git) return [];
  if (has('gitleaks')) {
    const found = gitleaksScan(project, run);
    if (found) return found;
  }
  const r = run('git', ['log', '-p', '--all', '--no-color', '--no-ext-diff', '--no-textconv', '-U0', '--format=commit %H'],
    { cwd: project.dir, maxBuffer: HISTORY_CAP_BYTES });
  const findings = [];
  if (r.status !== 0 && !r.stdout) {
    if (/does not have any commits/.test(r.stderr)) return [];
    return [{ id: 'SEC-03', severity: 'info', what: 'Couldn\'t read the git history.',
      why: timedOut(r) ? TIMED_OUT : r.stderr.trim().split('\n')[0] || 'git failed.',
      fix: 'Run `git log -p` yourself and look for keys, or install gitleaks and run preflight again.' }];
  }
  if (timedOut(r)) {
    findings.push({ id: 'SEC-03', severity: 'info', what: 'Reading the git history took longer than 2 minutes, so only part of it was checked.',
      why: 'Older commits can still hold secrets.', fix: 'Install gitleaks (https://github.com/gitleaks/gitleaks) and run preflight again for a full scan.' });
  } else if (r.error?.code === 'ENOBUFS' || r.stdout.length >= HISTORY_CAP_BYTES) {
    findings.push({ id: 'SEC-03', severity: 'info', what: 'The git history is large, so only the newest 20 MB of it was checked.',
      why: 'Older commits can still hold secrets.', fix: 'Install gitleaks (https://github.com/gitleaks/gitleaks) and run preflight again for a full scan.' });
  }
  const current = new Set();
  for (const text of project.texts.values()) for (const line of text.split('\n')) {
    const hit = findSecret(line);
    if (hit) current.add(hit.match);
  }
  const seen = new Map();
  let commit = '';
  let file = '';
  for (const line of r.stdout.split('\n')) {
    if (line.startsWith('commit ')) commit = line.slice(7, 14);
    else if (line.startsWith('+++ ')) file = line.slice(4).replace(/^b\//, '');
    else if (line.startsWith('+') && !line.startsWith('+++')) {
      const hit = findSecret(line.slice(1));
      // Oldest commit last in the log, so keep overwriting to report where it first appeared.
      if (hit && !current.has(hit.match)) seen.set(hit.match, { ...hit, commit, file });
    }
  }
  for (const hit of seen.values()) {
    findings.push({
      id: 'SEC-03', severity: hit.severity, file: hit.file, ref: fingerprint(hit.match),
      what: `A ${hit.name} is in the git history (commit ${hit.commit}), even though it's gone from the current files: ${redact(hit.match)}`,
      why: 'Git keeps every version. Anyone who gets the repo can check out the old commit and read the key.',
      fix: ROTATE,
    });
  }
  return findings;
}

function gitleaksScan(project, run) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'thinkaloud-gitleaks-'));
  const out = path.join(tmp, 'report.json');
  try {
    const r = run('gitleaks', ['git', '--no-banner', '--redact', '--exit-code', '0', '--log-level', 'error',
      '--report-format', 'json', '--report-path', out, project.dir], { cwd: project.dir });
    if (r.status !== 0) return null;
    const leaks = JSON.parse(readFileSync(out, 'utf8'));
    const seen = new Map();
    for (const l of leaks) seen.set(`${l.RuleID} ${l.File}`, l);
    return [...seen.values()].map((l) => ({
      id: 'SEC-03', severity: 'fail', file: l.File, line: l.StartLine, ref: fingerprint(l.Fingerprint ?? `${l.Commit}:${l.File}:${l.RuleID}`),
      what: `gitleaks found a secret (${l.RuleID}) in the git history, commit ${String(l.Commit).slice(0, 7)}.`,
      why: 'Git keeps every version. Anyone who gets the repo can check out that commit and read it.',
      fix: ROTATE,
    }));
  } catch {
    return null;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// SEC-04: variables the build puts in the browser, with names or values that look secret.
// Next.js, Vite, Create React App, Expo, Nuxt, Gatsby, and SvelteKit and Astro (plain PUBLIC_). The longer names
// come first, so NEXT_PUBLIC_X is reported whole.
export const CLIENT_PREFIXES = ['NEXT_PUBLIC_', 'NUXT_PUBLIC_', 'EXPO_PUBLIC_', 'VITE_', 'REACT_APP_', 'GATSBY_', 'PUBLIC_'];
const PREFIX = `(?:${CLIENT_PREFIXES.map((p) => p.slice(0, -1)).join('|')})_[A-Z0-9_]+`;
const CLIENT_PREFIX = new RegExp(`\\b(${PREFIX})`, 'g');
const CLIENT_ENV_LINE = new RegExp(`^\\s*(?:export\\s+)?(${PREFIX})\\s*=\\s*['"]?([^'"#\\s]*)`);
const SECRET_NAME = /SECRET|PRIVATE|SERVICE_ROLE|API_KEY/;

export function clientSecrets(project) {
  const byName = new Map();
  const note = (name, rel, line, value) => {
    const prev = byName.get(name);
    const bad = value && findSecret(`${name}=${value}`);
    if (!prev || (bad && !prev.bad)) byName.set(name, { rel, line, bad });
  };
  for (const [rel, text] of project.env) {
    text.split('\n').forEach((l, i) => {
      const m = l.match(CLIENT_ENV_LINE);
      if (m) note(m[1], rel, i + 1, m[2]);
    });
  }
  for (const [rel, text] of project.texts) {
    if (!CODE_EXT.test(rel)) continue;
    text.split('\n').forEach((l, i) => {
      for (const m of l.matchAll(CLIENT_PREFIX)) if (!byName.has(m[1])) note(m[1], rel, i + 1, null);
    });
  }
  const findings = [];
  for (const [name, { rel, line, bad }] of byName) {
    if (bad) {
      findings.push({
        id: 'SEC-04', severity: 'fail', file: rel, line, ref: fingerprint(bad.match),
        what: `\`${name}\` holds what looks like a ${bad.name}, and its prefix puts it in the browser.`,
        why: `Variables starting with ${CLIENT_PREFIXES.slice(0, -1).join(', ')} or ${CLIENT_PREFIXES.at(-1)} are copied into the `
          + 'JavaScript every visitor downloads. Anyone can open the browser tools and read it.',
        fix: 'Rename it without the prefix, use it only in server-side code (an API route or backend), and rotate the key.',
      });
    } else if (SECRET_NAME.test(name)) {
      findings.push({
        id: 'SEC-04', severity: 'warn', file: rel, line,
        what: `\`${name}\` sounds secret, but its prefix puts it in the browser.`,
        why: 'Everything with this prefix is readable by visitors. Some keys are meant to be public (Firebase\'s web '
          + 'API key, Supabase\'s anon key); secret keys and service-role keys never are.',
        fix: 'Check the provider\'s docs. If it\'s secret, drop the prefix and use it only in server-side code.',
      });
    }
  }
  return findings;
}

// SEC-05: code reads environment variables but there's no .env.example to say which.
export function envExample(project) {
  if (!project.stack.readsEnv) return [];
  const hasExample = [...project.committable].some((rel) => /(^|\/)\.env\.(example|sample|template)$/.test(rel));
  if (hasExample) return [];
  return [{
    id: 'SEC-05', severity: 'warn', file: '.env.example',
    what: 'The code reads environment variables, but there\'s no `.env.example`.',
    why: 'Without it, you (or whoever runs this next) won\'t know which secrets to set, and it\'s tempting to hard-code them.',
    fix: 'Create `.env.example` with every variable name and a placeholder value, like `OPENAI_API_KEY=your-key-here`, and commit it.',
  }];
}
