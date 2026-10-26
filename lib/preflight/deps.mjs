// DEP-01 … DEP-04: known vulnerabilities in dependencies, and missing lockfiles.
// Output formats checked against each tool on 24 Sep 2026.

import { existsSync, readFileSync } from 'node:fs';
import { onPath, TIMED_OUT, timedOut, toNative } from './files.mjs';

// A warning, not info, so an audit that didn't happen is never mistaken for one that found nothing. osv-scanner
// is an optional second opinion, so its own failure stays info.
const couldnt = (id, tool, detail, severity = 'warn') => ({
  id, severity,
  what: `Couldn't run \`${tool}\`, so dependencies weren't checked for known vulnerabilities.`,
  why: detail || 'The command failed or needs a network connection.',
  fix: `Run \`${tool}\` yourself in the project folder, or run preflight again when you're online.`,
});

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function vulnFinding(id, name, severity, title, fixText) {
  const high = severity === 'critical' || severity === 'high';
  return {
    id, severity: high ? 'fail' : 'warn', file: 'package.json', ref: name,
    what: `\`${name}\` has a known ${severity}-severity vulnerability${title ? `: ${title}` : ''}.`,
    why: high
      ? 'Critical and high vulnerabilities are the ones attackers look for first, often with ready-made tools.'
      : 'Moderate ones are harder to use against you, but still worth fixing when there\'s an update.',
    fix: fixText,
  };
}

// npm 7+ `npm audit --json`: { vulnerabilities: { <name>: { severity, via, fixAvailable } }, metadata }.
function parseNpmAudit(json) {
  const out = [];
  for (const [name, v] of Object.entries(json.vulnerabilities ?? {})) {
    if (!['critical', 'high', 'moderate'].includes(v.severity)) continue;
    const via = (v.via ?? []).find((x) => typeof x === 'object');
    const fix = v.fixAvailable === false
      ? 'No fixed version yet. Check whether you can drop or replace the package, or accept the risk for now.'
      : v.fixAvailable?.isSemVerMajor
        ? `Run \`npm audit fix --force\` or update to ${v.fixAvailable.name}@${v.fixAvailable.version}. It's a major version, so test afterwards.`
        : 'Run `npm audit fix`, then run your tests.';
    out.push(vulnFinding('DEP-01', name, v.severity, via?.title, fix));
  }
  return out;
}

// pnpm and older npm: { advisories: { <id>: { module_name, severity, title, patched_versions } } }.
export function parseAdvisories(json, tool) {
  return Object.values(json.advisories ?? {})
    .filter((a) => ['critical', 'high', 'moderate'].includes(a.severity))
    .map((a) => vulnFinding('DEP-01', a.module_name, a.severity, a.title,
      a.patched_versions && a.patched_versions !== '<0.0.0'
        ? `Update \`${a.module_name}\` to ${a.patched_versions} (try \`${tool} update ${a.module_name}\`), then run your tests.`
        : 'No fixed version yet. Check whether you can drop or replace the package, or accept the risk for now.'));
}

// yarn 1 `yarn audit --json` prints one JSON object per line; the exit code is a bitmask (8 high, 16 critical).
export function parseYarnAudit(stdout, status) {
  const out = [];
  for (const line of stdout.split('\n')) {
    const j = parseJson(line);
    if (j?.type === 'auditAdvisory' && j.data?.advisory) out.push(...parseAdvisories({ advisories: { x: j.data.advisory } }, 'yarn'));
  }
  if (!out.length && status & 24) {
    out.push(vulnFinding('DEP-01', 'a dependency', status & 16 ? 'critical' : 'high', '', 'Run `yarn audit` to see which, then update it.'));
  }
  return out;
}

function nodeAudit(project, run) {
  const { lockfiles } = project.stack;
  const dedupe = (list) => [...new Map(list.map((f) => [f.what, f])).values()];
  if (lockfiles.includes('package-lock.json') || lockfiles.includes('npm-shrinkwrap.json')) {
    const r = run('npm', ['audit', '--json'], { cwd: project.dir });
    const json = timedOut(r) ? null : parseJson(r.stdout);
    if (!json || json.error) return [couldnt('DEP-01', 'npm audit', timedOut(r) ? TIMED_OUT : json?.error?.summary)];
    return dedupe(json.advisories ? parseAdvisories(json, 'npm') : parseNpmAudit(json));
  }
  if (lockfiles.includes('pnpm-lock.yaml')) {
    if (pnpmConfigDeps(project)) {
      return [couldnt('DEP-01', 'pnpm audit', 'This project has configDependencies in pnpm-workspace.yaml, which pnpm installs '
        + 'and runs before any command, so preflight doesn\'t start pnpm here.')];
    }
    // On the command line, because a project's pnpm-workspace.yaml can turn the environment switch back off.
    const r = run('pnpm', ['audit', '--json', '--config.ignore-pnpmfile=true'], { cwd: project.dir });
    const json = timedOut(r) ? null : parseJson(r.stdout);
    return json ? dedupe(parseAdvisories(json, 'pnpm')) : [couldnt('DEP-01', 'pnpm audit', timedOut(r) && TIMED_OUT)];
  }
  if (lockfiles.includes('yarn.lock')) {
    if (existsSync(toNative(project.dir, '.yarnrc.yml'))) return [couldnt('DEP-01', 'yarn npm audit', 'Yarn 2+ reports in a format preflight doesn\'t read yet.')];
    const r = run('yarn', ['audit', '--json'], { cwd: project.dir });
    if (r.error || (r.status && !r.stdout)) return [couldnt('DEP-01', 'yarn audit', timedOut(r) && TIMED_OUT)];
    return dedupe(parseYarnAudit(r.stdout, r.status ?? 0));
  }
  if (lockfiles.some((f) => f.startsWith('bun.lock'))) return [couldnt('DEP-01', 'bun audit', 'Preflight doesn\'t read Bun\'s audit format yet.')];
  return [];
}

// pnpm 10's configDependencies are packages pnpm installs, and can load hooks from, before it runs any command.
function pnpmConfigDeps(project) {
  try {
    return /^\s*configDependencies\s*:/m.test(readFileSync(toNative(project.dir, 'pnpm-workspace.yaml'), 'utf8'));
  } catch {
    return false;
  }
}

// Every line of requirements.txt names one exact version (==). Only then can pip-audit check it without
// installing anything (--no-deps --disable-pip). Option lines (-r, -e, --hash…) don't count either way.
export function requirementsPinned(project) {
  if (!project.stack.pythonFiles.includes('requirements.txt')) return false;
  const lines = readFileSync(toNative(project.dir, 'requirements.txt'), 'utf8').split(/\r?\n/)
    .map((l) => l.replace(/#.*/, '').replace(/\\$/, '').trim()).filter((l) => l && !l.startsWith('-'));
  return lines.every((l) => /==/.test(l));
}

// The audits that apply to this project, in the order dependencyChecks runs them (for the report's "Looked at" line).
export function plannedAudits(project, has = onPath) {
  const { node, python, lockfiles } = project.stack;
  const out = [];
  if (node) {
    if (lockfiles.includes('package-lock.json') || lockfiles.includes('npm-shrinkwrap.json')) out.push('npm audit');
    else if (lockfiles.includes('pnpm-lock.yaml')) {
      if (!pnpmConfigDeps(project)) out.push('pnpm audit');
    } else if (lockfiles.includes('yarn.lock') && !existsSync(toNative(project.dir, '.yarnrc.yml'))) out.push('yarn audit');
  }
  if (python && has('pip-audit') && requirementsPinned(project)) out.push('pip-audit');
  if (has('osv-scanner')) out.push('osv-scanner');
  return out;
}

// pip-audit -f json: { dependencies: [{ name, version, vulns: [{ id, fix_versions }] }] } (older: a bare list).
export function parsePipAudit(json, file) {
  const deps = Array.isArray(json) ? json : json.dependencies ?? [];
  return deps.filter((d) => d.vulns?.length).map((d) => ({
    id: 'DEP-02', severity: 'warn', file, ref: d.name,
    what: `\`${d.name}\` ${d.version} has ${d.vulns.length} known vulnerabilit${d.vulns.length === 1 ? 'y' : 'ies'} (${d.vulns.map((v) => v.id).join(', ')}).`,
    why: 'pip-audit doesn\'t rate how serious these are, so look each one up before deciding. Most have an easy fix: update.',
    fix: d.vulns.some((v) => v.fix_versions?.length)
      ? `Update to ${d.name}>=${d.vulns.flatMap((v) => v.fix_versions ?? []).sort().at(-1)} in \`${file}\`, reinstall, and run your tests.`
      : 'No fixed version yet. Check whether you can replace it, or accept the risk for now.',
  }));
}

// pip-audit's own README: "`pip-audit -r INPUT` is functionally equivalent to `pip install -r INPUT`", and auditing a
// project folder builds it. Both run code from the packages or the project. So preflight only runs the mode that
// installs nothing: an exactly pinned requirements.txt, with --no-deps --disable-pip.
function pythonAudit(project, run, has) {
  if (!project.stack.python) return [];
  const file = project.stack.pythonFiles[0];
  if (!has('pip-audit')) {
    return [{ id: 'DEP-02', severity: 'info', file,
      what: 'Python dependencies weren\'t checked: pip-audit isn\'t installed.',
      why: 'Known vulnerabilities in packages are one of the most common ways apps get broken into.',
      fix: 'Install it with `pip install pip-audit` (or `pipx install pip-audit`) and run preflight again.' }];
  }
  if (!requirementsPinned(project)) {
    return [{ id: 'DEP-02', severity: 'info', file,
      what: 'Python dependencies weren\'t checked: they aren\'t all pinned in `requirements.txt`, and checking them otherwise means installing them.',
      why: 'Installing runs the packages\' own setup code, so preflight never does it for you.',
      fix: 'Pin every line with `==` in `requirements.txt` and run preflight again. Or, inside the virtual environment '
        + 'where you already installed them, run `pip-audit` with no arguments: it checks what\'s installed there.' }];
  }
  const args = ['-r', 'requirements.txt', '--no-deps', '--disable-pip', '-f', 'json', '--progress-spinner', 'off'];
  const r = run('pip-audit', args, { cwd: project.dir });
  const json = timedOut(r) ? null : parseJson(r.stdout);
  if (!json) {
    return [couldnt('DEP-02', 'pip-audit -r requirements.txt --no-deps --disable-pip', timedOut(r) ? TIMED_OUT : r.stderr.trim().split('\n').at(-1))];
  }
  return parsePipAudit(json, 'requirements.txt');
}

// Optional: osv-scanner covers many ecosystems at once. Exit 1 = vulnerabilities found, 128 = nothing to scan.
export function parseOsv(json) {
  const out = [];
  for (const res of json.results ?? []) {
    for (const p of res.packages ?? []) {
      if (!p.vulnerabilities?.length) continue;
      out.push({
        id: 'DEP-04', severity: 'warn', ref: p.package?.name, file: String(res.source?.path ?? '').split(/[\\/]/).pop() || undefined,
        what: `osv-scanner: \`${p.package?.name}\` ${p.package?.version ?? ''} has ${p.vulnerabilities.length} known vulnerabilit${p.vulnerabilities.length === 1 ? 'y' : 'ies'} (${p.vulnerabilities.map((v) => v.id).slice(0, 3).join(', ')}).`,
        why: 'osv-scanner checks every language\'s packages against the open OSV database. Look each one up to see how serious it is.',
        fix: `Update \`${p.package?.name}\` to a fixed version, then run your tests.`,
      });
    }
  }
  return out;
}

function osv(project, run, has) {
  if (!has('osv-scanner')) return [];
  const r = run('osv-scanner', ['scan', 'source', '-r', '--format', 'json', '.'], { cwd: project.dir });
  if (r.status === 128) return [];
  const json = timedOut(r) ? null : parseJson(r.stdout);
  return json ? parseOsv(json) : [couldnt('DEP-04', 'osv-scanner scan source -r .', timedOut(r) && TIMED_OUT, 'info')];
}

// DEP-03: nothing pins the exact versions that get installed.
function lockfiles(project) {
  const { node, python, pythonFiles, lockfiles: locks } = project.stack;
  const out = [];
  if (node && !locks.some((f) => /^(package-lock|npm-shrinkwrap)\.json$|^pnpm-lock|^yarn\.lock|^bun\.lock/.test(f))) {
    out.push({ id: 'DEP-03', severity: 'warn', file: 'package.json',
      what: 'There\'s a `package.json` but no lockfile (`package-lock.json`, `pnpm-lock.yaml` or `yarn.lock`).',
      why: 'Without one, every install can pick different versions, so what you tested isn\'t what gets deployed, and the vulnerability check can\'t run.',
      fix: 'Run `npm install` and commit the `package-lock.json` it creates.' });
  }
  if (python) {
    if (!requirementsPinned(project) &&!locks.some((f) => /^(poetry|uv|pdm)\.lock$|^Pipfile\.lock$/.test(f))) {
      out.push({ id: 'DEP-03', severity: 'warn', file: pythonFiles[0],
        what: 'Python dependencies aren\'t pinned to exact versions, and there\'s no lockfile.',
        why: 'Each install can pick newer versions than the ones you tested, and they can break or bring in vulnerabilities.',
        fix: 'Pin each line with `==` (for example with `pip freeze > requirements.txt`), or use a tool with a lockfile such as uv or Poetry.' });
    }
  }
  return out;
}

export function dependencyChecks(project, run, has = onPath) {
  return [...nodeAudit(project, run), ...pythonAudit(project, run, has), ...lockfiles(project), ...osv(project, run, has)];
}
