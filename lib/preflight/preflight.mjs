#!/usr/bin/env node
// Preflight stage 1: the script, which costs no tokens. Stage 2 is the AI review in the preflight skill.
// Zero dependencies.
//
//   thinkaloud preflight [project] [--strictness=personal|small|public]
//   node skills/preflight/scripts/preflight.mjs [project] …    (inside a workspace)
//
// Writes preflight-report.json and PREFLIGHT.md into the project. Exit 0 = nothing blocks going live at this
// strictness, 1 = something does, 2 = it couldn't run.

import { existsSync, realpathSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { aiChecks } from './ai.mjs';
import { configChecks } from './config.mjs';
import { dependencyChecks, plannedAudits } from './deps.mjs';
import { exec, loadProject, onPath, REPORT_JSON, REPORT_MD, writeFileSafe } from './files.mjs';
import { acceptedRisks, buildReport, renderMarkdown, resolveStrictness, STRICTNESS } from './report.mjs';
import { clientSecrets, envExample, envInGit, secretsInFiles, secretsInHistory } from './secrets.mjs';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// `run` and `has` stand in for spawning tools and looking them up on PATH, so tests never touch the network.
export function runPreflight(dir, { strictness, run = exec, has = onPath, date = today() } = {}) {
  const project = loadProject(dir, run);
  const findings = [
    ...secretsInFiles(project),
    ...envInGit(project, run),
    ...secretsInHistory(project, run, has),
    ...clientSecrets(project),
    ...envExample(project),
    ...dependencyChecks(project, run, has),
    ...configChecks(project),
    ...aiChecks(project),
  ];
  const { node, python, frameworks, lockfiles, aiSdk } = project.stack;
  return buildReport({
    findings,
    strictness: resolveStrictness(dir, strictness),
    stack: { node, python, frameworks, lockfiles, aiSdk, git: project.git },
    project: path.basename(path.resolve(dir)),
    date,
    checked: { files: project.texts.size, history: project.git, dependencies: plannedAudits(project, has) },
    accepted: acceptedRisks(dir),
  });
}

// Returns an error message instead of throwing, so a folder we can't write to is "couldn't run" (exit 2),
// never mistaken for "blocked" (exit 1).
export function writeReports(dir, report) {
  try {
    writeFileSafe(path.join(dir, REPORT_JSON), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSafe(path.join(dir, REPORT_MD), renderMarkdown(report));
    return null;
  } catch (e) {
    return e.message;
  }
}

export const PREFLIGHT_OPTIONS = { strictness: { type: 'string' } };

// Through links (macOS's /var), and ignoring case on Windows.
function samePath(a, b) {
  const real = (p) => {
    try {
      return realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };
  const norm = (p) => (process.platform === 'win32' ? real(p).toLowerCase() : real(p));
  return norm(a) === norm(b);
}

export function preflight(values, positionals, out = process.stdout, err = process.stderr) {
  const dir = path.resolve(positionals[0] ?? '.');
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    err.write(`thinkaloud preflight: "${positionals[0]}" isn't a folder.\n`);
    return 2;
  }
  // The workspace and the home folder hold many projects, and scanning one as a single app would mix them all up.
  const not = existsSync(path.join(dir, '.thinkaloud', 'manifest.json')) ? 'your Thinkaloud workspace'
    : samePath(dir, os.homedir()) ? 'your home folder' : null;
  if (not) {
    err.write(`thinkaloud preflight: ${dir} is ${not}, not a project. Name a project: preflight projects/<name>\n`);
    return 2;
  }
  if (values.strictness && !STRICTNESS.includes(values.strictness)) {
    err.write(`thinkaloud preflight: --strictness must be one of ${STRICTNESS.join(', ')}.\n`);
    return 2;
  }
  const report = runPreflight(dir, { strictness: values.strictness });
  const failed = writeReports(dir, report);
  if (failed) {
    err.write(`thinkaloud preflight: couldn't write the report into ${dir}: ${failed}\n`);
    return 2;
  }

  const s = report.summary;
  const lines = [
    `Preflight (script) for ${report.project}: strictness ${report.strictness} (from ${report.strictnessFrom})`,
    `  ${s.fail} fail · ${s.warn} warn · ${s.info} info${s.accepted ? ` · ${s.accepted} accepted` : ''}`,
  ];
  if (report.strictnessLowered) {
    lines.push(`  ! Your profile says ${report.strictnessLowered}, so this is less strict than usual. Details in PREFLIGHT.md.`);
  }
  if (report.ignoredAcceptances.length) {
    lines.push(`  ! ${report.ignoredAcceptances.length} "Accepts:" line(s) in DECISIONS.md don't count. PREFLIGHT.md says why.`);
  }
  for (const f of report.findings.filter((x) => x.blocking)) {
    lines.push(`  ✗ ${f.id}${f.file ? ` ${f.file}${f.line ? `:${f.line}` : ''}` : ''}: ${f.what}`);
  }
  lines.push(report.ready
    ? '  Nothing blocks going live at this strictness. Next: the AI review (say "preflight" to your companion).'
    : '  Not ready to go live yet.');
  lines.push(`  Details and fixes: ${path.join(dir, REPORT_MD)}`,
    `  The reports (${REPORT_MD}, ${REPORT_JSON}) show at most 4 characters of any key. To keep them out of git, add both to .gitignore.`,
    '', report.limit, '');
  out.write(lines.join('\n'));
  return report.ready ? 0 : 1;
}

// Node resolves links in import.meta.url but not in argv[1] (macOS temp folders are under a link, /var → /private/var).
function runDirectly() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

// Run directly (the workspace copy): node preflight.mjs [project] [--strictness=…]
if (process.argv[1] && runDirectly()) {
  let parsed;
  try {
    parsed = parseArgs({ args: process.argv.slice(2), options: PREFLIGHT_OPTIONS, allowPositionals: true });
  } catch (e) {
    process.stderr.write(`preflight: ${e.message}\n`);
    process.exit(2);
  }
  // Exit 2 means "couldn't run", so an unexpected error is never read as "blocked" (1) or "clear" (0).
  try {
    process.exitCode = preflight(parsed.values, parsed.positionals);
  } catch (e) {
    process.stderr.write(`preflight: couldn't run: ${e.message}\n`);
    process.exitCode = 2;
  }
}
